// app/(supplyChain)/api/supplyChain/verify-otp/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
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

        // get latest valid otp
        const { data: otpRecords, error: otpError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('user_id', userId)
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (otpError || !otpRecords || otpRecords.length === 0) {
            return NextResponse.json(
                { message: 'No valid OTP found' },
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
                'Admin': '/executive',
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
                    role: employeeRole || 'Employee',
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