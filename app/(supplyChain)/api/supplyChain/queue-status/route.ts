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

const queueStatusCache = new Map<string, { data: any; timestamp: number }>();
const QUEUE_CACHE_TTL_MS = 5000;

// GET /api/supplyChain/queue-status
// Returns live concurrency count, tiered slot allocation, and queue stats
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const targetRole = url.searchParams.get('role') || '';
        const normRole = targetRole.toLowerCase();

        const cached = queueStatusCache.get(normRole);
        if (cached && (Date.now() - cached.timestamp < QUEUE_CACHE_TTL_MS)) {
            return NextResponse.json(cached.data);
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

        // 2. Fetch all active sessions via supabaseAdmin
        const { data: activeSessions, error: activeErr } = await supabaseAdmin
            .from('sessions')
            .select('id, user_id, is_active, in_queue')
            .eq('is_active', true);

        if (activeErr) throw activeErr;

        const sessionsList = activeSessions || [];
        const totalActive = sessionsList.length;
        const userIds = sessionsList.map(s => s.user_id).filter(Boolean);

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

        let activeExecutiveAdmin = 0;
        let activeManager = 0;
        let activeEmployee = 0;
        let activeSupplier = 0;

        sessionsList.forEach((s) => {
            const r = userRolesMap[s.user_id] || 'employee';
            if (r === 'executive' || r === 'admin') {
                activeExecutiveAdmin++;
            } else if (r === 'manager') {
                activeManager++;
            } else if (r === 'supplier') {
                activeSupplier++;
            } else {
                activeEmployee++;
            }
        });

        // 3. Fetch users waiting in queue and their roles
        const { data: queuedSessions, error: queuedErr } = await supabaseAdmin
            .from('sessions')
            .select(`
                id,
                user_id,
                email,
                hr_employee_name,
                created_at,
                updated_at,
                in_queue,
                users (
                    id,
                    display_name,
                    role,
                    email
                )
            `)
            .eq('in_queue', true);

        if (queuedErr) console.warn('Error fetching queued sessions:', queuedErr);

        const queuedList = queuedSessions || [];
        const inQueueCount = queuedList.length;

        const queuedRolesCount: Record<string, number> = {};
        const queuedUsersSummary: Array<{ id: string; name: string; email: string; role: string }> = [];

        queuedList.forEach((s) => {
            const userObj = Array.isArray(s.users) ? s.users[0] : s.users;
            let roleStr = userObj?.role || '';
            if (!roleStr) {
                // capitalize first letter if found in userRolesMap
                const mapped = userRolesMap[s.user_id];
                roleStr = mapped ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : 'Employee';
            }
            const name = userObj?.display_name || s.hr_employee_name || s.email || 'User';
            queuedRolesCount[roleStr] = (queuedRolesCount[roleStr] || 0) + 1;
            queuedUsersSummary.push({
                id: s.id,
                name,
                email: s.email,
                role: roleStr,
            });
        });

        // 4. Compute role-specific availability based strictly on role slot limits
        const employeeAvailable = activeEmployee < employeeSlots;
        const managerAvailable = activeManager < managerSlots;
        const executiveAvailable = activeExecutiveAdmin < executiveSlots;
        const supplierAvailable = activeSupplier < supplierSlots;

        let roleSpecificAvailable = false;
        if (normRole === 'executive' || normRole === 'admin') {
            roleSpecificAvailable = executiveAvailable;
        } else if (normRole === 'manager') {
            roleSpecificAvailable = managerAvailable;
        } else if (normRole === 'supplier') {
            roleSpecificAvailable = supplierAvailable;
        } else if (targetRole) {
            roleSpecificAvailable = employeeAvailable;
        } else {
            roleSpecificAvailable = employeeAvailable || managerAvailable || executiveAvailable || supplierAvailable;
        }

        let roleActive = totalActive;
        let roleSlots = totalCapacity;
        if (normRole === 'executive' || normRole === 'admin') {
            roleActive = activeExecutiveAdmin;
            roleSlots = executiveSlots;
        } else if (normRole === 'manager') {
            roleActive = activeManager;
            roleSlots = managerSlots;
        } else if (normRole === 'supplier') {
            roleActive = activeSupplier;
            roleSlots = supplierSlots;
        } else if (targetRole) {
            roleActive = activeEmployee;
            roleSlots = employeeSlots;
        }

        const payload = {
            totalActive,
            maxCapacity: totalCapacity,
            roleActive,
            roleSlots,
            available: roleSpecificAvailable,
            queuedCount: inQueueCount,
            queuedRolesCount,
            queuedUsersSummary,
            slots: {
                executive: {
                    reserved: executiveSlots,
                    active: activeExecutiveAdmin,
                    available: Math.max(0, executiveSlots - activeExecutiveAdmin),
                },
                manager: {
                    reserved: managerSlots,
                    active: activeManager,
                    available: Math.max(0, managerSlots - activeManager),
                },
                employee: {
                    reserved: employeeSlots,
                    active: activeEmployee,
                    available: Math.max(0, employeeSlots - activeEmployee),
                },
                supplier: {
                    reserved: supplierSlots,
                    active: activeSupplier,
                    available: Math.max(0, supplierSlots - activeSupplier),
                },
            },
            roleAvailability: {
                executive: executiveAvailable,
                manager: managerAvailable,
                employee: employeeAvailable,
                supplier: supplierAvailable,
            },
        };

        queueStatusCache.set(normRole, { data: payload, timestamp: Date.now() });

        return NextResponse.json(payload);
    } catch (err: any) {
        console.error('Error fetching queue status:', err);
        return NextResponse.json(
            { error: 'Failed to retrieve queue status' },
            { status: 500 }
        );
    }
}
