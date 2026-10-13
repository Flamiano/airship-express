import { supabase } from '../../../lib/services/client/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { sendOTPEmail } from '../../../lib/email/sendOTP';

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

interface RateLimitEntry {
    attempts: number;
    lockoutUntil?: number;
}

// In-memory rate limiting map for login attempts (3 failed attempts -> 1 min lockout)
const loginRateLimits = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 60 * 1000;

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

function maskEmail(email?: string | null): string {
    if (!email || typeof email !== 'string') return '';
    const trimmed = email.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex === -1) return trimmed;
    const userPart = trimmed.slice(0, atIndex);
    const domainPart = trimmed.slice(atIndex + 1);
    if (userPart.length <= 2) return `${userPart.slice(0, 1)}***@${domainPart}`;
    if (userPart.length <= 4) return `${userPart.slice(0, 1)}***${userPart.slice(-1)}@${domainPart}`;
    return `${userPart.slice(0, 2)}***${userPart.slice(-2)}@${domainPart}`;
}

const roleRedirects: Record<string, string> = {
    'Superadmin': '/executive',
    'Executive': '/executive',
    'Admin': '/procurement',
    'Purchase Officer': '/purchase-orders',
    'Operator': '/warehousing',
    'Supplier': '/suppliers_page/purchase-orders',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, rememberMe } = body;

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Email and password are required' },
                { status: 400 }
            );
        }

        const normalizedEmail = (email || '').trim().toLowerCase();
        const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const clientKey = `${ip}_${normalizedEmail}`;
        const now = Date.now();
        const rateEntry = loginRateLimits.get(clientKey);

        // Check if currently locked out
        if (rateEntry && rateEntry.lockoutUntil && rateEntry.lockoutUntil > now) {
            const remainingSeconds = Math.ceil((rateEntry.lockoutUntil - now) / 1000);
            return NextResponse.json(
                {
                    message: `Rate limit reached (3 failed attempts). Please wait ${remainingSeconds}s before trying again.`,
                    locked: true,
                    retryAfter: remainingSeconds,
                    attempts: rateEntry.attempts,
                },
                { status: 429 }
            );
        }

        // Helper to register a failed attempt
        const recordFailedAttempt = (customMessage?: string) => {
            const currentAttempts = (rateEntry && (!rateEntry.lockoutUntil || rateEntry.lockoutUntil <= now))
                ? (rateEntry.attempts || 0) + 1
                : 1;

            if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
                loginRateLimits.set(clientKey, {
                    attempts: currentAttempts,
                    lockoutUntil: now + LOCKOUT_DURATION_MS,
                });
                return NextResponse.json(
                    {
                        message: `Rate limit reached (3 failed attempts). Login locked. You can continue in 1 minute (60s).`,
                        locked: true,
                        retryAfter: 60,
                        attemptsRemaining: 0,
                    },
                    { status: 429 }
                );
            } else {
                loginRateLimits.set(clientKey, { attempts: currentAttempts });
                const remaining = MAX_LOGIN_ATTEMPTS - currentAttempts;
                return NextResponse.json(
                    {
                        message: customMessage || `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`,
                        attemptsRemaining: remaining,
                        attempts: currentAttempts,
                    },
                    { status: 401 }
                );
            }
        };

        // 1. Query the users table for account details
        const { data: userRecord, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .ilike('email', normalizedEmail)
            .maybeSingle();

        if (userError || !userRecord) {
            return recordFailedAttempt();
        }

        // Check if account status is active
        if (userRecord.status && userRecord.status.toLowerCase() !== 'active') {
            return NextResponse.json(
                { message: 'Your account is deactivated or suspended. Please contact your system administrator.' },
                { status: 403 }
            );
        }

        // 2. Verify password with Supabase Auth or fallback password_hash in DB
        let isPasswordValid = false;
        let authSession: any = null;

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: userRecord.email || normalizedEmail,
                password: password,
            });

            if (!authError && authData?.user) {
                isPasswordValid = true;
                authSession = authData.session;
            }
        } catch {
            // fall through to database hash check
        }

        if (!isPasswordValid) {
            // Check direct password hash if stored in table
            if (userRecord.password_hash && userRecord.password_hash === password) {
                isPasswordValid = true;
            }
        }

        if (!isPasswordValid) {
            return recordFailedAttempt();
        }

        // Reset rate limit on successful credentials match
        loginRateLimits.delete(clientKey);

        let effectiveRole = userRecord.role || 'Operator';
        const normRole = effectiveRole.toLowerCase().trim();
        if (normRole === 'superadmin' || normRole === 'super_admin' || normRole === 'executive') {
            effectiveRole = 'Executive';
        } else if (normRole === 'supplier') {
            effectiveRole = 'Supplier';
        }
        const isOtpMandatory = normRole === 'superadmin' || normRole === 'super_admin' || normRole === 'executive' || normRole === 'admin' || normRole === 'supplier';

        // 3. Executive / Admin / Supplier Flow: ALWAYS send OTP
        if (isOtpMandatory) {
            const otp = generateOTP();
            const hashedOTP = hashOTP(otp);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
            const userDisplayName = userRecord.display_name || userRecord.name || (normRole === 'supplier' ? 'Authorized Supplier' : 'Admin User');

            const [insertResult, emailResult] = await Promise.all([
                supabaseAdmin
                    .from('otp_codes')
                    .insert({
                        user_id: userRecord.id,
                        code_hash: hashedOTP,
                        expires_at: expiresAt.toISOString(),
                        attempts: 0,
                        email: userRecord.email,
                        employee_name: userDisplayName,
                    }),
                sendOTPEmail({
                    to: userRecord.email,
                    otp: otp,
                    userName: userDisplayName,
                    expiresIn: 5,
                }).then(() => ({ success: true, error: null })).catch((err) => ({ success: false, error: err?.message || 'Failed to send email' }))
            ]);

            if (insertResult.error) {
                console.error('OTP code generation error:', insertResult.error);
                return NextResponse.json(
                    { message: 'Failed to generate verification code. Please try again.' },
                    { status: 500 }
                );
            }

            if (!emailResult.success) {
                console.error('Email sending failed:', emailResult.error);
                return NextResponse.json(
                    { message: 'Failed to send OTP email. Please check your email connection or contact support.' },
                    { status: 500 }
                );
            }

            // Log attempt
            await supabaseAdmin
                .from('user_activity')
                .insert({
                    user_id: userRecord.id,
                    action: 'OTP_REQUESTED',
                    module: 'Authentication',
                    description: `Security verification code sent to ${userRecord.email} (${effectiveRole})`,
                    ip_address: ip,
                    user_agent: userAgent,
                });

            return NextResponse.json({
                requireOtp: true,
                email: userRecord.email,
                maskedEmail: maskEmail(userRecord.email),
                userId: userRecord.id,
                role: effectiveRole,
                displayName: userDisplayName,
                expiresAt: expiresAt.toISOString(),
            });
        }

        // 4. Other Users Flow (Purchase Officer, Operator): Direct login (Remember Me strictly disallowed for non-suppliers)
        const isSupplier = normRole === 'supplier';
        const isRememberAllowed = isSupplier && Boolean(rememberMe);
        const sessionToken = randomBytes(32).toString('hex');
        const sessionExpiresAt = isRememberAllowed
            ? new Date(Date.now() + 15 * 24 * 3600000).toISOString() // 15 days
            : new Date(Date.now() + 24 * 3600000).toISOString();      // 24 hours

        // Deactivate previous active sessions for this user
        await supabaseAdmin
            .from('sessions')
            .update({ is_active: false, in_queue: false, updated_at: new Date().toISOString() })
            .eq('user_id', userRecord.id)
            .eq('is_active', true);

        // Insert or update active session
        const { error: sessionError } = await supabaseAdmin
            .from('sessions')
            .upsert({
                user_id: userRecord.id,
                session_token: sessionToken,
                expires_at: sessionExpiresAt,
                expires_at_remember: sessionExpiresAt,
                email: userRecord.email,
                hr_employee_name: userRecord.display_name || userRecord.name || 'User',
                is_active: true,
                in_queue: false,
                remember_me: isRememberAllowed,
                user_agent: userAgent,
                ip_address: ip,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });

        if (sessionError) {
            console.error('Session creation error:', sessionError);
            return NextResponse.json(
                { message: 'Failed to initialize session. Please try again.' },
                { status: 500 }
            );
        }

        // Log successful login
        await supabaseAdmin
            .from('user_activity')
            .insert({
                user_id: userRecord.id,
                action: 'LOGIN_SUCCESS',
                module: 'Authentication',
                description: `User ${userRecord.email} signed in with role ${effectiveRole} (${rememberMe ? 'Remembered 15d' : 'Session'})`,
                ip_address: ip,
                user_agent: userAgent,
            });

        const targetRedirect = roleRedirects[effectiveRole] || (normRole.includes('purchase') ? '/purchase-orders' : '/warehousing');

        return NextResponse.json({
            success: true,
            user: {
                id: userRecord.id,
                email: userRecord.email,
                role: effectiveRole,
                display_name: userRecord.display_name || userRecord.name || 'User',
            },
            session_token: sessionToken,
            remember_me: !!rememberMe,
            expires_at: sessionExpiresAt,
            redirect_url: targetRedirect,
            access_token: authSession?.access_token || null,
            refresh_token: authSession?.refresh_token || null,
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Something went wrong. Please try again.' },
            { status: 500 }
        );
    }
}