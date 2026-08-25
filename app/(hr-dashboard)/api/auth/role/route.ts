import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ROLE_DASHBOARD_MAP,
  HR_ROLES,
} from "@/app/(hr-dashboard)/utils/roleValidation";

const VALID_ROLES = Object.values(HR_ROLES);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("=== Role API Called ===");
    console.log("Request body:", body);

    const { employeeId } = body;

    if (!employeeId) {
      console.log("employeeId is missing");
      return NextResponse.json(
        {
          message: "Employee ID is required.",
        },
        { status: 400 }
      );
    }

    console.log("Looking up employeeId:", employeeId);

    const { data: employee, error } = await supabaseAdmin
      .from("hr_admin")
      .select("role, full_name, email, employee_id")
      .eq("employee_id", employeeId)
      .single();

    if (error) {
      console.error("Role lookup error:", error);
      return NextResponse.json(
        {
          message: "Employee ID not found. Please check your ID.",
        },
        { status: 401 }
      );
    }

    if (!employee) {
      console.log("No employee found with ID:", employeeId);
      return NextResponse.json(
        {
          message: "Employee ID not found. Please check your ID.",
        },
        { status: 401 }
      );
    }

    console.log("Employee found:");
    console.log("- Role:", employee.role);
    console.log("- Full Name:", employee.full_name);
    console.log("- Email:", employee.email);

    if (!VALID_ROLES.includes(employee.role)) {
      console.log("Invalid role:", employee.role);
      return NextResponse.json(
        {
          message: "Your account does not have access to an HR dashboard.",
        },
        { status: 403 }
      );
    }

    // Get the dashboard URL for this role
    const dashboardUrl =
      ROLE_DASHBOARD_MAP[employee.role as keyof typeof ROLE_DASHBOARD_MAP];

    return NextResponse.json({
      success: true,
      role: employee.role,
      fullName: employee.full_name,
      email: employee.email,
      employeeId: employee.employee_id,
      dashboardUrl: dashboardUrl || "/hrAuth",
    });
  } catch (error) {
    console.error("=== Role API Error ===");
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}
