// app/(supplyChain)/api/auth/supplyChain/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Check credentials against role_based_accounts table
        const { data: userData, error: userError } = await supabase
            .from('role_based_accounts')
            .select('id, email, role, status, password_hash')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            return NextResponse.json(
                { message: 'Invalid email or password' },
                { status: 401 }
            );
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
            return NextResponse.json(
                { message: 'Invalid email or password' },
                { status: 401 }
            );
        }

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