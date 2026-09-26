export type ReportTypeEnum = "cash_flow" | "balance_sheet" | "profit_loss";
export type ReportStatusEnum = "draft" | "audited" | "published" | "archived";

export interface FinancialReportRecord {
  id: number | string;
  report_type: ReportTypeEnum;
  period_start: string;
  period_end: string;
  status?: ReportStatusEnum;
  report_status?: ReportStatusEnum;
  summary_data?: Record<string, number> | null;
  created_at?: string;
}