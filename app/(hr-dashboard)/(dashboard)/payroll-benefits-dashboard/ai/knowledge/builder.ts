import {
  fetchPayrollRules,
  fetchSystemSummary,
  fetchEmployeeProfile,
  describeSSSBrackets,
  describePhilHealthRates,
  describePagIbigTiers,
  describeSystemSummary,
  describeEmployeeContext,
} from "../context";
import { formatPayrollContext } from "../shared/utils";
import type { PayrollContext } from "../shared/types";

interface BuildPromptOptions {
  staticGuidelines: string;
  runtimeContext?: PayrollContext;
  employeeId?: string;
  includeRules?: boolean;
  includeSummary?: boolean;
}

export async function buildSystemPrompt(
  opts: BuildPromptOptions
): Promise<string> {
  const {
    staticGuidelines,
    runtimeContext,
    employeeId,
    includeRules = true,
    includeSummary = true,
  } = opts;

  const sections: string[] = [staticGuidelines];
  const fetches: Promise<void>[] = [];

  if (includeRules) {
    fetches.push(
      fetchPayrollRules()
        .then((rules) => {
          sections.push(
            "## Current Government Contribution Rules (from database)"
          );
          sections.push(describeSSSBrackets(rules.sss_brackets));
          sections.push("");
          sections.push(describePhilHealthRates(rules.philhealth_rates));
          sections.push("");
          sections.push(describePagIbigTiers(rules.pagibig_tiers));
        })
        .catch((err) => {
          console.warn("[ai/builder] payroll rules fetch failed", err);
          sections.push("## Current Rules\n⚠️ Could not load live rules.");
        })
    );
  }

  if (includeSummary) {
    fetches.push(
      fetchSystemSummary()
        .then((summary) => {
          sections.push("");
          sections.push("## Live System Stats");
          sections.push(describeSystemSummary(summary));
        })
        .catch((err) => {
          console.warn("[ai/builder] summary fetch failed", err);
        })
    );
  }

  if (employeeId) {
    fetches.push(
      fetchEmployeeProfile(employeeId)
        .then((profile) => {
          if (!profile) return;
          sections.push("");
          sections.push("## Current Employee Context");
          sections.push(describeEmployeeContext(profile));
        })
        .catch((err) => {
          console.warn("[ai/builder] employee fetch failed", err);
        })
    );
  }

  await Promise.all(fetches);

  if (runtimeContext) {
    const ctxText = formatPayrollContext(runtimeContext);
    if (ctxText) {
      sections.push("");
      sections.push("## Runtime Context");
      sections.push(ctxText);
    }
  }

  sections.push("");
  sections.push("## Critical Instructions");
  sections.push(
    '- When answering about deductions or contribution rates, ALWAYS use values under "Current Government Contribution Rules".\n' +
      "- These come from the company's database — do NOT use training data values.\n" +
      "- Never expose full bank account numbers."
  );

  return sections.join("\n\n");
}
