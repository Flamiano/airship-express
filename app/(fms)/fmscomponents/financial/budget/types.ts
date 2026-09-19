// components/financial/budget/types.ts

export interface BudgetRecord {
  id: string;
  period_name?: string | null;
  allocated_amount?: number | null;
  spent_amount?: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
}

export interface BudgetFormData {
  period_name: string;
  allocated_amount: string;
  start_date: string;
  end_date: string;
}

export const EMPTY_BUDGET_FORM: BudgetFormData = {
  period_name: "",
  allocated_amount: "",
  start_date: "",
  end_date: "",
};

// Shared between BudgetForm's <form id=...> and the submit button living in
// Modal's footer (outside the form element), so the footer button can trigger
// this form's onSubmit via the standard HTML `form="<id>"` attribute.
export const BUDGET_FORM_ID = "budget-plan-form";