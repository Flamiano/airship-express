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
