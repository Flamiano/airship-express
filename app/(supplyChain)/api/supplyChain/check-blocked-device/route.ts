import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get('user-id');
        const userAgent = request.headers.get('user-agent');
        const sessionToken = request.headers.get('x-session-token');

        // validate required headers
        if (!userId) {
            return NextResponse.json(
                { blocked: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!userAgent) {
            return NextResponse.json(
                { blocked: false, error: 'User agent is required' },
                { status: 400 }
            );
        }

        if (!sessionToken) {
            return NextResponse.json(
                { blocked: false, error: 'Session token is required' },
                { status: 401 }
            );
        }

        // check if device is blocked
        const { data, error } = await supabase
            .from('blocked_devices')
            .select('id, device_name, reason, status, blocked_at')
            .eq('user_id', userId)
            .eq('user_agent', userAgent)
            .eq('status', 'blocked')
            .maybeSingle();

        if (error) {
            console.error('Supabase error checking blocked device:', error);
            return NextResponse.json(
                { blocked: false, error: 'Database error' },
                { status: 500 }
            );
        }

        // device is blocked
        if (data) {
            return NextResponse.json({
                blocked: true,
                device_id: data.id,
                device_name: data.device_name,
                reason: data.reason || 'Device blocked by administrator',
                blocked_at: data.blocked_at,
                status: data.status,
            });
        }

        // device is not blocked
        return NextResponse.json({ blocked: false });

    } catch (error) {
        console.error('Error in check-blocked-device API:', error);
        return NextResponse.json(
            { blocked: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}