import { flagAnomalies } from "../actions/flagAnomalies";
import type { AIInsight } from "../shared/types";

export async function runPayrollAudit(payslips: any[]): Promise<AIInsight[]> {
  if (!payslips || payslips.length === 0) return [];
  return flagAnomalies(payslips);
}
