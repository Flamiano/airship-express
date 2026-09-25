"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, Search } from "lucide-react";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformanceTabs,
} from "@/performance-development-dashboard/components/ui/performance";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  GoalApprovalStatus,
  GoalCreateInput,
  GoalProposalInput,
  GoalReviewInput,
  GoalUpdateInput,
  GoalWeightContext,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import {
  GOAL_APPROVAL_STATUSES,
  GOAL_APPROVAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUSES,
  PERFORMANCE_GOAL_STATUS_LABELS,
} from "@/performance-development-dashboard/types";
import { useGoalApi } from "@/performance-development-dashboard/hooks/useGoalApi";
import { GoalCard } from "@/performance-development-dashboard/components/goals/GoalCard";
import { CreateGoalModal } from "@/performance-development-dashboard/components/goals/CreateGoalModal";
import { GoalDetailModal } from "@/performance-development-dashboard/components/goals/GoalDetailModal";
import { ProposeGoalModal } from "@/performance-development-dashboard/components/goals/ProposeGoalModal";
import {
  ApproveProposalDialog,
  RejectProposalDialog,
  ReturnProposalDialog,
} from "@/performance-development-dashboard/components/goals/ProposalReviewDialogs";

type Props = {
  serverUser: CurrentPerDevUser;
  actorType: "hr_admin" | "manager" | "employee";
  /**
   * Server-resolved PerDev HR Admin flag (super_admin /
   * hr_performance_admin). actorType alone is not sufficient: non-PerDev HR
   * roles share actorType "hr_admin" but are denied by every goal API.
   */
  isPerDevHrAdmin: boolean;
  initialGoals: PerformanceGoal[];
  initialError?: string;
  cycles: PerformanceCycle[];
  employees: EmployeeOption[];
  cycleNamesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  defaultCycleId?: string;
  /**
   * Distinct department names for the HR department picker (derived
   * server-side from the employee roster). Empty for non-HR roles.
   */
  departments: string[];
  /**
   * Authenticated employee UUID for proposal ownership and review-queue
   * partitioning. Null for HR Admin accounts without a linked employee.
   */
  actorEmployeeId?: string | null;
  /**
   * Server-derived permission to show the proposal entry point. Managers/HR
   * keep the official creation flow; non-PerDev HR (which falls through to
   * the employee view) must never receive it.
   */
  canProposeGoal?: boolean;
};

const UNKNOWN_EMPLOYEE = "Unknown employee";

export function GoalsManagement({
  serverUser,
  actorType,
  isPerDevHrAdmin,
  initialGoals,
  initialError,
  cycles,
  employees,
  cycleNamesById,
  employeeNamesById,
  defaultCycleId,
  departments,
  actorEmployeeId = null,
  canProposeGoal = actorType === "employee",
}: Props) {
  const api = useGoalApi();
  const listGoals = api.list;
  const searchParams = useSearchParams();

  const isHrAdmin = isPerDevHrAdmin;
  const isManager = actorType === "manager";
  const canCreateGoals = isHrAdmin || isManager;
  // Employee-only proposal entry point. Managers/HR keep the official
  // creation flow (their goals are approved immediately); the proposal
  // endpoints remain available at the API layer for self-proposals.
  const canProposeGoals = canProposeGoal && !isHrAdmin && !isManager;
  const canReviewProposals = isHrAdmin || isManager;
  const showEmployeeFilter = isHrAdmin || isManager;

  const resolvedEmployeeNamesById = useMemo(() => {
    const names = { ...employeeNamesById };
    for (const employee of employees) {
      names[employee.id] = employee.name;
    }
    return names;
  }, [employeeNamesById, employees]);

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
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposalEditing, setProposalEditing] =
    useState<PerformanceGoal | null>(null);
  const [proposing, setProposing] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{
    action: "approve" | "return" | "reject";
    goal: PerformanceGoal;
  } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewWeightContext, setReviewWeightContext] =
    useState<GoalWeightContext | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | PerformanceGoalStatus
  >("");
  // Approval filter is a secondary client-side filter over the
  // server-authorized list; it never widens scope.
  const [approvalFilter, setApprovalFilter] = useState<"" | GoalApprovalStatus>(
    ""
  );
  // Goal scope: "team" (manager self + direct reports) and "organization"
  // (HR org-wide) reproduce the historical defaults by sending no scope
  // param; "my" and "department" are explicit server-enforced scopes.
  const [scope, setScope] = useState(
    isHrAdmin ? "organization" : isManager ? "team" : "my"
  );
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const scopeOptions = isHrAdmin
    ? [
        { key: "organization", label: "Organization" },
        { key: "department", label: "Department" },
        { key: "my", label: "My" },
      ]
    : isManager
      ? [
          { key: "team", label: "Team" },
          { key: "my", label: "My" },
          { key: "department", label: "Department" },
        ]
      : [
          { key: "my", label: "My" },
          { key: "department", label: "Department" },
        ];

  function handleScopeChange(value: string) {
    setScope(value);
    // Default the HR department picker on entry; cleared when leaving.
    if (value === "department" && isHrAdmin && departments.length > 0) {
      setDepartmentFilter((previous) => previous || departments[0]);
    } else {
      setDepartmentFilter("");
    }
  }

  const selectedGoal =
    goals.find((goal) => goal.id === selectedGoalId) ?? null;

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return goals.filter((goal) => {
      if (statusFilter && goal.status !== statusFilter) return false;
      if (approvalFilter && (goal.approval_status ?? "approved") !== approvalFilter) {
        return false;
      }
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
    approvalFilter,
    employeeFilter,
    cycleFilter,
    isHrAdmin,
    resolvedEmployeeNamesById,
  ]);

  /**
   * Review queue (manager/HR only): pending proposals owned by someone else,
   * drawn from the already server-scoped list — never widened. For managers
   * this is active direct reports' proposals; for HR it is organization-wide.
   */
  const pendingReviewQueue = useMemo(() => {
    if (!canReviewProposals) return [];
    return goals.filter(
      (goal) =>
        (goal.approval_status ?? "approved") === "pending_manager_approval" &&
        goal.employee_id !== actorEmployeeId
    );
  }, [goals, canReviewProposals, actorEmployeeId]);

  const loadGoals = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (isHrAdmin && employeeFilter) params.employee_id = employeeFilter;
    if (isHrAdmin && cycleFilter) params.cycle_id = cycleFilter;
    if (scope === "my" || scope === "department") {
      params.scope = scope;
      if (scope === "department" && isHrAdmin && departmentFilter) {
        params.department = departmentFilter;
      }
    }
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
  }, [listGoals, isHrAdmin, statusFilter, employeeFilter, cycleFilter, scope, departmentFilter]);

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

  async function handleProgress(
    id: string,
    input:
      | { progress_percent: number; note?: string | null }
      | { actual_value: number; note?: string | null }
  ) {
    const next = await api.runAction(id, "progress", () =>
      api.progress(id, input)
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

  async function handlePropose(input: GoalProposalInput) {
    setProposing(true);
    try {
      const goal = await api.proposeGoal(input);
      setProposeOpen(false);
      toast.success(
        `Proposal "${goal.title}" saved as a draft. Submit it for manager review when ready.`
      );
      await loadGoals();
      setSelectedGoalId(goal.id);
    } finally {
      setProposing(false);
    }
  }

  async function handleProposalUpdate(input: GoalProposalInput) {
    if (!proposalEditing) return;
    setProposing(true);
    try {
      const goal = await api.updateProposal(proposalEditing.id, input);
      setProposalEditing(null);
      toast.success("Proposal updated.");
      await loadGoals();
      setSelectedGoalId(goal.id);
    } finally {
      setProposing(false);
    }
  }

  async function handleSubmitProposal(id: string) {
    const next = await api.runAction(id, "submit-proposal", () =>
      api.submitProposal(id)
    );
    toast.success(
      "This goal has been submitted for review."
    );
    await loadGoals();
    setSelectedGoalId(next.id);
  }

  function openReviewDialog(
    action: "approve" | "return" | "reject",
    goal: PerformanceGoal
  ) {
    setReviewWeightContext(null);
    setReviewDialog({ action, goal });
    if (action === "approve") {
      loadWeightContext({
        employeeId: goal.employee_id,
        cycleId: goal.cycle_id,
      })
        .then((context) => setReviewWeightContext(context))
        .catch(() => setReviewWeightContext(null));
    }
  }

  async function handleReviewSubmit(input: GoalReviewInput) {
    if (!reviewDialog) return;
    const { action, goal } = reviewDialog;
    setReviewing(true);
    try {
      const next = await api.runAction(goal.id, action, () =>
        action === "approve"
          ? api.approveProposal(goal.id, input)
          : action === "return"
            ? api.returnProposal(goal.id, input)
            : api.rejectProposal(goal.id, input)
      );
      setReviewDialog(null);
      toast.success(
        action === "approve"
          ? `Goal "${next.title}" approved with a weight of ${next.weight}%.`
          : action === "return"
            ? `Goal "${next.title}" returned for revision.`
            : `Goal "${next.title}" rejected.`
      );
      await loadGoals();
      setSelectedGoalId(next.id);
    } finally {
      setReviewing(false);
    }
  }

  /**
   * Record deep-link: `?goal=<id>` (e.g. from a proposal notification)
   * opens the goal detail directly. Resolution is server-authorized: the
   * row must be present in the scope-filtered list; invalid, missing, or
   * out-of-scope ids surface a neutral message — never the record.
   */
  const deepLinkConsumedRef = useRef<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- query-param driven, scope-filtered record resolution with consumed-id guard */
  useEffect(() => {
    const id = searchParams.get("goal");
    if (!id || deepLinkConsumedRef.current === id) return;
    deepLinkConsumedRef.current = id;
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id.trim()
      )
    ) {
      const found = goals.find((goal) => goal.id === id.trim().toLowerCase());
      if (found) {
        setSelectedGoalId(found.id);
        return;
      }
    }
    setError(
      "That goal is no longer available. It may have been removed or moved outside your current scope."
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleFilterChange(overrides: Record<string, string>) {
    if (overrides.status !== undefined) {
      setStatusFilter(overrides.status as "" | PerformanceGoalStatus);
    }
    if (overrides.approval_status !== undefined) {
      setApprovalFilter(overrides.approval_status as "" | GoalApprovalStatus);
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
    handleFilterChange({
      status: "",
      approval_status: "",
      employee_id: "",
      cycle_id: "",
    });
  }

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Goals"
        description={
          isHrAdmin
            ? `Hello ${firstName}. Goal Setting defines what each employee is expected to accomplish; Goal Execution tracks how much of it has actually been accomplished.`
            : isManager
              ? `Hello ${firstName}. Set goals for your team, review employee goal proposals, and track their execution progress.`
              : `Hello ${firstName}. Review your goals, propose new ones for manager approval, then record your Goal Execution progress.`
        }
        actions={
          <>
            <PerformanceButton
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </PerformanceButton>
            {canProposeGoals && (
              <PerformanceButton onClick={() => setProposeOpen(true)}>
                <Plus size={15} strokeWidth={2} />
                Propose a goal
              </PerformanceButton>
            )}
            {canCreateGoals && (
              <PerformanceButton onClick={() => setCreateOpen(true)}>
                <Plus size={15} strokeWidth={2} />
                Set a goal
              </PerformanceButton>
            )}
          </>
        }
      />

      <PerformanceTabs
        tabs={scopeOptions}
        active={scope}
        onChange={handleScopeChange}
        ariaLabel="Goal scope"
      />

      {canReviewProposals && pendingReviewQueue.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[12.5px] font-medium text-amber-600 dark:text-amber-400">
            {pendingReviewQueue.length} goal proposal
            {pendingReviewQueue.length === 1 ? "" : "s"} awaiting your review.
          </p>
          <button
            type="button"
            onClick={() =>
              handleFilterChange({ approval_status: "pending_manager_approval" })
            }
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
          >
            Show pending proposals
          </button>
        </div>
      )}

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
          {isHrAdmin && scope === "department" && (
            <select
              value={departmentFilter}
              aria-label="Filter by department"
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="max-w-[220px] rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            aria-label="Filter by status"
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            <option value="">All statuses</option>
            {PERFORMANCE_GOAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PERFORMANCE_GOAL_STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            value={approvalFilter}
            aria-label="Filter by approval"
            onChange={(e) =>
              handleFilterChange({ approval_status: e.target.value })
            }
            className="rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            <option value="">All approvals</option>
            {GOAL_APPROVAL_STATUSES.map((approval) => (
              <option key={approval} value={approval}>
                {GOAL_APPROVAL_STATUS_LABELS[approval]}
              </option>
            ))}
          </select>

          {showEmployeeFilter && (
            <select
              value={employeeFilter}
              aria-label="Filter by employee"
              onChange={(e) =>
                handleFilterChange({ employee_id: e.target.value })
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
              aria-label="Filter by cycle"
              onChange={(e) =>
                handleFilterChange({ cycle_id: e.target.value })
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

          {(statusFilter || approvalFilter || employeeFilter || cycleFilter) && (
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
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading goals...</span>
          <SkeletonList rows={3} />
        </div>
      ) : displayed.length === 0 && !error ? (
        <PerformanceEmptyState
          title={goals.length > 0 ? "No matching goals" : "No goals set yet"}
          message={
            goals.length > 0
              ? "Try a different search or filter."
              : isHrAdmin
                ? "Set your first goal to define an expected outcome for an employee within a performance cycle."
                : isManager
                  ? pendingReviewQueue.length > 0
                    ? "Set goals for your team to define expected outcomes within a performance cycle."
                    : "Set goals for your team to define expected outcomes within a performance cycle. No goal proposals are awaiting your review."
                  : "You have no goals yet. Propose your first goal for manager approval."
          }
          action={
            canProposeGoals && goals.length === 0 ? (
              <PerformanceButton
                onClick={() => setProposeOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Propose your first goal
              </PerformanceButton>
            ) : canCreateGoals && goals.length === 0 ? (
              <PerformanceButton
                onClick={() => setCreateOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Create your first goal
              </PerformanceButton>
            ) : undefined
          }
        />
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
          onLoadWeightContext={loadWeightContext}
          actorEmployeeId={actorEmployeeId}
          onEditProposal={() => {
            setSelectedGoalId(null);
            setProposalEditing(selectedGoal);
          }}
          onSubmitProposal={handleSubmitProposal}
          onReviewProposal={(action) =>
            openReviewDialog(action, selectedGoal)
          }
        />
      )}

      {proposeOpen && canProposeGoals && (
        <ProposeGoalModal
          mode="create"
          ownerDisplayName={serverUser.fullName}
          cycles={cycles}
          defaultCycleId={defaultCycleId}
          submitting={proposing}
          onSubmit={handlePropose}
          onClose={() => setProposeOpen(false)}
        />
      )}

      {proposalEditing && canProposeGoals && (
        <ProposeGoalModal
          mode="edit"
          initialGoal={proposalEditing}
          ownerDisplayName={serverUser.fullName}
          cycles={cycles}
          defaultCycleId={defaultCycleId}
          submitting={proposing}
          onSubmit={handleProposalUpdate}
          onClose={() => setProposalEditing(null)}
        />
      )}

      {reviewDialog && canReviewProposals && (
        <>
          {reviewDialog.action === "approve" && (
            <ApproveProposalDialog
              goal={reviewDialog.goal}
              employeeName={resolveEmployeeName(reviewDialog.goal.employee_id)}
              weightContext={reviewWeightContext}
              submitting={reviewing}
              onSubmit={handleReviewSubmit}
              onClose={() => setReviewDialog(null)}
            />
          )}
          {reviewDialog.action === "return" && (
            <ReturnProposalDialog
              goal={reviewDialog.goal}
              employeeName={resolveEmployeeName(reviewDialog.goal.employee_id)}
              submitting={reviewing}
              onSubmit={handleReviewSubmit}
              onClose={() => setReviewDialog(null)}
            />
          )}
          {reviewDialog.action === "reject" && (
            <RejectProposalDialog
              goal={reviewDialog.goal}
              employeeName={resolveEmployeeName(reviewDialog.goal.employee_id)}
              submitting={reviewing}
              onSubmit={handleReviewSubmit}
              onClose={() => setReviewDialog(null)}
            />
          )}
        </>
      )}
    </div>
  );
}