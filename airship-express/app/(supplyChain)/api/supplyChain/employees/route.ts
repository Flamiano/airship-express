// app/(supplyChain)/api/supplyChain/employees/route.ts

import { supabase } from '../../../lib/services/client/supabase';
import { NextResponse } from 'next/server';

const isUUID = (str?: string | null): boolean => {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const loggedInEmail = searchParams.get('email');

        if (!role) {
            return NextResponse.json(
                { message: 'Role parameter is required' },
                { status: 400 }
            );
        }

        // If Admin or Executive, fetch directly from users table
        if (role === 'Admin' || role === 'Executive') {
            const { data: dbUsers, error: userError } = await supabase
                .from('users')
                .select('*')
                .ilike('role', role)
                .order('display_name', { ascending: true });

            if (userError) {
                console.error(`Error fetching ${role} users:`, userError);
                return NextResponse.json(
                    { message: `Failed to fetch ${role} accounts: ` + userError.message },
                    { status: 500 }
                );
            }

            const usersList = (dbUsers || []).map((u: any) => {
                const userRole = u.role || role;
                const cleanEmpId = u.employee_id || u.id || u.user_id;

                const rawDept = (u.department || '').trim();
                const rawPos = (u.position || '').trim();
                const cleanDept = rawDept && rawDept.toLowerCase() !== userRole.toLowerCase() ? rawDept : null;
                const cleanPos = rawPos && rawPos.toLowerCase() !== userRole.toLowerCase() && rawPos.toLowerCase() !== (cleanDept || '').toLowerCase() ? rawPos : null;

                return {
                    id: u.id || u.user_id,
                    display_name: u.display_name || u.full_name || u.name || (role === 'Admin' ? 'Admin User' : 'Executive User'),
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
                    const { data: sessions } = await supabase
                        .from('sessions')
                        .select('email, remember_me, expires_at, is_active')
                        .in('email', userEmails);

                    if (sessions) {
                        const now = new Date();
                        const activeEmails = sessions
                            .filter(s => s.is_active && new Date(s.expires_at) > now)
                            .map(s => s.email);
                        const rememberedEmails = sessions
                            .filter(s => s.remember_me && new Date(s.expires_at) > now)
                            .map(s => s.email);

                        usersList.forEach(u => {
                            u.is_active = activeEmails.includes(u.email);
                            u.remembered = rememberedEmails.includes(u.email);
                        });
                    }
                }
            } catch (sessionErr) {
                console.error('Session check error:', sessionErr);
            }

            return NextResponse.json(usersList);
        }

        // For Employee (and any other role), fetch all mock_employees (excluding Admin/Executive and Drop-Off Pick-Up Riders / Drivers)
        const { data: dbEmployees, error: dbError } = await supabase
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

        const filteredDbEmployees = (dbEmployees || []).filter((emp: any) => {
            const pos = (emp.position || '').toLowerCase();
            const dept = (emp.department || '').toLowerCase();
            const role = (emp.role || '').toLowerCase();
            const title = (emp.job_title || emp.title || '').toLowerCase();

            // Exclude Admin and Executive accounts
            if (role.includes('admin') || role.includes('executive')) {
                return false;
            }

            const isRiderOrDriver = (
                pos.includes('rider') ||
                pos.includes('driver') ||
                pos.includes('drop-off') ||
                pos.includes('drop off') ||
                pos.includes('pick-up') ||
                pos.includes('pick up') ||
                title.includes('rider') ||
                title.includes('driver') ||
                dept.includes('rider') ||
                dept.includes('driver') ||
                role.includes('rider') ||
                role.includes('driver')
            );
            return !isRiderOrDriver;
        });

        const employees = filteredDbEmployees.map((emp: any) => {
            let employeeRole = 'Employee';
            const rawRole = (emp.role || emp.position || '').trim();
            if (/manager/i.test(rawRole)) {
                employeeRole = 'Manager';
            } else if (/operator/i.test(rawRole)) {
                employeeRole = 'Operator';
            } else if (emp.role) {
                employeeRole = emp.role;
            }

            const rawEmpId = emp.employee_id;
            const cleanEmpId = rawEmpId && !isUUID(rawEmpId) ? rawEmpId : null;

            const rawDept = (emp.department || '').trim();
            const rawPos = (emp.position || '').trim();
            const cleanDept = rawDept && rawDept.toLowerCase() !== employeeRole.toLowerCase() ? rawDept : null;
            const cleanPos = rawPos && rawPos.toLowerCase() !== employeeRole.toLowerCase() && rawPos.toLowerCase() !== (cleanDept || '').toLowerCase() ? rawPos : null;

            return {
                ...emp,
                id: emp.id || emp.user_id,
                display_name: emp.display_name || emp.full_name || emp.name || 'Employee User',
                email: emp.email || emp.user_email || emp.work_email,
                role: employeeRole,
                employee_id: cleanEmpId,
                department: cleanDept,
                position: cleanPos
            };
        });

        let rememberedEmails: string[] = [];
        let activeEmails: string[] = [];

        try {
            const empEmails = employees.map(e => e.email).filter(Boolean);
            if (empEmails.length > 0) {
                const { data: sessions } = await supabase
                    .from('sessions')
                    .select('email, remember_me, expires_at, is_active')
                    .in('email', empEmails);

                if (sessions) {
                    const now = new Date();
                    activeEmails = sessions
                        .filter(s => s.is_active && new Date(s.expires_at) > now)
                        .map(s => s.email);
                    rememberedEmails = sessions
                        .filter(s => s.remember_me && new Date(s.expires_at) > now)
                        .map(s => s.email);
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
        }

        const employeesWithStatus = employees.map(emp => ({
            ...emp,
            has_hr_password: !!emp.password_hash,
            remembered: rememberedEmails.includes(emp.email),
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