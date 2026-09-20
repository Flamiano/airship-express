"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Search } from "lucide-react";
import { StatTile } from "@/performance-development-dashboard/components/ui/StatTile";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  GoalCreateInput,
  GoalUpdateInput,
  GoalWeightContext,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import {
  PERFORMANCE_GOAL_STATUSES,
  PERFORMANCE_GOAL_STATUS_LABELS,
} from "@/performance-development-dashboard/types";
import { useGoalApi } from "@/performance-development-dashboard/hooks/useGoalApi";
import { GoalCard } from "@/performance-development-dashboard/components/goals/GoalCard";
import { CreateGoalModal } from "@/performance-development-dashboard/components/goals/CreateGoalModal";
import { GoalDetailModal } from "@/performance-development-dashboard/components/goals/GoalDetailModal";

type Props = {
  serverUser: CurrentPerDevUser;
  actorType: "hr_admin" | "manager" | "employee";
  initialGoals: PerformanceGoal[];
  initialError?: string;
  cycles: PerformanceCycle[];
  employees: EmployeeOption[];
  cycleNamesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  defaultCycleId?: string;
};

export function GoalsManagement({
  serverUser,
  actorType,
  initialGoals,
  initialError,
  cycles,
  employees,
  cycleNamesById,
  employeeNamesById,
  defaultCycleId,
}: Props) {
  const api = useGoalApi();
  const listGoals = api.list;

  const isHrAdmin = actorType === "hr_admin";
  const isManager = actorType === "manager";
  const canCreateGoals = isHrAdmin || isManager;
  const showEmployeeFilter = isHrAdmin || isManager;

  const resolvedEmployeeNamesById = useMemo(() => {
    const names = { ...employeeNamesById };
    for (const employee of employees) {
      names[employee.id] = employee.name;
    }
    return names;
  }, [employeeNamesById, employees]);

  const UNKNOWN_EMPLOYEE = "Unknown employee";

  function resolveEmployeeName(
    employeeId: string | null | undefined
  ): string {
    if (!employeeId) return UNKNOWN_EMPLOYEE;
    return resolvedEmployeeNamesById[employeeId] ?? UNKNOWN_EMPLOYEE;
  }

  function resolveCycleName(
    cycleId: string | null | undefined
  ): string | undefined {
    if (!cycleId) return undefined;
    return (
      cycleNamesById[cycleId] ??
      cycles.find((cycle) => cycle.id === cycleId)?.name ??
      "Unknown cycle"
    );
  }

  /**
   * Assigner display name for a goal. Prefers the account-identity name
   * (audit actor; e.g. the HR Admin account that assigned the goal) when one
   * exists, otherwise falls back to the employee-layer `assigned_by` name.
   * Mirrors the detail modal behaviour.
   */
  function resolveAssignedByName(goal: PerformanceGoal): string {
    if (goal.assignedByAccountName?.trim()) {
      return goal.assignedByAccountName;
    }
    return resolveEmployeeName(goal.assigned_by);
  }

  const [goals, setGoals] = useState<PerformanceGoal[]>(initialGoals);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | PerformanceGoalStatus
  >("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const selectedGoal =
    goals.find((goal) => goal.id === selectedGoalId) ?? null;

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return goals.filter((goal) => {
      if (statusFilter && goal.status !== statusFilter) return false;
      if (isHrAdmin && employeeFilter && goal.employee_id !== employeeFilter) {
        return false;
      }
      if (isHrAdmin && cycleFilter && goal.cycle_id !== cycleFilter) {
        return false;
      }
      if (!query) return true;
      const employeeName = (
        resolvedEmployeeNamesById[goal.employee_id] ?? ""
      ).toLowerCase();
      return (
        goal.title.toLowerCase().includes(query) ||
        (goal.description ?? "").toLowerCase().includes(query) ||
        employeeName.includes(query)
      );
    });
  }, [
    goals,
    search,
    statusFilter,
    employeeFilter,
    cycleFilter,
    isHrAdmin,
    resolvedEmployeeNamesById,
  ]);

  const counts = useMemo(
    () => ({
      total: displayed.length,
      inProgress: displayed.filter((goal) => goal.status === "in_progress")
        .length,
      pendingCompletion: displayed.filter(
        (goal) => goal.status === "pending_completion"
      ).length,
      completed: displayed.filter((goal) => goal.status === "completed").length,
    }),
    [displayed]
  );

  const loadGoals = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (isHrAdmin && employeeFilter) params.employee_id = employeeFilter;
    if (isHrAdmin && cycleFilter) params.cycle_id = cycleFilter;
    try {
      const fresh = await listGoals(params);
      setGoals(fresh);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load performance goals."
      );
    }
  }, [listGoals, isHrAdmin, statusFilter, employeeFilter, cycleFilter]);

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void loadGoals();
  }, [loadGoals]);

  /**
   * DISPLAY-ONLY Goal Setting helper. Reuses the existing goals list endpoint
   * (employee-scoped; cycle-scoped when a cycle is chosen) to summarise the
   * weights already recorded. It performs no writes and does not validate or
   * enforce the 100% rule — that stays server-side in appraisal scoring.
   */
  const loadWeightContext = useCallback(
    async ({
      employeeId,
      cycleId,
    }: {
      employeeId: string;
      cycleId: string | null;
    }): Promise<GoalWeightContext> => {
      const params: Record<string, string> = { employee_id: employeeId };
      if (cycleId) params.cycle_id = cycleId;
      const fresh = await listGoals(params);
      return {
        goalCount: fresh.length,
        weightTotal: fresh.reduce(
          (total, goal) => total + (goal.weight ?? 0),
          0
        ),
      };
    },
    [listGoals]
  );

  async function handleCreate(input: GoalCreateInput) {
    setCreating(true);
    try {
      const goal = await api.create(input);
      setCreateOpen(false);
      toast.success(`Goal "${goal.title}" created and assigned.`);
      await loadGoals();
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string, input: GoalUpdateInput) {
    await api.update(id, input);
    toast.success("Goal updated.");
    await loadGoals();
  }

  async function handleProgress(id: string, progressPercent: number) {
    const next = await api.runAction(id, "progress", () =>
      api.progress(id, { progress_percent: progressPercent })
    );
    toast.success(`Progress updated to ${next.progress_percent}%.`);
    await loadGoals();
  }

  async function handleSubmit(id: string) {
    const next = await api.runAction(id, "submit", () => api.submit(id));
    toast.success(`Goal "${next.title}" submitted for review.`);
    await loadGoals();
  }

  async function handleMarkCompleted(id: string) {
    const next = await api.runAction(id, "complete", () =>
      api.update(id, { status: "completed" })
    );
    toast.success(`Goal "${next.title}" marked complete.`);
    await loadGoals();
  }

  function handleFilterChange(overrides: Record<string, string>) {
    if (overrides.status !== undefined) {
      setStatusFilter(overrides.status as "" | PerformanceGoalStatus);
    }
    if (overrides.employee_id !== undefined) {
      setEmployeeFilter(overrides.employee_id);
    }
    if (overrides.cycle_id !== undefined) {
      setCycleFilter(overrides.cycle_id);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadGoals();
      setError(null);
      toast.success("Performance goals refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  function resetFilters() {
    handleFilterChange({ status: "", employee_id: "", cycle_id: "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Goals
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {isHrAdmin
              ? `Hello ${firstName}. Goal Setting defines what each employee is expected to accomplish; Goal Execution tracks how much of it has actually been accomplished.`
              : isManager
                ? `Hello ${firstName}. Set goals for your team and track their execution progress.`
                : `Hello ${firstName}. Review what you are expected to accomplish, then record your Goal Execution progress.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          {canCreateGoals && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Set a goal
            </button>
          )}
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total goals" value={counts.total} tone="bg-accent-dark" />
        <StatTile label="In progress" value={counts.inProgress} tone="bg-accent" />
        <StatTile
          label="Pending review"
          value={counts.pendingCompletion}
          tone="bg-ink"
        />
        <StatTile label="Completed" value={counts.completed} tone="bg-emerald-600" />
      </div>

      <FilterBar>
        <label className="relative block min-w-[200px] flex-1 sm:flex-none sm:w-[240px]">
          <span className="sr-only">Search goals</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search goals..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => void handleFilterChange({ status: e.target.value })}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            <option value="">All statuses</option>
            {PERFORMANCE_GOAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PERFORMANCE_GOAL_STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          {showEmployeeFilter && (
            <select
              value={employeeFilter}
              onChange={(e) =>
                void handleFilterChange({ employee_id: e.target.value })
              }
              className="max-w-[220px] rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          )}

          {isHrAdmin && (
            <select
              value={cycleFilter}
              onChange={(e) =>
                void handleFilterChange({ cycle_id: e.target.value })
              }
              className="max-w-[220px] rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            >
              <option value="">All cycles</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </select>
          )}

          {(statusFilter || employeeFilter || cycleFilter) && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </FilterBar>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <p className="text-[13px] font-medium text-red-600">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <SkeletonList rows={3} />
        </div>
      ) : displayed.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {goals.length > 0 ? "No matching goals" : "No goals set yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {isHrAdmin
              ? "Set your first goal to define an expected outcome for an employee within a performance cycle."
              : isManager
                ? "Set goals for your team to define expected outcomes within a performance cycle."
                : "You have no assigned goals yet. Check back once your team sets one."}
          </p>
          {canCreateGoals && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Create your first goal
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              employeeName={
                isHrAdmin || isManager ? resolveEmployeeName(goal.employee_id) : undefined
              }
              assignedByName={resolveAssignedByName(goal)}
              cycleName={resolveCycleName(goal.cycle_id)}
              isHrAdmin={isHrAdmin}
              isManager={isManager}
              busy={api.busy}
              onDetail={() => setSelectedGoalId(goal.id)}
              onMarkCompleted={isHrAdmin ? handleMarkCompleted : undefined}
            />
          ))}
        </div>
      )}

      {createOpen && canCreateGoals && (
        <CreateGoalModal
          employees={employees}
          cycles={cycles}
          defaultCycleId={defaultCycleId}
          assignerDisplayName={serverUser.fullName}
          onLoadWeightContext={loadWeightContext}
          submitting={creating}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          isHrAdmin={isHrAdmin}
          isManager={isManager}
          assignedToName={resolveEmployeeName(selectedGoal.employee_id)}
          assignedByEmployeeName={resolveEmployeeName(selectedGoal.assigned_by)}
          assignedByAccountName={selectedGoal.assignedByAccountName ?? null}
          cycleName={resolveCycleName(selectedGoal.cycle_id)}
          employees={employees}
          cycles={cycles}
          busy={api.busy}
          onClose={() => setSelectedGoalId(null)}
          onProgress={handleProgress}
          onSubmit={handleSubmit}
          onMarkCompleted={handleMarkCompleted}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}