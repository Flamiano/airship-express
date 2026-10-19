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

export async function POST(request: Request) {
    try {
        let sessionToken = request.headers.get('x-session-token');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

        let body: any = {};
        try {
            const text = await request.text();
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch {
                    // handle formData or urlencoded from navigator.sendBeacon
                    const params = new URLSearchParams(text);
                    body = Object.fromEntries(params.entries());
                }
            }
            if (!sessionToken && (body?.session_token || body?.sessionToken)) {
                sessionToken = body.session_token || body.sessionToken;
            }
        } catch (e) {
            // no body or invalid json
        }

        // Fallback to cookie if sessionToken not in header or body
        if (!sessionToken) {
            const cookieHeader = request.headers.get('cookie') || '';
            const match = cookieHeader.match(/(?:session_token|sc_session_token)=([^;]+)/);
            if (match && match[1]) {
                sessionToken = decodeURIComponent(match[1].trim());
            }
        }

        const email = body?.email;
        const userId = body?.user_id || body?.userId;

        let session: any = null;

        if (sessionToken) {
            const { data } = await supabaseAdmin
                .from('sessions')
                .select('*')
                .eq('session_token', sessionToken)
                .maybeSingle();
            session = data;
        }

        if (!session && email) {
            const { data } = await supabaseAdmin
                .from('sessions')
                .select('*')
                .eq('email', email)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            session = data;
        }

        if (!session && userId) {
            const { data } = await supabaseAdmin
                .from('sessions')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            session = data;
        }

        const isInactive = body?.reason === 'user_inactive' || body?.action === 'INACTIVITY_TIMEOUT';
        const deactivationReason = isInactive ? 'inactivity_timeout' : 'user_logout';

        // 1. Deactivate by session token if provided
        if (sessionToken) {
            const { error: updateErr } = await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    user_agent: userAgent,
                    updated_at: new Date().toISOString(),
                })
                .eq('session_token', sessionToken);
            if (updateErr) {
                console.error('[Logout] Error deactivating session by token:', updateErr);
            }
        }

        // 2. Deactivate by user_id if known
        const targetUserId = userId || session?.user_id;
        if (targetUserId) {
            const { error: updateErr } = await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    user_agent: userAgent,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', targetUserId);
            if (updateErr) {
                console.error('[Logout] Error deactivating session by user_id:', updateErr);
            }
        }

        // 3. Deactivate by email if known (essential for suppliers & employees)
        const targetEmail = (email || session?.email || '').trim().toLowerCase();
        if (targetEmail) {
            const { error: updateErr } = await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    user_agent: userAgent,
                    updated_at: new Date().toISOString(),
                })
                .ilike('email', targetEmail);
            if (updateErr) {
                console.error('[Logout] Error deactivating session by email:', updateErr);
            }
        }

        if (!session && !sessionToken && !email && !userId) {
            return NextResponse.json(
                { message: 'No active session identifier provided', deactivated: true },
                { status: 200 }
            );
        }

        const action = body?.action || (isInactive ? 'INACTIVITY_TIMEOUT' : 'LOGOUT');
        const description = body?.description || (isInactive
            ? `Session ended: user inactive${session?.hr_employee_name ? ` (${session.hr_employee_name})` : ''}`
            : `User logged out${session?.hr_employee_name ? ` (${session.hr_employee_name})` : ''}`);

        // log activity
        if (session?.user_id) {
            try {
                await supabaseAdmin
                    .from('user_activity')
                    .insert({
                        user_id: session.user_id,
                        action: action,
                        module: 'Authentication',
                        description: description,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    });
            } catch (activityError) {
                // non-critical
            }
        }

        const response = NextResponse.json({
            message: 'Logged out successfully',
            session_id: session?.id || null,
            deactivated: true,
        });

        response.cookies.set('sc_session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
        response.cookies.set('session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
        response.cookies.set('session_backup', '', { path: '/', maxAge: 0 });
        response.cookies.set('user_role', '', { path: '/', maxAge: 0 });

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { message: 'Failed to logout' },
            { status: 500 }
        );
    }
}

// preflight support
export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 });
}