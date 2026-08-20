import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/app/(hr-dashboard)/supabase/client";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

const ALLOWED_ROLES = ["super_admin", "hr_payroll_admin"];

export async function POST(request: Request) {
  const { employeeId, password } = await request.json();

  if (!employeeId || !password) {
    return NextResponse.json(
      { message: "Enter your employee ID and password to continue." },
      { status: 400 }
    );
  }

  const { data: employee, error: lookupError } = await supabaseAdmin
    .from("hr_admin")
    .select("id, email, full_name, role")
    .eq("employee_id", employeeId)
    .single();

  if (lookupError || !employee) {
    console.error("Employee lookup failed:", lookupError);
    return NextResponse.json(
      { message: "Employee ID or password is incorrect." },
      { status: 401 }
    );
  }

  if (!ALLOWED_ROLES.includes(employee.role)) {
    return NextResponse.json(
      {
        message: "This account does not have access to the Payroll dashboard.",
      },
      { status: 403 }
    );
  }

  console.log("Attempting login with email:", employee.email);

  const { data: session, error: authError } =
    await supabase.auth.signInWithPassword({
      email: employee.email,
      password,
    });

  if (authError || !session.session) {
    console.error("Sign-in failed:", authError);
    return NextResponse.json(
      { message: "Employee ID or password is incorrect." },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("hr_access_token", session.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.session.expires_in,
  });
  cookieStore.set("hr_refresh_token", session.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.set("hr_role", employee.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.session.expires_in,
  });

  return NextResponse.json({
    employeeId,
    fullName: employee.full_name,
    role: employee.role,
    redirectTo: "/payroll-benefits-dashboard",
    session: {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    },
  });
}
