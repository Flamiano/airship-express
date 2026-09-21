import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import {
  verifyOtp,
  createSession,
  OTP_SESSION_MINUTES,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/otp";

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
    const purpose = body?.purpose;
    const code = String(body?.code || "").trim();

    if (!VALID.includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Code must be 6 digits" },
        { status: 400 }
      );
    }

    const result = await verifyOtp({
      adminId: admin.id,
      purpose,
      code,
      email: admin.email,
      adminName: admin.fullName,
    });

    if (!result.ok) {
      if (result.reason === "locked") {
        return NextResponse.json(
          {
            error: `Account locked. Try again in ${result.minutesLeft} minute(s).`,
            locked: true,
            minutes_left: result.minutesLeft,
          },
          { status: 429 }
        );
      }

      if (result.reason === "locked_after_max_attempts") {
        return NextResponse.json(
          {
            error: `Too many wrong attempts. Account locked for ${result.minutesLeft} minutes. A confirmation email was sent.`,
            locked: true,
            minutes_left: result.minutesLeft,
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
          error:
            messages[result.reason || "invalid_code"] || "Verification failed",
        },
        { status: 400 }
      );
    }

    const session = await createSession(admin.id, "all");

    return NextResponse.json({
      success: true,
      session_token: session.token,
      scope: "all",
      expires_at: session.expiresAt.toISOString(),
      session_minutes: OTP_SESSION_MINUTES,
    });
  } catch (error: any) {
    console.error("POST /otp/verify error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
