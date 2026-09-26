import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export type SearchResult = {
  id: string;
  type:
    | "employee"
    | "claim"
    | "payroll_run"
    | "bank"
    | "benefit"
    | "compensation"
    | "settings";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const [employeesRes, claimsRes, runsRes, banksRes, benefitsRes, gradesRes] =
    await Promise.all([
      supabaseAdmin
        .from("hr1_employees")
        .select(
          "id, employee_id_number, first_name, last_name, department, status"
        )
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},employee_id_number.ilike.${like},email.ilike.${like},department.ilike.${like}`
        )
        .limit(6),
      supabaseAdmin
        .from("hr4_claims")
        .select("id, amount, status, description, employee_id")
        .or(`description.ilike.${like},status.ilike.${like}`)
        .limit(5),
      supabaseAdmin
        .from("hr4_payroll_runs")
        .select("id, period_start, period_end, status, approval_status")
        .or(`approval_status.ilike.${like},status.ilike.${like}`)
        .limit(5),
      supabaseAdmin
        .from("hr4_bank_types")
        .select("id, bank_name, bank_code")
        .or(`bank_name.ilike.${like},bank_code.ilike.${like}`)
        .limit(4),
      supabaseAdmin
        .from("hr4_compen_employee_benefits")
        .select("id, benefit_name, benefit_type, amount")
        .or(`benefit_name.ilike.${like},benefit_type.ilike.${like}`)
        .limit(5),
      supabaseAdmin
        .from("hr4_compen_salary_grades")
        .select("id, grade_code, grade_name")
        .or(`grade_code.ilike.${like},grade_name.ilike.${like}`)
        .limit(4),
    ]);

  (employeesRes.data ?? []).forEach((e: any) => {
    results.push({
      id: e.id,
      type: "employee",
      title: `${e.first_name} ${e.last_name}`,
      subtitle: `${e.employee_id_number} · ${e.department} · ${e.status}`,
      href: `/payroll-benefits-dashboard/payroll?employee=${e.id}`,
    });
  });

  (claimsRes.data ?? []).forEach((c: any) => {
    results.push({
      id: c.id,
      type: "claim",
      title: `Claim ${c.status}`,
      subtitle: `${c.description ?? "No description"}`,
      href: `/payroll-benefits-dashboard/claims?claim=${c.id}`,
    });
  });

  (runsRes.data ?? []).forEach((r: any) => {
    results.push({
      id: String(r.id),
      type: "payroll_run",
      title: `${r.period_start} → ${r.period_end}`,
      subtitle: `${r.approval_status ?? r.status}`,
      href: `/payroll-benefits-dashboard/payroll?run=${r.id}`,
    });
  });

  (banksRes.data ?? []).forEach((b: any) => {
    results.push({
      id: String(b.id),
      type: "bank",
      title: b.bank_name,
      subtitle: b.bank_code,
      href: `/payroll-benefits-dashboard/bank?bank=${b.id}`,
    });
  });

  (benefitsRes.data ?? []).forEach((b: any) => {
    results.push({
      id: String(b.id),
      type: "benefit",
      title: b.benefit_name,
      subtitle: `${b.benefit_type}`,
      href: `/payroll-benefits-dashboard/benefits?benefit=${b.id}`,
    });
  });

  (gradesRes.data ?? []).forEach((g: any) => {
    results.push({
      id: String(g.id),
      type: "compensation",
      title: `${g.grade_code} — ${g.grade_name}`,
      subtitle: "Salary grade",
      href: `/payroll-benefits-dashboard/compensation?grade=${g.id}`,
    });
  });

  const STATIC: SearchResult[] = [
    {
      id: "s-payroll",
      type: "settings",
      title: "Payroll",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/payroll",
    },
    {
      id: "s-bank",
      type: "settings",
      title: "Bank Details",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/bank",
    },
    {
      id: "s-benefits",
      type: "settings",
      title: "Benefits",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/benefits",
    },
    {
      id: "s-claims",
      type: "settings",
      title: "Claims",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/claims",
    },
    {
      id: "s-comp",
      type: "settings",
      title: "Compensation",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/compensation",
    },
    {
      id: "s-settings",
      type: "settings",
      title: "Settings",
      subtitle: "Module",
      href: "/payroll-benefits-dashboard/settings",
    },
    {
      id: "s-account",
      type: "settings",
      title: "Account settings",
      subtitle: "Profile, email, password",
      href: "/payroll-benefits-dashboard/settings?tab=account",
    },
    {
      id: "s-notifs",
      type: "settings",
      title: "Notification preferences",
      subtitle: "Emails and in-app alerts",
      href: "/payroll-benefits-dashboard/settings?tab=notifications",
    },
  ];

  const needle = q.toLowerCase();
  STATIC.forEach((s) => {
    if (
      s.title.toLowerCase().includes(needle) ||
      (s.subtitle ?? "").toLowerCase().includes(needle)
    ) {
      results.push(s);
    }
  });

  return NextResponse.json({ results: results.slice(0, 20) });
}
