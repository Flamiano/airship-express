// app/(supplyChain)/api/auth/concurrent-login/respond/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getChallengeById, resolveLoginChallenge } from '../../../../lib/services/concurrentLoginService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const anonKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || 
                 process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                 process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { requestId, approved, password } = body;

        if (!requestId || typeof approved !== 'boolean') {
            return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        const challenge = await getChallengeById(requestId);
        if (!challenge) {
            return NextResponse.json({ success: false, message: 'Request expired or not found' }, { status: 404 });
        }

        if (approved) {
            if (!password || typeof password !== 'string' || !password.trim()) {
                return NextResponse.json({ success: false, message: 'Password is required to verify your identity.' }, { status: 400 });
            }

            // Verify password against challenge user
            let isPasswordValid = false;
            try {
                const isolatedAuthClient = createClient(supabaseUrl, anonKey, {
                    auth: { persistSession: false, autoRefreshToken: false },
                });
                const { data: authData, error: authError } = await isolatedAuthClient.auth.signInWithPassword({
                    email: challenge.email,
                    password: password.trim(),
                });

                if (!authError && authData?.user) {
                    isPasswordValid = true;
                }
            } catch {
                // fall through to database check
            }

            if (!isPasswordValid) {
                const { data: userRec } = await supabaseAdmin
                    .from('users')
                    .select('password_hash')
                    .eq('id', challenge.userId)
                    .maybeSingle();

                if (userRec?.password_hash && userRec.password_hash === password.trim()) {
                    isPasswordValid = true;
                }
            }

            if (!isPasswordValid) {
                return NextResponse.json({
                    success: false,
                    message: 'Incorrect password. Verification failed.'
                }, { status: 401 });
            }

            // 1. Mark challenge approved
            await resolveLoginChallenge(requestId, true);

            // 2. Terminate the CURRENT active session for this user in database
            await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', challenge.userId)
                .eq('is_active', true);

            // 3. Insert/Activate the NEW device session
            if (challenge.sessionPayload) {
                const { sessionToken, expiresAt, rememberMe } = challenge.sessionPayload;
                await supabaseAdmin
                    .from('sessions')
                    .upsert({
                        user_id: challenge.userId,
                        session_token: sessionToken,
                        expires_at: expiresAt,
                        expires_at_remember: expiresAt,
                        email: challenge.email,
                        hr_employee_name: challenge.displayName,
                        is_active: true,
                        in_queue: false,
                        remember_me: rememberMe,
                        user_agent: challenge.newDeviceUserAgent,
                        ip_address: challenge.newDeviceIp,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'email' });
            }

            // Log activity
            await supabaseAdmin
                .from('user_activity')
                .insert({
                    user_id: challenge.userId,
                    action: 'CONCURRENT_LOGIN_APPROVED',
                    module: 'Authentication',
                    description: `Active session approved sign-in from new device (${challenge.newDeviceUserAgent}). Previous device session terminated.`,
                    ip_address: challenge.newDeviceIp,
                    user_agent: challenge.newDeviceUserAgent,
                });

            return NextResponse.json({
                success: true,
                approved: true,
                message: 'Login approved. Current device will be logged out.'
            });
        } else {
            // User declined the login request
            await resolveLoginChallenge(requestId, false);

            // Log decline
            await supabaseAdmin
                .from('user_activity')
                .insert({
                    user_id: challenge.userId,
                    action: 'CONCURRENT_LOGIN_DECLINED',
                    module: 'Authentication',
                    description: `Active user rejected login attempt from new device (${challenge.newDeviceUserAgent}, IP: ${challenge.newDeviceIp}).`,
                    ip_address: challenge.newDeviceIp,
                    user_agent: challenge.newDeviceUserAgent,
                });

            return NextResponse.json({
                success: true,
                approved: false,
                message: 'Login request declined. You remain logged in.'
            });
        }
    } catch (err: any) {
        console.error('Error in concurrent-login/respond route:', err);
        return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500 });
    }
}
