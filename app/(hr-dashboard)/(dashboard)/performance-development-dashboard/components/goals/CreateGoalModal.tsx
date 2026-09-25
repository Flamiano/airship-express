"use client";

import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  EmployeeOption,
  GoalCreateInput,
  GoalWeightContext,
  PerformanceCycle,
} from "@/performance-development-dashboard/types";
import { GoalForm } from "@/performance-development-dashboard/components/goals/GoalForm";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { PerformanceDialogPanel } from "@/performance-development-dashboard/components/ui/performance";

type Props = {
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  defaultCycleId?: string;
  /**
   * DISPLAY-ONLY attribution name resolved server-side from the authenticated
   * account (e.g. the HR Admin account full name). It is never submitted with
   * the goal; the server derives the real assigner from the session.
   */
  assignerDisplayName?: string;
  onLoadWeightContext?: (input: {
    employeeId: string;
    cycleId: string | null;
  }) => Promise<GoalWeightContext>;
  submitting: boolean;
  onSubmit: (input: GoalCreateInput) => Promise<void>;
  onClose: () => void;
};

export function CreateGoalModal({
  employees,
  cycles,
  defaultCycleId,
  assignerDisplayName,
  onLoadWeightContext,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-goal-modal-title"
    >
      <PerformanceDialogPanel labelledBy="create-goal-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Goal Setting
            </p>
            <h2
              id="create-goal-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New performance goal
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Define the expected outcome for an employee within a performance
              cycle. Progress and status are tracked later during Goal
              Execution.
            </p>
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

        <div className="mt-6">
          <GoalForm
            mode="create"
            employees={employees}
            cycles={cycles}
            defaultCycleId={defaultCycleId}
            assignerDisplayName={assignerDisplayName}
            onLoadWeightContext={onLoadWeightContext}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </PerformanceDialogPanel>
    </Modal>
  );
}