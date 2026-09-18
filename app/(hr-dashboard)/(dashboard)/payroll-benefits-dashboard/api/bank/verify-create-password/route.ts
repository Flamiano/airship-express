import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_CREATE_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 60;

function getUserId(authResult: any): string | null {
  return authResult?.user?.id || authResult?.id || null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const userId = getUserId(authResult);
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to identify admin user." },
        { status: 403 }
      );
    }

    const { data: attemptRow } = await supabaseAdmin
      .from("hr4_bank_pass_attempts")
      .select("create_attempts, create_locked_until")
      .eq("admin_id", userId)
      .maybeSingle();

    const now = new Date();
    let locked = false;
    let minutesLeft = 0;

    if (attemptRow?.create_locked_until) {
      const lockedUntil = new Date(attemptRow.create_locked_until);
      if (lockedUntil > now) {
        locked = true;
        minutesLeft = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 60000
        );
      }
    }

    const attempts = attemptRow?.create_attempts ?? 0;

    return NextResponse.json({
      success: true,
      attempts,
      remaining: Math.max(0, MAX_CREATE_ATTEMPTS - attempts),
      locked,
      minutesLeft,
      maxAttempts: MAX_CREATE_ATTEMPTS,
    });
  } catch (error) {
    console.error("GET /bank/verify-create-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    const userId = getUserId(authResult);
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to identify admin user." },
        { status: 403 }
      );
    }

    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (adminError || !adminRow || !adminRow.email) {
      console.error("Admin lookup error:", adminError);
      return NextResponse.json(
        { error: "Admin account not found." },
        { status: 404 }
      );
    }

    const { data: attemptRow } = await supabaseAdmin
      .from("hr4_bank_pass_attempts")
      .select("create_attempts, create_locked_until")
      .eq("admin_id", userId)
      .maybeSingle();

    const now = new Date();

    if (attemptRow?.create_locked_until) {
      const lockedUntil = new Date(attemptRow.create_locked_until);
      if (lockedUntil > now) {
        const minutesLeft = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 60000
        );
        return NextResponse.json(
          {
            error: `Account locked. Try again in ${minutesLeft} minute${
              minutesLeft > 1 ? "s" : ""
            }.`,
            locked: true,
            minutesLeft,
            maxAttempts: MAX_CREATE_ATTEMPTS,
          },
          { status: 403 }
        );
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_HR_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({
        email: adminRow.email,
        password,
      });

    if (authError || !authData.session) {
      const currentAttempts = (attemptRow?.create_attempts ?? 0) + 1;
      const shouldLock = currentAttempts >= MAX_CREATE_ATTEMPTS;

      const lockUntil = shouldLock
        ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60000).toISOString()
        : null;

      if (attemptRow) {
        await supabaseAdmin
          .from("hr4_bank_pass_attempts")
          .update({
            create_attempts: shouldLock ? 0 : currentAttempts,
            create_last_attempt_at: now.toISOString(),
            create_locked_until: lockUntil,
            updated_at: now.toISOString(),
          })
          .eq("admin_id", userId);
      } else {
        await supabaseAdmin.from("hr4_bank_pass_attempts").insert({
          admin_id: userId,
          create_attempts: shouldLock ? 0 : currentAttempts,
          create_last_attempt_at: now.toISOString(),
          create_locked_until: lockUntil,
        });
      }

      if (shouldLock) {
        return NextResponse.json(
          {
            error: `Too many failed attempts. Creation access is locked for ${LOCK_DURATION_MINUTES} minutes.`,
            locked: true,
            minutesLeft: LOCK_DURATION_MINUTES,
            maxAttempts: MAX_CREATE_ATTEMPTS,
          },
          { status: 403 }
        );
      }

      const remaining = MAX_CREATE_ATTEMPTS - currentAttempts;
      return NextResponse.json(
        {
          error: `Invalid password. ${remaining} attempt${
            remaining === 1 ? "" : "s"
          } remaining.`,
          remaining,
          maxAttempts: MAX_CREATE_ATTEMPTS,
        },
        { status: 403 }
      );
    }

    await supabaseAdmin.from("hr4_bank_pass_attempts").upsert(
      {
        admin_id: userId,
        create_attempts: 0,
        create_last_attempt_at: now.toISOString(),
        create_locked_until: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "admin_id" }
    );

    return NextResponse.json({
      success: true,
      expiresIn: 300,
      admin: {
        id: adminRow.id,
        email: adminRow.email,
        fullName: adminRow.full_name,
        role: adminRow.role,
      },
    });
  } catch (error) {
    console.error("POST /bank/verify-create-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
