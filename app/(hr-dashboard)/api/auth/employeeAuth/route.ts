import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json(
        { message: "Employee ID and password are required." },
        { status: 400 }
      );
    }

    // Step 1: Find employee by employee_id_number
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, employee_id_number, first_name, last_name, email, status, auth_user_id")
      .eq("employee_id_number", employeeId)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        { message: "Employee ID not found. Please check your ID." },
        { status: 401 }
      );
    }

    // Step 2: Require active status, auth_user_id, and email
    if (employee.status !== "active") {
      return NextResponse.json(
        { message: "This account is not active. Please contact HR." },
        { status: 403 }
      );
    }

    if (!employee.auth_user_id) {
      return NextResponse.json(
        { message: "This account is not linked to a login. Please contact HR." },
        { status: 403 }
      );
    }

    if (!employee.email) {
      return NextResponse.json(
        { message: "No email on file for this account. Please contact HR." },
        { status: 403 }
      );
    }

    // Step 3: Authenticate through Supabase Auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_HR_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: employee.email,
        password,
      });

    if (authError) {
      let errorMessage = "Invalid employee ID or password.";
      if (authError.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid password. Please try again.";
      } else if (authError.message.includes("Email not confirmed")) {
        errorMessage = "Please confirm your email address first.";
      }
      return NextResponse.json({ message: errorMessage }, { status: 401 });
    }

    if (!authData.session) {
      return NextResponse.json(
        { message: "Authentication failed. No session created." },
        { status: 401 }
      );
    }

    // Step 4: Verify Supabase user matches the employee's auth_user_id
    if (authData.user.id !== employee.auth_user_id) {
      console.error("Employee auth_user_id mismatch:", authData.user.id, employee.auth_user_id);
      return NextResponse.json(
        { message: "Authentication failed. Account mismatch." },
        { status: 401 }
      );
    }

    // Step 5: Determine Manager vs Employee (relational rule)
    const { count } = await supabaseAdmin
      .from("hr1_employees")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", employee.id)
      .eq("status", "active");

    const accountType = (count ?? 0) > 0 ? "manager" : "employee";

    const fullName =
      [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() ||
      employee.email;

    // Step 6: Return session and identity
    return NextResponse.json({
      session: authData.session,
      fullName,
      accountType,
      employeeIdNumber: employee.employee_id_number,
      redirectTo: "/employee-dashboard",
      message: `Welcome back, ${fullName}!`,
    });
  } catch (error) {
    console.error("Employee auth error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
