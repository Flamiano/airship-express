import type {
  LiveSystemSummary,
  LiveEmployeeProfile,
  SafeEmployeeRow,
  SafeEmployeeCounts,
  TopRatedEmployee,
  OpenRunRow,
  RejectedRunRow,
} from "./types";
import type { SSSBracket, PhilHealthRate, PagibigTier } from "../../types";

function peso(n: number | null | undefined) {
  if (n == null) return "—";
  return `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function describeSSSBrackets(brackets: SSSBracket[]): string {
  if (!brackets.length) return "No active SSS brackets configured.";
  const rows = brackets.map(
    (b) =>
      `• Range ${peso(b.range_min)} – ${
        b.range_max ? peso(b.range_max) : "above"
      } | MSC ${peso(b.monthly_salary_credit)} | Employer ${peso(
        b.employer_share
      )} | Employee ${peso(b.employee_share)} | EC ${peso(b.ec_share)}`
  );
  return ["SSS Contribution Brackets (active):", ...rows].join("\n");
}

export function describePhilHealthRates(rates: PhilHealthRate[]): string {
  if (!rates.length) return "No active PhilHealth rates configured.";
  const rows = rates.map(
    (r) =>
      `• Base min ${peso(r.base_min_salary)} | Employer ${(
        r.employer_rate * 100
      ).toFixed(2)}% | Employee ${(r.employee_rate * 100).toFixed(
        2
      )}% | Premium cap ${peso(r.premium_cap)} | Effective ${r.effective_date}`
  );
  return ["PhilHealth Rates (active):", ...rows].join("\n");
}

export function describePagIbigTiers(tiers: PagibigTier[]): string {
  if (!tiers.length) return "No active Pag-IBIG tiers configured.";
  const rows = tiers.map(
    (t) =>
      `• ${t.tier_name} | Salary ${peso(t.salary_min)} – ${
        t.salary_max ? peso(t.salary_max) : "above"
      } | Employer ${(t.employer_rate * 100).toFixed(2)}% | Employee ${(
        t.employee_rate * 100
      ).toFixed(2)}% | Max employer ${peso(
        t.max_employer_share
      )} | Max employee ${peso(t.max_employee_share)}`
  );
  return ["Pag-IBIG Tiers (active):", ...rows].join("\n");
}

export function describeSystemSummary(s: LiveSystemSummary): string {
  return [
    `• Active employees: ${s.active_employees}`,
    `• Bank types: ${s.total_bank_types}`,
    `• Claim types: ${s.total_claim_types}`,
    `• Job positions: ${s.total_job_positions}`,
    `• Salary grades: ${s.total_salary_grades}`,
    `• Open payroll runs: ${s.open_payroll_runs}`,
  ].join("\n");
}

export function describeEmployeeContext(p: LiveEmployeeProfile): string {
  const e = p.employee;
  const lines: string[] = [];
  lines.push(
    `Employee: ${e.first_name} ${e.last_name} (${e.employee_id_number})`
  );
  lines.push(`Status: ${e.status} | Department: ${e.department}`);
  lines.push(
    `Date hired: ${e.date_hired} | Email: ${e.email} | Phone: ${e.phone}`
  );

  if (p.payroll_info) {
    const pi = p.payroll_info;
    lines.push("");
    lines.push("Compensation:");
    lines.push(`• Basic salary: ${peso(pi.basic_salary)}`);
    lines.push(`• Pay schedule: ${pi.pay_schedule}`);
    lines.push(
      `• Custom daily rate: ${
        pi.custom_daily_rate != null ? peso(pi.custom_daily_rate) : "none"
      }`
    );
    lines.push(
      `• Incentives: ${peso(pi.incentives ?? 0)}${
        pi.incentive_description ? ` (${pi.incentive_description})` : ""
      }`
    );
  } else {
    lines.push("");
    lines.push("Compensation: no payroll record on file.");
  }

  if (p.bank_account) {
    const b = p.bank_account;
    lines.push("");
    lines.push("Bank:");
    lines.push(
      `• ${b.bank_name ?? "Bank"} (${
        b.bank_type ?? "—"
      }) • account ending ${b.account_number.slice(-4)} • ${b.account_name} • ${
        b.is_active ? "active" : "inactive"
      } • ${b.verified_at ? "verified" : "unverified"}`
    );
  } else {
    lines.push("");
    lines.push("Bank: no account on file.");
  }

  return lines.join("\n");
}

export function describeEmployeeList(rows: SafeEmployeeRow[]): string {
  if (!rows.length) return "No active employees on record.";
  return rows
    .map(
      (e, i) =>
        `${i + 1}. ${e.first_name} ${e.last_name} (${e.employee_id_number}) - ${
          e.job_title || "no position"
        }${e.has_bank ? "" : " - missing bank details"}${
          e.has_birthdate ? "" : " - missing birthdate"
        }`
    )
    .join("\n");
}

export function describeSafeEmployeeCounts(counts: SafeEmployeeCounts): string {
  return [
    `Active: ${counts.active}`,
    `On leave: ${counts.on_leave}`,
    `Inactive: ${counts.inactive}`,
  ].join("\n");
}

export function describeTopRatedEmployees(rows: TopRatedEmployee[]): string {
  if (!rows.length) return "No finalized performance ratings on record.";
  return rows
    .map(
      (e, i) =>
        `${i + 1}. ${e.employee_name} (${
          e.employee_id_number
        }) - rating ${e.performance_rating.toFixed(2)}${
          e.letter_grade ? ` (${e.letter_grade})` : ""
        }`
    )
    .join("\n");
}

export function describeOpenRuns(rows: OpenRunRow[]): string {
  if (!rows.length) return "No open payroll runs.";
  return rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.period_start} to ${r.period_end} - approval ${
          r.approval_status
        }`
    )
    .join("\n");
}

export function describeRejectedRuns(rows: RejectedRunRow[]): string {
  if (!rows.length) return "No rejected payroll runs.";
  return rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.period_start} to ${r.period_end} - rejected by ${
          r.rejected_by_name || "unknown"
        }: ${r.rejection_reason || "no reason recorded"}`
    )
    .join("\n");
}
