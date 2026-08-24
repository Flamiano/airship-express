export type AppRole =
  | "super_admin"
  | "hr_payroll_admin"
  | "hr_performance_admin"
  | "hr_recruitment_admin"
  | "hr_workforce_admin";

export type HR1EmployeeStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated"
  | "resigned";

export type HR2AttendanceStatus = "On-Shift" | "On-Break" | "Tardy" | "Absent";

export type HR4PaySchedule =
  | "semi_monthly"
  | "monthly"
  | "weekly"
  | "bi_weekly";

export type HR4PayrollRunStatus =
  | "draft"
  | "processing"
  | "approved"
  | "completed"
  | "cancelled"
  | "voided";

export interface HR2AttendanceLog {
  id: string;
  employee_id: string;
  status: HR2AttendanceStatus;
  shift_start: string;
  shift_end: string;
  terminal: string;
  last_scan: string | null;
  created_at: string | null;
}

export interface HR1Employee {
  id: string;
  applicant_id: string | null;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  job_position_id: string;
  department: string;
  date_hired: string;
  status: HR1EmployeeStatus;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface HR1JobPosition {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HR4JobPositionSettings {
  id: string;
  job_position_id: string;
  daily_rate: number;
  hours_per_day: number;
  break_hours: number;
  overtime_rate: number;
  created_at: string;
  updated_at: string;
}

export interface HR4JobPositionSettingsWithPosition
  extends HR4JobPositionSettings {
  hr1_job_positions: {
    id: string;
    title: string;
    department: string;
  };
}

export interface SSSBracket {
  id: number;
  range_min: number;
  range_max: number | null;
  monthly_salary_credit: number;
  employer_share: number;
  employee_share: number;
  ec_share: number;
  effective_date: string;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhilHealthRate {
  id: number;
  base_min_salary: number;
  employer_rate: number;
  employee_rate: number;
  premium_cap: number;
  effective_date: string;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PagibigTier {
  id: number;
  tier_name: string;
  salary_min: number;
  salary_max: number | null;
  employer_rate: number;
  employee_rate: number;
  max_employer_share: number | null;
  max_employee_share: number | null;
  effective_date: string;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HR4EmployeePayrollInfo {
  id: number;
  employee_id: string;
  basic_salary: number;
  pay_schedule: HR4PaySchedule;
  bank_name: string | null;
  bank_account_no: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HR4PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  pay_schedule: HR4PaySchedule;
  status: HR4PayrollRunStatus;
  run_date: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HR4Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: string;
  basic_pay: number;
  gross_pay: number;
  sss_employee_share: number | null;
  sss_employer_share: number | null;
  philhealth_employee_share: number | null;
  philhealth_employer_share: number | null;
  pagibig_employee_share: number | null;
  pagibig_employer_share: number | null;
  withholding_tax: number | null;
  other_deductions: number | null;
  total_deductions: number;
  net_pay: number;
  daily_rate: number | null;
  days_worked: number | null;
  hours_worked: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  created_at: string | null;
}

export interface PayrollComputationResult {
  employee_id: string;
  employee_name: string;
  employee_id_number: string;
  job_title: string;
  daily_rate: number;
  hours_per_day: number;
  break_hours: number;
  overtime_rate: number;
  days_worked: number;
  hours_worked: number;
  regular_hours: number;
  overtime_hours: number;
  basic_pay: number;
  gross_pay: number;
  sss_employee_share: number;
  sss_employer_share: number;
  philhealth_employee_share: number;
  philhealth_employer_share: number;
  pagibig_employee_share: number;
  pagibig_employer_share: number;
  withholding_tax: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
}
