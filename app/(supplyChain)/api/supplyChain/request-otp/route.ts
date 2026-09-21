// app/(supplyChain)/api/supplyChain/request-otp/route.ts

import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { sendOTPEmail } from '../../../lib/email/sendOTP';

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: Request) {
    try {
        const { userId, email, loggedInUserId, employeeName } = await request.json();

        const effectiveUserId = userId || loggedInUserId;
        const effectiveLoggedInUserId = loggedInUserId || userId;

        if (!effectiveUserId || !email) {
            return NextResponse.json(
                { message: 'User ID and email are required' },
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

        // rate limiting - max 3 per hour
        const { count, error: countError } = await supabase
            .from('otp_codes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', effectiveLoggedInUserId)
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

        // generate otp (valid for 5 minutes)
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // execute database insert and email dispatch concurrently in parallel
        const [insertResult, emailResult] = await Promise.all([
            supabase
                .from('otp_codes')
                .insert({
                    user_id: effectiveLoggedInUserId,
                    code_hash: hashedOTP,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                    email: email,
                    employee_name: employeeName || 'Unknown',
                }),
            sendOTPEmail({
                to: email,
                otp: otp,
                userName: employeeName || 'HR Employee',
            }).then(() => ({ success: true, error: null })).catch((err) => ({ success: false, error: err?.message || 'Failed to send email' }))
        ]);

        if (insertResult.error) {
            console.error('OTP insert error:', insertResult.error);
            return NextResponse.json(
                { message: 'Failed to generate OTP: ' + insertResult.error.message },
                { status: 500 }
            );
        }

        if (!emailResult.success) {
            console.error('Email sending failed:', emailResult.error);
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