import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const cookieHeader = request.headers.get('cookie') || '';
        const cookieMatch = cookieHeader.match(/(?:session_token|sc_session_token)=([^;]+)/);
        const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : '';
        const clientToken = request.headers.get('x-session-token') || searchParams.get('session_token') || cookieToken;

        if (!email) {
            return NextResponse.json(
                { found: false, message: 'Email is required' },
                { status: 400 }
            );
        }

        // find session by token first if provided, or by email ordered by latest updated_at
        let session: any = null;

        if (clientToken) {
            const { data } = await supabaseAdmin
                .from('sessions')
                .select('email, remember_me, expires_at, expires_at_remember, user_agent, hr_employee_name, user_id, session_token, is_active')
                .eq('session_token', clientToken)
                .maybeSingle();
            session = data;
        }

        if (!session) {
            const { data: sessions, error } = await supabaseAdmin
                .from('sessions')
                .select('email, remember_me, expires_at, expires_at_remember, user_agent, hr_employee_name, user_id, session_token, is_active')
                .eq('email', email)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Database error fetching session:', error);
                return NextResponse.json(
                    { found: false, message: 'Database error' },
                    { status: 500 }
                );
            }

            if (sessions && sessions.length > 0) {
                session = sessions[0];
            }
        }

        if (!session) {
            return NextResponse.json(
                { found: false },
                { status: 404 }
            );
        }

        // check expiration against current time
        const expiryDate = session.expires_at_remember || session.expires_at;
        const isExpired = Boolean(expiryDate && new Date(expiryDate) < new Date());

        // Cryptographic Device Validation:
        // A device is remembered on this specific browser only if clientToken matches session_token, remember_me is true, and session is not expired
        const isTokenMatch = Boolean(clientToken && session.session_token && clientToken === session.session_token);
        const isRemembered = Boolean(session.remember_me && !isExpired && isTokenMatch);

        // Check if actively logged in on another device:
        const isCurrentlyActive = Boolean(session.is_active === true && !isExpired && !isTokenMatch);

        // get user role
        let userRole: string | undefined = undefined;
        if (session.user_id) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('role')
                .eq('id', session.user_id)
                .maybeSingle();

            if (userData?.role) {
                userRole = userData.role;
            }
        }

        if (!userRole) {
            const { data: hrData } = await supabaseAdmin
                .from('mock_employees')
                .select('role, position')
                .eq('email', email)
                .maybeSingle();

            if (hrData) {
                const rawRole = (hrData.role || hrData.position || '').trim();
                if (/admin/i.test(rawRole)) userRole = 'Admin';
                else if (/manager|purchase|purchasing|office-in-charge|project coordinator/i.test(rawRole)) userRole = 'Purchase Officer';
                else if (/operator|appraiser/i.test(rawRole)) userRole = 'Operator';
                else if (/executive/i.test(rawRole)) userRole = 'Executive';
                else userRole = hrData.role || 'Employee';
            } else {
                const { data: supData } = await supabaseAdmin
                    .from('suppliers_account')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();

                if (supData) {
                    userRole = 'Supplier';
                }
            }
        }

        const isSupplier = (userRole || '').toLowerCase() === 'supplier';
        const finalIsRemembered = Boolean(isRemembered && isSupplier);

        return NextResponse.json({
            found: true,
            remember_me: finalIsRemembered,
            is_same_device: isTokenMatch,
            expires_at: session.expires_at,
            hr_employee_name: session.hr_employee_name,
            is_expired: isExpired,
            is_active: session.is_active,
            is_currently_active: isCurrentlyActive,
            role: userRole || 'Employee',
            user_id: session.user_id,
            session_token: session.session_token,
        });
    } catch (error) {
        console.error('Error checking employee session:', error);
        return NextResponse.json(
            { found: false, message: 'Server error' },
            { status: 500 }
        );
    }
}