import type { PayrollContext } from "../shared/types";
import { formatCurrency, formatDate } from "../shared/utils";

export function buildChatContext(ctx?: PayrollContext): string {
  if (!ctx) return "";

  const parts: string[] = [];

  if (ctx.employee) {
    parts.push(
      `Employee: ${ctx.employee.name} (${ctx.employee.idNumber}) — ${ctx.employee.jobTitle}, ${ctx.employee.department}`
    );
  }

  if (ctx.payslip) {
    const p = ctx.payslip;
    parts.push(
      `Current payslip (${formatDate(p.periodStart)} – ${formatDate(
        p.periodEnd
      )}):\n` +
        `  Basic: ${formatCurrency(p.basicPay)}\n` +
        `  Gross: ${formatCurrency(p.grossPay)}\n` +
        `  Net: ${formatCurrency(p.netPay)}\n` +
        `  Deductions: SSS ${formatCurrency(p.deductions.sss)}, ` +
        `PhilHealth ${formatCurrency(p.deductions.philHealth)}, ` +
        `Pag-IBIG ${formatCurrency(p.deductions.pagIbig)}, ` +
        `Tax ${formatCurrency(p.deductions.withholdingTax)}`
    );
  }

  if (ctx.runs && ctx.runs.length > 0) {
    parts.push(
      `Recent payroll runs:\n` +
        ctx.runs
          .slice(0, 5)
          .map(
            (r) =>
              `  • ${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}: ${
                r.status
              }, ${formatCurrency(r.totalNetPay)}`
          )
          .join("\n")
    );
  }

  return parts.join("\n\n");
}
