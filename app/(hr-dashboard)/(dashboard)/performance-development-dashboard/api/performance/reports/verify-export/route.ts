import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { password } = rawBody;

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  // The identity is resolved entirely from the server-side session. Employee
  // IDs, emails, roles, or user IDs supplied by the browser are never used.
  const actor = await getAuthenticatedActor();

  if (actor instanceof NextResponse) return actor;

  // Only HR Admin accounts with an allowed PerDev role may verify export
  // credentials. Manager and Employee accounts are rejected here before
  // the password verification step.
  const hrAdmin = await requireHrAdmin();
  if (hrAdmin instanceof NextResponse) return hrAdmin;

  // Only the account email linked to the authenticated session is accepted as
  // the sign-in identifier, so a stolen session cannot verify another account.
  const email = hrAdmin.email;

  if (!email) {
    return NextResponse.json(
      { error: "Unable to verify credentials for this account" },
      { status: 500 }
    );
  }

  try {
    // Reuse the same Supabase email+password verification the HR login uses.
    // The client is non-persistent and never writes cookies, so the user's
    // existing session is untouched and the returned session is discarded.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_HR_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // No account details are exposed. A failed sign-in against the session's
      // own account can only mean the typed password is incorrect (or the
      // account is locked/rate-limited by Supabase).
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("POST /api/performance/reports/verify-export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}