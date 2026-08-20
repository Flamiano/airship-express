import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const sessionToken = request.headers.get('x-session-token');

        if (!sessionToken) {
            return NextResponse.json(
                { valid: false, message: 'No session token' },
                { status: 401 }
            );
        }

        const { data: session, error } = await supabase
            .from('sessions')
            .select('*, users!inner(*)')
            .eq('session_token', sessionToken)
            .eq('is_active', true)
            .single();

        if (error || !session) {
            return NextResponse.json(
                { valid: false, message: 'Invalid or expired session' },
                { status: 401 }
            );
        }

        // check expiration
        const expiresAt = new Date(session.expires_at);
        if (expiresAt < new Date()) {
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('id', session.id);

            return NextResponse.json(
                { valid: false, message: 'Session expired' },
                { status: 401 }
            );
        }

        // check for duplicate active sessions
        const { data: activeSessions } = await supabase
            .from('sessions')
            .select('id')
            .eq('user_id', session.user_id)
            .eq('is_active', true);

        if (activeSessions && activeSessions.length > 1) {
            // keep only this session
            const otherSessions = activeSessions.filter(s => s.id !== session.id);
            for (const otherSession of otherSessions) {
                await supabase
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('id', otherSession.id);
            }
        }

        // calculate remaining time
        const remainingMs = expiresAt.getTime() - new Date().getTime();
        const remainingHours = Math.floor(remainingMs / 3600000);
        const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);

        return NextResponse.json({
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
            },
            user: {
                id: session.users.id,
                display_name: session.users.display_name,
                email: session.users.email,
                role: session.users.role,
                department: session.users.department,
            }
        });
    } catch (error) {
        console.error('Session validation error:', error);
        return NextResponse.json(
            { valid: false, message: 'Session validation failed' },
            { status: 500 }
        );
    }
}