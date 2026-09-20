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
    'Manager': '/warehousing',
    'Operator': '/warehousing',
    'Employee': '/documents',
};

const DEFAULT_PAGE_PERMISSIONS: Record<string, string[]> = {
    '/executive': ['Executive'],
    '/warehousing': ['Executive', 'Admin', 'Manager', 'Operator'],
    '/inventory': ['Executive', 'Admin', 'Manager', 'Operator'],
    '/procurement': ['Executive', 'Admin', 'Manager'],
    '/suppliers': ['Executive', 'Admin', 'Manager'],
    '/purchase-orders': ['Executive', 'Admin', 'Manager'],
    '/documents': ['Executive', 'Admin', 'Manager', 'Employee'],
    '/forecast': ['Executive', 'Admin'],
    '/gallery': ['Executive', 'Admin', 'Manager', 'Employee'],
    '/trash': ['Executive', 'Admin', 'Manager', 'Employee', 'Operator'],
    '/user-activity': ['Executive', 'Admin'],
    '/settings': ['Executive', 'Admin'],
};

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('sc_system_settings')
            .select('*')
            .eq('id', 'default_settings')
            .maybeSingle();

        if (error) {
            console.error('Error fetching sc_system_settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            // Seed initial row
            const initialRow = {
                id: 'default_settings',
                inactivity: DEFAULT_INACTIVITY,
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
                pagePermissions: data.page_permissions || DEFAULT_PAGE_PERMISSIONS,
                roleRedirects: data.role_redirects || DEFAULT_ROLE_REDIRECTS,
                updatedAt: data.updated_at,
                updatedBy: data.updated_by,
            },
        });
    } catch (err: any) {
        console.error('Failed to get sc_system_settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { inactivity, pagePermissions, roleRedirects, updatedBy } = body;

        const payload = {
            id: 'default_settings',
            inactivity: inactivity || DEFAULT_INACTIVITY,
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
