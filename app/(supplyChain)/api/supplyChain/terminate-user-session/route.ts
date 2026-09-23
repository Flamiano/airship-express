import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        const cookiesHeader = request.headers.get('cookie') || '';
        const cookieToken = cookiesHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('sc_session_token=') || c.startsWith('session_token='))
            ?.split('=')[1];

        const callerSessionToken = request.headers.get('x-session-token') || cookieToken;
        if (!callerSessionToken) {
            return NextResponse.json(
                { success: false, message: 'Missing caller authorization session token' },
                { status: 401 }
            );
        }

        // 1. Verify caller has Admin or Executive role
        const { data: callerSession, error: callerError } = await supabaseAdmin
            .from('sessions')
            .select(`
                id,
                user_id,
                is_active,
                users!inner (
                    id,
                    display_name,
                    email,
                    role
                )
            `)
            .eq('session_token', callerSessionToken)
            .eq('is_active', true)
            .maybeSingle();

        if (callerError || !callerSession) {
            return NextResponse.json(
                { success: false, message: 'Invalid or expired caller session' },
                { status: 401 }
            );
        }

        const callerRole = ((callerSession.users as any)?.role || '').toLowerCase().trim();
        const callerName = (callerSession.users as any)?.display_name || 'Administrator';
        const callerId = callerSession.user_id;

        if (!['admin', 'executive'].includes(callerRole)) {
            return NextResponse.json(
                { success: false, message: 'Only Administrators and Executives are authorized to terminate user sessions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { sessionId, reason } = body;

        if (!sessionId) {
            return NextResponse.json(
                { success: false, message: 'Target sessionId is required' },
                { status: 400 }
            );
        }

        // 2. Fetch target session details and verify target role
        const { data: targetSession, error: targetError } = await supabaseAdmin
            .from('sessions')
            .select(`
                id,
                user_id,
                email,
                is_active,
                ip_address,
                user_agent,
                users!inner (
                    id,
                    display_name,
                    email,
                    role
                )
            `)
            .eq('id', sessionId)
            .maybeSingle();

        if (targetError || !targetSession) {
            return NextResponse.json(
                { success: false, message: 'Target session not found' },
                { status: 404 }
            );
        }

        const targetUser = (targetSession.users as any) || {};
        const targetRole = (targetUser.role || '').toLowerCase().trim();
        const targetName = targetUser.display_name || targetSession.email || 'User';

        // 3. ENFORCE HIERARCHY RULE:
        // - Executive accounts are protected from remote logout.
        // - Admins and Executives are authorized to log out Managers, Employees, Operators, and Admins.
        if (targetRole === 'executive') {
            return NextResponse.json(
                {
                    success: false,
                    message: `Cannot terminate session: ${targetName} is an Executive. Executive accounts are protected from remote logout.`
                },
                { status: 403 }
            );
        }

        if (!['admin', 'executive'].includes(callerRole)) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized: Only Executives and Admins can terminate user sessions.' },
                { status: 403 }
            );
        }

        // 4. Deactivate the session
        const { error: deactivateError } = await supabaseAdmin
            .from('sessions')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

        if (deactivateError) {
            console.error('Error deactivating target session:', deactivateError);
            return NextResponse.json(
                { success: false, message: 'Failed to deactivate session' },
                { status: 500 }
            );
        }

        // 5. Log audit trail in user_activity
        try {
            const userAgent = request.headers.get('user-agent') || 'Server';
            const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

            await supabaseAdmin.from('user_activity').insert({
                user_id: callerId,
                action: 'REMOTE_LOGOUT',
                module: 'User Activity',
                description: `${callerName} (${callerSession.users ? (callerSession.users as any).role : 'Admin'}) remotely logged out ${targetName} (${targetUser.role || 'Employee'}). Reason: ${reason || 'Administrator action'}`,
                ip_address: ipAddress,
                user_agent: userAgent,
                created_at: new Date().toISOString(),
            });
        } catch (logErr) {
            console.warn('Could not record user_activity for remote logout:', logErr);
        }

        return NextResponse.json({
            success: true,
            message: `Successfully logged out ${targetName} (${targetUser.role || 'Employee'}).`
        });

    } catch (error: any) {
        console.error('Error in terminate-user-session route:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
