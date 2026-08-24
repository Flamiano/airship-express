import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type AppRole =
  | "super_admin"
  | "hr_payroll_admin"
  | "hr_performance_admin"
  | "hr_recruitment_admin"
  | "hr_workforce_admin";

const PAYROLL_WRITE_ROLES: AppRole[] = ["super_admin", "hr_payroll_admin"];

export type AdminSession = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
};

export async function requireAdmin(
  request?: NextRequest
): Promise<AdminSession | NextResponse> {
  try {
    let token: string | undefined;

    // First try to get token from cookies
    const cookieStore = await cookies();
    token = cookieStore.get("hr_access_token")?.value;

    // If no token in cookies and request is provided, try Authorization header
    if (!token && request) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - No token found" },
        { status: 401 }
      );
    }

    // Verify the token with Supabase
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Get admin data
    const { data: admin, error: adminError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name, email, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin not found" },
        { status: 401 }
      );
    }

    // Check if user has required role
    if (!PAYROLL_WRITE_ROLES.includes(admin.role as AppRole)) {
      return NextResponse.json(
        {
          error:
            "Forbidden - Insufficient permissions. Required: super_admin or hr_payroll_admin",
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
      { error: "Authentication error" },
      { status: 500 }
    );
  }
}
