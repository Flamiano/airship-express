import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { found: false, message: 'Email is required' },
                { status: 400 }
            );
        }

        // find session by email
        const { data: session, error } = await supabase
            .from('sessions')
            .select('email, remember_me, expires_at, user_agent, hr_employee_name, user_id, session_token, is_active')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { found: false, message: 'Database error' },
                { status: 500 }
            );
        }

        if (!session) {
            return NextResponse.json(
                { found: false },
                { status: 404 }
            );
        }

        // get user role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user_id)
            .maybeSingle();

        // check expiration
        const isExpired = new Date(session.expires_at) < new Date();

        // check if actively logged in on another device
        const isCurrentlyActive = session.is_active === true && !isExpired;

        return NextResponse.json({
            found: true,
            remember_me: session.remember_me,
            expires_at: session.expires_at,
            user_agent: session.user_agent || '',
            hr_employee_name: session.hr_employee_name,
            is_expired: isExpired,
            is_active: session.is_active,
            is_currently_active: isCurrentlyActive,
            role: userData?.role || 'Employee',
            user_id: session.user_id,
            session_token: session.session_token
        });
    } catch (error) {
        console.error('Error checking employee session:', error);
        return NextResponse.json(
            { found: false, message: 'Server error' },
            { status: 500 }
        );
    }
}