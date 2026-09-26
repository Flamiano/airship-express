import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { employeeId, password } = await request.json();

        if (!employeeId || !password) {
            return NextResponse.json(
                { message: 'Enter your employee ID and password to continue.' },
                { status: 400 }
            );
        }

        // 1. Look up employee in FMS users table
        const { data: fmsUser, error: fmsError } = await supabaseAdmin
            .from('fms_users')
            .select('id, employee_id, role')
            .eq('employee_id', employeeId)
            .single();

        if (fmsError || !fmsUser) {
            return NextResponse.json(
                { message: 'Employee ID or password is incorrect.' },
                { status: 401 }
            );
        }

        // 2. Get the Supabase Auth user email for FMS
        const { data: authUser, error: authError } =
            await supabaseAdmin.auth.admin.getUserById(fmsUser.id);

        if (authError || !authUser?.user?.email) {
            return NextResponse.json(
                { message: 'Employee ID or password is incorrect.' },
                { status: 401 }
            );
        }

        // 3. Collect FMS authentication cookies
        const cookieStore = await cookies();

        const cookiesToApply: {
            name: string;
            value: string;
            options: any;
        }[] = [];

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_FMS_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_FMS_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            try {
                                cookieStore.set(name, value, options);
                            } catch {
                                // Applied to final response below
                            }

                            cookiesToApply.push({
                                name,
                                value,
                                options,
                            });
                        });
                    },
                },
            }
        );

        // 4. Authenticate against FMS Supabase
        const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
                email: authUser.user.email,
                password,
            });

        if (signInError || !signInData.session) {
            return NextResponse.json(
                { message: 'Employee ID or password is incorrect.' },
                { status: 401 }
            );
        }

        // 5. Construct final response
        const response = NextResponse.json({
            success: true,
            session: signInData.session,
            user: {
                id: fmsUser.id,
                employeeId: fmsUser.employee_id,
                role: fmsUser.role,
            },
            redirectTo: '/dashboard',
        });

        // 6. Attach FMS authentication cookies
        cookiesToApply.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
        });

        return response;
    } catch {
        return NextResponse.json(
            { message: 'An unexpected error occurred during login.' },
            { status: 500 }
        );
    }
}