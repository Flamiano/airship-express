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
  custom_daily_rate: number | null;
  salary_adjustment_reason: string | null;
  incentives: number | null;
  incentive_description: string | null;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
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

export interface HR4PayrollRunWithTotals extends HR4PayrollRun {
  payslip_count: number;
  total_net_pay: number;
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
  night_diff_hours: number | null;
  night_diff_pay: number | null;
  holiday_hours: number | null;
  holiday_pay: number | null;
  allowances_pay: number | null;
  bonus_pay: number | null;
  incentive_pay: number | null;
  created_at: string | null;
}

export interface HR4PayslipWithEmployee extends HR4Payslip {
  employee_name: string | null;
  employee_id_number: string | null;
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

export type HR4BankTypeCategory = "traditional" | "digital" | "e_wallet";

export interface HR4BankType {
  id: number;
  bank_code: string;
  bank_name: string;
  bank_type: HR4BankTypeCategory;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface HR4BankAccount {
  id: number;
  employee_id: string;
  bank_type_id: number;
  account_number: string;
  account_name: string;
  is_primary: boolean;
  is_active: boolean | null;
  verified_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HR4BankAccountWithType extends HR4BankAccount {
  hr4_bank_types: HR4BankType | null;
}

export interface HR4BankAccountFormatted {
  id: number;
  employee_id: string;
  employee_name: string;
  employee_id_number: string | null;
  bank_type_id: number;
  bank_type_name: string | null;
  bank_type_code: string | null;
  bank_type_category: HR4BankTypeCategory | null;
  account_number: string;
  account_name: string;
  is_primary: boolean;
  is_active: boolean | null;
  verified_at: string | null;
  verified_by_name: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type HR4BankHistoryAction =
  | "created"
  | "updated"
  | "deleted"
  | "verified"
  | "unverified";

export interface HR4BankHistory {
  id: number;
  employee_id: string;
  previous_bank_type_id: number | null;
  new_bank_type_id: number | null;
  previous_account_number: string | null;
  new_account_number: string | null;
  previous_account_name: string | null;
  new_account_name: string | null;
  action: HR4BankHistoryAction;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_email: string | null;
  created_at: string | null;
}

export interface HR4BankPassAttempt {
  id: string;
  admin_id: string;
  attempts: number;
  last_attempt_at: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankRevealStatus {
  success: boolean;
  attempts: number;
  remaining: number;
  locked: boolean;
  minutesLeft: number;
  maxAttempts: number;
}

export interface BankRevealPasswordResponse {
  success: boolean;
  expiresIn: number;
  admin: {
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
  };
}

export interface EmployeeBankDetails {
  employee_id: string;
  employee_name: string;
  employee_id_number: string;
  bank_account: {
    id: number;
    bank_type_id: number;
    bank_code: string | null;
    bank_name: string | null;
    bank_type: HR4BankTypeCategory | null;
    account_number: string;
    account_name: string;
    is_primary: boolean;
    is_active: boolean | null;
    verified_at: string | null;
    verified_by_name: string | null;
  } | null;
  has_complete_bank: boolean;
}

export interface HR4EmployeeIncentive {
  id: string;
  employee_id: string;
  payroll_run_id: number;
  amount: number;
  description: string | null;
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  created_at: string;
}

export interface HR4EmployeeIncentiveFormatted extends HR4EmployeeIncentive {
  employee_name: string;
  employee_id_number: string | null;
  period_start: string | null;
  period_end: string | null;
  pay_schedule: HR4PaySchedule | null;
  run_status: HR4PayrollRunStatus | null;
  is_active_now: boolean;
}

export type HR4RateChangeScope = "employee" | "position";

export interface HR4RateChangeLog {
  id: string;
  scope: HR4RateChangeScope;
  employee_id: string | null;
  job_position_id: string | null;
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  action: string;
  previous_daily_rate: number | null;
  new_daily_rate: number | null;
  previous_incentives: number | null;
  new_incentives: number | null;
  reason: string | null;
  created_at: string;
}

export interface EmployeePayrollInfoRow {
  id: number | null;
  employee_id: string;
  employee_name: string;
  employee_id_number: string;
  job_title: string | null;
  department: string | null;
  position_daily_rate: number;
  effective_daily_rate: number;
  custom_daily_rate: number | null;
  has_custom_rate: boolean;
  salary_adjustment_reason: string | null;
  daily_rate: number;
  hours_per_day: number;
  break_hours: number;
  overtime_rate: number;
  basic_salary: number | null;
  pay_schedule: HR4PaySchedule | null;
  bank_name: string | null;
  bank_account_no: string | null;
  has_complete_bank: boolean;
  is_active: boolean;
  attendance_status: string;
  attendance_count: number;
  date_hired: string | null;
  incentives: number;
  edited_by?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobPositionSettingsRow {
  id: string;
  job_position_id: string;
  title: string;
  department: string;
  daily_rate: number;
  basic_salary: number;
  hours_per_day: number;
  break_hours: number;
  overtime_rate: number;
  is_active: boolean;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
  edited_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HR2AttendanceLogRow {
  id: string;
  employee_id: string;
  status: HR2AttendanceStatus;
  shift_start: string;
  shift_end: string;
  terminal: string;
  created_at: string | null;
}

export interface PayrollSummary {
  active_employees: number;
  today_attendance: number;
  open_runs: number;
  last_run_net_pay: number;
  ytd_net_pay: number;
}

export interface IncompleteBankEmployee {
  employee_id: string;
  employee_name: string;
  employee_id_number: string;
  missing: string[];
}

export interface HR4PHHoliday {
  id: string;
  holiday_date: string;
  name: string;
  type: "regular" | "special_non_working" | "special_working";
  year: number;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HR4NightDiffSettings {
  id: string | null;
  night_diff_start: string;
  night_diff_end: string;
  night_diff_rate: number;
  deduct_from_payroll: boolean;
  is_active: boolean;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type HR4BenefitFrequency =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "one_time";

export type HR4BenefitType =
  | "allowance"
  | "bonus"
  | "incentive"
  | "commission"
  | "overtime"
  | "night_diff"
  | "holiday_pay"
  | "other";

export interface HR4CompenEmployeeBenefit {
  id: number;
  employee_id: string;
  benefit_type: HR4BenefitType;
  benefit_name: string;
  amount: number;
  frequency: HR4BenefitFrequency;
  payroll_run_id: number | null;
  is_taxable: boolean;
  deduct_from_payroll: boolean;
  is_mandatory: boolean;
  is_active: boolean;
  effective_date: string;
  expiry_date: string | null;
  description: string | null;
  holiday_multiplier: number;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
}

export interface HolidayPayConfig {
  holiday_multiplier: number;
}

export interface LatestPerformanceRating {
  employee_id: string;
  appraisal_id: string;
  performance_rating: number | null;
  final_score: number | null;
  letter_grade: string | null;
  cycle_name: string | null;
  cycle_year: number | null;
  reviewed_at: string | null;
  status: string | null;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
}

export type LatestPerformanceRatingMap = Record<
  string,
  LatestPerformanceRating
>;

export interface EmployeeBankStatus {
  employee_id: string;
  has_complete_bank: boolean;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

export interface HR4ClaimType {
  id: number;
  name: string;
  description: string | null;
  max_amount: number | null;
  requires_receipt: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface HR4Claim {
  id: string;
  employee_id: string;
  claim_type_id: number;
  amount: number;
  description: string | null;
  receipt_url: string | null;
  status: "pending" | "approved" | "rejected" | "reimbursed" | "cancelled";
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  payroll_run_id: number | null;
  reimbursed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HR4ClaimFormatted extends HR4Claim {
  employee_name: string | null;
  employee_id_number: string | null;
  claim_type_name: string | null;
  reviewed_by_name: string | null;
}

export interface HR4CompenSalaryGrade {
  id: number;
  grade_code: string;
  grade_name: string;
  grade_level: number;
  min_salary: number;
  mid_salary: number;
  max_salary: number;
  step_increment: number | null;
  market_reference: string | null;
  description: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  last_modified_by_email: string | null;
}

export interface HR4CompenPayStep {
  id: number;
  grade_id: number;
  step_number: number;
  step_amount: number;
  effective_date: string;
  expiry_date: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}
