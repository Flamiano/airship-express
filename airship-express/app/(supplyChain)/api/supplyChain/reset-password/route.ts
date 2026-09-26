// app/(supplyChain)/api/supplyChain/reset-password/route.ts

import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'crypto';
import { sendOTPEmail } from '../../../lib/email/sendOTP';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

const TOKEN_SECRET = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'airship_reset_password_secret_key';

function createResetToken(email: string): string {
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    const payload = `${email.toLowerCase()}:${expiresAt}`;
    const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

function verifyResetToken(token: string, email: string): boolean {
    try {
        const [encodedPayload, signature] = token.split('.');
        if (!encodedPayload || !signature) return false;

        const payload = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
        const [tokenEmail, expiresAtStr] = payload.split(':');
        const expiresAt = parseInt(expiresAtStr, 10);

        if (tokenEmail !== email.toLowerCase()) return false;
        if (isNaN(expiresAt) || expiresAt < Date.now()) return false;

        const expectedSignature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
        return signature === expectedSignature;
    } catch {
        return false;
    }
}

function validatePasswordSecurity(password: string): { valid: boolean; message?: string } {
    if (!password || password.length < 6) {
        return { valid: false, message: 'Password must be at least 6 characters long.' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least 1 uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least 1 lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least 1 number.' };
    }
    return { valid: true };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, email, employeeName } = body;

        if (!email) {
            return NextResponse.json(
                { message: 'Email is required' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // action 1: request otp for password reset
        if (action === 'request_otp') {
            // lookup user across users, mock_employees, and role_based_accounts
            const { data: existingUser } = await supabase
                .from('users')
                .select('id, display_name')
                .eq('email', normalizedEmail)
                .maybeSingle();

            const { data: hrUser } = await supabase
                .from('mock_employees')
                .select('id, employee_name')
                .eq('email', normalizedEmail)
                .maybeSingle();

            const effectiveUserId = existingUser?.id || hrUser?.id || normalizedEmail;
            const displayName = employeeName || existingUser?.display_name || hrUser?.employee_name || 'User';

            // rate limit check - max 5 in past hour
            const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
            const { count } = await supabase
                .from('otp_codes')
                .select('*', { count: 'exact', head: true })
                .eq('email', normalizedEmail)
                .gte('created_at', oneHourAgo);

            if (count && count >= 5) {
                return NextResponse.json(
                    { message: 'Too many OTP requests. Please wait an hour before trying again.' },
                    { status: 429 }
                );
            }

            // 60-second cooldown check - max 1 request per 60 seconds
            const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
            const { data: recentOtp } = await supabase
                .from('otp_codes')
                .select('created_at')
                .eq('email', normalizedEmail)
                .gte('created_at', sixtySecondsAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentOtp) {
                const elapsedSeconds = Math.floor((Date.now() - new Date(recentOtp.created_at).getTime()) / 1000);
                const waitSeconds = Math.max(1, 60 - elapsedSeconds);
                return NextResponse.json(
                    { message: `Please wait ${waitSeconds} seconds before requesting another code.` },
                    { status: 429 }
                );
            }

            // generate otp
            const otp = generateOTP();
            const hashedOTP = hashOTP(otp);
            const expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes

            // store otp code
            const { error: insertError } = await supabase
                .from('otp_codes')
                .insert({
                    user_id: effectiveUserId,
                    code_hash: hashedOTP,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                    email: normalizedEmail,
                    employee_name: displayName,
                });

            if (insertError) {
                console.error('otp insertion failed:', insertError);
                return NextResponse.json(
                    { message: 'Failed to generate OTP. Please try again.' },
                    { status: 500 }
                );
            }

            // send email
            try {
                await sendOTPEmail({
                    to: normalizedEmail,
                    otp: otp,
                    userName: displayName,
                    expiresIn: 5,
                });
            } catch (emailError: any) {
                console.error('send otp email error:', emailError);
                return NextResponse.json(
                    { message: 'Failed to send OTP email. Please verify your address.' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'A 6-digit verification code has been sent to your email.',
                expiresAt: expiresAt.toISOString(),
            });
        }

        // action 2: verify otp code
        if (action === 'verify_otp') {
            const { otp } = body;

            if (!otp || !/^\d{6}$/.test(otp)) {
                return NextResponse.json(
                    { message: 'Please enter a valid 6-digit verification code.' },
                    { status: 400 }
                );
            }

            const hashedInputOTP = hashOTP(otp);

            // get latest unexpired unused otp for this email
            const { data: otpRecords, error: otpError } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('email', normalizedEmail)
                .is('used_at', null)
                .gte('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            if (otpError || !otpRecords || otpRecords.length === 0) {
                return NextResponse.json(
                    { message: 'Invalid or expired verification code. Please request a new one.' },
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

            if (otpRecord.code_hash !== hashedInputOTP) {
                await supabase
                    .from('otp_codes')
                    .update({ attempts: (otpRecord.attempts || 0) + 1 })
                    .eq('id', otpRecord.id);

                const remaining = 5 - ((otpRecord.attempts || 0) + 1);
                return NextResponse.json(
                    { message: `Invalid verification code. (${remaining} attempts remaining)` },
                    { status: 400 }
                );
            }

            // mark otp as used
            await supabase
                .from('otp_codes')
                .update({ used_at: new Date().toISOString() })
                .eq('id', otpRecord.id);

            // issue reset token
            const resetToken = createResetToken(normalizedEmail);

            return NextResponse.json({
                success: true,
                message: 'Verification code confirmed successfully.',
                resetToken,
            });
        }

        // action 3: confirm reset password
        if (action === 'confirm_reset') {
            const { resetToken, newPassword } = body;

            if (!resetToken || !verifyResetToken(resetToken, normalizedEmail)) {
                return NextResponse.json(
                    { message: 'Your reset session has expired or is invalid. Please verify OTP again.' },
                    { status: 401 }
                );
            }

            const check = validatePasswordSecurity(newPassword);
            if (!check.valid) {
                return NextResponse.json(
                    { message: check.message },
                    { status: 400 }
                );
            }

            const ipAddress = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'Unknown';
            const userAgent = request.headers.get('user-agent') || 'Unknown';

            // find user in supabase auth
            let authUserId: string | null = null;
            try {
                const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
                const foundUser = userList?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
                if (foundUser) {
                    authUserId = foundUser.id;
                    await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
                        password: newPassword,
                    });
                }
            } catch (authErr) {
                console.error('error updating supabase auth password:', authErr);
            }

            // update mock_employees password_hash
            try {
                await supabase
                    .from('mock_employees')
                    .update({
                        password_hash: newPassword,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('email', normalizedEmail);
            } catch (e) {
                // non-critical
            }

            // update role_based_accounts password_hash
            try {
                await supabase
                    .from('role_based_accounts')
                    .update({
                        password_hash: newPassword,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('email', normalizedEmail);
            } catch (e) {
                // non-critical
            }

            // update users updated_at
            try {
                await supabase
                    .from('users')
                    .update({
                        updated_at: new Date().toISOString(),
                    })
                    .eq('email', normalizedEmail);
            } catch (e) {
                // non-critical
            }

            // record security log
            try {
                await supabase
                    .from('user_activity')
                    .insert({
                        user_id: authUserId || normalizedEmail,
                        action: 'PASSWORD_RESET',
                        module: 'Security',
                        description: `User ${normalizedEmail} successfully reset their password via OTP verification.`,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    });
            } catch (e) {
                // non-critical
            }

            return NextResponse.json({
                success: true,
                message: 'Your password has been reset successfully. You can now log in.',
            });
        }

        return NextResponse.json(
            { message: 'Invalid action specified' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('reset password error:', error);
        return NextResponse.json(
            { message: 'Failed to process request. Please try again.' },
            { status: 500 }
        );
    }
}
