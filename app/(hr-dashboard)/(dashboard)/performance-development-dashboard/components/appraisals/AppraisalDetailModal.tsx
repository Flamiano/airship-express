"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import {
  APPRAISAL_STATUS_LABELS,
  APPRAISAL_STATUS_TONES,
  DEV_PLAN_ITEM_STATUS_LABELS,
  type AppraisalScoringInputs,
  type AppraisalStatus,
  type DevPlanItemStatus,
  type DevelopmentPlanItem,
  type PerformanceAppraisal,
} from "@/performance-development-dashboard/types";
import { calculateScoring, SCORING_WEIGHT_TOLERANCE } from "@/performance-development-dashboard/lib/performance/scoring";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { Skeleton } from "@/performance-development-dashboard/components/ui/Skeleton";
import { AttendanceContextSection } from "@/performance-development-dashboard/components/appraisals/AttendanceContextSection";
import { LeaveContextSection } from "@/performance-development-dashboard/components/appraisals/LeaveContextSection";
import { formatDateTime } from "@/performance-development-dashboard/lib/format/date";
import { formatMeasuredPair } from "@/performance-development-dashboard/lib/format/measurement";
import {
  MAX_APPRAISAL_TEXT_LENGTH,
  MAX_DEV_PLAN_ACTION_LENGTH,
  MAX_DEV_PLAN_TARGET_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

const STAGE_ORDER: AppraisalStatus[] = [
  "draft",
  "self_assessment",
  "manager_assessment",
  "finalized",
  "acknowledged",
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

const STAGE_AWAITING_DESCRIPTIONS: Record<string, string> = {
  draft: "Draft — not yet active",
  self_assessment: "Awaiting employee self-assessment",
  manager_assessment: "Awaiting manager assessment",
  finalized: "Awaiting employee acknowledgement",
  acknowledged: "Completed",
};

function formatWeight(weight: number | null): string {
  if (weight === null) return "no weight";
  return `${Math.round(weight * 100) / 100}%`;
}

function RatingSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
    >
      <option value="">—</option>
      {RATING_OPTIONS.map((rating) => (
        <option key={rating} value={rating}>
          {rating}
        </option>
      ))}
    </select>
  );
}

type Props = {
  appraisal: PerformanceAppraisal;
  isHrAdmin: boolean;
  currentUserEmployeeId: string | null;
  employeeName?: string;
  evaluatorName?: string;
  reviewerByAccountName?: string | null;
  cycleName?: string | null;
  submitting: boolean;
  scoringInputs: AppraisalScoringInputs | null;
  scoringLoading: boolean;
  onSelfAssessment: (input: {
    strengths?: string;
    improvements?: string;
  }) => Promise<void>;
  onManagerAssessment: (input: {
    goalRatings: { goal_id: string; rating: number }[];
    competencyRatings: { competency_id: string; rating: number }[];
    comments: string;
  }) => Promise<void>;
  onFinalize: () => Promise<void>;
  onAcknowledge: () => Promise<void>;
  onClose: () => void;
};

export function AppraisalDetailModal({
  appraisal,
  isHrAdmin,
  currentUserEmployeeId,
  employeeName,
  evaluatorName,
  reviewerByAccountName,
  cycleName,
  submitting,
  scoringInputs,
  scoringLoading,
  onSelfAssessment,
  onManagerAssessment,
  onFinalize,
  onAcknowledge,
  onClose,
}: Props) {
  const status = appraisal.status as AppraisalStatus;
  const statusLabel =
    APPRAISAL_STATUS_LABELS[status] ?? (appraisal.status || "Unknown stage");
  const statusTone = APPRAISAL_STATUS_TONES[status] ?? "bg-line text-muted";

  const isKnownStage = STAGE_ORDER.includes(status);
  const currentStageIndex = STAGE_ORDER.indexOf(status);

  const isOwnRecord =
    !!currentUserEmployeeId && appraisal.employee_id === currentUserEmployeeId;

  const canSelfAssess =
    isOwnRecord && status === "self_assessment";

  // The manager has already submitted if persisted goal results exist.
  // The server uses the same check to prevent duplicate submission (409).
  const hasManagerSubmitted =
    !!scoringInputs &&
    scoringInputs.existing_goal_ratings.length > 0;

  // Manager assessment: assigned evaluator only (not HR Admin reviewer)
  // Hidden once the manager has already submitted (result rows persist).
  const canManagerAssess =
    !!appraisal.currentUserIsEvaluator &&
    status === "manager_assessment" &&
    !hasManagerSubmitted;

  // Evaluator's read-only view: visible after submission, before HR finalization.
  const canViewSubmittedManagerAssessment =
    !!appraisal.currentUserIsEvaluator &&
    status === "manager_assessment" &&
    hasManagerSubmitted;
  // Finalization: HR Admin reviewer only (Manager cannot finalize)
  const canFinalize =
    isHrAdmin &&
    !!appraisal.currentUserIsHrReviewer &&
    status === "manager_assessment" &&
    scoringInputs !== null &&
    scoringInputs.goals.length > 0 &&
    scoringInputs.goals.every((g) =>
      scoringInputs!.existing_goal_ratings.some((r) => r.goal_id === g.goal_id),
    ) &&
    scoringInputs.competencies.length > 0 &&
    scoringInputs.competencies.every((c) =>
      scoringInputs!.existing_competency_ratings.some(
        (r) => r.competency_id === c.competency_id,
      ),
    );
  const ratingsIncomplete =
    isHrAdmin &&
    !!appraisal.currentUserIsHrReviewer &&
    status === "manager_assessment" &&
    !canFinalize;
  const canAcknowledge =
    isOwnRecord && status === "finalized";

  const [strengths, setStrengths] = useState(appraisal.strengths ?? "");
  const [improvements, setImprovements] = useState(
    appraisal.improvements ?? "",
  );
  const [comments, setComments] = useState(appraisal.comments ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  /* ── Development Plan Items state ───────────────────────────────── */
  const [devPlanItems, setDevPlanItems] = useState<DevelopmentPlanItem[]>([]);
  const [devPlanError, setDevPlanError] = useState<string | null>(null);
  const [devPlanLoadError, setDevPlanLoadError] = useState<string | null>(null);
  const [devPlanAdding, setDevPlanAdding] = useState(false);
  const [newDevAction, setNewDevAction] = useState("");
  const [newDevTarget, setNewDevTarget] = useState("");
  const [newDevStatus, setNewDevStatus] =
    useState<DevPlanItemStatus>("not_started");
  const [editingDevItemId, setEditingDevItemId] = useState<string | null>(null);
  const [editDevAction, setEditDevAction] = useState("");
  const [editDevTarget, setEditDevTarget] = useState("");
  const [editDevStatus, setEditDevStatus] =
    useState<DevPlanItemStatus>("not_started");

  const DEV_PLAN_API =
    "/performance-development-dashboard/api/performance/development-plan-items";

  const canManageDevPlan =
    (canSelfAssess || !!appraisal.currentUserIsEvaluator || isHrAdmin) &&
    status !== "finalized" &&
    status !== "acknowledged";

  useEffect(() => {
    if (!appraisal.id) return;
    let cancelled = false;
    const load = async () => {
      setDevPlanLoadError(null);
      try {
        const res = await fetch(
          `${DEV_PLAN_API}?appraisal_id=${encodeURIComponent(appraisal.id)}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setDevPlanItems(Array.isArray(data) ? data : []);
        } else if (!cancelled) {
          // A failed fetch is not an empty list: surface it distinctly so a
          // load failure never looks like "no development actions".
          setDevPlanLoadError("Failed to load development actions.");
        }
      } catch {
        if (!cancelled) {
          setDevPlanLoadError("Failed to load development actions.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [appraisal.id]);

  const handleAddDevItem = async () => {
    if (!newDevAction.trim() || !newDevTarget.trim()) return;
    setDevPlanError(null);
    try {
      const res = await fetch(DEV_PLAN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          appraisal_id: appraisal.id,
          action: newDevAction.trim(),
          target: newDevTarget.trim(),
          status: newDevStatus,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        setDevPlanItems((prev) => [...prev, item]);
        setNewDevAction("");
        setNewDevTarget("");
        setNewDevStatus("not_started");
        setDevPlanAdding(false);
      } else {
        const body = await res.json().catch(() => ({}));
        setDevPlanError(body.error || "Failed to add item.");
      }
    } catch {
      setDevPlanError("Failed to add item.");
    }
  };

  const handleUpdateDevItem = async (itemId: string) => {
    if (!editDevAction.trim() || !editDevTarget.trim()) return;
    setDevPlanError(null);
    try {
      const res = await fetch(`${DEV_PLAN_API}/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: editDevAction.trim(),
          target: editDevTarget.trim(),
          status: editDevStatus,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDevPlanItems((prev) =>
          prev.map((item) => (item.id === itemId ? updated : item)),
        );
        setEditingDevItemId(null);
      } else {
        const body = await res.json().catch(() => ({}));
        setDevPlanError(body.error || "Failed to update item.");
      }
    } catch {
      setDevPlanError("Failed to update item.");
    }
  };

  const handleDeleteDevItem = async (itemId: string) => {
    setDevPlanError(null);
    try {
      const res = await fetch(`${DEV_PLAN_API}/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setDevPlanItems((prev) => prev.filter((item) => item.id !== itemId));
      } else {
        const body = await res.json().catch(() => ({}));
        setDevPlanError(body.error || "Failed to delete item.");
      }
    } catch {
      setDevPlanError("Failed to delete item.");
    }
  };

  const [lastScoringInputs, setLastScoringInputs] =
    useState<AppraisalScoringInputs | null>(null);
  const [goalRatingById, setGoalRatingById] = useState<Record<string, number>>(
    {},
  );
  const [competencyRatingById, setCompetencyRatingById] = useState<
    Record<string, number>
  >({});

  if (scoringInputs !== null && scoringInputs !== lastScoringInputs) {
    const goals: Record<string, number> = {};
    for (const rating of scoringInputs.existing_goal_ratings) {
      goals[rating.goal_id] = rating.rating;
    }
    const competencies: Record<string, number> = {};
    for (const rating of scoringInputs.existing_competency_ratings) {
      competencies[rating.competency_id] = rating.rating;
    }
    setLastScoringInputs(scoringInputs);
    setGoalRatingById(goals);
    setCompetencyRatingById(competencies);
  }

  const preview = useMemo(() => {
    if (!scoringInputs || scoringInputs.goals.length === 0) return null;

    const goalEntries = scoringInputs.goals.map((goal) => ({
      rating: goalRatingById[goal.goal_id],
      weight: goal.weight,
    }));
    const allGoalsRated = goalEntries.every(
      (entry) => entry.rating !== undefined && entry.weight !== null,
    );
    const allCompetenciesRated = scoringInputs.competencies.every(
      (competency) =>
        competencyRatingById[competency.competency_id] !== undefined,
    );
    if (!allGoalsRated || !allCompetenciesRated) return null;

    return calculateScoring({
      goalEntries: goalEntries.map((entry) => ({
        rating: entry.rating as number,
        weight: entry.weight as number,
      })),
      competencyRatings: scoringInputs.competencies.map(
        (competency) =>
          competencyRatingById[competency.competency_id] as number,
      ),
    });
  }, [scoringInputs, goalRatingById, competencyRatingById]);

  const weightTotal = scoringInputs?.weight_total ?? 0;
  const weightTotalOk =
    scoringInputs === null ||
    scoringInputs.goals.length === 0 ||
    Math.abs(weightTotal - 100) < SCORING_WEIGHT_TOLERANCE;
  const allRatingsFilled =
    !!scoringInputs &&
    scoringInputs.goals.length > 0 &&
    scoringInputs.goals.every(
      (goal) => goalRatingById[goal.goal_id] !== undefined,
    ) &&
    scoringInputs.competencies.length > 0 &&
    scoringInputs.competencies.every(
      (competency) =>
        competencyRatingById[competency.competency_id] !== undefined,
    );

  async function handleSelfAssessment(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!strengths.trim() && !improvements.trim()) {
      setFormError("Provide at least a strength or an improvement.");
      return;
    }
    try {
      await onSelfAssessment({ strengths, improvements });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to submit self assessment.",
      );
    }
  }

  async function handleManagerAssessment(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!comments.trim()) {
      setFormError("Comments are required for the manager assessment.");
      return;
    }
    if (!scoringInputs) return;

    const goalRatings = scoringInputs.goals
      .filter((goal) => goalRatingById[goal.goal_id] !== undefined)
      .map((goal) => ({
        goal_id: goal.goal_id,
        rating: goalRatingById[goal.goal_id] as number,
      }));
    const competencyRatings = scoringInputs.competencies
      .filter(
        (competency) =>
          competencyRatingById[competency.competency_id] !== undefined,
      )
      .map((competency) => ({
        competency_id: competency.competency_id,
        rating: competencyRatingById[competency.competency_id] as number,
      }));

    try {
      await onManagerAssessment({ goalRatings, competencyRatings, comments });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit assessment.",
      );
    }
  }

  async function handleFinalize() {
    setFormError(null);
    try {
      await onFinalize();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to finalize.");
    }
  }

  async function handleAcknowledge() {
    setFormError(null);
    try {
      await onAcknowledge();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to acknowledge.",
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="appraisal-detail-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}
              >
                {statusLabel}
              </span>
              <span className="text-[12px] font-medium text-muted">
                Created {formatDateTime(appraisal.created_at)}
              </span>
            </div>
            <h2
              id="appraisal-detail-modal-title"
              className="mt-2 font-bricolage text-[22px] font-medium tracking-tight text-ink"
            >
              {appraisal.review_period}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Employee: {employeeName ?? "Unknown employee"} · Evaluator:{" "}
              {appraisal.evaluator_id
                ? (evaluatorName ?? "Unknown employee")
                : "Not assigned"}
              {reviewerByAccountName
                ? ` · HR Admin: ${reviewerByAccountName}`
                : ""}
              {cycleName ? ` · Cycle: ${cycleName}` : ""}
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

        {!isKnownStage && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-[12.5px] font-medium text-amber-700">
              This record carries a stage outside the current workflow (&quot;
              {appraisal.status}&quot;) and cannot be modified.
            </p>
          </div>
        )}

        {isKnownStage && (
          <div className="mt-5 flex items-center gap-2">
            {STAGE_ORDER.map((stage, index) => {
              const reached = index <= currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div
                  key={stage}
                  className="flex flex-1 items-center gap-2 last:flex-none"
                >
                  <div className="flex flex-1 flex-col items-center gap-1 text-center">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        reached
                          ? "bg-accent text-paper"
                          : "border border-line text-muted dark:border-paper/15"
                      }`}
                    >
                      {reached && !isCurrent ? (
                        <Check size={11} strokeWidth={2.5} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`text-[10px] font-medium leading-none ${
                        isCurrent
                          ? "text-ink"
                          : reached
                            ? "text-accent"
                            : "text-muted/70"
                      }`}
                    >
                      {APPRAISAL_STATUS_LABELS[stage]}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] leading-none text-muted">
                        {STAGE_AWAITING_DESCRIPTIONS[stage]}
                      </span>
                    )}
                  </div>
                  {index < STAGE_ORDER.length - 1 && (
                    <span
                      className={`mb-4 h-px flex-1 ${
                        index < currentStageIndex
                          ? "bg-accent"
                          : "bg-line dark:bg-paper/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-line bg-paper px-4 py-4 text-[12.5px] dark:border-paper/10 sm:grid-cols-3">
          <div>
            <dt className="text-muted">Updated</dt>
            <dd className="font-medium text-ink">
              {formatDateTime(appraisal.updated_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Finalized</dt>
            <dd className="font-medium text-ink">
              {formatDateTime(appraisal.finalized_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Acknowledged</dt>
            <dd className="font-medium text-ink">
              {formatDateTime(appraisal.acknowledged_at)}
            </dd>
          </div>
        </dl>

        {appraisal.scoreSummary && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/[0.04] px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Official result
              </p>
              <p className="mt-1 font-bricolage text-[24px] font-medium leading-none text-ink">
                {appraisal.scoreSummary.final_score.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Final performance rating
              </p>
              <p className="mt-1 font-bricolage text-[18px] font-medium leading-none text-ink">
                {appraisal.scoreSummary.band_label}
              </p>
            </div>
          </div>
        )}

        {appraisal.goalResults && appraisal.goalResults.length > 0 && (
          <div className="mt-5">
            <p className="text-[12.5px] font-medium text-ink">Goal ratings</p>
            <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
              {appraisal.goalResults.map((result, index) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${
                    index > 0 ? "border-t border-line dark:border-paper/10" : ""
                  }`}
                >
                  <span className="text-muted">
                    {index + 1}.{" "}
                    <span className="text-ink">
                      {result.title || result.goal_id}
                    </span>
                  </span>
                  <span className="font-medium text-ink">{result.rating}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {appraisal.competencyResults &&
          appraisal.competencyResults.length > 0 && (
            <div className="mt-5">
              <p className="text-[12.5px] font-medium text-ink">
                Competency ratings
              </p>
              <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                {appraisal.competencyResults.map((result, index) => (
                  <div
                    key={result.id}
                    className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${
                      index > 0
                        ? "border-t border-line dark:border-paper/10"
                        : ""
                    }`}
                  >
                    <span className="text-muted">
                      {index + 1}.{" "}
                      <span className="text-ink capitalize">
                        {result.name || result.competency_id}
                      </span>
                    </span>
                    <span className="font-medium text-ink">
                      {result.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {(appraisal.strengths || appraisal.improvements) && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-[12.5px] font-medium text-ink">
                Self assessment
              </p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink dark:border-paper/10">
                {appraisal.strengths || "No strengths recorded."}
              </p>
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-ink">Improvements</p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink dark:border-paper/10">
                {appraisal.improvements || "No improvements recorded."}
              </p>
            </div>
          </div>
        )}

        {appraisal.comments && (
          <div className="mt-5">
            <p className="text-[12.5px] font-medium text-ink">
              Manager assessment
            </p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink dark:border-paper/10">
              {appraisal.comments}
            </p>
          </div>
        )}

        {canSelfAssess && (
          <form
            onSubmit={handleSelfAssessment}
            className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4"
          >
            <p className="text-[13px] font-medium text-ink">
              Submit your self assessment
            </p>
            <div>
              <label
                htmlFor="appraisal-strengths"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Strengths
              </label>
              <textarea
                id="appraisal-strengths"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                maxLength={MAX_APPRAISAL_TEXT_LENGTH}
                rows={4}
                placeholder="What went well in this period..."
                className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
            </div>
            <div>
              <label
                htmlFor="appraisal-improvements"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Improvements
              </label>
              <textarea
                id="appraisal-improvements"
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                maxLength={MAX_APPRAISAL_TEXT_LENGTH}
                rows={4}
                placeholder="What could be improved in this period..."
                className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Provide at least one strength or improvement to submit.
              </p>
            </div>
            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit self assessment"}
              </button>
            </div>
          </form>
        )}

        {/* ── Development Plan Items ───────────────────────────────── */}
        {(canManageDevPlan || devPlanItems.length > 0) && (
          <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4">
            <p className="text-[13px] font-medium text-ink">Development Actions</p>
            <p className="mt-1 text-[11.5px] text-muted">
              Specify actions to support goals, develop competencies, and
              perform job responsibilities.
            </p>
            {devPlanLoadError && (
              <p role="alert" className="mt-2 text-[11.5px] font-medium text-red-600">
                {devPlanLoadError}
              </p>
            )}

            {devPlanItems.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wide text-muted">
                      <th scope="col" className="pb-1.5 pr-3">Actions to Be Taken</th>
                      <th scope="col" className="pb-1.5 pr-3">Target</th>
                      <th scope="col" className="pb-1.5 pr-3">Status</th>
                      {canManageDevPlan && <th scope="col" className="pb-1.5 w-20"><span className="sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {devPlanItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-line/50 last:border-0"
                      >
                        {editingDevItemId === item.id ? (
                          <>
                            <td className="py-2 pr-3">
                              <textarea
                                value={editDevAction}
                                onChange={(e) =>
                                  setEditDevAction(e.target.value)
                                }
                                maxLength={MAX_DEV_PLAN_ACTION_LENGTH}
                                rows={2}
                                aria-label="Edit action"
                                className="w-full resize-none rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <textarea
                                value={editDevTarget}
                                onChange={(e) =>
                                  setEditDevTarget(e.target.value)
                                }
                                maxLength={MAX_DEV_PLAN_TARGET_LENGTH}
                                rows={2}
                                aria-label="Edit target"
                                className="w-full resize-none rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                value={editDevStatus}
                                onChange={(e) =>
                                  setEditDevStatus(
                                    e.target.value as DevPlanItemStatus,
                                  )
                                }
                                aria-label="Edit status"
                                className="rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
                              >
                                {(
                                  Object.entries(
                                    DEV_PLAN_ITEM_STATUS_LABELS,
                                  ) as [DevPlanItemStatus, string][]
                                ).map(([val, label]) => (
                                  <option key={val} value={val}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDevItem(item.id)}
                                  className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-paper hover:bg-accent-dark"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDevItemId(null)}
                                  className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-line/50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 pr-3 text-ink">
                              {item.action}
                            </td>
                            <td className="py-2 pr-3 text-ink">
                              {item.target}
                            </td>
                            <td className="py-2 pr-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  item.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : item.status === "in_progress"
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-line text-muted"
                                }`}
                              >
                                {DEV_PLAN_ITEM_STATUS_LABELS[item.status] ??
                                  item.status}
                              </span>
                            </td>
                            {canManageDevPlan && (
                              <td className="py-2">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDevItemId(item.id);
                                      setEditDevAction(item.action);
                                      setEditDevTarget(item.target);
                                      setEditDevStatus(item.status);
                                    }}
                                    className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-line/50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDevItem(item.id)}
                                    className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] text-red-600 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canManageDevPlan && devPlanAdding && (
              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.05] p-3 space-y-2">
                <div>
                  <label htmlFor="dev-plan-action-new" className="mb-1 block text-[11px] font-medium text-muted">
                    Actions to Be Taken
                  </label>
                  <textarea
                    id="dev-plan-action-new"
                    value={newDevAction}
                    onChange={(e) => setNewDevAction(e.target.value)}
                    maxLength={MAX_DEV_PLAN_ACTION_LENGTH}
                    rows={2}
                    placeholder="Describe the action to be taken..."
                    className="w-full resize-none rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted/60 focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="dev-plan-target-new" className="mb-1 block text-[11px] font-medium text-muted">
                    Target
                  </label>
                  <textarea
                    id="dev-plan-target-new"
                    value={newDevTarget}
                    onChange={(e) => setNewDevTarget(e.target.value)}
                    maxLength={MAX_DEV_PLAN_TARGET_LENGTH}
                    rows={2}
                    placeholder="What is the target or expected outcome..."
                    className="w-full resize-none rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted/60 focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="dev-plan-status-new" className="mb-1 block text-[11px] font-medium text-muted">
                    Status
                  </label>
                  <select
                    id="dev-plan-status-new"
                    value={newDevStatus}
                    onChange={(e) =>
                      setNewDevStatus(e.target.value as DevPlanItemStatus)
                    }
                    className="rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
                  >
                    {(
                      Object.entries(DEV_PLAN_ITEM_STATUS_LABELS) as [
                        DevPlanItemStatus,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {devPlanError && (
                  <p className="text-[11.5px] text-red-600">{devPlanError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDevPlanAdding(false);
                      setDevPlanError(null);
                    }}
                    className="rounded-md border border-line px-3 py-1.5 text-[11.5px] text-muted hover:bg-line/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddDevItem}
                    disabled={!newDevAction.trim() || !newDevTarget.trim()}
                    className="rounded-md bg-accent px-3 py-1.5 text-[11.5px] font-medium text-paper hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}

            {canManageDevPlan && !devPlanAdding && (
              <button
                type="button"
                onClick={() => setDevPlanAdding(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-accent/40 px-3 py-2 text-[12px] text-accent hover:bg-accent/5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add development action
              </button>
            )}
          </div>
        )}

        {canManagerAssess && (
          <form
            onSubmit={handleManagerAssessment}
            className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4"
          >
            <p className="text-[13px] font-medium text-ink">
              Record your manager assessment
            </p>

            {scoringLoading ? (
              <div className="flex flex-col gap-3 py-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 dark:border-paper/10"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-48 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-14 rounded-md" />
                  </div>
                ))}
              </div>
            ) : scoringInputs ? (
              <>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Goal ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — weights must total exactly 100%
                    </span>
                  </p>
                  <p className="mb-2 text-[11.5px] text-muted">
                    {cycleName
                      ? `Only goals in the appraisal's cycle (${cycleName}) are scored; goals from other cycles are excluded.`
                      : "All of the employee's goals are scored."}
                  </p>
                  {scoringInputs.goals.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-amber-700">
                      This appraisal has no applicable goals. Assign goals to
                      the employee
                      {cycleName ? ` in the ${cycleName} cycle` : ""} before
                      submitting the manager assessment.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                      {scoringInputs.goals.map((goal, index) => (
                        <div
                          key={goal.goal_id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                            index > 0
                              ? "border-t border-line dark:border-paper/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink">
                              {goal.title || "Untitled goal"}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              Weight {formatWeight(goal.weight)}
                            </p>
                            {(goal.progress_method ?? "manual") ===
                              "measurable" && (
                              <p className="text-[11.5px] tabular-nums text-muted">
                                Progress {goal.progress_percent ?? 0}% ·{" "}
                                {formatMeasuredPair(
                                  goal.actual_value,
                                  goal.target_value,
                                  goal.measurement_type,
                                  goal.measurement_unit
                                )}
                              </p>
                            )}
                          </div>
                          <RatingSelect
                            label={`Goal rating for ${goal.title || "goal"}`}
                            value={goalRatingById[goal.goal_id]}
                            onChange={(rating) =>
                              setGoalRatingById((previous) => ({
                                ...previous,
                                [goal.goal_id]: rating,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {scoringInputs.goals.length > 0 && (
                    <p
                      className={`mt-1.5 text-[11.5px] ${
                        weightTotalOk
                          ? "text-muted"
                          : "font-medium text-red-600"
                      }`}
                    >
                      Weight total: {Math.round(weightTotal * 100) / 100}% —{" "}
                      {weightTotalOk
                        ? "valid (100%)."
                        : "goal weights must total exactly 100%."}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Competency ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — equally weighted
                    </span>
                  </p>
                  {scoringInputs.competencies.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-amber-700">
                      This appraisal has no applicable competencies. Associate
                      competencies with the employee&apos;s position before
                      submitting the manager assessment.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                      {scoringInputs.competencies.map((competency, index) => (
                        <div
                          key={competency.competency_id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                            index > 0
                              ? "border-t border-line dark:border-paper/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink capitalize">
                              {competency.name}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              {competency.category}
                              {competency.current_level !== null &&
                                ` · current level ${competency.current_level} (reference only)`}
                            </p>
                          </div>
                          <RatingSelect
                            label={`Competency rating for ${competency.name}`}
                            value={
                              competencyRatingById[competency.competency_id]
                            }
                            onChange={(rating) =>
                              setCompetencyRatingById((previous) => ({
                                ...previous,
                                [competency.competency_id]: rating,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted">
                    The employee&apos;s operational competency level is
                    reference only — it is never used as the appraisal rating.
                  </p>
                </div>

                {preview && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                    {preview.ok ? (
                      <>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Preview
                          </p>
                          <p className="font-bricolage text-[20px] font-medium leading-none text-ink">
                            {preview.calculation.finalScoreDisplay.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-right font-medium text-ink">
                          {preview.calculation.band.label}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12.5px] font-medium text-red-600">
                        {preview.error}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted">
                The scoring inputs could not be loaded for this appraisal.
              </p>
            )}

            <div>
              <label
                htmlFor="appraisal-comments"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Comments
              </label>
              <textarea
                id="appraisal-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={MAX_APPRAISAL_TEXT_LENGTH}
                rows={5}
                placeholder="Your evaluation of the employee's performance this period..."
                className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
            </div>

            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !scoringInputs ||
                  !allRatingsFilled ||
                  !weightTotalOk
                }
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit manager assessment"}
              </button>
            </div>
          </form>
        )}

        {canViewSubmittedManagerAssessment && (
          <div className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-ink">
                Manager assessment — submitted
              </p>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700">
                Awaiting HR finalization
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              Your manager assessment has been submitted successfully. HR will
              review and finalize this appraisal.
            </p>

            {scoringLoading ? (
              <div className="flex flex-col gap-3 py-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 dark:border-paper/10"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-48 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : scoringInputs ? (
              <>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Goal ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — rated by you
                    </span>
                  </p>
                  <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                    {scoringInputs.goals.map((goal, index) => {
                      const existingRating =
                        scoringInputs.existing_goal_ratings.find(
                          (r) => r.goal_id === goal.goal_id,
                        );
                      return (
                        <div
                          key={goal.goal_id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                            index > 0
                              ? "border-t border-line dark:border-paper/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink">
                              {goal.title || "Untitled goal"}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              Weight {formatWeight(goal.weight)}
                            </p>
                            {(goal.progress_method ?? "manual") ===
                              "measurable" && (
                              <p className="text-[11.5px] tabular-nums text-muted">
                                Progress {goal.progress_percent ?? 0}% ·{" "}
                                {formatMeasuredPair(
                                  goal.actual_value,
                                  goal.target_value,
                                  goal.measurement_type,
                                  goal.measurement_unit
                                )}
                              </p>
                            )}
                          </div>
                          <span className="rounded-lg border border-line bg-accent/[0.04] px-2.5 py-1.5 text-[13px] font-medium text-ink dark:border-paper/15">
                            {existingRating?.rating ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Competency ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — rated by you
                    </span>
                  </p>
                  <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                    {scoringInputs.competencies.map((competency, index) => {
                      const existingRating =
                        scoringInputs.existing_competency_ratings.find(
                          (r) =>
                            r.competency_id === competency.competency_id,
                        );
                      return (
                        <div
                          key={competency.competency_id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                            index > 0
                              ? "border-t border-line dark:border-paper/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink capitalize">
                              {competency.name}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              {competency.category}
                            </p>
                          </div>
                          <span className="rounded-lg border border-line bg-accent/[0.04] px-2.5 py-1.5 text-[13px] font-medium text-ink dark:border-paper/15">
                            {existingRating?.rating ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {appraisal.comments && (
                  <div>
                    <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                      Your comments
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink dark:border-paper/10">
                      {appraisal.comments}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted">
                The scoring inputs could not be loaded for this appraisal.
              </p>
            )}
          </div>
        )}

        {/* ── Time & Attendance Activity (supplemental external context) ── */}
        {/* Read-only raw HR2 activity for this appraisal's review period.
            Deliberately outside Goals (60%) / Competencies (40%) scoring,
            assessment forms, Development Actions, and finalize/acknowledge
            controls. Never influences ratings or submission state. */}
        <AttendanceContextSection
          appraisalId={appraisal.id}
          isFinalized={status === "finalized" || status === "acknowledged"}
        />

        {/* ── Leave Activity (supplemental external context) ── */}
        {/* Read-only current approved-request ranges for this appraisal's
            review period. Independent from Time & Attendance Activity: no
            reconciliation between them. Never influences ratings, scoring,
            or submission state. */}
        <LeaveContextSection
          appraisalId={appraisal.id}
          isFinalized={status === "finalized" || status === "acknowledged"}
        />

        {canFinalize && (
          <div className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4">
            <p className="text-[13px] font-medium text-ink">
              Review and finalize this appraisal
            </p>
            <p className="text-[12.5px] leading-relaxed text-muted">
              The Manager has submitted goal and competency ratings. Review the
              ratings below. Finalization computes the official result: Final
              Score = (Goal Score × 60%) + (Competency Score × 40%), mapped to a
              single rating band. This is locked in at finalization and is never
              recalculated afterwards.
            </p>

            {scoringLoading ? (
              <div className="flex flex-col gap-3 py-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 dark:border-paper/10"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-48 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : scoringInputs ? (
              <>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Goal ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — rated by Manager
                    </span>
                  </p>
                  {scoringInputs.goals.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-amber-700">
                      No applicable goals found.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                      {scoringInputs.goals.map((goal, index) => {
                        const existingRating =
                          scoringInputs.existing_goal_ratings.find(
                            (r) => r.goal_id === goal.goal_id,
                          );
                        return (
                          <div
                            key={goal.goal_id}
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                              index > 0
                                ? "border-t border-line dark:border-paper/10"
                                : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-ink">
                                {goal.title || "Untitled goal"}
                              </p>
                              <p className="text-[11.5px] text-muted">
                                Weight {formatWeight(goal.weight)}
                              </p>
                            </div>
                            <span className="rounded-lg border border-line bg-accent/[0.04] px-2.5 py-1.5 text-[13px] font-medium text-ink dark:border-paper/15">
                              {existingRating?.rating ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {scoringInputs.goals.length > 0 && (
                    <p className="mt-1.5 text-[11.5px] text-muted">
                      Weight total: {Math.round(weightTotal * 100) / 100}%
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                    Competency ratings
                    <span className="font-normal text-muted">
                      {" "}
                      — rated by Manager
                    </span>
                  </p>
                  {scoringInputs.competencies.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-amber-700">
                      No applicable competencies found.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line bg-paper dark:border-paper/10">
                      {scoringInputs.competencies.map((competency, index) => {
                        const existingRating =
                          scoringInputs.existing_competency_ratings.find(
                            (r) => r.competency_id === competency.competency_id,
                          );
                        return (
                          <div
                            key={competency.competency_id}
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] ${
                              index > 0
                                ? "border-t border-line dark:border-paper/10"
                                : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-ink capitalize">
                                {competency.name}
                              </p>
                              <p className="text-[11.5px] text-muted">
                                {competency.category}
                              </p>
                            </div>
                            <span className="rounded-lg border border-line bg-accent/[0.04] px-2.5 py-1.5 text-[13px] font-medium text-ink dark:border-paper/15">
                              {existingRating?.rating ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {preview && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                    {preview.ok ? (
                      <>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Computed result
                          </p>
                          <p className="font-bricolage text-[20px] font-medium leading-none text-ink">
                            {preview.calculation.finalScoreDisplay.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-right font-medium text-ink">
                          {preview.calculation.band.label}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12.5px] font-medium text-red-600">
                        {preview.error}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted">
                The scoring inputs could not be loaded for this appraisal.
              </p>
            )}

            {appraisal.comments && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink">
                  Manager comments
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink dark:border-paper/10">
                  {appraisal.comments}
                </p>
              </div>
            )}

            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleFinalize}
                disabled={submitting || !scoringInputs}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Finalizing..." : "Finalize appraisal"}
              </button>
            </div>
            {ratingsIncomplete && (
              <p className="text-[12.5px] text-muted">
                Ratings are incomplete. The manager must submit a full
                assessment before finalizing.
              </p>
            )}
          </div>
        )}

        {canAcknowledge && (
          <div className="mt-6 space-y-4 rounded-2xl border border-accent/25 bg-accent/[0.03] p-4">
            <p className="text-[13px] font-medium text-ink">
              Acknowledge this appraisal
            </p>
            <p className="text-[12.5px] leading-relaxed text-muted">
              Acknowledgement records that you have reviewed your final
              evaluation. It does not alter the evaluation, and it does not
              imply agreement.
            </p>
            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-red-600">
                  {formError}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Acknowledging..." : "Acknowledge appraisal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
