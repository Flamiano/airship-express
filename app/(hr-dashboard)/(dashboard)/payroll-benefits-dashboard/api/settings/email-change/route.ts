import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import {
  sendEmailChangeVerification,
  sendEmailChangeWarning,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string; email: string; fullName: string };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const newEmail = String(body?.newEmail ?? "")
    .trim()
    .toLowerCase();

  if (!newEmail || !EMAIL_RE.test(newEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("hr_admin")
    .select("email")
    .eq("id", admin.id)
    .maybeSingle();

  if (currentError) {
    console.error("[email-change] fetch current admin failed:", currentError);
    return NextResponse.json(
      { error: "Could not verify your current email." },
      { status: 500 }
    );
  }

  const oldEmail = current?.email ?? admin.email;
  if (!oldEmail) {
    return NextResponse.json(
      { error: "Your admin record has no email on file." },
      { status: 400 }
    );
  }

  if (oldEmail.toLowerCase() === newEmail) {
    return NextResponse.json(
      { error: "That is already your current email address." },
      { status: 400 }
    );
  }

  const { data: taken } = await supabaseAdmin
    .from("hr_admin")
    .select("id")
    .eq("email", newEmail)
    .neq("id", admin.id)
    .maybeSingle();

  if (taken) {
    return NextResponse.json(
      { error: "That email is already in use by another admin." },
      { status: 409 }
    );
  }

  await supabaseAdmin
    .from("hr_admin_email_change")
    .delete()
    .eq("admin_id", admin.id);

  const code = generateCode();
  const expiresAt = new Date(
    Date.now() + CODE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("hr_admin_email_change")
    .insert({
      admin_id: admin.id,
      old_email: oldEmail,
      new_email: newEmail,
      new_email_code_hash: hashCode(code),
      new_email_expires_at: expiresAt,
      old_email_notified_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error("[email-change] insert failed:", insertError);
    return NextResponse.json(
      { error: "Could not start the email change request." },
      { status: 500 }
    );
  }

  try {
    await sendEmailChangeVerification({
      to: newEmail,
      adminName: admin.fullName,
      code,
      oldEmail,
      ttlMinutes: CODE_TTL_MINUTES,
    });
  } catch (err: any) {
    console.error("[email-change] verification email failed:", err);
    await supabaseAdmin
      .from("hr_admin_email_change")
      .delete()
      .eq("admin_id", admin.id);
    return NextResponse.json(
      { error: "Failed to send the verification email to the new address." },
      { status: 500 }
    );
  }

  try {
    await sendEmailChangeWarning({
      to: oldEmail,
      adminName: admin.fullName,
      oldEmail,
      newEmail,
    });
  } catch (err: any) {
    console.warn("[email-change] warning email failed:", err);
  }

  return NextResponse.json({
    success: true,
    sentTo: newEmail,
    warningSentTo: oldEmail,
    expiresAt,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string; email: string };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const code = String(body?.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit verification code." },
      { status: 400 }
    );
  }

  const { data: change, error: changeError } = await supabaseAdmin
    .from("hr_admin_email_change")
    .select("*")
    .eq("admin_id", admin.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (changeError) {
    console.error("[email-change] fetch pending failed:", changeError);
    return NextResponse.json(
      { error: "Could not load your pending request." },
      { status: 500 }
    );
  }

  if (!change) {
    return NextResponse.json(
      { error: "No pending email change. Start again." },
      { status: 400 }
    );
  }

  if (new Date(change.new_email_expires_at) < new Date()) {
    return NextResponse.json(
      { error: "The code has expired. Request a new one." },
      { status: 400 }
    );
  }

  if (change.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Request a new code." },
      { status: 429 }
    );
  }

  if (hashCode(code) !== change.new_email_code_hash) {
    const nextAttempts = (change.attempts ?? 0) + 1;
    await supabaseAdmin
      .from("hr_admin_email_change")
      .update({ attempts: nextAttempts })
      .eq("id", change.id);

    const remaining = MAX_ATTEMPTS - nextAttempts;
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Incorrect code. ${remaining} attempt${
                remaining === 1 ? "" : "s"
              } remaining.`
            : "Too many incorrect attempts. Request a new code.",
      },
      { status: 400 }
    );
  }

  const { data: duplicate } = await supabaseAdmin
    .from("hr_admin")
    .select("id")
    .eq("email", change.new_email)
    .neq("id", admin.id)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      { error: "That email was just taken by another admin. Start again." },
      { status: 409 }
    );
  }

  const { error: adminUpdateError } = await supabaseAdmin
    .from("hr_admin")
    .update({ email: change.new_email })
    .eq("id", admin.id);

  if (adminUpdateError) {
    console.error("[email-change] hr_admin update failed:", adminUpdateError);
    return NextResponse.json(
      { error: "Could not update your email. Try again." },
      { status: 500 }
    );
  }

  try {
    await supabaseAdmin.auth.admin.updateUserById(admin.id, {
      email: change.new_email,
      email_confirm: true,
    });
  } catch (err: any) {
    console.warn("[email-change] auth user update failed:", err);
  }

  const { error: consumeError } = await supabaseAdmin
    .from("hr_admin_email_change")
    .update({
      consumed_at: new Date().toISOString(),
      new_email_verified_at: new Date().toISOString(),
    })
    .eq("id", change.id);

  if (consumeError) {
    console.warn("[email-change] consume pending failed:", consumeError);
  }

  return NextResponse.json({
    success: true,
    email: change.new_email,
  });
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string };

  const { error } = await supabaseAdmin
    .from("hr_admin_email_change")
    .delete()
    .eq("admin_id", admin.id)
    .is("consumed_at", null);

  if (error) {
    console.error("[email-change] cancel failed:", error);
    return NextResponse.json(
      { error: "Could not cancel the pending request." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
