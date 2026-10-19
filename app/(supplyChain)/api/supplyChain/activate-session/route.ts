import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateUserLoginAuthorization } from '../../../lib/services/userAccessService';

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

// activates a remembered session
export async function POST(request: Request) {
    try {
        const { session_token, user_agent } = await request.json();

        if (!session_token) {
            return NextResponse.json(
                { message: 'Session token is required' },
                { status: 400 }
            );
        }

        // get ip address
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            request.headers.get('cf-connecting-ip') ||
            'Unknown';

        // find session
        const { data: session, error: findError } = await supabaseAdmin
            .from('sessions')
            .select('*')
            .eq('session_token', session_token)
            .maybeSingle();

        if (findError || !session) {
            return NextResponse.json(
                { message: 'Session not found' },
                { status: 404 }
            );
        }

        // Check user role
        const { data: userRecord } = await supabaseAdmin
            .from('users')
            .select('id, email, display_name, role')
            .eq('id', session.user_id)
            .maybeSingle();

        const role = userRecord?.role || 'Employee';

        // Check user access control (schedule & permission)
        const authValidation = await validateUserLoginAuthorization({
            userId: session.user_id,
            email: session.email || userRecord?.email || '',
            role: role,
        });

        if (!authValidation.allowed) {
            return NextResponse.json(
                {
                    message: authValidation.reason,
                    notAllowed: true,
                    user: {
                        id: session.user_id,
                        email: session.email || userRecord?.email || '',
                        display_name: userRecord?.display_name || session.email,
                        role: role,
                    },
                },
                { status: 403 }
            );
        }

        // 1. Fetch system concurrency slot configuration
        const { data: settingsRow } = await supabaseAdmin
            .from('sc_system_settings')
            .select('concurrency_slots')
            .eq('id', 'default_settings')
            .maybeSingle();

        const slots = settingsRow?.concurrency_slots || {
            executiveSlots: 10,
            managerSlots: 20,
            employeeSlots: 70,
            supplierSlots: 10,
        };

        const executiveSlots = slots.executiveSlots ?? 10;
        const managerSlots = slots.managerSlots ?? 20;
        const employeeSlots = slots.employeeSlots ?? 70;
        const supplierSlots = slots.supplierSlots ?? 10;
        const totalCapacity = executiveSlots + managerSlots + employeeSlots + supplierSlots;

        // 2. Fetch active sessions via supabaseAdmin
        const { data: activeSessions } = await supabaseAdmin
            .from('sessions')
            .select('id, user_id, is_active, in_queue')
            .eq('is_active', true);

        // Exclude current session
        const activeList = (activeSessions || []).filter(s => s.id !== session.id && s.user_id !== session.user_id);
        const userIds = activeList.map(s => s.user_id).filter(Boolean);

        const userRolesMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: usersData } = await supabaseAdmin
                .from('users')
                .select('id, role')
                .in('id', userIds);

            (usersData || []).forEach(u => {
                userRolesMap[u.id] = (u.role || 'Employee').toLowerCase();
            });
        }

        const totalActive = activeList.length;

        let activeExecAdmin = 0;
        let activeManager = 0;
        let activeEmployee = 0;
        let activeSupplier = 0;

        activeList.forEach((s) => {
            const r = userRolesMap[s.user_id] || 'employee';
            if (r === 'executive' || r === 'admin') activeExecAdmin++;
            else if (r === 'manager' || r === 'purchase officer' || r === 'purchase_officer') activeManager++;
            else if (r === 'supplier') activeSupplier++;
            else activeEmployee++;
        });

        const normRole = role.toLowerCase();
        let isAdmitted = false;
        let tierName = 'Staff & Operator';
        let tierSlots = employeeSlots;
        let tierActive = activeEmployee;

        if (normRole === 'executive' || normRole === 'admin') {
            tierName = 'Executive/Admin';
            tierSlots = executiveSlots;
            tierActive = activeExecAdmin;
            isAdmitted = activeExecAdmin < executiveSlots;
        } else if (normRole === 'manager' || normRole === 'purchase officer' || normRole === 'purchase_officer') {
            tierName = 'Purchase Officer';
            tierSlots = managerSlots;
            tierActive = activeManager;
            isAdmitted = activeManager < managerSlots;
        } else if (normRole === 'supplier') {
            tierName = 'Supplier';
            tierSlots = supplierSlots;
            tierActive = activeSupplier;
            isAdmitted = activeSupplier < supplierSlots;
        } else {
            tierName = 'Staff & Operator';
            tierSlots = employeeSlots;
            tierActive = activeEmployee;
            isAdmitted = activeEmployee < employeeSlots;
        }

        if (!isAdmitted) {
            // Set session into queue
            await supabaseAdmin
                .from('sessions')
                .update({
                    in_queue: true,
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', session.id);

            const { count: inQueueCount } = await supabaseAdmin
                .from('sessions')
                .select('*', { count: 'exact', head: true })
                .eq('in_queue', true);

            return NextResponse.json(
                {
                    queued: true,
                    position: inQueueCount || 1,
                    activeUsers: totalActive,
                    maxCapacity: totalCapacity,
                    tierName,
                    tierActive,
                    tierSlots,
                    message: `The ${tierName} tier (${tierActive}/${tierSlots} slots occupied) is currently at capacity. You have been placed in the waiting queue.`
                },
                { status: 429 }
            );
        }

        // activate and update device info
        const newExpiry = new Date(Date.now() + 15 * 24 * 3600000).toISOString();
        const { data: updated, error: updateError } = await supabaseAdmin
            .from('sessions')
            .update({
                is_active: true,
                in_queue: false,
                user_agent: user_agent || session.user_agent,
                ip_address: ipAddress || session.ip_address,
                // extend 15 days
                expires_at: newExpiry,
                expires_at_remember: newExpiry,
            })
            .eq('id', session.id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json(
                { message: 'Failed to activate session' },
                { status: 500 }
            );
        }

        // log activity
        await supabaseAdmin
            .from('user_activity')
            .insert({
                user_id: session.user_id,
                action: 'SESSION_ACTIVATED',
                module: 'Authentication',
                description: `Session activated via "Login (Remembered)" for ${session.email}`,
                ip_address: ipAddress,
                user_agent: user_agent || session.user_agent,
            });

        const response = NextResponse.json({
            success: true,
            message: 'Session activated successfully',
            session: {
                id: updated.id,
                email: updated.email,
                is_active: updated.is_active,
                expires_at: updated.expires_at,
                session_token: session.session_token
            }
        });

        const cookieMaxAge = 15 * 24 * 60 * 60; // 15 days for remembered session
        response.cookies.set('sc_session_token', session.session_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: cookieMaxAge,
        });
        response.cookies.set('session_token', session.session_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: cookieMaxAge,
        });

        return response;
    } catch (error) {
        console.error('Error activating session:', error);
        return NextResponse.json(
            { message: 'Failed to activate session' },
            { status: 500 }
        );
    }
}