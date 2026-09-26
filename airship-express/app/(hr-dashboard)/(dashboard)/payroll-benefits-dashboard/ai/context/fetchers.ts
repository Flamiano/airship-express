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
    const row = bankAccount.data as {
      account_number: string;
      account_name: string;
      is_primary: boolean;
      is_active: boolean;
      verified_at: string | null;
      hr4_bank_types: { bank_name: string; bank_type: string } | null;
    };

    mappedBank = {
      account_number: row.account_number,
      account_name: row.account_name,
      bank_name: row.hr4_bank_types?.bank_name ?? null,
      bank_type: row.hr4_bank_types?.bank_type ?? null,
      is_primary: row.is_primary,
      is_active: row.is_active,
      verified_at: row.verified_at,
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
