"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  Competency,
  EmployeeCompetencyAssessmentInput,
  EmployeeCompetencyProfileItem,
  EmployeeOption,
} from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  employees: EmployeeOption[];
  competencies: Competency[];
  /**
   * The employee competency PROFILE already loaded by the page (latest
   * assessment row per employee + competency). Used to pre-fill Current Level
   * with the employee's latest stored level — no extra API call.
   */
  profile: EmployeeCompetencyProfileItem[];
  defaultEmployeeId: string;
  submitting: boolean;
  onSubmit: (input: EmployeeCompetencyAssessmentInput) => Promise<void>;
  onClose: () => void;
};

export function AssessEmployeeModal({
  employees,
  competencies,
  profile,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [competencyId, setCompetencyId] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [requiredLevel, setRequiredLevel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Latest stored `current_level` for the given employee + competency from the
   * existing profile (already resolved server-side as the latest assessment
   * row). Empty when there is no prior record — no fake default.
   */
  function latestStoredLevelFor(
    employee: string,
    competency: string
  ): string {
    if (!employee || !competency) return "";
    const latest = profile.find(
      (item) =>
        item.employee_id === employee && item.competency_id === competency
    );
    return latest ? String(latest.current_level) : "";
  }

  function parseLevel(value: string): number | null {
    if (!value) return null;
    const level = Number(value);
    return Number.isInteger(level) && level >= 1 && level <= 5 ? level : null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!employeeId) {
      setFormError("Select the employee being assessed.");
      return;
    }
    if (!competencyId) {
      setFormError("Select the competency being assessed.");
      return;
    }

    const current = parseLevel(currentLevel);
    if (current === null) {
      setFormError("Current level must be an integer between 1 and 5.");
      return;
    }

    const required = requiredLevel
      ? parseLevel(requiredLevel)
      : null;
    if (requiredLevel && required === null) {
      setFormError("Required level must be an integer between 1 and 5.");
      return;
    }

    try {
      await onSubmit({
        employee_id: employeeId,
        competency_id: competencyId,
        current_level: current,
        required_level: required,
      });
      setCompetencyId("");
      setCurrentLevel("");
      setRequiredLevel("");
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to record the competency assessment."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="assess-employee-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="assess-employee-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New competency assessment
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
              htmlFor="assessment-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="assessment-employee"
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setCurrentLevel(
                  latestStoredLevelFor(e.target.value, competencyId)
                );
              }}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              {employees.length === 0 && (
                <option value="">No employees</option>
              )}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` · ${employee.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="assessment-competency"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Competency
            </label>
            <select
              id="assessment-competency"
              value={competencyId}
              onChange={(e) => {
                setCompetencyId(e.target.value);
                setCurrentLevel(
                  latestStoredLevelFor(employeeId, e.target.value)
                );
              }}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            >
              <option value="">Select competency</option>
              {competencies.map((competency) => (
                <option key={competency.id} value={competency.id}>
                  {competency.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="assessment-current"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Current level
              </label>
              <input
                id="assessment-current"
                type="number"
                min={1}
                max={5}
                step={1}
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
              />
            </div>

            <div>
              <label
                htmlFor="assessment-required"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Required level{" "}
                <span className="text-muted">(optional)</span>
              </label>
              <input
                id="assessment-required"
                type="number"
                min={1}
                max={5}
                step={1}
                value={requiredLevel}
                onChange={(e) => setRequiredLevel(e.target.value)}
                placeholder="Use position standard"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
            </div>
          </div>

          <p className="text-[11.5px] text-muted">
            Current level is pre-filled from the employee's latest recorded
            assessment and can be adjusted for a reassessment. As an HR
            account, you will be recorded as the assessor. Assessments are
            append-only: re-assessing the same competency creates a newer state
            rather than changing the past.
          </p>

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
              {submitting ? "Recording..." : "Record assessment"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}