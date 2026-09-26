import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import {
  createOtp,
  getActiveLock,
  OTP_TTL_MINUTES,
  OTP_LOCK_MINUTES,
  type OtpPurpose,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/otp";
import { sendOtpEmail } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const VALID: string[] = [
  "merit",
  "bonus",
  "merit_delete",
  "bonus_delete",
  "benefit",
  "benefit_delete",
  "claim",
  "claim_delete",
];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const body = await request.json();
    const purpose = body?.purpose as OtpPurpose;

    if (!VALID.includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    const lock = await getActiveLock(admin.id);
    if (lock.locked) {
      return NextResponse.json(
        {
          error: `Too many wrong attempts. Try again in ${lock.minutesLeft} minute(s).`,
          locked: true,
          minutes_left: lock.minutesLeft,
        },
        { status: 429 }
      );
    }

    const { code, expiresAt } = await createOtp({
      adminId: admin.id,
      email: admin.email,
      purpose,
    });

    await sendOtpEmail({
      to: admin.email,
      code,
      purpose: purpose as any,
      adminName: admin.fullName,
      ttlMinutes: OTP_TTL_MINUTES,
    });

    return NextResponse.json({
      success: true,
      expires_at: expiresAt.toISOString(),
      ttl_minutes: OTP_TTL_MINUTES,
      lock_minutes: OTP_LOCK_MINUTES,
    });
  } catch (error: any) {
    console.error("POST /otp/send error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
