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

export interface SafeEmployeeRow {
  id: string;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
  status: string;
  date_hired: string | null;
  has_bank: boolean;
  has_birthdate: boolean;
}

export interface SafeEmployeeCounts {
  active: number;
  on_leave: number;
  inactive: number;
}

export interface TopRatedEmployee {
  employee_name: string;
  employee_id_number: string;
  department: string | null;
  performance_rating: number;
  letter_grade: string | null;
}

export interface OpenRunRow {
  id: number;
  period_start: string;
  period_end: string;
  status: string;
  approval_status: string;
  distributed_at: string | null;
}

export interface RejectedRunRow {
  id: number;
  period_start: string;
  period_end: string;
  approval_status: string;
  rejection_reason: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
}
