import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

const VALID_ROLES = ['Admin', 'Manager', 'Employee', 'Executive', 'Operator'];

export async function GET(request: Request) {
    try {
        const sessionToken = request.headers.get('x-session-token');
        const currentUserAgent = request.headers.get('user-agent') || '';


        if (!sessionToken) {
            return NextResponse.json(
                { valid: false },
                { status: 401 }
            );
        }

        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_token', sessionToken)
            .eq('is_active', true)
            .maybeSingle();

        if (sessionError || !session) {
            return NextResponse.json(
                { valid: false },
                { status: 401 }
            );
        }



        if (new Date(session.expires_at) < new Date()) {
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('id', session.id);

            return NextResponse.json(
                { valid: false, session_cleared: true },
                { status: 401 }
            );
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, display_name, email, role, department')
            .eq('id', session.user_id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json(
                { valid: false, session_cleared: true },
                { status: 401 }
            );
        }

        if (!user.role || !VALID_ROLES.includes(user.role)) {
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('id', session.id);

            return NextResponse.json(
                { valid: false, session_cleared: true, invalid_role: true },
                { status: 401 }
            );
        }


        const storedUserAgent = session.user_agent || '';
        const isSameDevice = storedUserAgent === currentUserAgent;

        if (!isSameDevice) {
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('id', session.id);

            await supabase
                .from('user_activity')
                .insert({
                    user_id: session.user_id,
                    action: 'DEVICE_MISMATCH',
                    module: 'Authentication',
                    description: `Session invalidated due to device mismatch. Stored: ${storedUserAgent}, Current: ${currentUserAgent}`,
                    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
                    user_agent: currentUserAgent,
                });

            return NextResponse.json(
                { valid: false, message: 'Different device detected', session_cleared: true },
                { status: 401 }
            );
        }

        return NextResponse.json({
            valid: true,
            user: {
                id: user.id,
                display_name: user.display_name,
                email: user.email,
                role: user.role,
                department: user.department,
            }
        });
    } catch (error) {
        return NextResponse.json(
            { valid: false, session_cleared: true },
            { status: 500 }
        );
    }
}