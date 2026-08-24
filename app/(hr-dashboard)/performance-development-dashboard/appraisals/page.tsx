"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/performance-development-dashboard/components/EmptyState";
import Chip from "@/app/(hr-dashboard)/performance-development-dashboard/components/Chip";
import ProgressBar from "@/app/(hr-dashboard)/performance-development-dashboard/components/ProgressBar";
import StatCard from "@/app/(hr-dashboard)/performance-development-dashboard/components/StatCard";
import {
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/Skeleton";
import {
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";
import {
  controlSmallClass,
  errorTextClass,
  inputClass,
  selectClass,
  textareaClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";
import { useDirectory } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

const DIMENSIONS = [
  "Job Knowledge",
  "Reliability",
  "Customer Service",
  "Teamwork",
  "Speed & Efficiency",
];

const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Developing",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

function ratingLabel(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  return RATING_LABELS[score];
}

type DimensionScore = { dimension: string; score: number };
type GoalScore = { goal_id: string; title: string; score: number };
type Goal = { id: string; title: string; employee_id: string | null };

type Appraisal = {
  id: string;
  employee_id: string | null;
  reviewer_id: string | null;
  review_period: string;
  manager_rating: number | null;
  final_score: number | null;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
  manager_dimension_scores: DimensionScore[] | null;
  goal_scores: GoalScore[] | null;
  status: string;
  acknowledged_at: string | null;
};

const FILTERS = ["all", "draft", "reviewed", "finalized"] as const;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    reviewed: "Reviewed",
    finalized: "Finalized",
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "finalized") return "success";
  if (status === "reviewed") return "warning";
  return "neutral";
}

function verdict(
  final: number | null
): { label: string; variant: "success" | "warning" | "danger" | "neutral" } | null {
  if (final === null) return null;
  if (final >= 4) return { label: "Exceeds Expectations", variant: "success" };
  if (final >= 3) return { label: "Meets Expectations", variant: "neutral" };
  return { label: "Needs Improvement", variant: "danger" };
}

function buildDimensionScores(record: Record<string, string>): DimensionScore[] {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    score: Number(record[dimension]),
  })).filter((s) => !Number.isNaN(s.score));
}

function buildGoalScores(
  record: Record<string, string>,
  goals: Goal[]
): GoalScore[] {
  return goals
    .map((g) => ({
      goal_id: g.id,
      title: g.title,
      score: Number(record[g.id]),
    }))
    .filter((s) => !Number.isNaN(s.score));
}

function RatingSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={controlSmallClass}
    >
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function DimensionBreakdown({
  managerScores,
}: {
  managerScores: DimensionScore[] | null;
}) {
  if (!managerScores || managerScores.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {managerScores.map((s) => (
        <div key={s.dimension}>
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-muted">{s.dimension}</span>
            <span className="text-muted">
              {s.score} · {ratingLabel(s.score)}
            </span>
          </div>
          <ProgressBar
            value={(s.score / 5) * 100}
            tone="success"
            className="h-1.5"
          />
        </div>
      ))}
    </div>
  );
}

function GoalBreakdown({ goalScores }: { goalScores: GoalScore[] | null }) {
  if (!goalScores || goalScores.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Goal Achievement
      </p>
      {goalScores.map((g) => (
        <div
          key={g.goal_id}
          className="flex items-center justify-between gap-2 text-xs"
        >
          <span className="truncate text-muted">{g.title}</span>
          <span className="shrink-0 text-muted">
            {g.score} · {ratingLabel(g.score)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewForm({
  appraisal,
  onUpdated,
}: {
  appraisal: Appraisal;
  onUpdated: () => void;
}) {
  const initialManager = (appraisal.manager_dimension_scores ?? []).reduce(
    (acc, s) => ({ ...acc, [s.dimension]: s.score.toString() }),
    {} as Record<string, string>
  );
  const initialGoal = (appraisal.goal_scores ?? []).reduce(
    (acc, g) => ({ ...acc, [g.goal_id]: g.score.toString() }),
    {} as Record<string, string>
  );
  const [managerScores, setManagerScores] =
    useState<Record<string, string>>(initialManager);
  const [goalScores, setGoalScores] =
    useState<Record<string, string>>(initialGoal);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [strengths, setStrengths] = useState(appraisal.strengths ?? "");
  const [improvements, setImprovements] = useState(
    appraisal.improvements ?? ""
  );
  const [comments, setComments] = useState(appraisal.comments ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        const res = await fetch("/performance-development-dashboard/api/goals");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const all: Goal[] = json.goals || [];
        setGoals(all.filter((g) => g.employee_id === appraisal.employee_id));
      } catch {
        // ignore goal load errors in the review form
      }
    }

    loadGoals();
    return () => {
      cancelled = true;
    };
  }, [appraisal.employee_id]);

  const filled = DIMENSIONS.map((d) => managerScores[d]).filter(
    (v) => v !== undefined && v !== ""
  );
  const managerAverage =
    filled.length > 0
      ? Math.round(
          (filled.reduce((sum, v) => sum + Number(v), 0) / filled.length) * 10
        ) / 10
      : null;
  const allRated = DIMENSIONS.every((d) => managerScores[d]);

  async function save(nextStatus: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/appraisals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appraisal.id,
          manager_dimension_scores: buildDimensionScores(managerScores),
          goal_scores: buildGoalScores(goalScores, goals),
          strengths,
          improvements,
          comments,
          status: nextStatus,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to save appraisal");
      }
      onUpdated();
      toast.success("Appraisal saved successfully.");
    } catch {
      toast.error("Failed to save appraisal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Manager Rating
      </p>
      {DIMENSIONS.map((dimension) => (
        <div key={dimension} className="flex items-center justify-between gap-3">
          <span className="text-sm">{dimension}</span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted">
              {managerScores[dimension]
                ? ratingLabel(Number(managerScores[dimension]))
                : ""}
            </span>
            <RatingSelect
              value={managerScores[dimension] ?? ""}
              onChange={(value) =>
                setManagerScores((prev) => ({ ...prev, [dimension]: value }))
              }
              label={`Manager rating for ${dimension}`}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">
        Average: {managerAverage ?? "—"}
        {appraisal.status === "reviewed" &&
          ` · Final score will be ${managerAverage ?? "—"}`}
      </p>

      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        Goal Achievement
      </p>
      {goals.length === 0 ? (
        <p className="text-xs text-muted">
          No goals linked for this employee.
        </p>
      ) : (
        goals.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm">{g.title}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted">
                {goalScores[g.id]
                  ? ratingLabel(Number(goalScores[g.id]))
                  : ""}
              </span>
              <RatingSelect
                value={goalScores[g.id] ?? ""}
                onChange={(value) =>
                  setGoalScores((prev) => ({ ...prev, [g.id]: value }))
                }
                label={`Goal rating for ${g.title}`}
              />
            </div>
          </div>
        ))
      )}

      <textarea
        placeholder="Strengths"
        aria-label="Strengths"
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        className={textareaClass}
      />
      <textarea
        placeholder="Areas for improvement"
        aria-label="Areas for improvement"
        value={improvements}
        onChange={(e) => setImprovements(e.target.value)}
        className={textareaClass}
      />
      <textarea
        placeholder="Comments"
        aria-label="Comments"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        className={textareaClass}
      />
      <div className="flex gap-2">
        {appraisal.status === "draft" && (
          <Button
            onClick={() => save("reviewed")}
            loading={submitting}
            disabled={submitting || !allRated}
          >
            Save &amp; Mark Reviewed
          </Button>
        )}
        {appraisal.status === "reviewed" && (
          <Button
            onClick={() => save("finalized")}
            loading={submitting}
            disabled={submitting || !allRated}
          >
            Finalize
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AppraisalsPage() {
  const { user, isAdmin } = useHrAuth();
  const { directory, getDirectoryUser } = useDirectory();
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/appraisals");
        if (!res.ok) throw new Error("Failed to load appraisals");
        const json = await res.json();
        if (cancelled) return;
        setAppraisals(json.appraisals || []);
      } catch {
        if (!cancelled) setError("Could not load appraisals. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  async function acknowledge(id: string) {
    try {
      const res = await fetch("/performance-development-dashboard/api/appraisals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acknowledge: true }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to acknowledge appraisal");
      }
      refetch();
      toast.success("Appraisal acknowledged successfully.");
    } catch {
      toast.error("Failed to acknowledge appraisal. Please try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/performance-development-dashboard/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          review_period: reviewPeriod,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to create appraisal");
      }
      setReviewPeriod("");
      setEmployeeId("");
      refetch();
      toast.success("Appraisal created successfully.");
    } catch {
      toast.error("Failed to create appraisal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleAppraisals = appraisals.filter((a) =>
    filter === "all" ? true : a.status === filter
  );

  const stats = [
    { label: "Total", value: appraisals.length },
    { label: "Draft", value: appraisals.filter((a) => a.status === "draft").length },
    { label: "Reviewed", value: appraisals.filter((a) => a.status === "reviewed").length },
    { label: "Finalized", value: appraisals.filter((a) => a.status === "finalized").length },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Appraisals"
        subtitle="Managers rate performance across key areas and finalize each review period."
      />

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 flex max-w-md flex-col gap-3"
        >
          <h2 className="text-lg font-semibold font-bricolage">
            New Appraisal
          </h2>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            aria-label="Select employee"
            className={selectClass}
          >
            <option value="" disabled>
              Select employee
            </option>
            {directory.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.jobTitle}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Review period (e.g. 2026-H1)"
            aria-label="Review period"
            value={reviewPeriod}
            onChange={(e) => setReviewPeriod(e.target.value)}
            required
            className={inputClass}
          />
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating…" : "Create Appraisal"}
          </Button>
        </form>
      )}

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading appraisals…">
          <SkeletonStats />
          <SkeletonCards rows={3} className="mt-8 max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {!loading && appraisals.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {FILTERS.map((value) => (
            <Chip
              key={value}
              active={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : statusLabel(value)}
            </Chip>
          ))}
        </div>
      )}

      {!loading && visibleAppraisals.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={
            appraisals.length === 0
              ? "No appraisals yet"
              : "No appraisals match"
          }
          description={
            appraisals.length === 0
              ? isAdmin
                ? "Create an appraisal above to get started."
                : "Your manager hasn't started an appraisal for you yet."
              : "Try a different filter to see more appraisals."
          }
        />
      )}

      {!loading && visibleAppraisals.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-4"
        >
          {visibleAppraisals.map((a) => {
            const employee = getDirectoryUser(a.employee_id);
            const reviewer = getDirectoryUser(a.reviewer_id);
            const finalVerdict = verdict(a.final_score);
            const isAppraisee =
              !!user?.employeeId && a.employee_id === user.employeeId;
            return (
              <motion.div key={a.id} variants={staggerItem}>
                <Card>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold font-bricolage">
                        {a.review_period}
                      </h2>
                      {employee && (
                        <p className="mt-0.5 text-xs text-muted">
                          {employee.name}
                          {employee.jobTitle && (
                            <span className="text-muted">
                              {" "}· {employee.jobTitle}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusVariant(a.status)}>
                      {statusLabel(a.status)}
                    </Badge>
                  </div>

                  <DimensionBreakdown managerScores={a.manager_dimension_scores} />
                  <GoalBreakdown goalScores={a.goal_scores} />

                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted">
                      Manager: {a.manager_rating ?? "—"} · Final:{" "}
                      {a.final_score ?? "—"}
                    </p>
                    {finalVerdict && (
                      <Badge variant={finalVerdict.variant}>
                        {finalVerdict.label}
                      </Badge>
                    )}
                  </div>

                  {a.strengths && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-medium text-green-600 dark:text-green-400">
                        Strengths:
                      </span>{" "}
                      {a.strengths}
                    </p>
                  )}
                  {a.improvements && (
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        To improve:
                      </span>{" "}
                      {a.improvements}
                    </p>
                  )}

                  {reviewer && a.reviewer_id && (
                    <p className="mt-1 text-xs text-muted">
                      Reviewer: {reviewer.name}
                    </p>
                  )}
                  {a.comments && (
                    <p className="mt-1 text-sm italic text-muted">
                      “{a.comments}”
                    </p>
                  )}

                  {a.status === "finalized" &&
                    (a.acknowledged_at ? (
                      <p className="mt-3 text-xs text-green-600 dark:text-green-400">
                        Acknowledged on{" "}
                        {new Date(a.acknowledged_at).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </p>
                    ) : (
                      isAppraisee && (
                        <div className="mt-3">
                          <Button onClick={() => acknowledge(a.id)}>
                            Acknowledge
                          </Button>
                        </div>
                      )
                    ))}

                  {isAdmin && a.status !== "finalized" && (
                    <ReviewForm appraisal={a} onUpdated={refetch} />
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
