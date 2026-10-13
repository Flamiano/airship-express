import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

const isUUID = (str?: string | null): boolean => {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const loggedInEmail = searchParams.get('email');
        const clientSessionToken = (request.headers.get('x-session-token') || searchParams.get('sessionToken') || searchParams.get('session_token') || '').trim();
        let clientTokensMap: Record<string, string> = {};
        try {
            const headerTokens = request.headers.get('x-remember-tokens');
            if (headerTokens) {
                clientTokensMap = JSON.parse(headerTokens);
            }
        } catch (e) {}

        if (!role) {
            return NextResponse.json(
                { message: 'Role parameter is required' },
                { status: 400 }
            );
        }

        // If Supplier role, fetch active accounts from suppliers_account
        if (role.toLowerCase() === 'supplier') {
            const { data: accounts, error: accError } = await supabaseAdmin
                .from('suppliers_account')
                .select(`
                    id,
                    supplier_id,
                    email,
                    contact_name,
                    status,
                    password_hash,
                    suppliers (
                        id,
                        name,
                        category,
                        location
                    )
                `)
                .eq('status', 'Active')
                .order('contact_name', { ascending: true });

            if (accError) {
                console.error('Error fetching suppliers_account:', accError);
                return NextResponse.json([]);
            }

            const supplierList = (accounts || []).map((acc: any) => {
                const companyName = acc.suppliers?.name || 'Supplier Partner';
                const displayName = acc.contact_name ? `${acc.contact_name} (${companyName})` : companyName;
                return {
                    id: acc.id,
                    supplier_id: acc.supplier_id,
                    display_name: displayName,
                    email: acc.email,
                    role: 'Supplier',
                    department: companyName,
                    position: 'Authorized Supplier Representative',
                    employee_id: `SUP-${acc.supplier_id || String(acc.id).slice(0, 5)}`,
                    has_hr_password: !!acc.password_hash,
                    remembered: false,
                    is_active: false
                };
            });

            // Check sessions for remembered / active status
            try {
                const supplierEmails = supplierList.map(s => s.email).filter(Boolean);
                if (supplierEmails.length > 0) {
                    const { data: sessions } = await supabaseAdmin
                        .from('sessions')
                        .select('email, remember_me, expires_at, expires_at_remember, is_active, session_token')
                        .in('email', supplierEmails);

                    if (sessions) {
                        const now = new Date();
                        const activeEmails = sessions
                            .filter(s => {
                                if (!s.is_active || !s.expires_at || new Date(s.expires_at) <= now) return false;
                                const emailKey = (s.email || '').toLowerCase();
                                const isClientOwnToken = Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                                return !isClientOwnToken;
                            })
                            .map(s => s.email);
                        const rememberedEmails = sessions
                            .filter(s => {
                                const remExpiry = s.expires_at_remember || s.expires_at;
                                if (!s.remember_me || !remExpiry || new Date(remExpiry) <= now) return false;
                                const emailKey = (s.email || '').toLowerCase();
                                return Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                            })
                            .map(s => s.email);

                        supplierList.forEach(s => {
                            s.is_active = activeEmails.includes(s.email);
                            s.remembered = rememberedEmails.includes(s.email);
                        });
                    }
                }
            } catch (sessionErr) {
                console.error('Supplier session check error:', sessionErr);
            }

            return NextResponse.json(supplierList);
        }

        // If Executive, fetch directly from users table
        if (role === 'Executive') {
            const { data: dbUsers, error: userError } = await supabaseAdmin
                .from('users')
                .select('*')
                .ilike('role', 'Executive')
                .order('display_name', { ascending: true });

            if (userError) {
                console.error(`Error fetching Executive users:`, userError);
                return NextResponse.json(
                    { message: `Failed to fetch Executive accounts: ` + userError.message },
                    { status: 500 }
                );
            }

            const usersList = (dbUsers || []).map((u: any) => {
                const userRole = u.role || 'Executive';
                const cleanEmpId = u.employee_id || u.id || u.user_id;

                const rawDept = (u.department || '').trim();
                const rawPos = (u.position || '').trim();
                const cleanDept = rawDept && rawDept.toLowerCase() !== userRole.toLowerCase() ? rawDept : null;
                const cleanPos = rawPos && rawPos.toLowerCase() !== userRole.toLowerCase() && rawPos.toLowerCase() !== (cleanDept || '').toLowerCase() ? rawPos : null;

                return {
                    id: u.id || u.user_id,
                    display_name: u.display_name || u.full_name || u.name || 'Executive User',
                    email: u.email || u.user_email,
                    role: userRole,
                    department: cleanDept,
                    position: cleanPos,
                    employee_id: cleanEmpId,
                    has_hr_password: false,
                    remembered: false,
                    is_active: false
                };
            });

            // Check sessions for remembered / active status
            try {
                const userEmails = usersList.map(u => u.email).filter(Boolean);
                if (userEmails.length > 0) {
                    const { data: sessions } = await supabaseAdmin
                        .from('sessions')
                        .select('email, remember_me, expires_at, expires_at_remember, is_active, session_token')
                        .in('email', userEmails);

                    if (sessions) {
                        const now = new Date();
                        const activeEmails = sessions
                            .filter(s => {
                                if (!s.is_active || !s.expires_at || new Date(s.expires_at) <= now) return false;
                                const emailKey = (s.email || '').toLowerCase();
                                const isClientOwnToken = Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                                return !isClientOwnToken;
                            })
                            .map(s => s.email);
                        const rememberedEmails = sessions
                            .filter(s => {
                                const remExpiry = s.expires_at_remember || s.expires_at;
                                if (!s.remember_me || !remExpiry || new Date(remExpiry) <= now) return false;
                                const emailKey = (s.email || '').toLowerCase();
                                return Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                            })
                            .map(s => s.email);

                        usersList.forEach(u => {
                            u.is_active = activeEmails.includes(u.email);
                            u.remembered = false;
                        });
                    }
                }
            } catch (sessionErr) {
                console.error('Session check error:', sessionErr);
            }

            return NextResponse.json(usersList);
        }

        // Position to Role Mapping Helper
        const normalizePosition = (pos?: string | null): string => {
            if (!pos) return '';
            return pos.trim().toUpperCase().replace(/\s+/g, ' ');
        };

        const getAdminPositionPriority = (pos?: string | null): number => {
            const p = normalizePosition(pos);
            // Tier 1: Highest priority - ADMIN STAFF / ADMIN / ADMINISTRATOR
            if (p === 'ADMIN STAFF' || p === 'ADMIN' || p === 'ADMINISTRATOR') return 1;
            // Tier 2: MARKETING/ADMIN STAFF
            if (p.includes('MARKETING') || p.includes('MKTG')) return 2;
            // Tier 3: ADMIN ASSISTANT
            if (p.includes('ADMIN ASSISTANT') || p === 'ADMIN ASSISTANT') return 3;
            // Tier 4: Other admin positions
            if (p.includes('ADMIN')) return 4;
            return 5;
        };

        const getRoleForPosition = (pos?: string | null): 'Admin' | 'Purchase Officer' | 'Operator' | 'Staff' | 'Employee' | null => {
            const p = normalizePosition(pos);
            
            // ADMIN: ADMIN STAFF, MARKETING/ADMIN STAFF, ADMIN ASSISTANT, ADMIN, ADMINISTRATOR
            if (
                p === 'ADMIN STAFF' ||
                p === 'ADMIN' ||
                p === 'ADMINISTRATOR' ||
                p === 'MARKETING/ADMIN STAFF' ||
                p === 'MARKETING / ADMIN STAFF' ||
                p === 'MKTG/ADMIN STAFF' ||
                p === 'MKTG / ADMIN STAFF' ||
                p.includes('ADMIN STAFF') ||
                p === 'ADMIN ASSISTANT' ||
                p.includes('ADMIN ASSISTANT')
            ) {
                return 'Admin';
            }

            // PURCHASE OFFICER: OFFICE-IN-CHARGE, PROJECT COORDINATOR, MANAGER, PURCHASE OFFICER, PURCHASING OFFICER
            if (
                p === 'OFFICE-IN-CHARGE' ||
                p === 'OFFICE IN CHARGE' ||
                p === 'PROJECT COORDINATOR' ||
                p === 'MANAGER' ||
                p === 'PURCHASE OFFICER' ||
                p === 'PURCHASING OFFICER'
            ) {
                return 'Purchase Officer';
            }

            // OPERATOR: APPRAISER
            if (
                p === 'APPRAISER' ||
                p === 'OPERATOR'
            ) {
                return 'Operator';
            }

            // STAFF:
            // OFFICE STAFF, SALES REPRESENTATIVE, CSR/MKTG STAFF, HR OFFICER, HR GENERALIST
            if (
                p === 'OFFICE STAFF' ||
                p === 'SALES REPRESENTATIVE' ||
                p === 'CSR/MKTG STAFF' ||
                p === 'CSR / MKTG STAFF' ||
                p === 'CSR/MARKETING STAFF' ||
                p === 'HR OFFICER' ||
                p === 'HR GENERALIST' ||
                p === 'STAFF' ||
                p === 'EMPLOYEE'
            ) {
                return 'Staff';
            }

            // All other positions (riders, drivers, etc.) are NOT part of supply chain
            return null;
        };

        // For Admin / Staff / Employee / Purchase Officer / Operator, fetch mock_employees filtered strictly by position
        const { data: dbEmployees, error: dbError } = await supabaseAdmin
            .from('mock_employees')
            .select('*')
            .order('display_name', { ascending: true });

        if (dbError) {
            console.error('Error fetching mock_employees from db:', dbError);
            return NextResponse.json(
                { message: 'Failed to fetch employees from database: ' + dbError.message },
                { status: 500 }
            );
        }

        const targetRole = (role.toLowerCase() === 'employee' ? 'staff' : role.toLowerCase());

        const filteredDbEmployees = (dbEmployees || []).filter((emp: any) => {
            const assignedRole = getRoleForPosition(emp.position);
            // If position is not one of the allowed supply chain positions, exclude
            if (!assignedRole) return false;

            // Only include employees that belong to the role logged in
            return assignedRole.toLowerCase() === targetRole;
        });

        // For Admin role: sort with priority for ADMIN STAFF first, then MARKETING/ADMIN STAFF, then ADMIN ASSISTANT
        if (targetRole === 'admin') {
            filteredDbEmployees.sort((a: any, b: any) => {
                const prioA = getAdminPositionPriority(a.position);
                const prioB = getAdminPositionPriority(b.position);
                if (prioA !== prioB) return prioA - prioB;
                const nameA = (a.display_name || a.full_name || a.name || '').toLowerCase();
                const nameB = (b.display_name || b.full_name || b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        const employees = filteredDbEmployees.map((emp: any) => {
            const assignedRole = getRoleForPosition(emp.position) || 'Staff';
            const rawEmpId = emp.employee_id;
            const cleanEmpId = rawEmpId && !isUUID(rawEmpId) ? rawEmpId : null;

            const rawDept = (emp.department || '').trim();
            const rawPos = (emp.position || '').trim();
            const cleanDept = rawDept && rawDept.toLowerCase() !== assignedRole.toLowerCase() ? rawDept : null;
            const cleanPos = rawPos && rawPos.toLowerCase() !== assignedRole.toLowerCase() && rawPos.toLowerCase() !== (cleanDept || '').toLowerCase() ? rawPos : null;

            return {
                ...emp,
                id: emp.id || emp.user_id,
                display_name: emp.display_name || emp.full_name || emp.name || 'Employee User',
                email: emp.email || emp.user_email || emp.work_email,
                role: assignedRole,
                employee_id: cleanEmpId,
                department: cleanDept,
                position: cleanPos || rawPos
            };
        });

        let rememberedEmails: string[] = [];
        let activeEmails: string[] = [];

        try {
            const empEmails = employees.map(e => e.email).filter(Boolean);
            if (empEmails.length > 0) {
                const { data: sessions } = await supabaseAdmin
                    .from('sessions')
                    .select('email, remember_me, expires_at, expires_at_remember, is_active, session_token')
                    .in('email', empEmails);

                if (sessions) {
                    const now = new Date();
                    activeEmails = sessions
                        .filter(s => {
                            if (!s.is_active || !s.expires_at || new Date(s.expires_at) <= now) return false;
                            const emailKey = (s.email || '').toLowerCase();
                            const isClientOwnToken = Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                            return !isClientOwnToken;
                        })
                        .map(s => s.email);
                    rememberedEmails = sessions
                        .filter(s => {
                            const remExpiry = s.expires_at_remember || s.expires_at;
                            if (!s.remember_me || !remExpiry || new Date(remExpiry) <= now) return false;
                            const emailKey = (s.email || '').toLowerCase();
                            return Boolean((clientSessionToken && s.session_token === clientSessionToken) || (clientTokensMap[emailKey] && s.session_token === clientTokensMap[emailKey]));
                        })
                        .map(s => s.email);
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
        }

        const employeesWithStatus = employees.map(emp => ({
            ...emp,
            has_hr_password: !!emp.password_hash,
            remembered: false,
            is_active: activeEmails.includes(emp.email)
        }));

        return NextResponse.json(employeesWithStatus);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json(
            { message: 'Failed to fetch employees from HR system' },
            { status: 500 }
        );
    }
}