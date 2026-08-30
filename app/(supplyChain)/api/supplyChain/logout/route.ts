import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        let sessionToken = request.headers.get('x-session-token');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

        // try body if header missing
        if (!sessionToken) {
            try {
                const body = await request.json();
                sessionToken = body.session_token;
            } catch (e) {
                // no body or invalid json
            }
        }

        if (!sessionToken) {
            return NextResponse.json(
                { message: 'No session found' },
                { status: 400 }
            );
        }

        // find session
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_token', sessionToken)
            .single();

        if (sessionError || !session) {
            return NextResponse.json(
                { message: 'Session not found' },
                { status: 404 }
            );
        }

        // deactivate session but keep for reuse
        const { error: updateError } = await supabase
            .from('sessions')
            .update({
                is_active: false,
                user_agent: userAgent,
            })
            .eq('id', session.id);

        if (updateError) {
            console.error('Failed to deactivate session:', updateError);
            return NextResponse.json(
                { message: 'Failed to logout' },
                { status: 500 }
            );
        }

        // log activity
        try {
            await supabase
                .from('user_activity')
                .insert({
                    user_id: session.user_id,
                    action: 'LOGOUT',
                    module: 'Authentication',
                    description: `User logged out${session.hr_employee_name ? ` (${session.hr_employee_name})` : ''}`,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                });
        } catch (activityError) {
            // non-critical
        }

        return NextResponse.json({
            message: 'Logged out successfully',
            session_id: session.id,
            deactivated: true,
        });
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