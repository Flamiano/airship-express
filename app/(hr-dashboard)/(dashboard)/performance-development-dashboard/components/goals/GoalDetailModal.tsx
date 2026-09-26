"use client";

import { useEffect, useRef, useState } from "react";
import { Edit3, ExternalLink, FileText, ImagePlus, X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  CreateGoalEvidenceInput,
  EmployeeOption,
  GoalEvidenceAttachmentInput,
  GoalUpdateInput,
  GoalWeightContext,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalEvidenceItem,
} from "@/performance-development-dashboard/types";
import {
  GOAL_APPROVAL_STATUS_LABELS,
  GOAL_APPROVAL_STATUS_TONES,
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import { GoalForm } from "@/performance-development-dashboard/components/goals/GoalForm";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceProgress,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
  PerformanceTextInput,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import {
  formatDate,
  formatDateOnly,
} from "@/performance-development-dashboard/lib/format/date";
import {
  achievementPercent,
  formatMeasuredPair,
} from "@/performance-development-dashboard/lib/format/measurement";
import { MAX_GOAL_PROGRESS_NOTE_LENGTH } from "@/performance-development-dashboard/lib/constants";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  MAX_EVIDENCE_NOTE_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import { useGoalApi } from "@/performance-development-dashboard/hooks/useGoalApi";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type Props = {
  goal: PerformanceGoal;
  isHrAdmin: boolean;
  isManager?: boolean;
  assignedToName: string;
  /**
   * Employee-layer assigner name (from `assigned_by` -> hr1_employees), e.g.
   * "Ana Garcia". Fallback when no account-level audit attribution exists.
   */
  assignedByEmployeeName: string;
  /**
   * Account-identity assigner name (from the `goal.created` audit actor),
   * e.g. the HR Admin account "cap cap". Present on every scoped response;
   * `null`/missing falls back to the employee-layer name.
   */
  assignedByAccountName?: string | null;
  cycleName?: string;
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  busy?: { id: string; action: string } | null;
  onClose: () => void;
  onProgress: (
    id: string,
    input:
      | { progress_percent: number; note?: string | null }
      | { actual_value: number; note?: string | null }
  ) => Promise<void>;
  onSubmit: (id: string) => Promise<void>;
  onMarkCompleted: (id: string) => Promise<void>;
  onUpdate: (id: string, input: GoalUpdateInput) => Promise<void>;
  /**
   * DISPLAY-ONLY loader for the edit form's live weight-allocation summary.
   * Same loader the create form uses; never writes, never validates. Null
   * when the allocation cannot be evaluated (no cycle or load failure).
   */
  onLoadWeightContext?: (input: {
    employeeId: string;
    cycleId: string | null;
  }) => Promise<GoalWeightContext | null>;
  /**
   * Authenticated employee UUID for proposal ownership checks. When it
   * matches the goal owner, owner-only proposal actions (edit draft,
   * submit) are offered; review actions are never offered to the owner.
   */
  actorEmployeeId?: string | null;
  /** Opens the proposal edit form for the owner's draft/returned proposal. */
  onEditProposal?: () => void;
  /** Submits the owner's draft/returned proposal for manager review. */
  onSubmitProposal?: (id: string) => Promise<void>;
  /** Opens the manager/HR review dialog for a pending proposal. */
  onReviewProposal?: (action: "approve" | "return" | "reject") => void;
  /**
   * Files goal evidence (owner-only, approved goals). The evidence API is the
   * authorization boundary; the modal only exposes the action when the
   * authenticated employee owns the goal. Uploads go through the existing
   * private-storage + signed-URL architecture — never a public URL.
   */
  onUploadEvidence?: (
    id: string,
    input: CreateGoalEvidenceInput
  ) => Promise<PerformanceGoalEvidenceItem>;
};

/**
 * One read-only evidence history row: date · progress snapshot, note,
 * and the attachment (image thumbnail opening the viewer, or filename with
 * a View Evidence action for PDFs/files). Mirrors the check-in conversation
 * evidence presentation; the signed `fileUrl` is the only file reference.
 */
function EvidenceHistoryRow({
  item,
  onViewImage,
}: {
  item: PerformanceGoalEvidenceItem;
  onViewImage: (url: string, name: string) => void;
}) {
  const isImage = (item.attachment_mime ?? "").startsWith("image/");
  const fileName = item.attachment_name ?? "Attachment";

  return (
    <div className="rounded-xl border border-line px-4 py-3 dark:border-paper/10">
      <p className="text-[12px] font-medium text-muted">
        {formatDate(item.created_at)} ·{" "}
        <span className="font-semibold tabular-nums text-ink">
          {item.progress_percent}%
        </span>
      </p>
      {item.note && (
        <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
          {item.note}
        </p>
      )}
      {item.attachment_name &&
        (isImage && item.fileUrl ? (
          <>
            <button
              type="button"
              onClick={() =>
                item.fileUrl && onViewImage(item.fileUrl, fileName)
              }
              className="mt-2 block overflow-hidden rounded-xl border border-line transition-colors hover:border-accent/40 dark:border-paper/15"
              aria-label={`Open ${fileName} preview`}
            >
              {/* Remote signed URL: next/image cannot optimize short-lived
                  Storage URLs (no remotePatterns configured). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.fileUrl}
                alt={fileName}
                className="max-h-48 w-auto object-cover"
              />
            </button>
            <p className="mt-1.5 text-[12px] text-muted">{fileName}</p>
          </>
        ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 dark:border-paper/15">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted dark:border-paper/15">
                <FileText size={16} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {fileName}
              </span>
              {item.fileUrl && (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
                >
                  <ExternalLink size={13} strokeWidth={1.75} />
                  View Evidence
                </a>
              )}
            </div>
        ))}
    </div>
  );
}

export function GoalDetailModal({
  goal,
  isHrAdmin,
  isManager = false,
  assignedToName,
  assignedByEmployeeName,
  assignedByAccountName,
  cycleName,
  employees,
  cycles,
  busy,
  onClose,
  onProgress,
  onSubmit,
  onMarkCompleted,
  onUpdate,
  onLoadWeightContext,
  actorEmployeeId = null,
  onEditProposal,
  onSubmitProposal,
  onReviewProposal,
  onUploadEvidence,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [progressInput, setProgressInput] = useState(goal.progress_percent ?? 0);
  const [actualInput, setActualInput] = useState(
    goal.actual_value != null ? String(goal.actual_value) : ""
  );
  const [progressNote, setProgressNote] = useState("");
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Read-only evidence history, loaded lazily per goal. The evidence
  // endpoint is the authorization boundary; no client-side access logic.
  const { listEvidence } = useGoalApi();
  const [evidence, setEvidence] = useState<PerformanceGoalEvidenceItem[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceGoalId, setEvidenceGoalId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(
    null
  );

  useEffect(() => {
    if (evidenceGoalId === goal.id) return;
    let cancelled = false;
    listEvidence(goal.id)
      .then((rows) => {
        if (cancelled) return;
        setEvidence(rows);
        setEvidenceError(null);
        setEvidenceGoalId(goal.id);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvidenceError(
          err instanceof Error ? err.message : "Failed to load evidence."
        );
        setEvidenceGoalId(goal.id);
      });
    return () => {
      cancelled = true;
    };
  }, [goal.id, evidenceGoalId, listEvidence]);

  const evidenceLoading = evidenceGoalId !== goal.id;

  /**
   * Single-CTA rule: an authorized uploader sees exactly ONE primary
   * "Upload Evidence" action at any time. While the list is empty (including
   * loading/error reads, where the outcome is still unknown) the empty-state
   * card owns the CTA; the section header owns it only once rows exist.
   * Read-only actors never satisfy `canUploadEvidence`, so they see zero.
   */
  const isEvidenceEmpty =
    !evidenceLoading && !evidenceError && evidence.length === 0;

  // Direct evidence upload (owner-only, approved goals). Mirrors the
  // goal-linked check-in attachment pattern: same MIME allowlist, same 10 MB
  // cap, same base64 payload shape. The evidence API remains the
  // authorization boundary — this UI only exposes the existing capability.
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(
    goal.progress_percent ?? 0
  );
  const [uploadNote, setUploadNote] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Owner-only upload affordance. Backend rule (unchanged): only the goal
   * owner may file evidence, and only on approved goals. Managers/HR stay
   * read-only here even though they can view scoped evidence history.
   * (`isApproved` below resolves the same way; this inline check avoids
   * referencing declarations further down.)
   */
  const canUploadEvidence =
    (goal.approval_status ?? "approved") === "approved" &&
    actorEmployeeId !== null &&
    actorEmployeeId === goal.employee_id &&
    goal.status !== "completed" &&
    onUploadEvidence !== undefined;

  useEffect(() => {
    setProgressInput(goal.progress_percent ?? 0);
  }, [goal.id, goal.progress_percent]);

  useEffect(() => {
    setActualInput(goal.actual_value != null ? String(goal.actual_value) : "");
  }, [goal.id, goal.actual_value]);

  const isMeasurable = (goal.progress_method ?? "manual") === "measurable";

  /**
   * Client-side preview of the server calculation (actual / target * 100).
   * Display only — the server recomputes authoritatively on save.
   */
  const previewProgress =
    isMeasurable &&
    actualInput.trim() !== "" &&
    goal.target_value !== null &&
    goal.target_value > 0
      ? (() => {
          const parsed = Number(actualInput);
          if (!Number.isFinite(parsed) || parsed < 0) return null;
          return Math.min(100, Math.round((parsed / goal.target_value!) * 100 * 100) / 100);
        })()
      : null;

  const statusTone =
    PERFORMANCE_GOAL_STATUS_TONES[goal.status] ?? PERFORMANCE_GOAL_STATUS_TONES.not_started;
  const goalBusy = busy?.id === goal.id ? busy.action : null;

  // Approval (official?) vs execution (how far along?) stay separate.
  // Missing approval data (pre-migration reads) behaves as approved so
  // backfilled official goals keep their existing execution UX.
  const approval = goal.approval_status ?? "approved";
  const isApproved = approval === "approved";
  const approvalTone =
    GOAL_APPROVAL_STATUS_TONES[approval] ?? GOAL_APPROVAL_STATUS_TONES.draft;
  const isOwner =
    actorEmployeeId !== null && actorEmployeeId === goal.employee_id;
  const canEditProposal =
    isOwner &&
    (approval === "draft" || approval === "returned") &&
    onEditProposal !== undefined &&
    onSubmitProposal !== undefined;
  const canReviewProposal =
    (isHrAdmin || isManager) &&
    approval === "pending_manager_approval" &&
    !isOwner &&
    onReviewProposal !== undefined;

  const [confirmSubmitProposal, setConfirmSubmitProposal] = useState(false);
  const [proposalActionError, setProposalActionError] = useState<string | null>(
    null
  );
  const [proposalActionSaving, setProposalActionSaving] = useState(false);

  async function handleSubmitProposal() {
    if (!onSubmitProposal) return;
    setProposalActionError(null);
    setProposalActionSaving(true);
    try {
      await onSubmitProposal(goal.id);
      setConfirmSubmitProposal(false);
    } catch (err) {
      setProposalActionError(
        err instanceof Error ? err.message : "Failed to submit proposal."
      );
    } finally {
      setProposalActionSaving(false);
    }
  }

  const employeeEditable =
    isApproved &&
    !isHrAdmin && !isManager &&
    (goal.status === "not_started" || goal.status === "in_progress");

  /**
   * Completion readiness (display-only mirror of the server rule in
   * `submitGoalCompletion`): submission requires canonical progress exactly
   * 100%. The server remains authoritative — this only controls whether the
   * action is offered. Applies to manual and measurable goals alike since
   * both store capped canonical `progress_percent`.
   */
  const canSubmitCompletion = (goal.progress_percent ?? 0) >= 100;

  const managerCanEditProgress =
    isApproved &&
    isManager &&
    (goal.status === "not_started" || goal.status === "in_progress");

  const hrCanEditProgress =
    isApproved &&
    isHrAdmin &&
    (goal.status === "not_started" || goal.status === "in_progress");

  const hrCanComplete =
    isApproved && isHrAdmin && goal.status === "pending_completion";
  /**
   * Normal completion confirmation: the owner's current manager confirms a
   * 100% pending goal. Display-only mirror of the server rule in
   * `updatePerformanceGoal` (approved + pending_completion + canonical 100%,
   * direct-report-only, never own goal). The server remains authoritative.
   */
  const managerCanConfirmCompletion =
    isApproved &&
    isManager &&
    !isOwner &&
    goal.status === "pending_completion" &&
    canSubmitCompletion;
  const hrCanEdit =
    isApproved && isHrAdmin && goal.status !== "completed";
  const managerCanEdit =
    isApproved && isManager && goal.status !== "completed";

  async function handleProgressUpdate() {
    setProgressError(null);
    if (isMeasurable) {
      const parsed =
        actualInput.trim() === "" ? NaN : Number(actualInput);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setProgressError("Actual must be a number at or above 0.");
        return;
      }
    }
    setProgressSaving(true);
    try {
      const note = progressNote.trim() || null;
      if (isMeasurable) {
        await onProgress(goal.id, {
          actual_value: Number(actualInput),
          note,
        });
      } else {
        await onProgress(goal.id, { progress_percent: progressInput, note });
      }
      setProgressNote("");
    } catch (err) {
      setProgressError(
        err instanceof Error ? err.message : "Failed to update progress."
      );
    } finally {
      setProgressSaving(false);
    }
  }

  async function handleSubmit() {
    setProgressError(null);
    setProgressSaving(true);
    try {
      await onSubmit(goal.id);
    } catch (err) {
      setProgressError(
        err instanceof Error ? err.message : "Failed to submit goal."
      );
    } finally {
      setProgressSaving(false);
    }
  }

  async function handleEditSave(input: GoalUpdateInput) {
    await onUpdate(goal.id, input);
    setEditing(false);
  }

  function handleUploadFileChange(file: File | null) {
    setUploadError(null);
    if (!file) {
      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
      return;
    }
    if (
      !(ALLOWED_EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setUploadError("Unsupported file type. Use PNG, JPG, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
      setUploadError("File is too large. Maximum size is 10 MB.");
      return;
    }
    if (file.size === 0) {
      setUploadError("File is empty. Choose a different file.");
      return;
    }
    setUploadFile(file);
  }

  function readUploadAttachmentPayload(
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

  async function refreshEvidence() {
    try {
      const rows = await listEvidence(goal.id);
      setEvidence(rows);
      setEvidenceError(null);
      setEvidenceGoalId(goal.id);
    } catch (err) {
      setEvidenceError(
        err instanceof Error ? err.message : "Failed to load evidence."
      );
      setEvidenceGoalId(goal.id);
    }
  }

  async function handleEvidenceUpload() {
    if (!onUploadEvidence) return;
    setUploadError(null);
    let attachment: GoalEvidenceAttachmentInput | null = null;
    if (uploadFile) {
      try {
        attachment = await readUploadAttachmentPayload(uploadFile);
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "Could not read the selected file."
        );
        return;
      }
    }
    setUploading(true);
    try {
      const input: CreateGoalEvidenceInput = {
        progress_percent: Math.min(
          100,
          Math.max(0, Math.round(uploadProgress))
        ),
        note: uploadNote.trim() || null,
        ...(attachment ? { attachment } : {}),
      };
      await onUploadEvidence(goal.id, input);
      setShowUploadForm(false);
      setUploadNote("");
      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
      await refreshEvidence();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload evidence."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
    <Modal
      onClose={onClose}
      closeDisabled={goalBusy !== null}
      labelledBy="goal-detail-modal-title"
    >
      <PerformanceDialogPanel labelledBy="goal-detail-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <PerformanceStatusBadge tone={statusTone}>
                {PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}
              </PerformanceStatusBadge>
              {!isApproved && (
                <PerformanceStatusBadge tone={approvalTone}>
                  {GOAL_APPROVAL_STATUS_LABELS[approval]}
                </PerformanceStatusBadge>
              )}
              {goal.priority && (
                <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {PRIORITY_LABELS[goal.priority] ?? goal.priority}
                </span>
              )}
              {goal.category && (
                <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {goal.category}
                </span>
              )}
            </div>
            <h2
              id="goal-detail-modal-title"
              className="mt-3 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {goal.title}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
          <button
            type="button"
            onClick={onClose}
            disabled={goalBusy !== null}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        </div>

        {!isApproved && (
          <div className="mt-4 rounded-xl border border-line px-4 py-3 dark:border-paper/10">
            <div className="flex flex-wrap items-center gap-2">
              <PerformanceStatusBadge tone={approvalTone}>
                {GOAL_APPROVAL_STATUS_LABELS[approval]}
              </PerformanceStatusBadge>
              {goal.weight != null && (
                <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                  Weight {goal.weight}%
                </span>
              )}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              {approval === "draft" &&
                "This goal has not yet been approved for your performance plan. Submit it for manager review when ready."}
              {approval === "pending_manager_approval" &&
                (canReviewProposal
                  ? "This proposal is awaiting your review."
                  : "Submitted for review. You won't be able to edit the goal while it is pending review.")}
              {approval === "returned" &&
                "This proposal needs changes before it can be approved."}
              {approval === "rejected" &&
                "This proposal was not approved. It is kept for your records and cannot be resubmitted."}
            </p>
            {goal.review_note && (
              <div className="mt-2 rounded-lg bg-ink/[0.03] px-3 py-2 dark:bg-paper/[0.06]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Review feedback
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                  {goal.review_note}
                </p>
              </div>
            )}

            {proposalActionError && (
              <p
                aria-live="polite"
                className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600"
              >
                {proposalActionError}
              </p>
            )}

            {canEditProposal && !confirmSubmitProposal && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PerformanceButton
                  variant="ghost"
                  onClick={() => {
                    setProposalActionError(null);
                    onEditProposal?.();
                  }}
                  disabled={goalBusy !== null || proposalActionSaving}
                >
                  <Edit3 size={13} strokeWidth={1.75} />
                  Edit proposal
                </PerformanceButton>
                <PerformanceButton
                  onClick={() => {
                    setProposalActionError(null);
                    setConfirmSubmitProposal(true);
                  }}
                  disabled={goalBusy !== null || proposalActionSaving}
                >
                  Submit for approval
                </PerformanceButton>
              </div>
            )}

            {canEditProposal && confirmSubmitProposal && (
              <div className="mt-3 rounded-lg border border-line px-3 py-2.5 dark:border-paper/15">
                <p className="text-[12.5px] font-medium text-ink">
                  Submit this goal for manager review?
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  You won&apos;t be able to edit the goal while it is pending
                  review.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PerformanceButton
                    onClick={handleSubmitProposal}
                    disabled={goalBusy !== null || proposalActionSaving}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    {proposalActionSaving
                      ? "Submitting..."
                      : "Confirm submit"}
                  </PerformanceButton>
                  <PerformanceButton
                    variant="ghost"
                    onClick={() => setConfirmSubmitProposal(false)}
                    disabled={goalBusy !== null || proposalActionSaving}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    Back
                  </PerformanceButton>
                </div>
              </div>
            )}

            {canReviewProposal && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PerformanceButton
                  onClick={() => onReviewProposal?.("approve")}
                  disabled={goalBusy !== null}
                >
                  Approve
                </PerformanceButton>
                <PerformanceButton
                  variant="ghost"
                  onClick={() => onReviewProposal?.("return")}
                  disabled={goalBusy !== null}
                >
                  Return for revision
                </PerformanceButton>
                <PerformanceButton
                  variant="ghost"
                  onClick={() => onReviewProposal?.("reject")}
                  disabled={goalBusy !== null}
                >
                  Reject
                </PerformanceButton>
              </div>
            )}
          </div>
        )}

        {editing && (isHrAdmin || isManager) ? (
          <div className="mt-6">
            <GoalForm
              mode="edit"
              initialGoal={goal}
              employees={employees}
              cycles={cycles}
              submitting={goalBusy !== null}
              onSubmit={handleEditSave}
              onCancel={() => setEditing(false)}
              onLoadWeightContext={onLoadWeightContext}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <section>
              <PerformanceSectionHeader
                eyebrow="Goal setting"
                title="Expected outcome"
                description="Defined during Goal Setting for this performance cycle."
              />

              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Description
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
                  {goal.description || "Not set"}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-ink/[0.02] px-4 py-3 dark:bg-paper/[0.04] dark:border-paper/10">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Target
                </p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {goal.target || "Not set"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(isHrAdmin || isManager) && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      Assigned to
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink">
                      {assignedToName}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Assigned by
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {assignedByAccountName
                      ? assignedByAccountName
                      : assignedByEmployeeName}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Performance cycle
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {cycleName ?? "No cycle"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Weight
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink tabular-nums">
                    {goal.weight != null ? `${goal.weight}%` : "Not set"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Priority
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {PRIORITY_LABELS[goal.priority] ?? goal.priority}
                  </p>
                </div>

                {goal.start_date && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      Start date
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink">
                      {formatDateOnly(goal.start_date)}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {isApproved && (
            <section className="border-t border-line pt-5 dark:border-paper/10">
              <PerformanceSectionHeader
                eyebrow="Goal execution"
                title="Progress"
                description="How much of the expected outcome has actually been accomplished?"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Current progress
                  </p>
                  <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">
                    {goal.progress_percent}%
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Goal status
                  </p>
                  <PerformanceStatusBadge tone={statusTone} className="mt-1.5 inline-block">
                    {PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}
                  </PerformanceStatusBadge>
                  {goal.status !== "completed" &&
                    !employeeEditable &&
                    !hrCanEditProgress &&
                    !managerCanEditProgress &&
                    !hrCanComplete && (
                      <p className="mt-1 text-[11.5px] text-muted">
                        Status advances one step at a time. Use the actions above to move this goal forward.
                      </p>
                    )}
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Due date
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {goal.due_date ? formatDateOnly(goal.due_date) : "No due date"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <PerformanceProgress
                  value={goal.progress_percent}
                  label={`${goal.title} progress`}
                />
                {isMeasurable ? (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                    {formatMeasuredPair(
                      goal.actual_value,
                      goal.target_value,
                      goal.measurement_type,
                      goal.measurement_unit
                    )}{" "}
                    · calculated from recorded actuals. It is not an official
                    performance rating.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                    Progress tracks execution of this goal. It is not an official
                    performance rating.
                  </p>
                )}
              </div>

            {(employeeEditable || hrCanEditProgress || managerCanEditProgress) ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line px-4 py-4 dark:border-paper/10">
                {isMeasurable ? (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                        Target
                      </p>
                      <p className="text-[12px] font-semibold tabular-nums text-ink">
                        {formatMeasuredPair(
                          goal.actual_value,
                          goal.target_value,
                          goal.measurement_type,
                          goal.measurement_unit
                        )}
                      </p>
                    </div>
                    <PerformanceField
                      label="Update actual"
                      htmlFor="goal-actual-input"
                      hint="Enter the latest measured actual. Progress is calculated by the server."
                    >
                      <PerformanceTextInput
                        id="goal-actual-input"
                        type="number"
                        min="0"
                        step="any"
                        value={actualInput}
                        onChange={(e) => setActualInput(e.target.value)}
                        placeholder="e.g. 750000"
                        disabled={progressSaving}
                      />
                    </PerformanceField>
                    {previewProgress !== null && (
                      <p aria-live="polite" className="text-[12px] text-muted">
                        Calculated progress:{" "}
                        <span className="font-semibold tabular-nums text-ink">
                          {previewProgress}%
                        </span>
                        {(() => {
                          const achievement = achievementPercent(
                            Number(actualInput),
                            goal.target_value
                          );
                          return achievement !== null && achievement > 100 ? (
                            <span className="text-muted">
                              {" "}
                              ({achievement}% of target)
                            </span>
                          ) : null;
                        })()}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-end gap-3">
                    <label className="flex-1">
                      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                        Update current progress
                      </span>
                      <div className="mt-1.5 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={progressInput}
                          aria-label="Update current progress"
                          onChange={(e) =>
                            setProgressInput(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          disabled={progressSaving}
                          className="flex-1 text-accent accent-current"
                        />
                        <span className="w-10 text-right text-[12px] font-semibold tabular-nums text-ink">
                          {progressInput}%
                        </span>
                      </div>
                      <span className="mt-1 block text-[11.5px] text-muted">
                        0–100%. Recording progress moves the goal to In Progress.
                      </span>
                    </label>
                  </div>
                )}
                <PerformanceField
                  label="Progress update note"
                  htmlFor="goal-progress-note"
                  optional
                >
                  <PerformanceTextarea
                    id="goal-progress-note"
                    value={progressNote}
                    onChange={(e) => setProgressNote(e.target.value)}
                    maxLength={MAX_GOAL_PROGRESS_NOTE_LENGTH}
                    rows={2}
                    placeholder="Optional context for this update…"
                    disabled={progressSaving}
                  />
                </PerformanceField>
                <div className="flex flex-wrap items-center gap-2">
                  <PerformanceButton
                    variant="ghost"
                    onClick={handleProgressUpdate}
                    disabled={progressSaving}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    {progressSaving
                      ? "Saving..."
                      : isMeasurable
                        ? "Update actual"
                        : "Save progress"}
                  </PerformanceButton>
                  {employeeEditable && goal.status !== "pending_completion" && goal.status !== "completed" && (
                    canSubmitCompletion ? (
                      <PerformanceButton
                        onClick={handleSubmit}
                        disabled={progressSaving}
                        className="px-3 py-1.5 text-[12.5px]"
                      >
                        Submit completion
                      </PerformanceButton>
                    ) : (
                      <PerformanceButton
                        disabled
                        title="Progress must reach 100% before this goal can be submitted for completion."
                        className="px-3 py-1.5 text-[12.5px]"
                      >
                        Submit completion
                      </PerformanceButton>
                    )
                  )}
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted">
                  {canSubmitCompletion
                    ? "Submitting marks the goal as pending manager confirmation. Status changes follow the existing goal workflow."
                    : "Progress must reach 100% before this goal can be submitted for completion."}
                </p>
              </div>
            ) : null}

            {goal.status === "pending_completion" && !isHrAdmin && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-amber-600">
                  Submitted for review — pending manager confirmation.
                </p>
              </div>
            )}

            {goal.status === "completed" && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-emerald-600">
                  This goal has been completed.
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  Completed goals are read-only — progress, evidence, and
                  details are preserved for history.
                </p>
              </div>
            )}
            </section>
            )}
          </div>
        )}

        {!editing && isApproved && (
          <section className="mt-6 border-t border-line pt-5 dark:border-paper/10">
            <PerformanceSectionHeader
              eyebrow="Evidence"
              title="Evidence & Check-ins"
              description="Supporting files and documents for this goal."
              action={
                canUploadEvidence && !showUploadForm && !isEvidenceEmpty ? (
                  <PerformanceButton
                    onClick={() => {
                      setUploadError(null);
                      setUploadProgress(goal.progress_percent ?? 0);
                      setShowUploadForm(true);
                    }}
                    disabled={goalBusy !== null}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    Upload Evidence
                  </PerformanceButton>
                ) : undefined
              }
            />
            {canUploadEvidence && showUploadForm && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line px-4 py-4 dark:border-paper/10">
                <div className="flex items-end gap-3">
                  <label className="flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      Progress snapshot
                    </span>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={uploadProgress}
                        aria-label="Evidence progress snapshot"
                        onChange={(e) =>
                          setUploadProgress(
                            Math.min(
                              100,
                              Math.max(0, Number(e.target.value))
                            )
                          )
                        }
                        disabled={uploading}
                        className="flex-1 text-accent accent-current"
                      />
                      <span className="w-12 text-right text-[12px] font-semibold tabular-nums text-ink">
                        {Math.round(uploadProgress)}%
                      </span>
                    </div>
                    <span className="mt-1 block text-[11.5px] text-muted">
                      Snapshot for this evidence only — your goal&apos;s current
                      progress stays unchanged here.
                    </span>
                  </label>
                </div>
                <PerformanceField
                  label="Note"
                  htmlFor="goal-evidence-note"
                  optional
                >
                  <PerformanceTextarea
                    id="goal-evidence-note"
                    value={uploadNote}
                    onChange={(e) => setUploadNote(e.target.value)}
                    maxLength={MAX_EVIDENCE_NOTE_LENGTH}
                    rows={2}
                    placeholder="Optional context for this evidence…"
                    disabled={uploading}
                  />
                </PerformanceField>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    File{" "}
                    <span className="font-normal normal-case tracking-normal">
                      (optional)
                    </span>
                  </p>
                  <label
                    htmlFor="goal-evidence-file"
                    className={`mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15 ${
                      uploading ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <ImagePlus size={15} strokeWidth={1.75} />
                    {uploadFile ? "Change file" : "Attach photo or PDF"}
                  </label>
                  <input
                    ref={uploadFileInputRef}
                    id="goal-evidence-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    disabled={uploading}
                    className="sr-only"
                    onChange={(e) =>
                      handleUploadFileChange(e.target.files?.[0] ?? null)
                    }
                  />
                  <p className="mt-1 text-[11.5px] text-muted">
                    PNG, JPG, WebP, or PDF · up to 10 MB.
                  </p>
                  {uploadFile && (
                    <p className="mt-1 truncate text-[12.5px] font-medium text-ink">
                      {uploadFile.name}{" "}
                      <span className="font-normal tabular-nums text-muted">
                        ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </p>
                  )}
                </div>
                {uploadError && (
                  <p
                    aria-live="polite"
                    className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600"
                  >
                    {uploadError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <PerformanceButton
                    onClick={handleEvidenceUpload}
                    disabled={uploading}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </PerformanceButton>
                  <PerformanceButton
                    variant="ghost"
                    onClick={() => {
                      setShowUploadForm(false);
                      setUploadError(null);
                      setUploadFile(null);
                      if (uploadFileInputRef.current)
                        uploadFileInputRef.current.value = "";
                    }}
                    disabled={uploading}
                    className="px-3 py-1.5 text-[12.5px]"
                  >
                    Cancel
                  </PerformanceButton>
                </div>
              </div>
            )}
            {evidenceError ? (
              <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600">
                {evidenceError}
              </p>
            ) : evidenceLoading ? (
              <p className="mt-2 text-[12.5px] text-muted">
                Loading evidence…
              </p>
            ) : evidence.length === 0 ? (
              <div className="mt-4 rounded-xl border border-line px-4 py-4 text-center dark:border-paper/10">
                <p className="text-[13px] font-medium text-ink">
                  {canUploadEvidence
                    ? "No evidence uploaded yet."
                    : "No evidence has been uploaded for this goal yet."}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
                  {canUploadEvidence
                    ? "Attach supporting files or record a progress snapshot for this goal."
                    : "Evidence uploaded by the goal owner will appear here."}
                </p>
                {canUploadEvidence && !showUploadForm && (
                  <PerformanceButton
                    onClick={() => {
                      setUploadError(null);
                      setUploadProgress(goal.progress_percent ?? 0);
                      setShowUploadForm(true);
                    }}
                    disabled={goalBusy !== null}
                    className="mt-3 px-3 py-1.5 text-[12.5px]"
                  >
                    Upload Evidence
                  </PerformanceButton>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {evidence.map((item) => (
                  <EvidenceHistoryRow
                    key={item.id}
                    item={item}
                    onViewImage={(url, name) => setViewer({ url, name })}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {progressError && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600">
            {progressError}
          </p>
        )}

        {!editing && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5 dark:border-paper/10">
            {(hrCanEdit || managerCanEdit) && (
              <PerformanceButton
                variant="ghost"
                onClick={() => {
                  setEditing(true);
                  setProgressError(null);
                }}
                disabled={goalBusy !== null}
              >
                <Edit3 size={13} strokeWidth={1.75} />
                Edit
              </PerformanceButton>
            )}
            {hrCanComplete && (
              <PerformanceButton
                onClick={() => onMarkCompleted(goal.id)}
                disabled={goalBusy !== null}
              >
                Mark complete
              </PerformanceButton>
            )}
            {managerCanConfirmCompletion && (
              <PerformanceButton
                onClick={() => onMarkCompleted(goal.id)}
                disabled={goalBusy !== null}
              >
                Confirm Completion
              </PerformanceButton>
            )}
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={goalBusy !== null}
            >
              Close
            </PerformanceButton>
          </div>
        )}
      </PerformanceDialogPanel>
    </Modal>

    {/* Evidence lightbox: sibling of the detail modal (not nested) so
        Escape/backdrop only dismiss the viewer, never the detail view. */}
    {viewer && (
      <Modal onClose={() => setViewer(null)} labelledBy="evidence-viewer-title">
        <PerformanceDialogPanel size="lg" labelledBy="evidence-viewer-title">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="evidence-viewer-title"
              className="mt-1 max-w-full truncate font-bricolage text-[18px] font-medium tracking-tight text-ink"
            >
              {viewer.name}
            </h2>
            <Tooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>
          {/* Remote signed URL: next/image cannot optimize short-lived Storage
              URLs (no remotePatterns configured), so a plain img is used. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewer.url}
            alt={viewer.name}
            className="mt-4 max-h-[70vh] w-full rounded-xl border border-line object-contain dark:border-paper/15"
          />
        </PerformanceDialogPanel>
      </Modal>
    )}
    </>
  );
}