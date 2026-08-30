// app/(supplyChain)/api/supplyChain/deactivate-session/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        let sessionToken;
        try {
            const body = await request.json();
            sessionToken = body.sessionToken;
        } catch (e) {
            // no body or invalid json
        }

        if (!sessionToken) {
            sessionToken = request.headers.get('x-session-token');
        }

        if (!sessionToken) {
            return NextResponse.json(
                { message: 'Session token is required' },
                { status: 400 }
            );
        }

        // find the session
        const { data: session, error: findError } = await supabase
            .from('sessions')
            .select('id, user_id')
            .eq('session_token', sessionToken)
            .maybeSingle();

        if (findError || !session) {
            return NextResponse.json(
                { message: 'Session not found' },
                { status: 404 }
            );
        }

        // deactivate the session
        const { error: updateError } = await supabase
            .from('sessions')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

        if (updateError) {
            console.error('Failed to deactivate session:', updateError);
            return NextResponse.json(
                { message: 'Failed to deactivate session' },
                { status: 500 }
            );
        }

        // log activity
        try {
            await supabase
                .from('user_activity')
                .insert({
                    user_id: session.user_id,
                    action: 'SESSION_DEACTIVATED',
                    module: 'Authentication',
                    description: 'Session deactivated via API',
                    ip_address: request.headers.get('x-forwarded-for') || 'Unknown',
                    user_agent: request.headers.get('user-agent') || 'Unknown',
                    created_at: new Date().toISOString(),
                });
        } catch (activityError) {
            // non-critical
        }

        return NextResponse.json({
            success: true,
            message: 'Session deactivated successfully',
            session_id: session.id
        });
    } catch (error) {
        console.error('Error deactivating session:', error);
        return NextResponse.json(
            { message: 'Failed to deactivate session' },
            { status: 500 }
        );
    }
}

// support preflight
export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 });
}