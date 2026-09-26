import React from "react";
import { Loader2, UserCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal";
import { Alert } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert";
import { Button } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button";

export function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export const formatCurrency = (amount: number | null | undefined) =>
  `₱${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  })}`;

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

export const calculateTenure = (dateHired: string | null | undefined) => {
  if (!dateHired) return "—";
  try {
    const hired = new Date(dateHired);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - hired.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = Math.floor((diffDays % 365) % 30);

    const parts = [];
    if (years > 0) {
      parts.push(`${years} yr${years > 1 ? "s" : ""}`);
    }
    if (months > 0) {
      parts.push(`${months} mo${months > 1 ? "s" : ""}`);
    }
    if (days > 0 && years === 0) {
      parts.push(`${days} day${days > 1 ? "s" : ""}`);
    }

    return parts.length > 0 ? parts.join(", ") : "Less than a month";
  } catch {
    return "—";
  }
};

export type StatTint = "blue" | "amber" | "emerald" | "purple" | "red" | "gray";

const TINT_CLASSES: Record<StatTint, string> = {
  blue: "bg-accent/10 text-accent",
  amber: "bg-pagibig-soft text-pagibig",
  emerald: "bg-philhealth-soft text-philhealth",
  purple: "bg-sss/10 text-sss",
  red: "bg-ink/5 text-muted",
  gray: "bg-ink/5 text-muted",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
  label: string;
  value: string;
  tint: StatTint;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3.5 dark:border-line/30 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted font-rethink">
          {label}
        </p>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${TINT_CLASSES[tint]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1 text-lg font-mono font-semibold text-ink truncate">
        {value}
      </p>
    </div>
  );
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: any[];
  loading: boolean;
}

export function HistoryModal({
  isOpen,
  onClose,
  title,
  entries,
  loading,
}: HistoryModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="max-w-lg"
      variant="info"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted font-rethink">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
          Loading history…
        </div>
      ) : entries.length === 0 ? (
        <Alert variant="info" message="No edits recorded yet." />
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <UserCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  <p className="text-xs font-semibold text-ink font-rethink truncate">
                    {entry.admin_name || "Unknown Admin"}
                  </p>
                </div>
                <p className="text-[10px] text-muted font-rethink shrink-0">
                  {formatDateTime(entry.created_at)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-accent font-rethink">
                {entry.action || "Updated"}
              </p>
              {entry.previous_daily_rate !== entry.new_daily_rate && (
                <p className="mt-1 text-[11px] text-ink font-rethink">
                  Rate:{" "}
                  {entry.previous_daily_rate != null
                    ? formatCurrency(entry.previous_daily_rate)
                    : "—"}{" "}
                  →{" "}
                  {entry.new_daily_rate != null
                    ? formatCurrency(entry.new_daily_rate)
                    : "position default"}
                </p>
              )}
              {entry.reason && (
                <p className="mt-1.5 text-[11px] text-ink bg-paper border border-line rounded-md px-2 py-1 font-rethink">
                  {entry.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isProcessing?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  isProcessing = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="max-w-sm"
      variant="warning"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pagibig-soft text-pagibig">
            <AlertCircle className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm text-ink font-rethink pt-1.5">{message}</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto font-rethink"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="w-full sm:w-auto font-rethink"
          >
            {isProcessing ? (
              <>
                <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export const findEmployeeById = (employees: any[], employeeId: string) =>
  employees.find((e) => e.employee_id === employeeId);

export const employeeHasBank = (employees: any[], employeeId: string) => {
  const emp = findEmployeeById(employees, employeeId);
  if (!emp) return false;
  return (
    emp.has_complete_bank === true ||
    (!!emp.bank_account_no && !!emp.bank_name)
  );
};