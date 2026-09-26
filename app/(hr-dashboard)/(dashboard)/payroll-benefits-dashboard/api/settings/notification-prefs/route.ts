import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const ALLOWED_KEYS = [
  "security_alerts",
  "email_payslip_distribution",
  "email_budget_alerts",
  "email_claim_approvals",
  "email_payroll_run_updates",
  "email_merit_bonus",
  "in_app_bell",
  "in_app_toast",
  "in_app_sound",
  "daily_briefing",
] as const;

const DEFAULTS: Record<(typeof ALLOWED_KEYS)[number], boolean> = {
  security_alerts: true,
  email_payslip_distribution: true,
  email_budget_alerts: true,
  email_claim_approvals: true,
  email_payroll_run_updates: true,
  email_merit_bonus: true,
  in_app_bell: true,
  in_app_toast: true,
  in_app_sound: false,
  daily_briefing: true,
};

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string };

  const { data, error } = await supabaseAdmin
    .from("hr_admin_notification_prefs")
    .select("*")
    .eq("admin_id", admin.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data) {
    return NextResponse.json({ prefs: data });
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("hr_admin_notification_prefs")
    .insert({ admin_id: admin.id, ...DEFAULTS })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json({ prefs: created });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, boolean | string> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of ALLOWED_KEYS) {
    if (typeof body?.[key] === "boolean") {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hr_admin_notification_prefs")
    .upsert(
      { admin_id: admin.id, ...DEFAULTS, ...update },
      { onConflict: "admin_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body?.security_alerts === "boolean") {
    await supabaseAdmin
      .from("hr_admin")
      .update({ receives_security_alerts: body.security_alerts })
      .eq("id", admin.id);
  }

  return NextResponse.json({ prefs: data });
}
