
import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';

interface RateLimitEntry {
    attempts: number;
    lockoutUntil?: number;
}

// In-memory rate limiting map for login attempts
const loginRateLimits = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 60 * 1000;

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Email and password are required' },
                { status: 400 }
            );
        }

        const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
        const clientKey = `${ip}_${(email || '').toLowerCase().trim()}`;
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

        // Check credentials against role_based_accounts table
        const { data: userData, error: userError } = await supabase
            .from('role_based_accounts')
            .select('id, email, role, status, password_hash')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            return recordFailedAttempt();
        }

        // Check if account is active
        if (userData.status !== 'Active') {
            return NextResponse.json(
                { message: 'Your account is inactive. Please contact HR.' },
                { status: 403 }
            );
        }

        // Compare password (plain text for now)
        if (userData.password_hash !== password) {
            return recordFailedAttempt();
        }

        // Reset rate limit on successful credentials match
        loginRateLimits.delete(clientKey);

        // Log login attempt
        await supabase
            .from('user_activity')
            .insert({
                user_id: userData.id,
                action: 'LOGIN_ATTEMPT',
                module: 'Authentication',
                description: `User ${userData.email} logged in with role ${userData.role}`,
                ip_address: request.headers.get('x-forwarded-for') || 'Unknown',
                user_agent: request.headers.get('user-agent') || 'Unknown',
            });

        return NextResponse.json({
            user: {
                id: userData.id,
                email: userData.email,
                role: userData.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Something went wrong. Please try again.' },
            { status: 500 }
        );
    }
}