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

export interface LivePayrollRules {
  sss_brackets: SSSBracket[];
  philhealth_rates: PhilHealthRate[];
  pagibig_tiers: PagibigTier[];
  fetched_at: string;
}

export interface LiveSystemSummary {
  active_employees: number;
  total_bank_types: number;
  total_claim_types: number;
  total_job_positions: number;
  total_salary_grades: number;
  open_payroll_runs: number;
  fetched_at: string;
}

export interface LiveEmployeeBankAccount {
  account_number: string;
  account_name: string;
  bank_name: string | null;
  bank_type: string | null;
  is_primary: boolean;
  is_active: boolean;
  verified_at: string | null;
}

export interface LiveEmployeeProfile {
  employee: HR1Employee;
  payroll_info: HR4EmployeePayrollInfo | null;
  bank_account: LiveEmployeeBankAccount | null;
  fetched_at: string;
}

export interface LiveBankTypes {
  bank_types: HR4BankType[];
  fetched_at: string;
}

export interface LiveClaimTypes {
  claim_types: HR4ClaimType[];
  fetched_at: string;
}

export interface LiveJobSettings {
  job_settings: HR4JobPositionSettingsWithPosition[];
  job_positions: HR1JobPosition[];
  fetched_at: string;
}

export interface LiveCompensation {
  salary_grades: HR4CompenSalaryGrade[];
  pay_steps: HR4CompenPayStep[];
  fetched_at: string;
}
