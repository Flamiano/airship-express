import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type AppRole =
  | "super_admin"
  | "hr_payroll_admin"
  | "hr_performance_admin"
  | "hr_recruitment_admin"
  | "hr_workforce_admin";

const ALLOWED_ROLES: AppRole[] = ["super_admin", "hr_payroll_admin"];

export async function requireAdmin(request?: NextRequest) {
  try {
    console.log("requireAdmin: Starting authentication check");

    let token: string | undefined;

    if (request) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
        console.log("requireAdmin: Token found in Authorization header");
      }
    }

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get("hr_access_token")?.value;
      if (token) {
        console.log("requireAdmin: Token found in cookies");
      }
    }

    if (!token) {
      console.error("requireAdmin: No token found");
      return NextResponse.json(
        { error: "Unauthorized - No token found" },
        { status: 401 }
      );
    }

    console.log("requireAdmin: Verifying token");
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("requireAdmin: Token verification failed:", userError);
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    console.log("requireAdmin: User authenticated:", userData.user.email);

    const { data: admin, error: adminError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name, email, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      console.error("requireAdmin: Admin not found:", adminError);
      return NextResponse.json(
        { error: "Unauthorized - Admin not found" },
        { status: 401 }
      );
    }

    console.log("requireAdmin: Admin found with role:", admin.role);

    if (!ALLOWED_ROLES.includes(admin.role as AppRole)) {
      console.error("requireAdmin: Insufficient permissions:", admin.role);
      return NextResponse.json(
        {
          error: `Forbidden - Role "${admin.role}" does not have access. Required: hr_payroll_admin`,
        },
        { status: 403 }
      );
    }

    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role as AppRole,
    };
  } catch (error) {
    console.error("requireAdmin error:", error);
    return NextResponse.json(
      {
        error:
          "Authentication error: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 }
    );
  }
}
