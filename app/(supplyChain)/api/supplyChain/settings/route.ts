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

const DEFAULT_INACTIVITY = {
    enabled: true,
    timeoutSeconds: 120,
    warningSeconds: 10,
    enableCountdownSound: false,
};

const DEFAULT_ROLE_REDIRECTS = {
    'Executive': '/executive',
    'Admin': '/procurement',
    'Purchase Officer': '/warehousing',
    'Operator': '/warehousing',
    'Staff': '/documents',
    'Employee': '/documents',
};

const DEFAULT_PAGE_PERMISSIONS: Record<string, string[]> = {
    '/executive': ['Executive'],
    '/warehousing': ['Executive', 'Admin', 'Purchase Officer', 'Operator'],
    '/inventory': ['Executive', 'Admin', 'Purchase Officer', 'Operator'],
    '/procurement': ['Executive', 'Admin', 'Purchase Officer'],
    '/suppliers': ['Executive', 'Admin', 'Purchase Officer'],
    '/purchase-orders': ['Superadmin', 'Admin', 'Purchase Officer', 'Executive', 'Operator', 'Supervisor', 'Staff', 'Employee'],
    '/documents': ['Executive', 'Admin', 'Purchase Officer', 'Staff', 'Employee', 'Operator'],
    '/forecast': ['Executive', 'Admin'],
    '/gallery': ['Executive', 'Admin', 'Purchase Officer', 'Staff', 'Employee', 'Operator'],
    '/trash': ['Executive', 'Admin', 'Purchase Officer', 'Staff', 'Employee', 'Operator'],
    '/user-activity': ['Executive', 'Admin'],
    '/settings': ['Executive', 'Admin'],
};

const DEFAULT_CONCURRENCY_SLOTS = {
    executiveSlots: 10, // Reserved exclusively for Executives & Admins
    managerSlots: 20,   // Reserved for Managers + Executives/Admins
    employeeSlots: 70,  // For Staff & Operators (max: 650)
    supplierSlots: 10,  // For Suppliers (max: 50)
};

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('sc_system_settings')
            .select('*')
            .eq('id', 'default_settings')
            .maybeSingle();

        if (error) {
            console.warn('Warning: fallback to default sc_system_settings due to:', error.message);
            return NextResponse.json({
                ok: true,
                data: {
                    inactivity: DEFAULT_INACTIVITY,
                    concurrencySlots: DEFAULT_CONCURRENCY_SLOTS,
                    pagePermissions: DEFAULT_PAGE_PERMISSIONS,
                    roleRedirects: { ...DEFAULT_ROLE_REDIRECTS, 'Supplier': '/suppliers_page/purchase-orders' },
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'Fallback Default'
                }
            });
        }

        if (!data) {
            // Seed initial row
            const initialRow = {
                id: 'default_settings',
                inactivity: DEFAULT_INACTIVITY,
                concurrency_slots: DEFAULT_CONCURRENCY_SLOTS,
                page_permissions: DEFAULT_PAGE_PERMISSIONS,
                role_redirects: DEFAULT_ROLE_REDIRECTS,
                updated_at: new Date().toISOString(),
                updated_by: 'System Initializer',
            };

            const { data: inserted, error: insertError } = await supabaseAdmin
                .from('sc_system_settings')
                .insert(initialRow)
                .select()
                .single();

            if (insertError) {
                console.error('Error initializing sc_system_settings:', insertError);
            }

            const row = inserted || initialRow;
            return NextResponse.json({
                ok: true,
                data: {
                    inactivity: row.inactivity,
                    concurrencySlots: row.concurrency_slots || DEFAULT_CONCURRENCY_SLOTS,
                    pagePermissions: row.page_permissions,
                    roleRedirects: row.role_redirects,
                    updatedAt: row.updated_at,
                    updatedBy: row.updated_by,
                },
            });
        }

        return NextResponse.json({
            ok: true,
            data: {
                inactivity: data.inactivity || DEFAULT_INACTIVITY,
                concurrencySlots: data.concurrency_slots || DEFAULT_CONCURRENCY_SLOTS,
                pagePermissions: data.page_permissions || DEFAULT_PAGE_PERMISSIONS,
                roleRedirects: data.role_redirects || DEFAULT_ROLE_REDIRECTS,
                updatedAt: data.updated_at,
                updatedBy: data.updated_by,
            },
        });
    } catch (err: any) {
        console.warn('Failed to get sc_system_settings, returning defaults:', err?.message);
        return NextResponse.json({
            ok: true,
            data: {
                inactivity: DEFAULT_INACTIVITY,
                concurrencySlots: DEFAULT_CONCURRENCY_SLOTS,
                pagePermissions: DEFAULT_PAGE_PERMISSIONS,
                roleRedirects: { ...DEFAULT_ROLE_REDIRECTS, 'Supplier': '/suppliers_page/purchase-orders' },
                updatedAt: new Date().toISOString(),
                updatedBy: 'Fallback Default'
            }
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { inactivity, concurrencySlots, pagePermissions, roleRedirects, updatedBy } = body;

        // Fetch active sessions to ensure slots cannot be reduced below currently active users
        const { data: activeSessions } = await supabaseAdmin
            .from('sessions')
            .select('id, user_id, is_active')
            .eq('is_active', true);

        const sessionsList = activeSessions || [];
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

        let activeExecAdmin = 0;
        let activeManager = 0;
        let activeEmployee = 0;
        let activeSupplier = 0;

        sessionsList.forEach((s) => {
            const r = userRolesMap[s.user_id] || 'employee';
            if (r === 'executive' || r === 'admin') activeExecAdmin++;
            else if (r === 'manager') activeManager++;
            else if (r === 'supplier') activeSupplier++;
            else activeEmployee++;
        });

        const sanitizedSlots = {
            executiveSlots: Math.max(activeExecAdmin, Math.max(1, Math.min(500, concurrencySlots?.executiveSlots ?? 10))),
            managerSlots: Math.max(activeManager, Math.max(1, Math.min(500, concurrencySlots?.managerSlots ?? 20))),
            employeeSlots: Math.max(activeEmployee, Math.max(1, Math.min(650, concurrencySlots?.employeeSlots ?? 70))),
            supplierSlots: Math.max(activeSupplier, Math.max(1, Math.min(50, concurrencySlots?.supplierSlots ?? 10))),
        };

        const payload = {
            id: 'default_settings',
            inactivity: inactivity || DEFAULT_INACTIVITY,
            concurrency_slots: sanitizedSlots,
            page_permissions: pagePermissions || DEFAULT_PAGE_PERMISSIONS,
            role_redirects: roleRedirects || DEFAULT_ROLE_REDIRECTS,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy || 'Admin',
        };

        const { data, error } = await supabaseAdmin
            .from('sc_system_settings')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('Error upserting sc_system_settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            data: {
                inactivity: data.inactivity,
                concurrencySlots: data.concurrency_slots || DEFAULT_CONCURRENCY_SLOTS,
                pagePermissions: data.page_permissions,
                roleRedirects: data.role_redirects,
                updatedAt: data.updated_at,
                updatedBy: data.updated_by,
            },
        });
    } catch (err: any) {
        console.error('Failed to save sc_system_settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
