import { LaborBudgetResponse, LaborBudgetRow } from "./types";

export async function fetchLaborBudget(fiscalYear: number): Promise<LaborBudgetResponse> {
  const res = await fetch(`/payroll-benefits-dashboard/api/compensation/labor-budget?fiscal_year=${fiscalYear}`);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `Failed to load labor budget (status ${res.status}).`);
  }

  const response = await res.json();

  const rows: LaborBudgetRow[] = (response.rows || []).map((row: any) => {
    const planned = Number(row.planned_amount) || 0;
    const actual = Number(row.actual_amount) || 0;
    const variance = Number(row.variance) || actual - planned;

    const remaining = planned - actual;
    const overspend = Math.max(actual - planned, 0);
    const usagePct = planned > 0 ? (actual / planned) * 100 : 0;

    return {
      month: Number(row.month),
      planned_amount: planned,
      actual_amount: actual,
      variance,
      variance_pct: Number(row.variance_pct) || 0,
      is_over_budget: Boolean(row.is_over_budget ?? (planned > 0 && actual > planned)),
      status: row.status ?? null,
      plan_id: row.plan_id ?? null,
      notes: row.notes ?? null,
      created_by_name: row.created_by_name ?? null,
      last_modified_by_name: row.last_modified_by_name ?? null,
      remaining,
      overspend,
      usage_pct: usagePct,
    };
  });

  return {
    fiscal_year: Number(response.fiscal_year) || fiscalYear,
    rows,
    totals: {
      total_planned: Number(response.totals?.total_planned) || 0,
      total_actual: Number(response.totals?.total_actual) || 0,
      variance: Number(response.totals?.variance) || 0,
      variance_pct: Number(response.totals?.variance_pct) || 0,
      months_over: Number(response.totals?.months_over) || 0,
      months_planned: Number(response.totals?.months_planned) || 0,
    },
  };
}

export async function patchLaborBudget(
  planId: string,
  body: { action: "approve" } | { action: "reject"; reason: string }
) {
  const res = await fetch(`/payroll-benefits-dashboard/api/compensation/labor-budget/${planId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error || errBody?.message || `Request failed (status ${res.status}).`);
  }

  return res.json().catch(() => ({}));
}