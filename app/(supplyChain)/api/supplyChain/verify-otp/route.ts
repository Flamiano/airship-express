import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

function generateTemporaryToken(): string {
    return randomBytes(16).toString('hex');
}

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: Request) {
    try {
        const {
            userId,
            otp,
            targetUserId,
            rememberMe,
            email,
            employeeName,
            employeeRole
        } = await request.json();

        if (!/^\d{6}$/.test(otp)) {
            return NextResponse.json(
                { message: 'OTP must be 6 digits' },
                { status: 400 }
            );
        }

        const hashedInputOTP = hashOTP(otp);

        // get latest valid otp by user_id or email
        let otpQuery = supabase
            .from('otp_codes')
            .select('*')
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (email && userId) {
            otpQuery = otpQuery.or(`user_id.eq.${userId},email.eq.${email}`);
        } else if (email) {
            otpQuery = otpQuery.eq('email', email);
        } else {
            otpQuery = otpQuery.eq('user_id', userId);
        }

        const { data: otpRecords, error: otpError } = await otpQuery;

        if (otpError || !otpRecords || otpRecords.length === 0) {
            // check if the specific inputted OTP was issued and is now expired
            let expiredQuery = supabase
                .from('otp_codes')
                .select('*')
                .eq('code_hash', hashedInputOTP)
                .order('created_at', { ascending: false })
                .limit(1);

            if (email && userId) {
                expiredQuery = expiredQuery.or(`user_id.eq.${userId},email.eq.${email}`);
            } else if (email) {
                expiredQuery = expiredQuery.eq('email', email);
            } else {
                expiredQuery = expiredQuery.eq('user_id', userId);
            }

            const { data: matchingExpired } = await expiredQuery;

            if (matchingExpired && matchingExpired.length > 0) {
                return NextResponse.json(
                    {
                        expired: true,
                        message: 'The inputted OTP is already expired. Please click Resend Code for a new OTP.'
                    },
                    { status: 400 }
                );
            }

            // check if any recent unused OTP is expired
            let recentQuery = supabase
                .from('otp_codes')
                .select('*')
                .is('used_at', null)
                .order('created_at', { ascending: false })
                .limit(1);

            if (email && userId) {
                recentQuery = recentQuery.or(`user_id.eq.${userId},email.eq.${email}`);
            } else if (email) {
                recentQuery = recentQuery.or(`email.eq.${email}`);
            } else {
                recentQuery = recentQuery.eq('user_id', userId);
            }

            const { data: recentRecords } = await recentQuery;

            if (recentRecords && recentRecords.length > 0) {
                const latest = recentRecords[0];
                if (new Date(latest.expires_at) < new Date()) {
                    return NextResponse.json(
                        {
                            expired: true,
                            message: 'The inputted OTP is already expired (5-minute limit reached). Please click Resend Code.'
                        },
                        { status: 400 }
                    );
                }
            }

            return NextResponse.json(
                { message: 'Invalid or expired OTP. Please request a new code.' },
                { status: 400 }
            );
        }

        const otpRecord = otpRecords[0];

        if (otpRecord.attempts >= 5) {
            return NextResponse.json(
                { message: 'Too many failed attempts' },
                { status: 400 }
            );
        }

        const isValid = otpRecord.code_hash === hashedInputOTP;

        if (!isValid) {
            await supabase
                .from('otp_codes')
                .update({ attempts: (otpRecord.attempts || 0) + 1 })
                .eq('id', otpRecord.id);

            return NextResponse.json(
                { message: 'Invalid OTP code' },
                { status: 400 }
            );
        }

        // mark otp as used
        await supabase
            .from('otp_codes')
            .update({ used_at: new Date().toISOString() })
            .eq('id', otpRecord.id);

        // check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, email, role, display_name, position, department')
            .eq('email', email)
            .maybeSingle();

        // get hr data from mock_employees table for password check
        const { data: hrData } = await supabase
            .from('mock_employees')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        // get client info
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';

        // determine session expiry
        const expiresAt = rememberMe
            ? new Date(Date.now() + 15 * 24 * 3600000)
            : new Date(Date.now() + 8 * 3600000);

        if (existingUser) {
            // resolve and synchronize accurate role and position in users table
            const userPosition = (hrData?.position || existingUser.position || '').trim();
            let effectiveRole = existingUser.role;

            if (userPosition && effectiveRole !== 'Admin' && effectiveRole !== 'Executive') {
                const p = userPosition.toUpperCase().replace(/\s+/g, ' ');
                if (
                    p === 'OFFICE-IN-CHARGE' ||
                    p === 'OFFICE IN CHARGE' ||
                    p === 'PROJECT COORDINATOR' ||
                    p === 'ADMIN ASSISTANT' ||
                    p === 'MANAGER'
                ) {
                    effectiveRole = 'Manager';
                } else if (p === 'APPRAISER' || p === 'OPERATOR') {
                    effectiveRole = 'Operator';
                } else {
                    effectiveRole = 'Staff';
                }
            } else if (employeeRole && ['Admin', 'Executive', 'Manager', 'Operator', 'Staff', 'Employee'].includes(employeeRole)) {
                effectiveRole = employeeRole === 'Employee' ? 'Staff' : employeeRole;
            }

            try {
                await supabase
                    .from('users')
                    .update({
                        role: effectiveRole,
                        position: userPosition || null,
                        department: hrData?.department || existingUser.department || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingUser.id);
                (existingUser as any).role = effectiveRole;
                (existingUser as any).position = userPosition || null;
            } catch (updateRoleErr) {
                console.error('Error synchronizing user role and position:', updateRoleErr);
            }

            // Tiered Concurrency Slot Rate Limiter
            const { data: settingsRow } = await supabaseAdmin
                .from('sc_system_settings')
                .select('concurrency_slots')
                .eq('id', 'default_settings')
                .maybeSingle();

            const slots = settingsRow?.concurrency_slots || {
                executiveSlots: 10,
                managerSlots: 20,
                employeeSlots: 70,
            };

            const executiveSlots = slots.executiveSlots ?? 10;
            const managerSlots = slots.managerSlots ?? 20;
            const employeeSlots = slots.employeeSlots ?? 70;
            const totalCapacity = executiveSlots + managerSlots + employeeSlots;

            // Fetch active sessions via supabaseAdmin
            const { data: activeSessions } = await supabaseAdmin
                .from('sessions')
                .select('id, user_id, is_active, in_queue')
                .eq('is_active', true);

            // Exclude current user's existing session if re-authenticating
            const activeList = (activeSessions || []).filter(s => s.user_id !== existingUser.id);
            const userIds = activeList.map(s => s.user_id).filter(Boolean);

            const userRolesMap: Record<string, string> = {};
            if (userIds.length > 0) {
                const { data: usersData } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .in('id', userIds);

                (usersData || []).forEach(u => {
                    userRolesMap[u.id] = (u.role || 'Employee').toLowerCase();
                });
            }

            const totalActive = activeList.length;

            let activeExecAdmin = 0;
            let activeManager = 0;
            let activeEmployee = 0;

            activeList.forEach((s) => {
                const r = userRolesMap[s.user_id] || 'employee';
                if (r === 'executive' || r === 'admin') activeExecAdmin++;
                else if (r === 'manager') activeManager++;
                else activeEmployee++;
            });

            const normEffectiveRole = effectiveRole.toLowerCase();
            let isAdmitted = false;
            let tierName = 'Employee';
            let tierSlots = employeeSlots;
            let tierActive = activeEmployee;

            if (normEffectiveRole === 'executive' || normEffectiveRole === 'admin') {
                tierName = 'Executive/Admin';
                tierSlots = executiveSlots;
                tierActive = activeExecAdmin;
                isAdmitted = activeExecAdmin < executiveSlots;
            } else if (normEffectiveRole === 'manager') {
                tierName = 'Manager';
                tierSlots = managerSlots;
                tierActive = activeManager;
                isAdmitted = activeManager < managerSlots;
            } else {
                tierName = 'Employee';
                tierSlots = employeeSlots;
                tierActive = activeEmployee;
                isAdmitted = activeEmployee < employeeSlots;
            }

            if (!isAdmitted) {
                // Record queued presence in sessions table
                await supabaseAdmin
                    .from('sessions')
                    .upsert({
                        user_id: existingUser.id,
                        session_token: randomBytes(32).toString('hex'),
                        expires_at: expiresAt.toISOString(),
                        email: email,
                        hr_employee_name: existingUser.display_name,
                        is_active: false,
                        in_queue: true,
                        remember_me: rememberMe || false,
                        user_agent: userAgent,
                        ip_address: ipAddress,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'email' });

                const { count: inQueueCount } = await supabaseAdmin
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .eq('in_queue', true);

                return NextResponse.json(
                    {
                        queued: true,
                        position: inQueueCount || 1,
                        activeUsers: totalActive,
                        maxCapacity: totalCapacity,
                        tierName,
                        tierActive,
                        tierSlots,
                        message: `The ${tierName} tier (${tierActive}/${tierSlots} slots occupied) is currently at capacity. You have been placed in the waiting queue.`
                    },
                    { status: 429 }
                );
            }

            const sessionToken = randomBytes(32).toString('hex');

            // deactivate existing sessions
            await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', existingUser.id)
                .eq('is_active', true);

            const { data: existingSession } = await supabaseAdmin
                .from('sessions')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingSession) {
                const { error: updateError } = await supabaseAdmin
                    .from('sessions')
                    .update({
                        session_token: sessionToken,
                        expires_at: expiresAt.toISOString(),
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        is_active: true,
                        in_queue: false,
                        remember_me: rememberMe || false,
                        hr_employee_name: existingUser.display_name,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingSession.id);

                if (updateError) {
                    return NextResponse.json(
                        { message: 'Failed to update session' },
                        { status: 500 }
                    );
                }

            } else {
                const { error: insertError } = await supabaseAdmin
                    .from('sessions')
                    .insert({
                        user_id: existingUser.id,
                        session_token: sessionToken,
                        expires_at: expiresAt.toISOString(),
                        email: email,
                        hr_employee_name: existingUser.display_name,
                        is_active: true,
                        in_queue: false,
                        remember_me: rememberMe || false,
                        user_agent: userAgent,
                        ip_address: ipAddress,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) {
                    return NextResponse.json(
                        { message: 'Failed to create session' },
                        { status: 500 }
                    );
                }

            }

            const roleRedirects: Record<string, string> = {
                'Admin': '/procurement',
                'Manager': '/warehousing?tab=incoming',
                'Staff': '/documents',
                'Employee': '/documents',
                'Operator': '/warehousing?tab=incoming',
                'Executive': '/executive'
            };

            return NextResponse.json({
                verified: true,
                userExists: true,
                userId: existingUser.id,
                session_token: sessionToken,
                redirect_url: roleRedirects[existingUser.role] || '/documents',
                role: existingUser.role,
                employee: {
                    email: email,
                    display_name: existingUser.display_name,
                    role: existingUser.role
                }
            });
        } else {
            // user doesn't exist - return temp token for password setup
            const tempToken = generateTemporaryToken();

            let effectiveRole = employeeRole || 'Staff';
            if (hrData) {
                const rawPos = (hrData.position || '').trim().toUpperCase().replace(/\s+/g, ' ');
                const rawRole = (hrData.role || '').trim();
                if (/manager|office-in-charge|project coordinator|admin assistant/i.test(rawPos) || /manager/i.test(rawRole)) effectiveRole = 'Manager';
                else if (/appraiser|operator/i.test(rawPos) || /operator/i.test(rawRole)) effectiveRole = 'Operator';
                else if (rawRole) effectiveRole = rawRole === 'Employee' ? 'Staff' : rawRole;
                else effectiveRole = 'Staff';
            }

            return NextResponse.json({
                verified: true,
                userExists: false,
                tempToken: tempToken,
                hrHasPassword: !!hrData?.password_hash,
                hrPassword: hrData?.password_hash || null,
                employee: {
                    id: targetUserId,
                    email: email,
                    display_name: employeeName || 'User',
                    role: effectiveRole,
                    employee_id: hrData?.employee_id || null,
                    department: hrData?.department || null,
                    position: hrData?.position || null,
                }
            });
        }
    } catch (error) {
        return NextResponse.json(
            { message: 'Failed to verify OTP' },
            { status: 500 }
        );
    }
}