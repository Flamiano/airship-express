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

        // 1. Look up employee in fms_users table using Admin client
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

        // 2. Look up Supabase Auth user email using Admin client
        const { data: authUser, error: authError } =
            await supabaseAdmin.auth.admin.getUserById(fmsUser.id);

        if (authError || !authUser?.user?.email) {
            return NextResponse.json(
                { message: 'Employee ID or password is incorrect.' },
                { status: 401 }
            );
        }

        // 3. Collect cookies generated during authentication
        const cookieStore = await cookies();
        const cookiesToApply: { name: string; value: string; options: any }[] = [];

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
                                // Handled in final response headers
                            }
                            cookiesToApply.push({ name, value, options });
                        });
                    },
                },
            }
        );

        // 4. Authenticate password
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

        // 5. Construct final response with session payload
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

        // 6. Explicitly attach all generated session cookies to the final response
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