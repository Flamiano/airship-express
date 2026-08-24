import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

const VALID_ROLES = [
    "super_admin",
    "hr_payroll_admin",
    "hr_performance_admin",
    "hr_recruitment_admin",
    "hr_workforce_admin",
];

export async function POST(request: Request) {
    try {
        const { employeeId } = await request.json();

        if (!employeeId) {
            return NextResponse.json(
                {
                    message:
                        "Enter your employee ID and password to continue.",
                },
                { status: 400 }
            );
        }

        const { data: employee, error } =
            await supabaseAdmin
                .from("hr_admin")
                .select("role")
                .eq("employee_id", employeeId)
                .single();

        if (error || !employee) {
            console.error(
                "Role lookup failed:",
                error
            );

            return NextResponse.json(
                {
                    message:
                        "Employee ID or password is incorrect.",
                },
                { status: 401 }
            );
        }

        if (!VALID_ROLES.includes(employee.role)) {
            return NextResponse.json(
                {
                    message:
                        "Your account does not have access to an HR dashboard.",
                },
                { status: 403 }
            );
        }

        return NextResponse.json({
            role: employee.role,
        });
    } catch (error) {
        console.error(
            "HR role lookup error:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Something went wrong. Please try again.",
            },
            { status: 500 }
        );
    }
}