// app/(supplyChain)/api/supplyChain/employee-accounts/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { saveUserAccessRule, DEFAULT_ALLOWED_DAYS, DEFAULT_TIME_START, DEFAULT_TIME_END } from '../../../lib/services/userAccessService';
import { sendSupplyChainEmail } from '../../../lib/email/mailer';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// Generate a strong, readable password compliant with complexity rules:
// Length 12, uppercase, lowercase, digit, special character
export function generateStrongPassword(): string {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppers + lowers + numbers + symbols;

    // Ensure at least one from each category
    const chars = [
        uppers[crypto.randomInt(uppers.length)],
        lowers[crypto.randomInt(lowers.length)],
        numbers[crypto.randomInt(numbers.length)],
        symbols[crypto.randomInt(symbols.length)],
    ];

    while (chars.length < 12) {
        chars.push(all[crypto.randomInt(all.length)]);
    }

    // Shuffle characters securely
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}

function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (!password || password.length < 8) {
        return { valid: false, reason: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, reason: 'Password must contain at least 1 uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, reason: 'Password must contain at least 1 lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, reason: 'Password must contain at least 1 number.' };
    }
    return { valid: true };
}

// GET: Fetch mock_employees whose position contains ADMIN, joined with users table
export async function GET() {
    try {
        // Query mock_employees where position has ADMIN (case-insensitive)
        const { data: employees, error: empError } = await supabaseAdmin
            .from('mock_employees')
            .select('*')
            .ilike('position', '%admin%')
            .order('display_name', { ascending: true });

        if (empError) {
            console.error('Error fetching mock_employees:', empError);
            return NextResponse.json({ message: empError.message }, { status: 500 });
        }

        // Fetch registered users to correlate account existence
        const { data: users, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, email, display_name, role, status, created_at, updated_at');

        if (userError) {
            console.error('Error fetching users:', userError);
        }

        const usersByEmail = new Map<string, any>();
        (users || []).forEach(u => {
            if (u.email) {
                usersByEmail.set(u.email.toLowerCase().trim(), u);
            }
        });

        // Filter strictly to employees having ADMIN in position and map them
        const adminEmployees = (employees || [])
            .filter(emp => (emp.position || '').toUpperCase().includes('ADMIN'))
            .map(emp => {
                const emailClean = (emp.email || '').toLowerCase().trim();
                const matchedUser = usersByEmail.get(emailClean);

                return {
                    id: emp.id,
                    employee_id: emp.employee_id,
                    display_name: emp.display_name,
                    email: emp.email,
                    department: emp.department || 'Administration',
                    position: emp.position,
                    // User requirement: all employees in mock employees with ADMIN in position will be Purchase Officer in role for now
                    role: 'Purchase Officer',
                    raw_employee_role: emp.role,
                    status: emp.status || 'Active',
                    has_account: !!matchedUser,
                    user_id: matchedUser?.id || null,
                    account_status: matchedUser ? (matchedUser.status || 'Active') : 'No Account',
                    account_created_at: matchedUser?.created_at || null,
                    password_hash: emp.password_hash || null,
                    has_password: !!emp.password_hash,
                };
            });

        return NextResponse.json({
            success: true,
            employees: adminEmployees,
            total: adminEmployees.length,
            accounts_created: adminEmployees.filter(e => e.has_account).length,
            pending_accounts: adminEmployees.filter(e => !e.has_account).length,
        });
    } catch (error: any) {
        console.error('employee-accounts GET error:', error);
        return NextResponse.json(
            { message: error?.message || 'Failed to fetch employee accounts.' },
            { status: 500 }
        );
    }
}

// POST: Create Supabase Auth user & users table entry with role "Purchase Officer"
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, employeeDbId, email, displayName, department, position } = body;
        let password = body.password;

        if (!email) {
            return NextResponse.json({ message: 'Email is required' }, { status: 400 });
        }

        // Validate that position contains ADMIN
        const posClean = (position || '').toUpperCase();
        if (!posClean.includes('ADMIN')) {
            return NextResponse.json(
                { message: 'Only employees with ADMIN in their position can be provisioned in this tab.' },
                { status: 400 }
            );
        }

        // If no password provided, auto-generate one
        if (!password) {
            password = generateStrongPassword();
        }

        // Validate strength
        const strength = validatePasswordStrength(password);
        if (!strength.valid) {
            return NextResponse.json({ message: strength.reason }, { status: 400 });
        }

        const effectiveRole = 'Purchase Officer'; // Explicit user rule
        const cleanEmail = email.trim().toLowerCase();
        let userId: string | null = null;
        let isExistingAuth = false;

        // Check if user already exists in auth
        try {
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
            const foundUser = (authUsers?.users as any[])?.find((u: any) => (u.email || '').toLowerCase() === cleanEmail);
            if (foundUser && foundUser.id) {
                const existingId: string = foundUser.id;
                userId = existingId;
                isExistingAuth = true;
                // Update password for existing auth user
                await supabaseAdmin.auth.admin.updateUserById(existingId, {
                    password: password,
                    user_metadata: {
                        display_name: displayName,
                        role: effectiveRole,
                    },
                });
            }
        } catch (e) {
            console.warn('Auth user list lookup warning:', e);
        }

        // If not existing auth user, create one
        if (!userId) {
            const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: cleanEmail,
                password: password,
                email_confirm: true,
                user_metadata: {
                    display_name: displayName,
                    role: effectiveRole,
                },
            });

            if (createError) {
                console.error('Error creating auth user:', createError);
                return NextResponse.json(
                    { message: createError.message || 'Failed to create authentication user.' },
                    { status: 400 }
                );
            }

            userId = newUserData.user?.id || null;
        }

        if (!userId) {
            return NextResponse.json({ message: 'Failed to obtain user ID from authentication service.' }, { status: 500 });
        }

        // Upsert into users table with role "Purchase Officer"
        const { error: userUpsertError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: userId,
                email: cleanEmail,
                display_name: displayName || cleanEmail.split('@')[0],
                role: effectiveRole,
                position: position,
                department: department || 'Administration',
                status: 'Active',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (userUpsertError) {
            console.error('Error upserting into users table:', userUpsertError);
            return NextResponse.json(
                { message: 'User created in auth but failed to record profile: ' + userUpsertError.message },
                { status: 500 }
            );
        }

        // Update mock_employees record
        const empQuery = employeeDbId
            ? supabaseAdmin.from('mock_employees').update({
                password_hash: password,
                role: effectiveRole,
                updated_at: new Date().toISOString(),
            }).eq('id', employeeDbId)
            : supabaseAdmin.from('mock_employees').update({
                password_hash: password,
                role: effectiveRole,
                updated_at: new Date().toISOString(),
            }).eq('email', cleanEmail);

        await empQuery;

        // Initialize default access control rule (24/7 access enabled)
        try {
            await saveUserAccessRule({
                email: cleanEmail,
                user_id: userId,
                display_name: displayName,
                role: effectiveRole,
                is_allow: true,
                allowed_days: DEFAULT_ALLOWED_DAYS,
                allowed_time_start: DEFAULT_TIME_START,
                allowed_time_end: DEFAULT_TIME_END,
                auth_requested: false,
            }, 'Admin (Employee Tab)');
        } catch (accessErr) {
            console.warn('Could not initialize access rule:', accessErr);
        }

        // Log to user_activity
        try {
            await supabaseAdmin.from('user_activity').insert({
                user_id: userId,
                action: 'ACCOUNT_CREATED',
                module: 'User Management',
                description: `Admin created Purchase Officer account for ${displayName} (${cleanEmail})`,
                created_at: new Date().toISOString(),
            });
        } catch (actErr) {
            // non-critical
        }

        // Send credentials directly to the employee's email
        let emailSent = false;
        let emailErrorMsg: string | null = null;
        try {
            const envAppUrl = (process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
            const host = request.headers.get('host') || 'sc.airshipexpress.ph';
            const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
            const loginUrl = envAppUrl ? `${envAppUrl}/scAuth` : `${protocol}://${host}/scAuth`;

            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Airship Express Account Credentials</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
              <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <div style="background-color: #db2777; padding: 24px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Airship Express Logistics</h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.95;">Supply Chain Management Portal</p>
                </div>
                <div style="padding: 28px 24px;">
                  <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Welcome, ${displayName || 'Team Member'}!</h2>
                  <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                    Your Airship Express portal account has been created. You have been designated as a <strong>Purchase Officer</strong>.
                  </p>
                  
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <tr>
                        <td style="padding: 7px 0; color: #64748b; width: 140px;">Portal Login URL:</td>
                        <td style="padding: 7px 0; font-weight: 600;"><a href="${loginUrl}" style="color: #db2777; text-decoration: none;">${loginUrl}</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 7px 0; color: #64748b;">Login Email:</td>
                        <td style="padding: 7px 0; font-family: monospace; font-size: 14px; font-weight: 600; color: #0f172a;">${cleanEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 7px 0; color: #64748b;">Password:</td>
                        <td style="padding: 7px 0; font-family: monospace; font-size: 15px; font-weight: 700; color: #db2777;">${password}</td>
                      </tr>
                      <tr>
                        <td style="padding: 7px 0; color: #64748b;">Assigned Role:</td>
                        <td style="padding: 7px 0; font-weight: 600; color: #7c3aed;">Purchase Officer</td>
                      </tr>
                      <tr>
                        <td style="padding: 7px 0; color: #64748b;">Position:</td>
                        <td style="padding: 7px 0; font-weight: 500; color: #334155;">${position || 'Administrative Staff'}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 18px;">
                    <strong>Security Reminder:</strong> For your security, please sign in using the button below and change your password upon your first access. Keep these credentials confidential.
                  </p>

                  <div style="text-align: center; margin-top: 26px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #db2777; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign In to Portal</a>
                  </div>
                </div>
                <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
                  &copy; ${new Date().getFullYear()} Airship Express Logistics Inc. All rights reserved.
                </div>
              </div>
            </body>
            </html>
            `;

            const mailResult = await sendSupplyChainEmail({
                to: [{ email: cleanEmail, name: displayName }],
                subject: 'Your Airship Express Portal Account Credentials (Purchase Officer)',
                html: emailHtml,
                text: `Welcome to Airship Express!\n\nYour account has been created with role Purchase Officer.\n\nLogin URL: ${loginUrl}\nEmail: ${cleanEmail}\nPassword: ${password}\n\nPlease change your password upon your first login.`,
            });

            emailSent = mailResult.success;
            if (!mailResult.success) {
                emailErrorMsg = mailResult.error || 'Failed to dispatch email';
            }
        } catch (mailErr: any) {
            console.error('Credentials email dispatch error:', mailErr);
            emailErrorMsg = mailErr?.message || 'Email delivery exception';
        }

        return NextResponse.json({
            success: true,
            message: `Account for ${displayName} successfully created with role Purchase Officer!`,
            user_id: userId,
            email: cleanEmail,
            password: password,
            role: effectiveRole,
            is_new: !isExistingAuth,
            email_sent: emailSent,
            email_error: emailErrorMsg,
        });
    } catch (error: any) {
        console.error('employee-accounts POST error:', error);
        return NextResponse.json(
            { message: error?.message || 'Failed to create employee account.' },
            { status: 500 }
        );
    }
}

// PATCH: Admin changes/resets password for an employee
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { email, employeeDbId, userId: providedUserId } = body;
        let newPassword = body.newPassword;

        if (!email && !providedUserId && !employeeDbId) {
            return NextResponse.json({ message: 'User identification (email or ID) is required.' }, { status: 400 });
        }

        // If no password provided, auto-generate one
        if (!newPassword) {
            newPassword = generateStrongPassword();
        }

        // Validate strength
        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return NextResponse.json({ message: strength.reason }, { status: 400 });
        }

        const cleanEmail = (email || '').trim().toLowerCase();
        let targetUserId = providedUserId;

        // Find Auth user by email if not provided
        if (!targetUserId && cleanEmail) {
            const { data: userRec } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (userRec) {
                targetUserId = userRec.id;
            } else {
                const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
                const foundAuth = (authUsers?.users as any[])?.find((u: any) => (u.email || '').toLowerCase() === cleanEmail);
                if (foundAuth) targetUserId = foundAuth.id;
            }
        }

        // Update Auth password
        if (targetUserId) {
            const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                password: newPassword,
            });

            if (updateAuthError) {
                console.error('Error updating Supabase Auth password:', updateAuthError);
                return NextResponse.json({ message: updateAuthError.message }, { status: 400 });
            }

            // Update users table timestamp
            await supabaseAdmin
                .from('users')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', targetUserId);
        }

        // Update mock_employees password_hash
        const updateMockQuery = employeeDbId
            ? supabaseAdmin.from('mock_employees').update({
                password_hash: newPassword,
                updated_at: new Date().toISOString(),
            }).eq('id', employeeDbId)
            : supabaseAdmin.from('mock_employees').update({
                password_hash: newPassword,
                updated_at: new Date().toISOString(),
            }).eq('email', cleanEmail);

        const { error: mockUpdateError } = await updateMockQuery;
        if (mockUpdateError) {
            console.error('Error updating mock_employees password_hash:', mockUpdateError);
        }

        // Log to user_activity
        try {
            await supabaseAdmin.from('user_activity').insert({
                user_id: targetUserId || '00000000-0000-0000-0000-000000000000',
                action: 'PASSWORD_RESET',
                module: 'User Management',
                description: `Admin changed/reset password for ${cleanEmail || employeeDbId}`,
                created_at: new Date().toISOString(),
            });
        } catch (actErr) {
            // non-critical
        }

        // Send updated password email notification
        let emailSent = false;
        if (cleanEmail) {
            try {
                const envAppUrl = (process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
                const host = request.headers.get('host') || 'sc.airshipexpress.ph';
                const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
                const loginUrl = envAppUrl ? `${envAppUrl}/scAuth` : `${protocol}://${host}/scAuth`;

                const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>Airship Express Password Updated</title>
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
                  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                    <div style="background-color: #db2777; padding: 24px; text-align: center; color: #ffffff;">
                      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Airship Express Logistics</h1>
                      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.95;">Security Notification</p>
                    </div>
                    <div style="padding: 28px 24px;">
                      <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0;">Password Reset Notification</h2>
                      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                        An administrator has updated the password for your Airship Express portal account.
                      </p>
                      
                      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                          <tr>
                            <td style="padding: 7px 0; color: #64748b; width: 140px;">Portal Login URL:</td>
                            <td style="padding: 7px 0; font-weight: 600;"><a href="${loginUrl}" style="color: #db2777; text-decoration: none;">${loginUrl}</a></td>
                          </tr>
                          <tr>
                            <td style="padding: 7px 0; color: #64748b;">Login Email:</td>
                            <td style="padding: 7px 0; font-family: monospace; font-size: 14px; font-weight: 600; color: #0f172a;">${cleanEmail}</td>
                          </tr>
                          <tr>
                            <td style="padding: 7px 0; color: #64748b;">New Password:</td>
                            <td style="padding: 7px 0; font-family: monospace; font-size: 15px; font-weight: 700; color: #db2777;">${newPassword}</td>
                          </tr>
                        </table>
                      </div>

                      <div style="text-align: center; margin-top: 26px;">
                        <a href="${loginUrl}" style="display: inline-block; background-color: #db2777; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign In Now</a>
                      </div>
                    </div>
                    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
                      &copy; ${new Date().getFullYear()} Airship Express Logistics Inc. All rights reserved.
                    </div>
                  </div>
                </body>
                </html>
                `;

                const mailResult = await sendSupplyChainEmail({
                    to: [{ email: cleanEmail }],
                    subject: 'Your Airship Express Portal Password Has Been Reset',
                    html: emailHtml,
                    text: `Your Airship Express portal password has been reset.\n\nLogin URL: ${loginUrl}\nEmail: ${cleanEmail}\nNew Password: ${newPassword}`,
                });
                emailSent = mailResult.success;
            } catch (mailErr) {
                console.error('Password reset email notification failed:', mailErr);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Password changed successfully!',
            email: cleanEmail,
            newPassword: newPassword,
            email_sent: emailSent,
        });
    } catch (error: any) {
        console.error('employee-accounts PATCH error:', error);
        return NextResponse.json(
            { message: error?.message || 'Failed to update employee password.' },
            { status: 500 }
        );
    }
}
