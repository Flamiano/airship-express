// app/(supplyChain)/api/supplyChain/verify-otp/route.ts

import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

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
            .select('id, email, role, display_name')
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
            // resolve and synchronize accurate role in users table
            let effectiveRole = existingUser.role;
            if (employeeRole && ['Admin', 'Executive', 'Manager', 'Operator', 'Employee'].includes(employeeRole)) {
                effectiveRole = employeeRole;
            } else if (hrData) {
                const rawRole = (hrData.role || hrData.position || '').trim();
                if (/manager/i.test(rawRole)) effectiveRole = 'Manager';
                else if (/operator/i.test(rawRole)) effectiveRole = 'Operator';
                else if (hrData.role) effectiveRole = hrData.role;
            }

            if (effectiveRole && effectiveRole !== existingUser.role) {
                try {
                    await supabase
                        .from('users')
                        .update({ role: effectiveRole, updated_at: new Date().toISOString() })
                        .eq('id', existingUser.id);
                    existingUser.role = effectiveRole;
                } catch (updateRoleErr) {
                    console.error('Error synchronizing user role:', updateRoleErr);
                }
            }

            const sessionToken = randomBytes(32).toString('hex');

            // deactivate existing sessions
            await supabase
                .from('sessions')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', existingUser.id)
                .eq('is_active', true);

            const { data: existingSession } = await supabase
                .from('sessions')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingSession) {
                const { error: updateError } = await supabase
                    .from('sessions')
                    .update({
                        session_token: sessionToken,
                        expires_at: expiresAt.toISOString(),
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        is_active: true,
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
                const { error: insertError } = await supabase
                    .from('sessions')
                    .insert({
                        user_id: existingUser.id,
                        session_token: sessionToken,
                        expires_at: expiresAt.toISOString(),
                        email: email,
                        hr_employee_name: existingUser.display_name,
                        is_active: true,
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

            let effectiveRole = employeeRole || 'Employee';
            if (hrData) {
                const rawRole = (hrData.role || hrData.position || '').trim();
                if (/manager/i.test(rawRole)) effectiveRole = 'Manager';
                else if (/operator/i.test(rawRole)) effectiveRole = 'Operator';
                else if (hrData.role) effectiveRole = hrData.role;
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