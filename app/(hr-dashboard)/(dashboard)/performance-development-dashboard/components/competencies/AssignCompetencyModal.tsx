"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  Competency,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  PositionOption,
} from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  positions: PositionOption[];
  competencies: Competency[];
  requirements: PositionCompetencyRequirement[];
  defaultPositionId: string | null;
  submitting: boolean;
  onSubmit: (input: PositionCompetencyRequirementInput) => Promise<void>;
  onClose: () => void;
};

export function AssignCompetencyModal({
  positions,
  competencies,
  requirements,
  defaultPositionId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [positionId, setPositionId] = useState(
    defaultPositionId ?? positions[0]?.id ?? ""
  );
  const [competencyId, setCompetencyId] = useState("");
  const [requiredLevel, setRequiredLevel] = useState("3");
  const [formError, setFormError] = useState<string | null>(null);

  const assignedCompetencyIds = useMemo(
    () =>
      new Set(
        requirements
          .filter((requirement) => requirement.position_id === positionId)
          .map((requirement) => requirement.competency_id)
      ),
    [requirements, positionId]
  );

  const availableCompetencies = useMemo(
    () =>
      competencies.filter(
        (competency) => !assignedCompetencyIds.has(competency.id)
      ),
    [competencies, assignedCompetencyIds]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!positionId) {
      setFormError("Select a position.");
      return;
    }
    if (!competencyId) {
      setFormError("Select a competency to assign.");
      return;
    }

    const level = Number(requiredLevel);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      setFormError("Required level must be an integer between 1 and 5.");
      return;
    }

    try {
      await onSubmit({
        position_id: positionId,
        competency_id: competencyId,
        required_level: level,
      });
      setCompetencyId("");
      setRequiredLevel("3");
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to assign competency to position."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="assign-competency-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="assign-competency-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Assign competency to position
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
              htmlFor="requirement-position"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Position
            </label>
            <select
              id="requirement-position"
              value={positionId}
              onChange={(e) => {
                const nextPositionId = e.target.value;
                setPositionId(nextPositionId);
                if (
                  competencyId &&
                  requirements.some(
                    (requirement) =>
                      requirement.position_id === nextPositionId &&
                      requirement.competency_id === competencyId
                  )
                ) {
                  setCompetencyId("");
                }
              }}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              {positions.length === 0 && <option value="">No positions</option>}
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                  {position.department ? ` · ${position.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="requirement-competency"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Competency
            </label>
            <select
              id="requirement-competency"
              value={competencyId}
              onChange={(e) => setCompetencyId(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            >
              <option value="">Select competency</option>
              {availableCompetencies.map((competency) => (
                <option key={competency.id} value={competency.id}>
                  {competency.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Competencies already assigned to this position are hidden.
            </p>
          </div>

          <div>
            <label
              htmlFor="requirement-level"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Required level
            </label>
            <input
              id="requirement-level"
              type="number"
              min={1}
              max={5}
              step={1}
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-[11px] text-muted">
              The level (1-5) this position should expect.
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
              {submitting ? "Assigning..." : "Assign competency"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}