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

    const bankTypesRaw = raw.hr4_bank_types;
    const bankTypeObj: {
      bank_name?: string | null;
      bank_type?: string | null;
    } | null = Array.isArray(bankTypesRaw)
      ? (bankTypesRaw[0] as {
          bank_name?: string | null;
          bank_type?: string | null;
        }) ?? null
      : (bankTypesRaw as {
          bank_name?: string | null;
          bank_type?: string | null;
        } | null);

    mappedBank = {
      account_number: String(raw.account_number ?? ""),
      account_name: String(raw.account_name ?? ""),
      bank_name: bankTypeObj?.bank_name ?? null,
      bank_type: bankTypeObj?.bank_type ?? null,
      is_primary: Boolean(raw.is_primary),
      is_active: Boolean(raw.is_active),
      verified_at: (raw.verified_at as string | null) ?? null,
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
  const { data: employees } = await supabaseAdmin
    .from("hr1_employees")
    .select(
      `id, employee_id_number, first_name, last_name, department, status, date_hired, birthdate,
       hr1_job_positions ( title ),
       hr4_bank_accounts ( account_number, bank_type_id, is_active )`
    )
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (!employees) return [];

  return employees.map((e: Record<string, unknown>) => {
    const jobsRaw = e.hr1_job_positions;
    const job: { title?: string | null } | null = Array.isArray(jobsRaw)
      ? (jobsRaw[0] as { title?: string | null }) ?? null
      : (jobsRaw as { title?: string | null } | null);

    const banksRaw = e.hr4_bank_accounts;
    const bank: {
      account_number?: string | null;
      bank_type_id?: number | null;
      is_active?: boolean | null;
    } | null = Array.isArray(banksRaw)
      ? (banksRaw[0] as {
          account_number?: string | null;
          bank_type_id?: number | null;
          is_active?: boolean | null;
        }) ?? null
      : (banksRaw as {
          account_number?: string | null;
          bank_type_id?: number | null;
          is_active?: boolean | null;
        } | null);

    const hasBank = Boolean(
      bank &&
        bank.is_active !== false &&
        bank.account_number &&
        bank.bank_type_id
    );

    return {
      id: String(e.id),
      employee_id_number: String(e.employee_id_number ?? ""),
      first_name: String(e.first_name ?? ""),
      last_name: String(e.last_name ?? ""),
      department: (e.department as string | null) ?? null,
      job_title: job?.title ?? null,
      status: String(e.status ?? "active"),
      date_hired: (e.date_hired as string | null) ?? null,
      has_bank: hasBank,
      has_birthdate: Boolean(e.birthdate),
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
  const { data } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select(
      `id, employee_id, performance_rating, final_score, letter_grade, status,
       hr1_employees ( first_name, last_name, employee_id_number, department )`
    )
    .eq("status", "finalized")
    .not("performance_rating", "is", null)
    .order("performance_rating", { ascending: false })
    .limit(limit * 2);

  if (!data) return [];

  const seen = new Set<string>();
  const result: TopRatedEmployee[] = [];

  for (const row of data as Array<Record<string, unknown>>) {
    const employeeId = String(row.employee_id);
    if (seen.has(employeeId)) continue;
    seen.add(employeeId);

    const empsRaw = row.hr1_employees;
    const emp: {
      first_name?: string | null;
      last_name?: string | null;
      employee_id_number?: string | null;
      department?: string | null;
    } | null = Array.isArray(empsRaw)
      ? (empsRaw[0] as {
          first_name?: string | null;
          last_name?: string | null;
          employee_id_number?: string | null;
          department?: string | null;
        }) ?? null
      : (empsRaw as {
          first_name?: string | null;
          last_name?: string | null;
          employee_id_number?: string | null;
          department?: string | null;
        } | null);

    if (!emp) continue;

    result.push({
      employee_name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
      employee_id_number: emp.employee_id_number ?? "",
      department: emp.department ?? null,
      performance_rating: Number(row.performance_rating ?? 0),
      letter_grade: (row.letter_grade as string | null) ?? null,
    });

    if (result.length >= limit) break;
  }

  return result;
}

export async function fetchOpenRuns(): Promise<OpenRunRow[]> {
  const { data } = await supabaseAdmin
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

  return (data || []) as OpenRunRow[];
}

export async function fetchPendingApprovals(): Promise<OpenRunRow[]> {
  const { data } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select(
      "id, period_start, period_end, status, approval_status, distributed_at"
    )
    .eq("approval_status", "pending_approval")
    .order("period_end", { ascending: false });

  return (data || []) as OpenRunRow[];
}

export async function fetchRejectedRuns(): Promise<RejectedRunRow[]> {
  const { data } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select(
      "id, period_start, period_end, approval_status, rejection_reason, rejected_by_name, rejected_at"
    )
    .eq("approval_status", "rejected")
    .order("rejected_at", { ascending: false })
    .limit(5);

  return (data || []) as RejectedRunRow[];
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

  const { data } = await q.limit(1).maybeSingle();
  return data || null;
}
