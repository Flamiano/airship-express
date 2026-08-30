// app/(supplyChain)/api/supplyChain/create-auth-user/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

function generateSessionToken(): string {
    return randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
    try {
        const {
            email,
            password,
            displayName,
            role,
            tempToken,
            useHrPassword,
            hrPassword,
            rememberMe
        } = await request.json();

        if (!tempToken) {
            return NextResponse.json(
                { message: 'Invalid session' },
                { status: 401 }
            );
        }

        // get client info
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            request.headers.get('cf-connecting-ip') ||
            'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';

        // choose which password to use
        const finalPassword = useHrPassword && hrPassword ? hrPassword : password;

        if (!finalPassword || finalPassword.length < 6) {
            return NextResponse.json(
                { message: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // check if auth user exists
        let userId;
        let authUserExists = false;

        try {
            // check users table first
            const { data: existingUser, error: userCheckError } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingUser) {
                authUserExists = true;
                userId = existingUser.id;
            } else {
                // check auth users
                const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

                if (!listError && authUsers?.users) {
                    const authUser = authUsers.users.find(u => u.email === email);
                    if (authUser) {
                        authUserExists = true;
                        userId = authUser.id;
                    }
                }
            }
        } catch (error) {
            // silent fail
        }

        // create new auth user if needed
        if (!authUserExists) {
            const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: finalPassword,
                email_confirm: true,
                user_metadata: {
                    display_name: displayName,
                    role: role,
                },
            });

            if (createError) {
                console.error('admin create user error:', createError);

                if (createError.message.includes('already registered')) {
                    return NextResponse.json(
                        { message: 'An account with this email already exists. Please try logging in.' },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    { message: createError.message || 'Failed to create account' },
                    { status: 400 }
                );
            }

            userId = userData.user?.id;
        }

        if (!userId) {
            return NextResponse.json(
                { message: 'Failed to create or authenticate user' },
                { status: 500 }
            );
        }

        // sign in to get supabase session
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: finalPassword,
        });

        if (authError) {
            console.error('supabase sign in error:', authError);
        }

        // check if user exists in users table
        const { data: existingUser, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (!existingUser) {
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    email: email,
                    display_name: displayName,
                    role: role,
                    status: 'Active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (insertError) {
                console.error('user insert error:', insertError);
                return NextResponse.json(
                    { message: 'Failed to create user profile: ' + insertError.message },
                    { status: 500 }
                );
            }
        } else {
            await supabase
                .from('users')
                .update({
                    role: role,
                    display_name: displayName,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
        }

        // deactivate existing sessions
        await supabase
            .from('sessions')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true);

        // create custom session
        const sessionToken = generateSessionToken();
        const expiresAt = rememberMe
            ? new Date(Date.now() + 15 * 24 * 3600000)
            : new Date(Date.now() + 8 * 3600000);

        const { error: sessionError } = await supabase
            .from('sessions')
            .insert({
                user_id: userId,
                session_token: sessionToken,
                expires_at: expiresAt.toISOString(),
                email: email,
                hr_employee_name: displayName,
                is_active: true,
                remember_me: rememberMe || false,
                user_agent: userAgent,
                ip_address: ipAddress,
                created_at: new Date().toISOString(),
            });

        if (sessionError) {
            console.error('session creation error:', sessionError);
            return NextResponse.json(
                { message: 'Failed to create session: ' + sessionError.message },
                { status: 500 }
            );
        }

        // log activity
        try {
            await supabase
                .from('user_activity')
                .insert({
                    user_id: userId,
                    action: 'USER_CREATED',
                    module: 'Authentication',
                    description: `User created: ${email} with role ${role} (${rememberMe ? '15 days' : '8 hours'})`,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    created_at: new Date().toISOString(),
                });
        } catch (activityError) {
            // non-critical
        }

        // determine redirect based on role
        const roleRedirects: Record<string, string> = {
            'Admin': '/executive',
            'Manager': '/warehousing?tab=incoming',
            'Employee': '/documents',
            'Operator': '/warehousing?tab=incoming',
            'Executive': '/executive'
        };

        const redirectUrl = roleRedirects[role] || '/documents';

        return NextResponse.json({
            success: true,
            session_token: sessionToken,
            user_id: userId,
            redirect_url: redirectUrl,
            role: role,
            remember_me: rememberMe || false,
            expires_at: expiresAt.toISOString(),
            access_token: authData?.session?.access_token || null,
            refresh_token: authData?.session?.refresh_token || null,
            message: 'Account created successfully!'
        });

    } catch (error) {
        console.error('create auth user error:', error);
        return NextResponse.json(
            { message: 'Something went wrong: ' + (error as Error).message },
            { status: 500 }
        );
    }
}