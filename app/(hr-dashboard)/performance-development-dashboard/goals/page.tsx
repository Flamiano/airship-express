"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import GoalForm from "@/app/(hr-dashboard)/performance-development-dashboard/components/GoalForm";
import GoalEditForm from "@/app/(hr-dashboard)/performance-development-dashboard/components/GoalEditForm";
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
  iconEditClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  target: string | null;
  due_date: string | null;
  progress_percent: number | null;
  status: string;
};

const GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "missed",
] as const;

const FILTERS = ["all", ...GOAL_STATUSES, "overdue"] as const;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    missed: "Missed",
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "missed") return "danger";
  if (status === "in_progress") return "warning";
  return "neutral";
}

function priorityLabel(priority: string | null) {
  if (!priority) return null;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function priorityVariant(
  priority: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  if (priority === "low") return "success";
  return "neutral";
}

function priorityRank(priority: string | null) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function todayManila() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}

function isOverdue(goal: Goal) {
  return (
    !!goal.due_date &&
    goal.status !== "completed" &&
    goal.due_date < todayManila()
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sortBy, setSortBy] = useState<"due_date" | "priority" | "title">(
    "due_date"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/goals");
        if (!res.ok) throw new Error("Failed to load goals");
        const json = await res.json();
        if (cancelled) return;
        setGoals(json.goals || []);
      } catch {
        if (!cancelled) setError("Could not load goals. Please try again.");
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

  async function updateGoal(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch("/performance-development-dashboard/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update goal");
      }
      refetch();
      toast.success("Goal updated successfully.");
    } catch {
      toast.error("Failed to update goal. Please try again.");
    }
  }

  function updateStatus(id: string, status: string) {
    updateGoal(id, { status });
  }

  function commitProgress(goal: Goal) {
    const draft = progressDrafts[goal.id];
    if (draft === undefined || draft === (goal.progress_percent ?? 0)) return;
    const nextStatus =
      draft >= 100
        ? "completed"
        : goal.status === "not_started" && draft > 0
          ? "in_progress"
          : goal.status;
    updateGoal(goal.id, {
      progress_percent: draft,
      status: nextStatus,
    });
  }

  async function deleteGoal(id: string) {
    if (!window.confirm("Delete this goal?")) return;
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/goals?id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete goal");
      }
      refetch();
      toast.success("Goal deleted successfully.");
    } catch {
      toast.error("Failed to delete goal. Please try again.");
    }
  }

  function formatDate(date: string | null) {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
    });
  }

  const filteredGoals = goals
    .filter((goal) => {
      if (filter === "overdue") return isOverdue(goal);
      if (filter === "all") return true;
      return goal.status === filter;
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "priority") return priorityRank(a.priority) - priorityRank(b.priority);
      const aDate = a.due_date ?? "9999-12-31";
      const bDate = b.due_date ?? "9999-12-31";
      return aDate.localeCompare(bDate);
    });

  const inProgress = goals.filter((g) =>
    ["in_progress", "not_started"].includes(g.status)
  ).length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const overdue = goals.filter(isOverdue).length;

  const stats = [
    { label: "Total Goals", value: goals.length },
    { label: "In Progress", value: inProgress },
    { label: "Completed", value: completed },
    { label: "Overdue", value: overdue },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Goals"
        subtitle="Track your objectives, update progress, and keep your manager in the loop."
      />

      <GoalForm onGoalCreated={refetch} />

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading goals…">
          <SkeletonStats count={4} />
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

      {!loading && goals.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {FILTERS.map((value) => (
            <Chip
              key={value}
              active={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : value === "overdue"
                  ? "Overdue"
                  : statusLabel(value)}
            </Chip>
          ))}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "due_date" | "priority" | "title")
            }
            aria-label="Sort goals"
            className={`ml-auto ${controlSmallClass}`}
          >
            <option value="due_date">Sort by due date</option>
            <option value="priority">Sort by priority</option>
            <option value="title">Sort by title</option>
          </select>
        </div>
      )}

      {!loading && goals.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Create your first goal above to get started."
        />
      )}

      {!loading && goals.length > 0 && filteredGoals.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals match"
          description="Try a different filter to see more goals."
        />
      )}

      {!loading && filteredGoals.length > 0 && (
        <motion.div
          key={`${refreshKey}-${filter}-${sortBy}`}
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-4"
        >
          {filteredGoals.map((goal) => (
            <motion.div key={goal.id} variants={staggerItem}>
              <Card>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold font-bricolage">
                    {goal.title}
                  </h2>
                  <div className="flex shrink-0 items-center gap-2">
                    {isOverdue(goal) && (
                      <Badge variant="danger">Overdue</Badge>
                    )}
                    {goal.priority && (
                      <Badge variant={priorityVariant(goal.priority)}>
                        {priorityLabel(goal.priority)}
                      </Badge>
                    )}
                    <Badge variant={statusVariant(goal.status)}>
                      {statusLabel(goal.status)}
                    </Badge>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(editingId === goal.id ? null : goal.id)
                      }
                      aria-label={
                        editingId === goal.id ? "Close goal editor" : "Edit goal"
                      }
                      aria-expanded={editingId === goal.id}
                      className={iconEditClass}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                {editingId === goal.id ? (
                  <GoalEditForm
                    goal={goal}
                    onSaved={() => {
                      refetch();
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    {goal.description && (
                      <p className="mb-2 text-sm text-muted">
                        {goal.description}
                      </p>
                    )}
                    {goal.target && (
                      <p className="mb-2 text-sm text-muted">
                        <span className="font-medium text-ink dark:text-paper">
                          Target:
                        </span>{" "}
                        {goal.target}
                      </p>
                    )}
                    <div className="mb-3 flex items-center gap-3">
                      <ProgressBar
                        value={
                          progressDrafts[goal.id] ?? goal.progress_percent ?? 0
                        }
                        label={`Progress for ${goal.title}`}
                        className="flex-1"
                      />
                      <span className="w-10 shrink-0 text-right text-xs text-muted">
                        {progressDrafts[goal.id] ?? goal.progress_percent ?? 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={progressDrafts[goal.id] ?? goal.progress_percent ?? 0}
                      onChange={(e) =>
                        setProgressDrafts((drafts) => ({
                          ...drafts,
                          [goal.id]: Number(e.target.value),
                        }))
                      }
                      onPointerUp={() => commitProgress(goal)}
                      onBlur={() => commitProgress(goal)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitProgress(goal);
                      }}
                      aria-label={`Progress for ${goal.title}`}
                      className="mb-3 w-full accent-accent"
                    />
                    <p className="mb-3 text-xs text-muted">
                      {goal.category && (
                        <span className="capitalize">{goal.category}</span>
                      )}
                      {goal.due_date && (
                        <>
                          {goal.category && " · "}Due {formatDate(goal.due_date)}
                        </>
                      )}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={goal.status}
                        onChange={(e) => updateStatus(goal.id, e.target.value)}
                        aria-label={`Status for ${goal.title}`}
                        className={controlSmallClass}
                      >
                        {GOAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                      <Button variant="danger" onClick={() => deleteGoal(goal.id)}>
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
