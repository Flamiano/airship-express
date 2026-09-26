"use server";

import { chat } from "../providers";

export type AiryTask =
  | "chat"
  | "briefing"
  | "preflight"
  | "audit"
  | "summary"
  | "rejection"
  | "recovery"
  | "payslip_explainer"
  | "distribute_check"
  | "budget_guard"
  | "anomaly_deep";

const SYSTEM = `You are Airy, the Airship Express Payroll co-pilot inside the HR Payroll dashboard.

You automate payroll work. Never invent numbers.

Computation reference:
- daily_rate = custom_daily_rate if set, else hr4_job_position_settings.daily_rate
- hourly_rate = daily_rate / hours_per_day
- basic_pay = regular_hours * hourly_rate + overtime_hours * hourly_rate * overtime_rate
- night_diff_pay = night_diff_hours * hourly_rate * (night_diff_rate - 1)
- holiday_pay = regular_holiday_hours * hourly_rate * (multiplier - 1) + special * hourly_rate * 0.3
- allowances/bonus/incentive prorated from hr4_compen_employee_benefits and hr4_employee_incentives
- gross_pay = basic_pay + night_diff + holiday + allowances + bonus + incentive
- sss/philhealth/pagibig from bracket tables, prorated by days_worked/30 / periods_per_month
- net_pay = gross_pay - total_deductions

Rules:
- Currency is Philippine Peso.
- Be concise. Bullets for multi-step.
- Name exact buttons when suggesting actions.
- Preflight/distribute tasks end with "VERDICT: GO" or "VERDICT: BLOCKED".`;

async function ask(
  prompt: string,
  context: any,
  maxTokens = 500
): Promise<string> {
  try {
    const res = await chat(
      {
        messages: [
          { role: "system", content: SYSTEM + "\n\n" + prompt },
          { role: "user", content: JSON.stringify(context, null, 2) },
        ],
        temperature: 0.3,
        maxTokens,
      },
      "groq"
    );
    return res.content || "No response.";
  } catch (err: any) {
    return `Airy is unavailable right now: ${err?.message || "unknown error"}`;
  }
}

export async function airyChat(
  message: string,
  context?: Record<string, any>
): Promise<string> {
  try {
    const res = await chat(
      {
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              message +
              (context
                ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
                : ""),
          },
        ],
        temperature: 0.3,
        maxTokens: 900,
      },
      "groq"
    );
    return res.content || "No response.";
  } catch (err: any) {
    return `Airy is unavailable right now: ${err?.message || "unknown error"}`;
  }
}

export async function airyBriefing(snapshot: any) {
  return ask(
    "Task: Write a 3-bullet morning briefing. Focus on what needs attention TODAY. Each bullet under 20 words.",
    snapshot,
    300
  );
}

export async function airyPreflight(ctx: any) {
  return ask(
    "Task: Preflight check. List every blocker. Then VERDICT: GO or VERDICT: BLOCKED. Under 120 words.",
    ctx,
    400
  );
}

export async function airyAudit(ctx: any) {
  return ask(
    "Task: Post-process audit. Group anomalies by type. Rank by severity. End with one-line recommendation. Under 120 words.",
    ctx,
    500
  );
}

export async function airyRunSummary(ctx: any) {
  return ask(
    "Task: 3-sentence plain-English summary. Include totals, headcount, and one thing worth noting.",
    ctx,
    300
  );
}

export async function airyDraftRejection(ctx: any) {
  return ask(
    "Task: Draft one-paragraph rejection reason for Financial. Cite the exact figure. Under 60 words.",
    ctx,
    200
  );
}

export async function airyRecoveryPlan(ctx: any) {
  return ask(
    "Task: Financial rejected this run. List exact fix steps in numbered form. Under 120 words.",
    ctx,
    400
  );
}

export async function airyPayslipExplainer(ctx: any) {
  return ask(
    "Task: Explain where each peso on this payslip came from in plain English. Under 140 words.",
    ctx,
    400
  );
}

export async function airyDistributeCheck(ctx: any) {
  return ask(
    "Task: Pre-distribution sanity check. List issues. End VERDICT: SAFE or VERDICT: REVIEW. Under 100 words.",
    ctx,
    300
  );
}

export async function airyBudgetGuard(ctx: any) {
  return ask(
    "Task: Budget guard. State remaining before and after this run. Flag if over plan. Under 60 words.",
    ctx,
    200
  );
}

export async function airyAnomalyDeep(ctx: any) {
  return ask(
    "Task: Deep anomaly analysis. Look for patterns. Give 3 hypotheses. Under 200 words.",
    ctx,
    600
  );
}
