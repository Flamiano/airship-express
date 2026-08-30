// app/(supplyChain)/api/supplyChain/request-otp/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { sendOTPEmail } from '@/app/(supplyChain)/lib/email/sendOTP';

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: Request) {
    try {
        const { userId, email, loggedInUserId, employeeName } = await request.json();

        if (!userId || !email || !loggedInUserId) {
            return NextResponse.json(
                { message: 'User ID, email, and logged in user are required' },
                { status: 400 }
            );
        }

        // validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { message: 'Invalid email format' },
                { status: 400 }
            );
        }

        // check if user exists in users table, create if not
        const { data: existingUser, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', loggedInUserId)
            .maybeSingle();

        let effectiveUserId = loggedInUserId;

        if (!existingUser) {
            const { data: roleData } = await supabase
                .from('role_based_accounts')
                .select('email, role')
                .eq('id', loggedInUserId)
                .maybeSingle();

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: loggedInUserId,
                    email: roleData?.email || email,
                    display_name: employeeName || 'User',
                    role: roleData?.role || 'Employee',
                    status: 'Pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (insertError) {
                console.error('Failed to create temporary user:', insertError);
                return NextResponse.json(
                    { message: 'Failed to create user profile' },
                    { status: 500 }
                );
            }
        }

        // rate limiting - max 3 per hour
        const { count, error: countError } = await supabase
            .from('otp_codes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', effectiveUserId)
            .gte('created_at', new Date(Date.now() - 3600000).toISOString());

        if (countError) {
            console.error('Rate limit check error:', countError);
        }

        if (count && count >= 3) {
            return NextResponse.json(
                { message: 'Too many OTP requests. Please wait an hour.' },
                { status: 429 }
            );
        }

        // generate otp
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expiresAt = new Date(Date.now() + 5 * 60000);

        // store otp
        const { error: insertError } = await supabase
            .from('otp_codes')
            .insert({
                user_id: effectiveUserId,
                code_hash: hashedOTP,
                expires_at: expiresAt.toISOString(),
                attempts: 0,
                email: email,
                employee_name: employeeName || 'Unknown',
            });

        if (insertError) {
            console.error('OTP insert error:', insertError);
            return NextResponse.json(
                { message: 'Failed to generate OTP: ' + insertError.message },
                { status: 500 }
            );
        }

        // send email
        try {
            await sendOTPEmail({
                to: email,
                otp: otp,
                userName: employeeName || 'HR Employee',
                expiresIn: 5,
            });
        } catch (emailError: any) {
            console.error('Email sending failed:', emailError.message);
            return NextResponse.json(
                { message: 'Failed to send OTP email. Please check your email address or contact support.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'OTP sent successfully to your email',
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error('Error requesting OTP:', error);
        return NextResponse.json(
            { message: 'Failed to send OTP. Please try again.' },
            { status: 500 }
        );
    }
}