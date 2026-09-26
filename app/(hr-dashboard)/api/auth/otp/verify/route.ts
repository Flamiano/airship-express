import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  verifyOtp,
  createSession,
  OTP_SESSION_MINUTES,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employeeId = String(body?.employeeId || "").trim();
    const code = String(body?.otpCode || "").trim();

    if (!employeeId || !code) {
      return NextResponse.json(
        { message: "Employee ID and OTP are required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { message: "Code must be 6 digits." },
        { status: 400 }
      );
    }

    const { data: employee, error: empErr } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, full_name")
      .eq("employee_id", employeeId)
      .single();

    if (empErr || !employee) {
      return NextResponse.json(
        { message: "Employee not found." },
        { status: 401 }
      );
    }

    const result = await verifyOtp({
      adminId: employee.id,
      purpose: "login",
      code,
      email: employee.email,
      adminName: employee.full_name,
    });

    if (!result.ok) {
      if (result.reason === "locked") {
        return NextResponse.json(
          {
            message: `Account locked. Try again in ${result.minutesLeft} minute(s).`,
            locked: true,
            minutesLeft: result.minutesLeft,
          },
          { status: 429 }
        );
      }

      if (result.reason === "locked_after_max_attempts") {
        return NextResponse.json(
          {
            message: `Too many wrong attempts. Account locked for ${result.minutesLeft} minutes.`,
            locked: true,
            minutesLeft: result.minutesLeft,
          },
          { status: 429 }
        );
      }

      const messages: Record<string, string> = {
        no_active_code: "No active code. Request a new one.",
        expired: "Code expired. Request a new one.",
        too_many_attempts: "Too many wrong attempts. Request a new code.",
        invalid_code: "Incorrect code.",
        database_error: "Server error. Try again.",
      };

      return NextResponse.json(
        {
          message:
            messages[result.reason || "invalid_code"] || "Verification failed",
        },
        { status: 401 }
      );
    }

    const session = await createSession(employee.id, "all");

    await supabaseAdmin.from("hr_session_log").insert({
      admin_id: employee.id,
      event: "otp_verified",
      metadata: { purpose: "login" },
    });

    return NextResponse.json({
      success: true,
      message: "OTP verified.",
      session_token: session.token,
      scope: "all",
      expiresAt: session.expiresAt.toISOString(),
      sessionMinutes: OTP_SESSION_MINUTES,
    });
  } catch (err: any) {
    console.error("POST /api/auth/otp/verify error:", err);
    return NextResponse.json(
      { message: err?.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
