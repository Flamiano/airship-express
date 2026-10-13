import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    supabaseAdmin,
    validateExecutiveSession,
    signExecutiveVerificationToken,
    checkVerificationRateLimit,
    recordFailedVerification,
    resetVerificationRateLimit,
} from '../authHelper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || 
                 process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                 process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
    try {
        // 1. Verify user session and Executive authorization
        const authResult = await validateExecutiveSession(req);
        if (authResult.errorResponse) {
            return NextResponse.json(
                { success: false, error: authResult.errorResponse.error },
                { status: authResult.errorResponse.status }
            );
        }

        const { user } = authResult.auth!;
        const rateLimitKey = user.id || user.email;

        // 2. Check rate limit
        const rateCheck = checkVerificationRateLimit(rateLimitKey);
        if (rateCheck.locked) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many failed verification attempts. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
                    locked: true,
                    retryAfter: rateCheck.remainingSeconds,
                },
                { status: 429 }
            );
        }

        // 3. Parse and validate password
        const body = await req.json().catch(() => ({}));
        const { password } = body;

        if (!password || typeof password !== 'string' || !password.trim()) {
            return NextResponse.json(
                { success: false, error: 'Password is required to access confidential reports.' },
                { status: 400 }
            );
        }

        // 4. Verify password without disrupting active session
        let isPasswordValid = false;

        // Attempt A: Supabase Auth with non-persisting client
        try {
            const isolatedAuthClient = createClient(supabaseUrl, anonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            const { data: authData, error: authErr } = await isolatedAuthClient.auth.signInWithPassword({
                email: user.email,
                password: password.trim(),
            });

            if (!authErr && authData?.user) {
                isPasswordValid = true;
            }
        } catch {
            // Proceed to fallback
        }

        // Attempt B: Fallback check against stored hash or password in users table
        if (!isPasswordValid) {
            const { data: dbUser } = await supabaseAdmin
                .from('users')
                .select('password_hash')
                .eq('id', user.id)
                .maybeSingle();

            if (dbUser?.password_hash && dbUser.password_hash === password.trim()) {
                isPasswordValid = true;
            }
        }

        // 5. If verification failed, record rate limit and log audit
        if (!isPasswordValid) {
            const failedRecord = recordFailedVerification(rateLimitKey);

            // Audit log attempt
            try {
                await supabaseAdmin.from('user_activity').insert({
                    user_id: user.id,
                    action: 'EXECUTIVE_REPORT_VERIFY_FAILED',
                    details: {
                        email: user.email,
                        role: user.role,
                        attempts_remaining: failedRecord.attemptsRemaining,
                        timestamp: new Date().toISOString(),
                    },
                    created_at: new Date().toISOString(),
                });
            } catch {
                // Silently ignore audit log insertion error
            }

            if (failedRecord.locked) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Maximum attempts exceeded. Verification locked for ${failedRecord.remainingSeconds} seconds.`,
                        locked: true,
                        retryAfter: failedRecord.remainingSeconds,
                    },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    error: `Incorrect Executive password. (${failedRecord.attemptsRemaining} attempt${failedRecord.attemptsRemaining === 1 ? '' : 's'} remaining)`,
                    attemptsRemaining: failedRecord.attemptsRemaining,
                },
                { status: 401 }
            );
        }

        // 6. Verification succeeded: reset rate limit and issue short-lived signed token (15 mins)
        resetVerificationRateLimit(rateLimitKey);
        const { token, expiresAt } = signExecutiveVerificationToken(user.id, user.email);

        // Audit log success
        try {
            await supabaseAdmin.from('user_activity').insert({
                user_id: user.id,
                action: 'EXECUTIVE_REPORT_VERIFY_SUCCESS',
                details: {
                    email: user.email,
                    role: user.role,
                    expires_at: expiresAt,
                    timestamp: new Date().toISOString(),
                },
                created_at: new Date().toISOString(),
            });
        } catch {
            // Silently ignore audit log insertion error
        }

        return NextResponse.json({
            success: true,
            verificationToken: token,
            expiresAt,
            user: {
                displayName: user.display_name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err: any) {
        console.error('[Executive Password Verification] Error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error verifying credentials.' },
            { status: 500 }
        );
    }
}
