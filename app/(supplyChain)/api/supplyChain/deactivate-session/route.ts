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
        let body: any = {};
        try {
            body = await request.json();
            if (!sessionToken && (body?.sessionToken || body?.session_token)) {
                sessionToken = body.sessionToken || body.session_token;
            }
        } catch (e) {
            // ignore
        }

        let email = body?.email;
        let userId = body?.user_id || body?.userId;

        if (!sessionToken) {
            const cookieHeader = request.headers.get('cookie') || '';
            const match = cookieHeader.match(/(?:session_token|sc_session_token)=([^;]+)/);
            if (match && match[1]) {
                sessionToken = decodeURIComponent(match[1].trim());
            }
        }

        if (!sessionToken && !email && !userId) {
            return NextResponse.json({ ok: false, message: 'No session token or user identifier' }, { status: 400 });
        }

        if (sessionToken) {
            await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString()
                })
                .eq('session_token', sessionToken);
        }

        if (userId) {
            await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('is_active', true);
        } else if (email) {
            await supabaseAdmin
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString()
                })
                .eq('email', email)
                .eq('is_active', true);
        }

        const response = NextResponse.json({ ok: true, message: 'Session deactivated' });
        response.cookies.set('sc_session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
        response.cookies.set('session_token', '', { httpOnly: true, path: '/', maxAge: 0 });
        response.cookies.set('session_backup', '', { path: '/', maxAge: 0 });
        response.cookies.set('user_role', '', { path: '/', maxAge: 0 });
        return response;
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}