import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const sessionToken = request.headers.get('x-session-token');
        const currentUserAgent = request.headers.get('user-agent') || '';

        if (!sessionToken) {
            return NextResponse.json(
                { remembered: false, message: 'No session token' },
                { status: 401 }
            );
        }

        // find session by token
        const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_token', sessionToken)
            .maybeSingle();

        if (error) {
            return NextResponse.json(
                { remembered: false, message: 'Database error: ' + error.message },
                { status: 500 }
            );
        }

        if (!session) {
            return NextResponse.json(
                { remembered: false, message: 'Session not found' },
                { status: 401 }
            );
        }

        // check expiration
        if (new Date(session.expires_at) < new Date()) {
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('id', session.id);

            return NextResponse.json(
                { remembered: false, message: 'Session expired' },
                { status: 401 }
            );
        }

        // check if remembered
        if (!session.remember_me) {
            return NextResponse.json(
                { remembered: false, message: 'Not remembered' },
                { status: 401 }
            );
        }

        // get user info
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, display_name, email, role')
            .eq('id', session.user_id)
            .maybeSingle();

        if (userError) {
            // fallback to session data
            return NextResponse.json({
                remembered: true,
                differentDevice: false,
                session: {
                    email: session.email,
                    hr_employee_name: session.hr_employee_name,
                    expires_at: session.expires_at,
                },
                user: {
                    id: session.user_id,
                    display_name: 'User',
                    email: session.email,
                    role: 'Employee',
                }
            });
        }

        // check if same device
        const storedUserAgent = session.user_agent || '';
        const isSameDevice = storedUserAgent === currentUserAgent;

        if (!isSameDevice) {
            return NextResponse.json({
                remembered: true,
                differentDevice: true,
                session: {
                    email: session.email,
                    hr_employee_name: session.hr_employee_name,
                    expires_at: session.expires_at,
                },
                user: {
                    id: userData?.id || session.user_id,
                    display_name: userData?.display_name || 'User',
                    email: userData?.email || session.email,
                    role: userData?.role || 'Employee',
                }
            });
        }

        // reactivate if inactive
        if (!session.is_active) {
            await supabase
                .from('sessions')
                .update({
                    is_active: true,
                    user_agent: currentUserAgent
                })
                .eq('id', session.id);
        }

        return NextResponse.json({
            remembered: true,
            differentDevice: false,
            session: {
                email: session.email,
                hr_employee_name: session.hr_employee_name,
                expires_at: session.expires_at,
            },
            user: {
                id: userData?.id || session.user_id,
                display_name: userData?.display_name || 'User',
                email: userData?.email || session.email,
                role: userData?.role || 'Employee',
            }
        });
    } catch (error) {
        return NextResponse.json(
            { remembered: false, message: 'Server error: ' + (error as Error).message },
            { status: 500 }
        );
    }
}