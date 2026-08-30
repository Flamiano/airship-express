// app/(supplyChain)/api/supplyChain/change-password/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// Password complexity validator: 8+ chars, 1 uppercase, 1 lowercase, 1 number
function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (!password || password.length < 8) {
        return { valid: false, reason: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, reason: "Password must contain at least 1 uppercase letter." };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, reason: "Password must contain at least 1 lowercase letter." };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, reason: "Password must contain at least 1 number." };
    }
    return { valid: true };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { currentPassword, newPassword, email: providedEmail, logoutAfterSave } = body;
        const sessionToken = request.headers.get('x-session-token') || body.session_token;
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

        if (!currentPassword) {
            return NextResponse.json(
                { message: 'Current password is required.' },
                { status: 400 }
            );
        }

        if (!newPassword) {
            return NextResponse.json(
                { message: 'New password is required.' },
                { status: 400 }
            );
        }

        // Validate password complexity
        const strengthCheck = validatePasswordStrength(newPassword);
        if (!strengthCheck.valid) {
            return NextResponse.json(
                { message: strengthCheck.reason },
                { status: 400 }
            );
        }

        if (currentPassword === newPassword) {
            return NextResponse.json(
                { message: 'New password must be different from your current password.' },
                { status: 400 }
            );
        }

        // Resolve target user
        let targetEmail = providedEmail;
        let userId: string | null = null;
        let sessionId: string | null = null;

        if (sessionToken) {
            const { data: session } = await supabase
                .from('sessions')
                .select('id, user_id, email, is_active')
                .eq('session_token', sessionToken)
                .maybeSingle();

            if (session) {
                targetEmail = session.email || targetEmail;
                userId = session.user_id;
                sessionId = session.id;
            }
        }

        if (!targetEmail) {
            return NextResponse.json(
                { message: 'User identification failed. Please try logging in again.' },
                { status: 401 }
            );
        }

        // Find user by email in users table if userId is missing
        if (!userId) {
            const { data: userRec } = await supabase
                .from('users')
                .select('id, email')
                .eq('email', targetEmail)
                .maybeSingle();

            if (userRec) {
                userId = userRec.id;
            }
        }

        // Verify current password:
        let isCurrentPasswordValid = false;

        // 1. Try Supabase Auth sign-in
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: targetEmail,
                password: currentPassword,
            });

            if (!authError && authData?.user) {
                isCurrentPasswordValid = true;
                if (!userId) userId = authData.user.id;
            }
        } catch (e) {
            // fall through to db checks
        }

        // 2. Check mock_employees if not verified yet
        if (!isCurrentPasswordValid) {
            const { data: mockEmp } = await supabase
                .from('mock_employees')
                .select('password_hash')
                .eq('email', targetEmail)
                .maybeSingle();

            if (mockEmp?.password_hash && mockEmp.password_hash === currentPassword) {
                isCurrentPasswordValid = true;
            }
        }

        // 3. Check role_based_accounts if not verified yet
        if (!isCurrentPasswordValid) {
            const { data: rba } = await supabase
                .from('role_based_accounts')
                .select('password_hash')
                .eq('email', targetEmail)
                .maybeSingle();

            if (rba?.password_hash && rba.password_hash === currentPassword) {
                isCurrentPasswordValid = true;
            }
        }

        if (!isCurrentPasswordValid) {
            return NextResponse.json(
                { message: 'Incorrect current password. Please verify and try again.' },
                { status: 400 }
            );
        }

        // Update password in Supabase Auth
        if (userId) {
            try {
                await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: newPassword,
                });
            } catch (err) {
                console.error('Supabase admin update password error:', err);
            }
        } else {
            // Find user in auth list
            try {
                const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
                const foundAuthUser = userList?.users?.find(u => u.email === targetEmail);
                if (foundAuthUser) {
                    userId = foundAuthUser.id;
                    await supabaseAdmin.auth.admin.updateUserById(foundAuthUser.id, {
                        password: newPassword,
                    });
                }
            } catch (err) {
                console.error('Find and update auth user error:', err);
            }
        }

        // Update mock_employees table
        try {
            await supabase
                .from('mock_employees')
                .update({
                    password_hash: newPassword,
                    updated_at: new Date().toISOString(),
                })
                .eq('email', targetEmail);
        } catch (e) {
            // ignore if table/record not present
        }

        // Update role_based_accounts table
        try {
            await supabase
                .from('role_based_accounts')
                .update({
                    password_hash: newPassword,
                    updated_at: new Date().toISOString(),
                })
                .eq('email', targetEmail);
        } catch (e) {
            // ignore if table/record not present
        }

        // Update users table timestamp
        if (userId) {
            try {
                await supabase
                    .from('users')
                    .update({
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);
            } catch (e) {
                // non-critical
            }
        }

        // Log user security activity
        try {
            if (userId) {
                await supabase
                    .from('user_activity')
                    .insert({
                        user_id: userId,
                        action: 'PASSWORD_CHANGE',
                        module: 'Security',
                        description: `User ${targetEmail} changed account password.`,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    });
            }
        } catch (e) {
            // non-critical
        }

        // Handle logout request
        if (logoutAfterSave) {
            if (sessionId) {
                await supabase
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('id', sessionId);
            } else if (userId) {
                await supabase
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('user_id', userId);
            }

            return NextResponse.json({
                success: true,
                message: 'Password changed successfully. You have been logged out.',
                loggedOut: true,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Password changed successfully!',
            loggedOut: false,
        });
    } catch (error: any) {
        console.error('Change password error:', error);
        return NextResponse.json(
            { message: error?.message || 'Failed to update password. Please try again.' },
            { status: 500 }
        );
    }
}
