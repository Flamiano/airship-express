import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type NewNotif = {
  admin_id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  source_table: string;
  source_id: string;
  severity: "info" | "success" | "warning" | "danger";
  created_at: string;
};

function periodLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "payroll run";
  const s = new Date(start).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const e = new Date(end).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string };

  const { data: prefs } = await supabaseAdmin
    .from("hr_admin_notification_prefs")
    .select("*")
    .eq("admin_id", admin.id)
    .maybeSingle();

  const generated: NewNotif[] = [];
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  if (prefs?.in_app_bell !== false) {
    if (prefs?.email_payroll_run_updates !== false) {
      const { data: runs } = await supabaseAdmin
        .from("hr4_payroll_runs")
        .select(
          "id, period_start, period_end, approval_status, rejection_reason, approved_by_name, rejected_by_name, distributed_by_name, submitted_for_approval_at, approved_at, rejected_at, distributed_at"
        )
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(30);

      (runs ?? []).forEach((r: any) => {
        const label = periodLabel(r.period_start, r.period_end);

        if (r.approval_status === "pending_approval") {
          generated.push({
            admin_id: admin.id,
            type: "payroll_run_pending",
            title: "Payroll run awaiting approval",
            message: `${label} was submitted for financial approval.`,
            href: `/payroll-benefits-dashboard/payroll?run=${r.id}`,
            source_table: "hr4_payroll_runs",
            source_id: `${r.id}:pending`,
            severity: "warning",
            created_at: r.submitted_for_approval_at ?? new Date().toISOString(),
          });
        }

        if (r.approval_status === "approved") {
          generated.push({
            admin_id: admin.id,
            type: "payroll_run_approved",
            title: "Payroll run approved",
            message: `${label} approved by ${
              r.approved_by_name ?? "Financial"
            }.`,
            href: `/payroll-benefits-dashboard/payroll?run=${r.id}`,
            source_table: "hr4_payroll_runs",
            source_id: `${r.id}:approved`,
            severity: "success",
            created_at: r.approved_at ?? new Date().toISOString(),
          });
        }

        if (r.approval_status === "rejected") {
          generated.push({
            admin_id: admin.id,
            type: "payroll_run_rejected",
            title: "Payroll run rejected",
            message: `${label} was rejected by ${
              r.rejected_by_name ?? "Financial"
            }.${r.rejection_reason ? ` Reason: ${r.rejection_reason}` : ""}`,
            href: `/payroll-benefits-dashboard/payroll?run=${r.id}`,
            source_table: "hr4_payroll_runs",
            source_id: `${r.id}:rejected`,
            severity: "danger",
            created_at: r.rejected_at ?? new Date().toISOString(),
          });
        }

        if (r.approval_status === "distributed") {
          generated.push({
            admin_id: admin.id,
            type: "payroll_run_distributed",
            title: "Payroll run distributed",
            message: `${label} was distributed by ${
              r.distributed_by_name ?? "HR"
            }.`,
            href: `/payroll-benefits-dashboard/payroll?run=${r.id}`,
            source_table: "hr4_payroll_runs",
            source_id: `${r.id}:distributed`,
            severity: "success",
            created_at: r.distributed_at ?? new Date().toISOString(),
          });
        }
      });
    }

    if (prefs?.email_claim_approvals !== false) {
      const { data: claims } = await supabaseAdmin
        .from("hr4_claims")
        .select(
          "id, amount, status, employee_id, submitted_at, reviewed_at, ai_override, ai_verdict"
        )
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(30);

      const employeeIds = Array.from(
        new Set((claims ?? []).map((c: any) => c.employee_id).filter(Boolean))
      );

      const empMap = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: emps } = await supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name")
          .in("id", employeeIds);
        (emps ?? []).forEach((e: any) =>
          empMap.set(e.id, `${e.first_name} ${e.last_name}`)
        );
      }

      (claims ?? []).forEach((c: any) => {
        const name = empMap.get(c.employee_id) ?? "An employee";

        if (c.status === "pending" && c.ai_override) {
          generated.push({
            admin_id: admin.id,
            type: "claim_override",
            title: "Claim submitted with AI override",
            message: `${name} submitted a claim with an overridden AI verdict (${c.ai_verdict}).`,
            href: `/payroll-benefits-dashboard/claims?claim=${c.id}`,
            source_table: "hr4_claims",
            source_id: `${c.id}:override`,
            severity: "warning",
            created_at: c.submitted_at ?? new Date().toISOString(),
          });
        }

        if (c.status === "approved") {
          generated.push({
            admin_id: admin.id,
            type: "claim_approved",
            title: "Claim approved",
            message: `${name}'s claim was approved.`,
            href: `/payroll-benefits-dashboard/claims?claim=${c.id}`,
            source_table: "hr4_claims",
            source_id: `${c.id}:approved`,
            severity: "success",
            created_at: c.reviewed_at ?? new Date().toISOString(),
          });
        }
      });
    }

    if (prefs?.email_budget_alerts !== false) {
      const { data: budgets } = await supabaseAdmin
        .from("hr4_compen_budget_plans")
        .select(
          "id, fiscal_year, department, total_budget, actual_spent, status"
        )
        .gte("updated_at", since);

      (budgets ?? []).forEach((b: any) => {
        const pct =
          b.total_budget > 0 ? (b.actual_spent / b.total_budget) * 100 : 0;
        if (pct >= 100) {
          generated.push({
            admin_id: admin.id,
            type: "budget_exceeded",
            title: "Compensation budget exceeded",
            message: `${b.department ?? "Company"} FY${
              b.fiscal_year
            } is at ${pct.toFixed(0)}% utilization.`,
            href: `/payroll-benefits-dashboard/compensation?budget=${b.id}`,
            source_table: "hr4_compen_budget_plans",
            source_id: `${b.id}:100`,
            severity: "danger",
            created_at: new Date().toISOString(),
          });
        } else if (pct >= 80) {
          generated.push({
            admin_id: admin.id,
            type: "budget_warning",
            title: "Compensation budget nearing limit",
            message: `${b.department ?? "Company"} FY${
              b.fiscal_year
            } is at ${pct.toFixed(0)}% utilization.`,
            href: `/payroll-benefits-dashboard/compensation?budget=${b.id}`,
            source_table: "hr4_compen_budget_plans",
            source_id: `${b.id}:80`,
            severity: "warning",
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    if (prefs?.email_merit_bonus !== false) {
      const { data: merits } = await supabaseAdmin
        .from("hr4_compen_merit_planning")
        .select(
          "id, employee_id, fiscal_year, status, recommended_new_salary, current_salary, created_at"
        )
        .in("status", ["draft", "pending_review"])
        .gte("updated_at", since);

      const empIds = Array.from(
        new Set((merits ?? []).map((m: any) => m.employee_id).filter(Boolean))
      );
      const empMap2 = new Map<string, string>();
      if (empIds.length > 0) {
        const { data: emps } = await supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name")
          .in("id", empIds);
        (emps ?? []).forEach((e: any) =>
          empMap2.set(e.id, `${e.first_name} ${e.last_name}`)
        );
      }

      (merits ?? []).forEach((m: any) => {
        generated.push({
          admin_id: admin.id,
          type: "merit_pending",
          title: "Merit plan awaiting review",
          message: `${empMap2.get(m.employee_id) ?? "An employee"} — FY${
            m.fiscal_year
          } merit plan is ${m.status.replace(/_/g, " ")}.`,
          href: `/payroll-benefits-dashboard/compensation?merit=${m.id}`,
          source_table: "hr4_compen_merit_planning",
          source_id: `${m.id}:${m.status}`,
          severity: "info",
          created_at: m.created_at ?? new Date().toISOString(),
        });
      });

      const { data: bonuses } = await supabaseAdmin
        .from("hr4_compen_bonus_allocations")
        .select("id, employee_id, fiscal_year, status, amount, created_at")
        .in("status", ["draft", "pending_approval"])
        .gte("updated_at", since);

      const bonusEmpIds = Array.from(
        new Set((bonuses ?? []).map((b: any) => b.employee_id).filter(Boolean))
      );
      const empMap3 = new Map<string, string>();
      if (bonusEmpIds.length > 0) {
        const { data: emps } = await supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name")
          .in("id", bonusEmpIds);
        (emps ?? []).forEach((e: any) =>
          empMap3.set(e.id, `${e.first_name} ${e.last_name}`)
        );
      }

      (bonuses ?? []).forEach((b: any) => {
        generated.push({
          admin_id: admin.id,
          type: "bonus_pending",
          title: "Bonus allocation awaiting approval",
          message: `${empMap3.get(b.employee_id) ?? "An employee"} — FY${
            b.fiscal_year
          } bonus is ${b.status.replace(/_/g, " ")}.`,
          href: `/payroll-benefits-dashboard/compensation?bonus=${b.id}`,
          source_table: "hr4_compen_bonus_allocations",
          source_id: `${b.id}:${b.status}`,
          severity: "info",
          created_at: b.created_at ?? new Date().toISOString(),
        });
      });
    }

    if (prefs?.email_payslip_distribution !== false) {
      const { data: dists } = await supabaseAdmin
        .from("hr4_payslip_distributions")
        .select(
          "id, payroll_run_id, status, error_message, sent_at, created_at"
        )
        .eq("status", "failed")
        .gte("created_at", since)
        .limit(20);

      (dists ?? []).forEach((d: any) => {
        generated.push({
          admin_id: admin.id,
          type: "payslip_failed",
          title: "Payslip delivery failed",
          message: d.error_message ?? "A payslip email could not be delivered.",
          href: `/payroll-benefits-dashboard/payroll?run=${d.payroll_run_id}`,
          source_table: "hr4_payslip_distributions",
          source_id: `${d.id}:failed`,
          severity: "danger",
          created_at: d.created_at ?? new Date().toISOString(),
        });
      });
    }

    if (prefs?.security_alerts !== false) {
      const { data: sec } = await supabaseAdmin
        .from("hr4_airy_security_events")
        .select("id, event_type, trigger_intent, severity, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(15);

      (sec ?? []).forEach((s: any) => {
        generated.push({
          admin_id: admin.id,
          type: "security_event",
          title: "Security event detected",
          message: `${(s.trigger_intent ?? s.event_type).replace(/_/g, " ")}.`,
          href: "/payroll-benefits-dashboard/settings?tab=security",
          source_table: "hr4_airy_security_events",
          source_id: s.id,
          severity: s.severity === "critical" ? "danger" : "warning",
          created_at: s.created_at,
        });
      });
    }
  }

  if (generated.length > 0) {
    const dedup = new Map<string, NewNotif>();
    for (const g of generated) {
      dedup.set(`${g.source_table}:${g.source_id}`, g);
    }

    const rows = Array.from(dedup.values()).map((g) => ({
      ...g,
      is_read: false,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("hr_admin_notifications")
      .upsert(rows, {
        onConflict: "admin_id,source_table,source_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.warn("[notifications] insert ignored:", insertError.message);
    }
  }

  const { data: list, error: listError } = await supabaseAdmin
    .from("hr_admin_notifications")
    .select("*")
    .eq("admin_id", admin.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const unread = (list ?? []).filter((n: any) => !n.is_read).length;

  return NextResponse.json({
    notifications: list ?? [],
    unread,
    showBadge: prefs?.in_app_bell !== false,
  });
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

  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const markAll = body?.all === true;

  if (!markAll && ids.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("hr_admin_notifications")
    .update({ is_read: true, read_at: now })
    .eq("admin_id", admin.id);

  if (!markAll) {
    query = query.in("id", ids);
  } else {
    query = query.eq("is_read", false);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
