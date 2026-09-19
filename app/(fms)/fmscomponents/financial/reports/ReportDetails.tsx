import React from "react";
import { Modal } from "@/app/(fms)/fmscomponents/ui/Modal";
import { StatusBadge } from "@/app/(fms)/fmscomponents/ui/StatusBadge";
import { FinancialReportRecord, ReportTypeEnum } from "./types";

interface ReportDetailsProps {
  report: FinancialReportRecord | null;
  isOpen: boolean;
  onClose: () => void;
  formatDate: (dateStr?: string | null) => string;
  formatReportTypeLabel: (type: ReportTypeEnum) => string;
  getStatus: (item: FinancialReportRecord) => string;
  formatPeso: (val: number) => string;
}

export function ReportDetails({
  report,
  isOpen,
  onClose,
  formatDate,
  formatReportTypeLabel,
  getStatus,
  formatPeso,
}: ReportDetailsProps) {
  if (!report) return null;

  const statusVal = getStatus(report);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${formatReportTypeLabel(report.report_type)} #${report.id}`}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-border/20 transition"
        >
          Close
        </button>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-foreground/60">Report ENUM Value:</span>
          <span className="font-mono font-bold text-[#e5167e]">{report.report_type}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-foreground/60">Period Range:</span>
          <span className="font-bold text-foreground">
            {formatDate(report.period_start)} – {formatDate(report.period_end)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border items-center">
          <span className="text-foreground/60">Audit Status:</span>
          <StatusBadge status={statusVal || "N/A"} />
        </div>

        {report.summary_data && Object.keys(report.summary_data).length > 0 && (
          <div className="p-4 bg-background rounded-xl space-y-2 mt-4 border border-border">
            <div className="text-[11px] font-extrabold uppercase text-foreground/40 tracking-wider mb-2">
              Key Snapshot Figures (JSONB)
            </div>
            {Object.entries(report.summary_data).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs font-semibold">
                <span className="capitalize text-foreground/60">
                  {key.replace(/_/g, " ")}:
                </span>
                <span className="font-bold text-foreground">
                  {typeof value === "number" ? formatPeso(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}