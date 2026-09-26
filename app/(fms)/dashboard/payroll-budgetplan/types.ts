export type BudgetStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "active"
  | "rejected"
  | "closed"
  | null;

export interface LaborBudgetRow {
  month: number;
  planned_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number;
  is_over_budget: boolean;
  status: BudgetStatus;
  plan_id: string | null;
  notes: string | null;
  created_by_name: string | null;
  last_modified_by_name: string | null;

  // Derived locally from the HR API values
  remaining: number;
  overspend: number;
  usage_pct: number;
}

export interface LaborBudgetTotals {
  total_planned: number;
  total_actual: number;
  variance: number;
  variance_pct: number;
  months_over: number;
  months_planned: number;
}

export interface LaborBudgetResponse {
  fiscal_year: number;
  rows: LaborBudgetRow[];
  totals: LaborBudgetTotals;
}