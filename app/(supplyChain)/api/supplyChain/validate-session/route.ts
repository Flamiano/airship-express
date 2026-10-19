import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { DEFAULT_ALLOWED_DAYS, DEFAULT_TIME_START, DEFAULT_TIME_END } from '../../../lib/services/userAccessService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export async function GET(request: Request) {
    try {
        let sessionToken = request.headers.get('x-session-token');

        // Fallback to query params or cookies if header is missing
        if (!sessionToken) {
            const { searchParams } = new URL(request.url);
            sessionToken = searchParams.get('session_token') || searchParams.get('token');
        }

        if (!sessionToken) {
            const cookieHeader = request.headers.get('cookie') || '';
            const match = cookieHeader.match(/(?:session_token|sc_session_token)=([^;]+)/);
            if (match && match[1]) {
                sessionToken = decodeURIComponent(match[1].trim());
            }
        }

        if (!sessionToken) {
            return NextResponse.json(
                { valid: false, message: 'No session token' },
                { status: 401 }
            );
        }

        const { data: session, error } = await supabaseAdmin
            .from('sessions')
            .select('*')
            .eq('session_token', sessionToken)
            .maybeSingle();

        if (error || !session) {
            const res = NextResponse.json(
                { valid: false, message: 'Invalid or non-existent session' },
                { status: 401 }
            );
            res.cookies.set('sc_session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
            res.cookies.set('session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
            return res;
        }

        if (!session.is_active) {
            const res = NextResponse.json(
                { valid: false, message: 'Session is inactive or terminated', session_cleared: true },
                { status: 401 }
            );
            res.cookies.set('sc_session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
            res.cookies.set('session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
            return res;
        }

        // check expiration for timed sessions
        const expiryDate = session.expires_at_remember || session.expires_at;
        if (expiryDate) {
            const expiresAt = new Date(expiryDate);
            if (expiresAt < new Date()) {
                await supabaseAdmin
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('id', session.id);

                return NextResponse.json(
                    { valid: false, message: 'Session expired' },
                    { status: 401 }
                );
            }
        }

        // Resolve user information directly from users table
        let userId = session.user_id;
        let userRole = 'Operator';
        let userDisplayName = session.hr_employee_name || 'User';
        let userEmail = session.email || '';
        let userDepartment = '';

        let userQuery = supabaseAdmin.from('users').select('*');
        if (userId) {
            userQuery = userQuery.eq('id', userId);
        } else if (session.email) {
            userQuery = userQuery.ilike('email', session.email);
        }

        const { data: userData } = await userQuery.maybeSingle();
        if (userData) {
            userId = userData.id;
            userRole = userData.role || userRole;
            userDisplayName = userData.display_name || userData.name || userDisplayName;
            userEmail = userData.email || userEmail;
            userDepartment = userData.department || '';
        }

        // calculate remaining time
        let remainingHours = 0;
        let remainingMinutes = 0;
        if (session.expires_at) {
            const remainingMs = Math.max(0, new Date(session.expires_at).getTime() - new Date().getTime());
            remainingHours = Math.floor(remainingMs / 3600000);
            remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);
        }

        const response = NextResponse.json({
            valid: true,
            remember_me: session.remember_me || false,
            expires_at: session.expires_at,
            remaining: {
                hours: remainingHours,
                minutes: remainingMinutes,
            },
            session: {
                id: session.id,
                email: session.email,
                hr_employee_name: session.hr_employee_name,
                allowed_time_start: session.allowed_time_start || DEFAULT_TIME_START,
                allowed_time_end: session.allowed_time_end || DEFAULT_TIME_END,
                allowed_days: session.allowed_days || DEFAULT_ALLOWED_DAYS,
                is_allow: session.is_allow !== null && session.is_allow !== undefined ? Boolean(session.is_allow) : true,
            },
            user: {
                id: userId,
                display_name: userDisplayName,
                email: userEmail,
                role: userRole,
                department: userDepartment,
                allowed_time_start: session.allowed_time_start || DEFAULT_TIME_START,
                allowed_time_end: session.allowed_time_end || DEFAULT_TIME_END,
                allowed_days: session.allowed_days || DEFAULT_ALLOWED_DAYS,
                is_allow: session.is_allow !== null && session.is_allow !== undefined ? Boolean(session.is_allow) : true,
            }
        });

        const cookieMaxAge = session.remember_me ? 15 * 24 * 60 * 60 : 24 * 60 * 60;
        response.cookies.set('sc_session_token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: cookieMaxAge,
        });
        response.cookies.set('session_token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: cookieMaxAge,
        });

        return response;
    } catch (error) {
        console.error('Session validation error:', error);
        return NextResponse.json(
            { valid: false, message: 'Session validation failed' },
            { status: 500 }
        );
    }
}