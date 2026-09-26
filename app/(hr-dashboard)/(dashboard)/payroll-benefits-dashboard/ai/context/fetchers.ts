import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

import type {
  SSSBracket,
  PhilHealthRate,
  PagibigTier,
  HR4BankType,
  HR4ClaimType,
  HR4JobPositionSettingsWithPosition,
  HR1JobPosition,
  HR4CompenSalaryGrade,
  HR4CompenPayStep,
  HR1Employee,
  HR4EmployeePayrollInfo,
} from "../../types";

import type {
  LivePayrollRules,
  LiveSystemSummary,
  LiveEmployeeProfile,
  LiveEmployeeBankAccount,
  LiveBankTypes,
  LiveClaimTypes,
  LiveJobSettings,
  LiveCompensation,
  SafeEmployeeRow,
  SafeEmployeeCounts,
  TopRatedEmployee,
  OpenRunRow,
  RejectedRunRow,
} from "./types";

function firstOrSelf<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > 0 ? s : null;
}

function strOrEmpty(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function fetchPayrollRules(): Promise<LivePayrollRules> {
  const [sss, ph, pi] = await Promise.all([
    supabaseAdmin
      .from("hr4_sss_brackets")
      .select("*")
      .eq("is_active", true)
      .order("range_min", { ascending: true }),
    supabaseAdmin
      .from("hr4_philhealth_rates")
      .select("*")
      .eq("is_active", true)
      .order("base_min_salary", { ascending: true }),
    supabaseAdmin
      .from("hr4_pagibig_tiers")
      .select("*")
      .eq("is_active", true)
      .order("salary_min", { ascending: true }),
  ]);

  if (sss.error) throw sss.error;
  if (ph.error) throw ph.error;
  if (pi.error) throw pi.error;

  return {
    sss_brackets: (sss.data ?? []) as SSSBracket[],
    philhealth_rates: (ph.data ?? []) as PhilHealthRate[],
    pagibig_tiers: (pi.data ?? []) as PagibigTier[],
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchSystemSummary(): Promise<LiveSystemSummary> {
  const [
    activeEmployees,
    bankTypes,
    claimTypes,
    jobPositions,
    salaryGrades,
    openRuns,
  ] = await Promise.all([
    supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabaseAdmin
      .from("hr4_bank_types")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabaseAdmin
      .from("hr4_claim_types")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabaseAdmin
      .from("hr1_job_positions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabaseAdmin
      .from("hr4_compen_salary_grades")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft"),
  ]);

  return {
    active_employees: activeEmployees.count ?? 0,
    total_bank_types: bankTypes.count ?? 0,
    total_claim_types: claimTypes.count ?? 0,
    total_job_positions: jobPositions.count ?? 0,
    total_salary_grades: salaryGrades.count ?? 0,
    open_payroll_runs: openRuns.count ?? 0,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchEmployeeProfile(
  employeeId: string
): Promise<LiveEmployeeProfile | null> {
  const { data: employee, error: empErr } = await supabaseAdmin
    .from("hr1_employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle();

  if (empErr) throw empErr;
  if (!employee) return null;

  const [payrollInfo, bankAccount] = await Promise.all([
    supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle(),
    supabaseAdmin
      .from("hr4_bank_accounts")
      .select(
        "account_number, account_name, is_primary, is_active, verified_at, hr4_bank_types (bank_name, bank_type)"
      )
      .eq("employee_id", employeeId)
      .maybeSingle(),
  ]);

  if (payrollInfo.error) throw payrollInfo.error;
  if (bankAccount.error) throw bankAccount.error;

  let mappedBank: LiveEmployeeBankAccount | null = null;

  if (bankAccount.data) {
    const raw = bankAccount.data as Record<string, unknown>;
    const bankTypeObj = firstOrSelf<{
      bank_name?: string | null;
      bank_type?: string | null;
    }>(raw.hr4_bank_types);

    mappedBank = {
      account_number: strOrEmpty(raw.account_number),
      account_name: strOrEmpty(raw.account_name),
      bank_name: strOrNull(bankTypeObj?.bank_name),
      bank_type: strOrNull(bankTypeObj?.bank_type),
      is_primary: Boolean(raw.is_primary),
      is_active: Boolean(raw.is_active),
      verified_at: strOrNull(raw.verified_at),
    };
  }

  return {
    employee: employee as HR1Employee,
    payroll_info: (payrollInfo.data ?? null) as HR4EmployeePayrollInfo | null,
    bank_account: mappedBank,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchBankTypes(): Promise<LiveBankTypes> {
  const { data, error } = await supabaseAdmin
    .from("hr4_bank_types")
    .select("*")
    .eq("is_active", true)
    .order("bank_name", { ascending: true });
  if (error) throw error;
  return {
    bank_types: (data ?? []) as HR4BankType[],
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchClaimTypes(): Promise<LiveClaimTypes> {
  const { data, error } = await supabaseAdmin
    .from("hr4_claim_types")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return {
    claim_types: (data ?? []) as HR4ClaimType[],
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchJobSettings(): Promise<LiveJobSettings> {
  const [settings, positions] = await Promise.all([
    supabaseAdmin
      .from("hr4_job_position_settings")
      .select("*, hr1_job_positions ( id, title, department )"),
    supabaseAdmin
      .from("hr1_job_positions")
      .select("*")
      .eq("is_active", true)
      .order("title", { ascending: true }),
  ]);
  if (settings.error) throw settings.error;
  if (positions.error) throw positions.error;
  return {
    job_settings: (settings.data ?? []) as HR4JobPositionSettingsWithPosition[],
    job_positions: (positions.data ?? []) as HR1JobPosition[],
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchCompensation(): Promise<LiveCompensation> {
  const [grades, steps] = await Promise.all([
    supabaseAdmin
      .from("hr4_compen_salary_grades")
      .select("*")
      .eq("is_active", true)
      .order("grade_level", { ascending: true }),
    supabaseAdmin
      .from("hr4_compen_pay_steps")
      .select("*")
      .eq("is_active", true)
      .order("step_number", { ascending: true }),
  ]);
  if (grades.error) throw grades.error;
  if (steps.error) throw steps.error;
  return {
    salary_grades: (grades.data ?? []) as HR4CompenSalaryGrade[],
    pay_steps: (steps.data ?? []) as HR4CompenPayStep[],
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchActiveEmployeeNames(): Promise<SafeEmployeeRow[]> {
  const { data: employees, error } = await supabaseAdmin
    .from("hr1_employees")
    .select(
      `
      id,
      employee_id_number,
      first_name,
      last_name,
      department,
      status,
      date_hired,
      birthdate,
      hr1_job_positions ( title ),
      hr4_bank_accounts ( account_number, bank_type_id, is_active )
      `
    )
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[fetchActiveEmployeeNames] supabase error:", error);
    return [];
  }

  if (!employees || employees.length === 0) return [];

  return employees.map((raw) => {
    const e = raw as Record<string, unknown>;

    const job = firstOrSelf<{ title?: string | null }>(e.hr1_job_positions);
    const bank = firstOrSelf<{
      account_number?: string | null;
      bank_type_id?: number | null;
      is_active?: boolean | null;
    }>(e.hr4_bank_accounts);

    const hasBank = Boolean(
      bank &&
        bank.is_active !== false &&
        bank.account_number &&
        String(bank.account_number).trim().length > 0 &&
        bank.bank_type_id !== null &&
        bank.bank_type_id !== undefined
    );

    const hasBirthdate = Boolean(
      e.birthdate && String(e.birthdate).trim().length > 0
    );

    return {
      id: strOrEmpty(e.id),
      employee_id_number: strOrEmpty(e.employee_id_number),
      first_name: strOrEmpty(e.first_name),
      last_name: strOrEmpty(e.last_name),
      department: strOrNull(e.department),
      job_title: strOrNull(job?.title),
      status: strOrEmpty(e.status) || "active",
      date_hired: strOrNull(e.date_hired),
      has_bank: hasBank,
      has_birthdate: hasBirthdate,
    };
  });
}

export async function fetchEmployeeCounts(): Promise<SafeEmployeeCounts> {
  const [activeRes, onLeaveRes, inactiveRes] = await Promise.all([
    supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "on_leave"),
    supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "inactive"),
  ]);

  return {
    active: activeRes.count ?? 0,
    on_leave: onLeaveRes.count ?? 0,
    inactive: inactiveRes.count ?? 0,
  };
}

export async function fetchEmployeesWithoutBank(): Promise<SafeEmployeeRow[]> {
  const rows = await fetchActiveEmployeeNames();
  return rows.filter((r) => !r.has_bank);
}

export async function fetchEmployeesWithoutBirthdate(): Promise<
  SafeEmployeeRow[]
> {
  const rows = await fetchActiveEmployeeNames();
  return rows.filter((r) => !r.has_birthdate);
}

export async function fetchTopRatedEmployees(
  limit = 5
): Promise<TopRatedEmployee[]> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select(
      `
      id,
      employee_id,
      performance_rating,
      final_score,
      letter_grade,
      status,
      hr1_employees ( first_name, last_name, employee_id_number, department )
      `
    )
    .eq("status", "finalized")
    .not("performance_rating", "is", null)
    .order("performance_rating", { ascending: false })
    .limit(limit * 2);

  if (error) {
    console.error("[fetchTopRatedEmployees] supabase error:", error);
    return [];
  }

  if (!data) return [];

  const seen = new Set<string>();
  const result: TopRatedEmployee[] = [];

  for (const row of data as Array<Record<string, unknown>>) {
    const employeeId = strOrEmpty(row.employee_id);
    if (!employeeId || seen.has(employeeId)) continue;
    seen.add(employeeId);

    const emp = firstOrSelf<{
      first_name?: string | null;
      last_name?: string | null;
      employee_id_number?: string | null;
      department?: string | null;
    }>(row.hr1_employees);

    if (!emp) continue;

    const firstName = strOrEmpty(emp.first_name);
    const lastName = strOrEmpty(emp.last_name);
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) continue;

    result.push({
      employee_name: fullName,
      employee_id_number: strOrEmpty(emp.employee_id_number),
      department: strOrNull(emp.department),
      performance_rating: Number(row.performance_rating ?? 0),
      letter_grade: strOrNull(row.letter_grade),
    });

    if (result.length >= limit) break;
  }

  return result;
}

export async function fetchOpenRuns(): Promise<OpenRunRow[]> {
  const { data, error } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select(
      "id, period_start, period_end, status, approval_status, distributed_at"
    )
    .in("approval_status", [
      "draft",
      "pending_approval",
      "approved",
      "rejected",
    ])
    .order("period_end", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[fetchOpenRuns] supabase error:", error);
    return [];
  }

  return (data ?? []) as OpenRunRow[];
}

export async function fetchPendingApprovals(): Promise<OpenRunRow[]> {
  const { data, error } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select(
      "id, period_start, period_end, status, approval_status, distributed_at"
    )
    .eq("approval_status", "pending_approval")
    .order("period_end", { ascending: false });

  if (error) {
    console.error("[fetchPendingApprovals] supabase error:", error);
    return [];
  }

  return (data ?? []) as OpenRunRow[];
}

export async function fetchRejectedRuns(): Promise<RejectedRunRow[]> {
  const { data, error } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select(
      "id, period_start, period_end, approval_status, rejection_reason, rejected_by_name, rejected_at"
    )
    .eq("approval_status", "rejected")
    .order("rejected_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[fetchRejectedRuns] supabase error:", error);
    return [];
  }

  return (data ?? []) as RejectedRunRow[];
}

export async function findEmployeeByNameSafe(query: string) {
  const cleaned = query.trim();
  if (!cleaned) return null;

  const parts = cleaned.split(/\s+/);
  const first = parts[0];
  const last = parts.slice(1).join(" ");

  let q = supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name, employee_id_number, status")
    .eq("status", "active");

  if (last) {
    q = q.or(
      `and(first_name.ilike.%${first}%,last_name.ilike.%${last}%),` +
        `and(first_name.ilike.%${last}%,last_name.ilike.%${first}%)`
    );
  } else {
    q = q.or(`first_name.ilike.%${first}%,last_name.ilike.%${first}%`);
  }

  const { data, error } = await q.limit(1).maybeSingle();
  if (error) {
    console.error("[findEmployeeByNameSafe] supabase error:", error);
    return null;
  }
  return data || null;
}
