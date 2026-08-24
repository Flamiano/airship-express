import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

const ALLOWED_ROLES = ["super_admin", "hr_payroll_admin"];

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json(
        { message: "Enter your employee ID and password to continue." },
        { status: 400 }
      );
    }

    // Find the admin by employee_id
    const { data: admin, error: lookupError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, full_name, role")
      .eq("employee_id", employeeId)
      .single();

    if (lookupError || !admin) {
      console.error("Employee lookup failed:", lookupError);
      return NextResponse.json(
        { message: "Employee ID or password is incorrect." },
        { status: 401 }
      );
    }

    if (!ALLOWED_ROLES.includes(admin.role)) {
      return NextResponse.json(
        {
          message:
            "This account does not have access to the Payroll dashboard.",
        },
        { status: 403 }
      );
    }

    console.log("Attempting login with email:", admin.email);

    // Sign in with Supabase Admin
    const { data, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: admin.email,
        password: password,
      });

    if (authError || !data.session) {
      console.error("Sign-in failed:", authError);
      return NextResponse.json(
        { message: "Employee ID or password is incorrect." },
        { status: 401 }
      );
    }

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set("hr_access_token", data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: data.session.expires_in || 60 * 60 * 24 * 7,
    });
    cookieStore.set("hr_refresh_token", data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookieStore.set("hr_role", admin.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: data.session.expires_in || 60 * 60 * 24 * 7,
    });

    return NextResponse.json({
      success: true,
      employeeId,
      fullName: admin.full_name,
      role: admin.role,
      redirectTo: "/payroll-benefits-dashboard",
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
