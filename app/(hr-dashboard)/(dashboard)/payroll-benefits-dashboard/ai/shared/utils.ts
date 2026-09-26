import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PayrollContext } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface WithRetryOptions {
  retries?: number;
  delayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOptions = {}
): Promise<T> {
  const { retries = 1, delayMs = 300 } = opts;

  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function formatPayrollContext(context: PayrollContext): string {
  const lines: string[] = [];

  if (context.employee) {
    const e = context.employee;
    lines.push(
      `Employee: ${e.name} (ID: ${e.idNumber}), ${e.jobTitle} in ${e.department}`
    );
  }

  if (context.payslip) {
    const p = context.payslip;
    lines.push(
      `Payslip period: ${p.periodStart} to ${p.periodEnd}`,
      `Basic pay: ₱${p.basicPay.toLocaleString()}`,
      `Gross pay: ₱${p.grossPay.toLocaleString()}`,
      `Net pay: ₱${p.netPay.toLocaleString()}`,
      `Deductions — SSS: ₱${p.deductions.sss.toLocaleString()}, PhilHealth: ₱${p.deductions.philHealth.toLocaleString()}, Pag-IBIG: ₱${p.deductions.pagIbig.toLocaleString()}, Withholding Tax: ₱${p.deductions.withholdingTax.toLocaleString()}`
    );
  }

  if (context.runs && context.runs.length > 0) {
    lines.push("Recent payroll runs:");
    for (const run of context.runs) {
      lines.push(
        `- Run #${run.id}: ${run.periodStart} to ${run.periodEnd}, status: ${
          run.status
        }, total net pay: ₱${run.totalNetPay.toLocaleString()}`
      );
    }
  }

  return lines.join("\n");
}

export function formatCurrency(value: number | null | undefined, currency = "PHP"): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return currency === "PHP" ? "₱0.00" : "0.00";
  }
  const symbol = currency === "PHP" ? "₱" : "";
  return `${symbol}${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}