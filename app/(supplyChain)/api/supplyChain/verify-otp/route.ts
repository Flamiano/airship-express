import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { createLoginChallenge } from '../../../lib/services/concurrentLoginService';

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

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

const roleRedirects: Record<string, string> = {
    'Superadmin': '/executive',
    'Executive': '/executive',
    'Admin': '/inventory',
    'Purchase Officer': '/purchase-orders',
    'Operator': '/warehousing',
    'Supplier': '/suppliers_page/purchase-orders',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            userId,
            otp,
            email,
        } = body;

        if (!otp || !/^\d{6}$/.test(otp)) {
            return NextResponse.json(
                { message: 'OTP must be a 6-digit code' },
                { status: 400 }
            );
        }

        const normalizedEmail = (email || '').trim().toLowerCase();
        const hashedInputOTP = hashOTP(otp);

        // 1. Find the latest valid OTP code for this email or userId
        let otpQuery = supabaseAdmin
            .from('otp_codes')
            .select('*')
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (normalizedEmail && userId) {
            otpQuery = otpQuery.or(`user_id.eq.${userId},email.ilike.${normalizedEmail}`);
        } else if (normalizedEmail) {
            otpQuery = otpQuery.ilike('email', normalizedEmail);
        } else if (userId) {
            otpQuery = otpQuery.eq('user_id', userId);
        }

        const { data: otpRecords, error: otpError } = await otpQuery;

        if (otpError || !otpRecords || otpRecords.length === 0) {
            // Check if OTP was already used
            let usedQuery = supabaseAdmin
                .from('otp_codes')
                .select('*')
                .eq('code_hash', hashedInputOTP)
                .not('used_at', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1);

            if (normalizedEmail) {
                usedQuery = usedQuery.ilike('email', normalizedEmail);
            }

            const { data: matchingUsed } = await usedQuery;
            if (matchingUsed && matchingUsed.length > 0) {
                return NextResponse.json(
                    {
                        used: true,
                        message: 'This security code has already been used. Please request a new code if needed.'
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { message: 'Invalid or expired security code. Please click Resend Code.' },
                { status: 400 }
            );
        }

        const otpRecord = otpRecords[0];

        if ((otpRecord.attempts || 0) >= 5) {
            return NextResponse.json(
                { message: 'Too many failed attempts. Please request a new verification code.' },
                { status: 400 }
            );
        }

        // Validate hash
        if (otpRecord.code_hash !== hashedInputOTP) {
            await supabaseAdmin
                .from('otp_codes')
                .update({ attempts: (otpRecord.attempts || 0) + 1 })
                .eq('id', otpRecord.id);

            const remaining = 5 - ((otpRecord.attempts || 0) + 1);
            return NextResponse.json(
                { message: `Invalid security code. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` },
                { status: 400 }
            );
        }

        // Mark OTP as used
        await supabaseAdmin
            .from('otp_codes')
            .update({ used_at: new Date().toISOString() })
            .eq('id', otpRecord.id);

        // 2. Fetch authenticated user from users table
        let userQuery = supabaseAdmin.from('users').select('*');
        if (userId) {
            userQuery = userQuery.eq('id', userId);
        } else if (normalizedEmail) {
            userQuery = userQuery.ilike('email', normalizedEmail);
        }

        const { data: existingUser, error: userFetchError } = await userQuery.maybeSingle();

        if (userFetchError || !existingUser) {
            return NextResponse.json(
                { message: 'User record not found in system directory.' },
                { status: 404 }
            );
        }

        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';

        let effectiveRole = existingUser.role || 'Admin';
        const normEffectiveRole = effectiveRole.toLowerCase().trim();
        if (normEffectiveRole === 'superadmin' || normEffectiveRole === 'super_admin' || normEffectiveRole === 'executive') {
            effectiveRole = 'Executive';
        } else if (normEffectiveRole === 'supplier') {
            effectiveRole = 'Supplier';
        }

        // Only Supplier role is allowed to use Remember Me (15 days); all other roles are strictly disallowed (24h max)
        const isSupplier = normEffectiveRole === 'supplier';
        const isRememberAllowed = isSupplier && Boolean(body.rememberMe);

        const sessionToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
        const expiresAtRemember = isRememberAllowed
            ? new Date(Date.now() + 15 * 24 * 3600000).toISOString()
            : expiresAt;

        // Check if user already has an active session on another device/browser
        const { data: existingActiveSessions } = await supabaseAdmin
            .from('sessions')
            .select('id, user_agent, ip_address, session_token, expires_at')
            .eq('user_id', existingUser.id)
            .eq('is_active', true);

        const now = new Date();
        const currentActive = (existingActiveSessions || []).find(
            s => !s.expires_at || new Date(s.expires_at) > now
        );

        const redirectPath = roleRedirects[effectiveRole] || (effectiveRole === 'Executive' ? '/executive' : (effectiveRole === 'Supplier' ? '/suppliers_page/purchase-orders' : '/inventory'));

        if (currentActive) {
            // Another device is currently active! Create challenge and wait for active session approval
            const challenge = await createLoginChallenge({
                userId: existingUser.id,
                email: existingUser.email,
                displayName: existingUser.display_name || existingUser.name || (isSupplier ? 'Supplier' : 'Admin User'),
                role: effectiveRole,
                newDeviceUserAgent: userAgent,
                newDeviceIp: ipAddress,
                sessionPayload: {
                    sessionToken,
                    expiresAt: isRememberAllowed ? expiresAtRemember : expiresAt,
                    rememberMe: isRememberAllowed,
                    redirectUrl: redirectPath,
                }
            });

            return NextResponse.json({
                verified: true,
                requireApproval: true,
                requestId: challenge.requestId,
                message: 'An active session was detected on another device. Waiting for approval...',
                user: {
                    id: existingUser.id,
                    email: existingUser.email,
                    display_name: existingUser.display_name || existingUser.name || (isSupplier ? 'Supplier' : 'User'),
                    role: effectiveRole,
                }
            });
        }

        // Deactivate existing active sessions
        await supabaseAdmin
            .from('sessions')
            .update({ is_active: false, in_queue: false, updated_at: new Date().toISOString() })
            .eq('user_id', existingUser.id)
            .eq('is_active', true);

        // Upsert active session
        const { error: sessionError } = await supabaseAdmin
            .from('sessions')
            .upsert({
                user_id: existingUser.id,
                session_token: sessionToken,
                expires_at: expiresAt,
                expires_at_remember: expiresAtRemember,
                email: existingUser.email,
                hr_employee_name: existingUser.display_name || existingUser.name || (isSupplier ? 'Supplier' : 'Admin User'),
                is_active: true,
                in_queue: false,
                remember_me: isRememberAllowed,
                user_agent: userAgent,
                ip_address: ipAddress,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });

        if (sessionError) {
            console.error('Session update error after OTP:', sessionError);
            return NextResponse.json(
                { message: 'Failed to establish session after OTP verification.' },
                { status: 500 }
            );
        }

        // Log OTP Login Success
        await supabaseAdmin
            .from('user_activity')
            .insert({
                user_id: existingUser.id,
                action: 'MFA_LOGIN_SUCCESS',
                module: 'Authentication',
                description: `${effectiveRole} ${existingUser.email} logged in successfully via 2FA OTP verification.`,
                ip_address: ipAddress,
                user_agent: userAgent,
            });

        return NextResponse.json({
            verified: true,
            userExists: true,
            userId: existingUser.id,
            session_token: sessionToken,
            redirect_url: redirectPath,
            role: effectiveRole,
            remember_me: isRememberAllowed,
            expires_at: expiresAt,
            user: {
                id: existingUser.id,
                email: existingUser.email,
                display_name: existingUser.display_name || existingUser.name || (isSupplier ? 'Supplier' : 'User'),
                role: effectiveRole,
            },
            employee: {
                id: existingUser.id,
                email: existingUser.email,
                display_name: existingUser.display_name || existingUser.name || (isSupplier ? 'Supplier' : 'User'),
                role: effectiveRole,
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        return NextResponse.json(
            { message: 'Failed to verify OTP. Please try again.' },
            { status: 500 }
        );
    }
}