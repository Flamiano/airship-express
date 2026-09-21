"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import type { EmployeeOption, EmployeePointsListItem, SetPointsInput } from "@/performance-development-dashboard/types";

type Props = {
  points: EmployeePointsListItem | null;
  employees: EmployeeOption[];
  submitting: boolean;
  onSubmit: (input: SetPointsInput) => Promise<void>;
  onClose: () => void;
};

export function PointsModal({ points, employees, submitting, onSubmit, onClose }: Props) {
  const [employeeId, setEmployeeId] = useState(points?.employee_id ?? "");
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [value, setValue] = useState(points ? String(points.total_points) : "0");
  const [formError, setFormError] = useState<string | null>(null);

  const isExisting = points !== null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!employeeId) {
      setFormError("Select the employee.");
      return;
    }

    const numericValue = Number(value.trim());
    if (!Number.isInteger(numericValue)) {
      setFormError("Points must be a whole number.");
      return;
    }
    if (mode === "set" && numericValue < 0) {
      setFormError("Total balance cannot be negative.");
      return;
    }
    if (mode === "delta" && numericValue === 0) {
      setFormError("Adjustment amount cannot be zero.");
      return;
    }

    const input: SetPointsInput = {
      employee_id: employeeId,
      ...(mode === "set"
        ? { total_points: numericValue }
        : { delta: numericValue }),
    };

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="points-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Recognition &amp; Rewards
            </p>
            <h2
              id="points-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {isExisting
                ? `Set or adjust points for ${points.employeeName}`
                : "Add points balance"}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="points-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="points-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting || isExisting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Select an employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` · ${employee.department}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              One balance row per employee; first entry creates it.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink">
              How to update
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("set")}
                disabled={submitting}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                  mode === "set"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-muted hover:text-ink dark:border-paper/15"
                }`}
              >
                Set total
              </button>
              <button
                type="button"
                onClick={() => setMode("delta")}
                disabled={submitting}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                  mode === "delta"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-muted hover:text-ink dark:border-paper/15"
                }`}
              >
                Adjust by amount
              </button>
            </div>
            {isExisting && (
              <p className="mt-1 text-[11px] text-muted">
                Current balance: {points.total_points} points.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="points-value"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              {mode === "set" ? "New total balance" : "Adjustment amount (use − for deductions)"}
            </label>
            <input
              id="points-value"
              type="number"
              inputMode="numeric"
              min={mode === "set" ? 0 : undefined}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
            />
            <p className="mt-1 text-[11px] text-muted">
              The resulting balance cannot go below 0. Balance changes are
              manual — recognitions and redemptions never adjust it
              automatically.
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving..." : isExisting ? "Save balance" : "Add balance"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}