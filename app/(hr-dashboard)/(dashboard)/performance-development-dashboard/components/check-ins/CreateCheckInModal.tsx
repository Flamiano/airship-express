"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImagePlus, X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  EmployeeOption,
  GoalEvidenceAttachmentInput,
  PerformanceGoal,
} from "@/performance-development-dashboard/types";
import { PERFORMANCE_GOAL_STATUS_LABELS } from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTabs,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import {
  MAX_CHECK_IN_MESSAGE_LENGTH,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from "@/performance-development-dashboard/lib/constants";
import { useGoalApi } from "@/performance-development-dashboard/hooks/useGoalApi";

type Props = {
  canSelectEmployee: boolean;
  actorType: "hr_admin" | "manager" | "employee";
  employees: EmployeeOption[];
  defaultEmployeeId?: string | null;
  submitting: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
};

export function CreateCheckInModal({
  canSelectEmployee,
  actorType,
  employees,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(
    canSelectEmployee ? (defaultEmployeeId ?? "") : ""
  );
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Goal-linked evidence state (employee self-service only). The evidence API
  // is the authorization boundary; the server enforces goal ownership.
  const canLinkGoal = actorType === "employee";
  const goalApi = useGoalApi();
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(canLinkGoal);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalId, setGoalId] = useState("");
  const [progress, setProgress] = useState(0);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null
  );
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canLinkGoal) return;
    let cancelled = false;
    goalApi
      .list()
      .then((loaded) => {
        if (cancelled) return;
        // Current goals only: completed goals cannot take new evidence.
        setGoals(loaded.filter((goal) => goal.status !== "completed"));
      })
      .catch((err) => {
        if (cancelled) return;
        setGoalsError(
          err instanceof Error ? err.message : "Failed to load your goals."
        );
      })
      .finally(() => {
        if (!cancelled) setGoalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLinkGoal]);

  // Revoke the preview object URL on unmount; per-selection revocation
  // happens in handleFileChange. No state writes here.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const selectedGoal = goals.find((goal) => goal.id === goalId) ?? null;

  // Explicit type selector for employees. It mirrors the goal selection
  // (the source of truth): picking General clears the linked goal, picking
  // Goal-linked keeps the selection so the employee chooses a goal below.
  // Validation and payload shape are unchanged — an unlinked submit stays a
  // general check-in.
  const checkInType = goalId ? "linked" : "general";

  function handleGoalChange(value: string) {
    setGoalId(value);
    const goal = goals.find((candidate) => candidate.id === value) ?? null;
    // Prefill the snapshot with the goal's current authoritative progress.
    setProgress(goal?.progress_percent ?? 0);
  }

  function handleFileChange(file: File | null) {
    setAttachmentError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!file) {
      setAttachment(null);
      setAttachmentPreview(null);
      return;
    }
    if (
      !(ALLOWED_EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setAttachmentError(
        "Unsupported file type. Use PNG, JPG, WebP, or PDF."
      );
      return;
    }
    if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
      setAttachmentError("File is too large. Maximum size is 10 MB.");
      return;
    }
    if (file.size === 0) {
      setAttachmentError("File is empty. Choose a different file.");
      return;
    }
    setAttachment(file);
    // Local preview only — nothing is uploaded until submit.
    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setAttachmentPreview(objectUrl);
    } else {
      setAttachmentPreview(null);
    }
  }

  function readAttachmentPayload(
    file: File
  ): Promise<GoalEvidenceAttachmentInput> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error("Could not read the selected file."));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Could not read the selected file."));
          return;
        }
        // Strip the `data:<mime>;base64,` prefix; the server tolerates and
        // strips it as well, but the declared size must match decoded bytes.
        const base64 = result.replace(/^data:[^;]+;base64,/, "");
        resolve({
          name: file.name,
          mime: file.type,
          size: file.size,
          data: base64,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFormError("Check-in message is required.");
      return;
    }

    const input: Record<string, unknown> = { message: trimmedMessage };
    if (canSelectEmployee && employeeId) {
      input.employee_id = employeeId;
    }

    if (canLinkGoal && goalId) {
      input.goal_id = goalId;
      input.progress_percent = Math.min(
        100,
        Math.max(0, Math.round(progress))
      );
      if (attachment) {
        try {
          input.attachment = await readAttachmentPayload(attachment);
        } catch (err) {
          setFormError(
            err instanceof Error
              ? err.message
              : "Could not read the selected file."
          );
          return;
        }
      }
    }

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create check-in."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-check-in-modal-title"
    >
      <PerformanceDialogPanel size="sm" labelledBy="create-check-in-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-check-in-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New check-in
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
          {canSelectEmployee && (
            <PerformanceField label="Employee" htmlFor="check-in-employee">
              <PerformanceSelect
                id="check-in-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Select employee (defaults to your record)</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </option>
                ))}
              </PerformanceSelect>
            </PerformanceField>
          )}

          {canLinkGoal && (
            <PerformanceTabs
              tabs={[
                { key: "general", label: "General check-in" },
                { key: "linked", label: "Goal-linked" },
              ]}
              active={checkInType}
              onChange={(next) => {
                if (next === "general") setGoalId("");
              }}
              ariaLabel="Check-in type"
            />
          )}

          {canLinkGoal && (
            <PerformanceField
              label="Link to a goal"
              htmlFor="check-in-goal"
              optional
            >
              <PerformanceSelect
                id="check-in-goal"
                value={goalId}
                onChange={(e) => handleGoalChange(e.target.value)}
                disabled={submitting || goalsLoading}
              >
                <option value="">
                  {goalsLoading
                    ? "Loading your goals..."
                    : "No goal — general check-in"}
                </option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title} ·{" "}
                    {PERFORMANCE_GOAL_STATUS_LABELS[goal.status] ??
                      goal.status}{" "}
                    · {goal.progress_percent}%
                  </option>
                ))}
              </PerformanceSelect>
              {goalsError && (
                <p className="mt-1 text-[11.5px] text-red-600">{goalsError}</p>
              )}
              {!goalsLoading && !goalsError && goals.length === 0 && (
                <p className="mt-1 text-[11.5px] text-muted">
                  You have no active goals to link right now.
                </p>
              )}
            </PerformanceField>
          )}

          {canLinkGoal && selectedGoal && (
            <div className="rounded-xl border border-line px-4 py-4 dark:border-paper/10">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Progress update
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {selectedGoal.title} — currently{" "}
                <span className="font-semibold text-ink">
                  {selectedGoal.progress_percent}%
                </span>
              </p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progress}
                  onChange={(e) =>
                    setProgress(
                      Math.min(100, Math.max(0, Number(e.target.value)))
                    )
                  }
                  disabled={submitting}
                  aria-label="Progress snapshot"
                  className="flex-1 text-accent accent-current"
                />
                <span className="w-12 text-right text-[12px] font-semibold tabular-nums text-ink">
                  {progress}%
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-muted">
                Snapshot for this check-in only — your goal&apos;s current
                progress stays unchanged here.
              </p>

              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Evidence{" "}
                <span className="font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </p>
              <div className="mt-2">
                <label
                  htmlFor="check-in-evidence"
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15 ${
                    submitting ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <ImagePlus size={15} strokeWidth={1.75} />
                  {attachment ? "Change file" : "Attach photo or PDF"}
                </label>
                <input
                  id="check-in-evidence"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  disabled={submitting}
                  className="sr-only"
                  onChange={(e) =>
                    handleFileChange(e.target.files?.[0] ?? null)
                  }
                />
                <p className="mt-1 text-[11.5px] text-muted">
                  PNG, JPG, WebP, or PDF · up to 10 MB · uploaded on submit.
                </p>
              </div>

              {attachmentError && (
                <p className="mt-2 text-[12px] font-medium text-red-600">
                  {attachmentError}
                </p>
              )}

              {attachment && (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-line bg-paper px-3 py-2.5 dark:border-paper/15">
                  {attachmentPreview ? (
                    <Image
                      src={attachmentPreview}
                      alt="Evidence preview"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 shrink-0 rounded-md border border-line object-cover dark:border-paper/15"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-line text-muted dark:border-paper/15">
                      <FileText size={18} strokeWidth={1.75} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {attachment.name}
                    </p>
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-muted">
                      {(attachment.size / 1024).toFixed(1)} KB
                      {attachment.type === "application/pdf"
                        ? " · PDF"
                        : " · Image"}
                    </p>
                  </div>
                  <Tooltip label="Remove file" side="bottom">
                    <button
                      type="button"
                      onClick={() => handleFileChange(null)}
                      disabled={submitting}
                      aria-label="Remove file"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink disabled:opacity-50"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          <div>
            <PerformanceField
              label="Message"
              htmlFor="check-in-message"
              hint={
                canSelectEmployee
                  ? "The employee and given-by identities are recorded server-side."
                  : "This check-in is recorded against your own employee record."
              }
            >
              <PerformanceTextarea
                id="check-in-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_CHECK_IN_MESSAGE_LENGTH}
                rows={5}
                placeholder="Write an ongoing performance discussion or feedback note..."
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {message.length}/{MAX_CHECK_IN_MESSAGE_LENGTH}
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">{formError}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add check-in"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}