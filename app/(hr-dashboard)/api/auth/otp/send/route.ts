import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  createOtp,
  getActiveLock,
  OTP_LOCK_MINUTES,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/otp";
import { sendOtpEmail } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";
import { LOGIN_OTP_TTL_MINUTES } from "@/app/(hr-dashboard)/constants/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();
    if (!employeeId) {
      return NextResponse.json(
        { message: "Employee ID is required." },
        { status: 400 }
      );
    }

    const { data: employee, error } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, full_name, employee_id, role")
      .eq("employee_id", employeeId)
      .single();

    if (error || !employee) {
      return NextResponse.json(
        { message: "Employee ID not found." },
        { status: 401 }
      );
    }

    const lock = await getActiveLock(employee.id);
    if (lock.locked) {
      return NextResponse.json(
        {
          message: `Too many wrong attempts. Try again in ${lock.minutesLeft} minute(s).`,
          locked: true,
          minutesLeft: lock.minutesLeft,
        },
        { status: 429 }
      );
    }

    const { code, expiresAt } = await createOtp({
      adminId: employee.id,
      email: employee.email,
      purpose: "login",
      ttlMinutes: LOGIN_OTP_TTL_MINUTES,
    });

    await sendOtpEmail({
      to: employee.email,
      code,
      purpose: "login" as any,
      adminName: employee.full_name,
      ttlMinutes: LOGIN_OTP_TTL_MINUTES,
    });

    await supabaseAdmin.from("hr_session_log").insert({
      admin_id: employee.id,
      event: "otp_sent",
      metadata: {
        email: employee.email,
        purpose: "login",
        ttl_minutes: LOGIN_OTP_TTL_MINUTES,
      },
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent to your registered email.",
      expiresInSeconds: LOGIN_OTP_TTL_MINUTES * 60,
      lockMinutes: OTP_LOCK_MINUTES,
      devOtp: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err: any) {
    console.error("POST /api/auth/otp/send error:", err);
    return NextResponse.json(
      { message: err?.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
