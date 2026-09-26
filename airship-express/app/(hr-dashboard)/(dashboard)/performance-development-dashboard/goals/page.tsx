"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  DataTableRow,
  DetailRow,
  EmptyState,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
  StatCard,
  TableActions,
  TableCell,
  controlSmallClass,
  errorTextClass,
  inputClass,
  selectClass,
  textareaClass,
} from "../components/ui";
import { ApiError } from "../lib/api-error";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { formatDate, todayManila } from "../lib/datetime";
import { CalendarClock, Eye, Pencil, Target, Trash2 } from "lucide-react";
import { useHrAuth } from "../lib/hr-auth";
import { useDirectory } from "../lib/directory";
import { toast } from "sonner";
import type { DirectoryUser } from "../lib/types";

type Goal = {
  id: string;
  employee_id: string | null;
  assigned_by: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  target: string | null;
  due_date: string | null;
  progress_percent: number | null;
  status: string;
};

type Competency = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

type GoalCompetencyLink = {
  id: string;
  goal_id: string;
  competency_id: string;
  created_at: string;
  created_by: string | null;
  hr3_competencies: { name: string; category: string | null } | null;
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

function isOverdue(goal: Goal) {
  return (
    !!goal.due_date &&
    goal.status !== "completed" &&
    goal.due_date < todayManila()
  );
}

type GoalFormProps = {
  isAdmin: boolean;
  directory: DirectoryUser[];
  competencies: Competency[];
  selectedCompetencyIds: string[];
  onCompetencyIdsChange: (ids: string[]) => void;
  onSaveCompetencyLinks: (goalId: string, competencyIds: string[]) => Promise<void>;
  onGoalCreated: () => void;
  onCancel: () => void;
};

function GoalForm({
  isAdmin,
  directory,
  competencies,
  selectedCompetencyIds,
  onCompetencyIdsChange,
  onSaveCompetencyLinks,
  onGoalCreated,
  onCancel,
}: GoalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("individual");
  const [priority, setPriority] = useState("medium");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const createGoal = useApiMutation({
    path: "goals",
    method: "POST",
    onSuccess: () => {
      setFieldErrors({});
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload: Record<string, unknown> = {
      title,
      description,
      category,
      priority,
      target,
      due_date: dueDate || null,
    };
    if (isAdmin && employeeId) {
      payload.employee_id = employeeId;
    }
    const result = await createGoal.submit(payload);
    const submitError = result.error;
    if (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(
            submitError.fieldErrors.map((f) => [f.field, f.message])
          )
        );
        toast.error(
          submitError.fieldErrors.length > 0
            ? "Failed to create goal. Please check the form and try again."
            : "Failed to create goal. Please try again."
        );
      } else {
        toast.error("Failed to create goal. Please try again.");
      }
      return;
    }

    const goalData = (result.data ?? null) as { goal?: { id?: string } } | null;
    if (goalData?.goal?.id && selectedCompetencyIds.length > 0) {
      await onSaveCompetencyLinks(goalData.goal.id, selectedCompetencyIds);
      onCompetencyIdsChange([]);
    }

    setTitle("");
    setDescription("");
    setTarget("");
    setDueDate("");
    setEmployeeId("");
    onGoalCreated();
    onCancel();
    toast.success("Goal created successfully.");
  }

  function toggleCompetency(id: string) {
    if (selectedCompetencyIds.includes(id)) {
      onCompetencyIdsChange(
        selectedCompetencyIds.filter((c) => c !== id)
      );
    } else {
      onCompetencyIdsChange([...selectedCompetencyIds, id]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {isAdmin && directory.length > 0 && (
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          aria-label="Assign goal to employee"
          className={selectClass}
        >
          <option value="">Myself</option>
          {directory.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.jobTitle}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        placeholder="Goal title"
        aria-label="Goal title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      {fieldErrors.title && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.title}
        </p>
      )}
      <textarea
        placeholder="Description (optional)"
        aria-label="Goal description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      {fieldErrors.description && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.description}
        </p>
      )}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Goal category"
        className={selectClass}
      >
        <option value="individual">Individual</option>
        <option value="department">Department</option>
        <option value="company">Company</option>
      </select>
      <div className="flex gap-3">
        <input
          type="date"
          aria-label="Due date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        {fieldErrors.due_date && (
          <p className={errorTextClass} role="alert">
            {fieldErrors.due_date}
          </p>
        )}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
          className={`${selectClass} min-w-0 flex-1`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <input
        type="text"
        placeholder="Target (e.g. 25 packages/day)"
        aria-label="Goal target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={inputClass}
      />
      {fieldErrors.target && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.target}
        </p>
      )}
      {isAdmin && competencies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Competencies
          </p>
          <div className="flex flex-wrap gap-1.5">
            {competencies.map((c) => {
              const active = selectedCompetencyIds.includes(c.id);
              return (
                <Chip
                  key={c.id}
                  active={active}
                  onClick={() => toggleCompetency(c.id)}
                >
                  {c.name}
                </Chip>
              );
            })}
          </div>
          {selectedCompetencyIds.length === 0 && (
            <p className="text-xs text-muted">No competencies linked</p>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={createGoal.submitting}>
          {createGoal.submitting ? "Saving…" : "Create Goal"}
        </Button>
      </div>
    </form>
  );
}

type GoalEditFormProps = {
  goal: Goal;
  isAdmin: boolean;
  directory: DirectoryUser[];
  competencies: Competency[];
  selectedCompetencyIds: string[];
  onCompetencyIdsChange: (ids: string[]) => void;
  onSaveCompetencyLinks: (goalId: string, competencyIds: string[]) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
};

function GoalEditForm({
  goal,
  isAdmin,
  directory,
  competencies,
  selectedCompetencyIds,
  onCompetencyIdsChange,
  onSaveCompetencyLinks,
  onSaved,
  onCancel,
}: GoalEditFormProps) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [category, setCategory] = useState(goal.category ?? "individual");
  const [priority, setPriority] = useState(goal.priority ?? "medium");
  const [target, setTarget] = useState(goal.target ?? "");
  const [dueDate, setDueDate] = useState(goal.due_date ?? "");
  const [employeeId, setEmployeeId] = useState(goal.employee_id ?? "");
  const [status, setStatus] = useState(goal.status);
  const [progress, setProgress] = useState(goal.progress_percent ?? 0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateGoal = useApiMutation({
    path: "goals",
    method: "PUT",
    onSuccess: () => {
      setFieldErrors({});
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const payload: Record<string, unknown> = {
      id: goal.id,
      title,
      description,
      category,
      priority,
      target,
      due_date: dueDate || null,
      status,
      progress_percent: progress,
    };
    if (isAdmin) {
      payload.employee_id = employeeId || null;
    }
    const result = await updateGoal.submit(payload);
    const submitError = result.error;
    if (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(
            submitError.fieldErrors.map((f) => [f.field, f.message])
          )
        );
        toast.error(
          submitError.fieldErrors.length > 0
            ? "Failed to update goal. Please check the form and try again."
            : "Failed to update goal. Please try again."
        );
      } else {
        toast.error("Failed to update goal. Please try again.");
      }
      return;
    }

    if (selectedCompetencyIds) {
      await onSaveCompetencyLinks(goal.id, selectedCompetencyIds);
    }

    onSaved();
    toast.success("Goal updated successfully.");
  }

  function toggleCompetency(id: string) {
    if (selectedCompetencyIds.includes(id)) {
      onCompetencyIdsChange(
        selectedCompetencyIds.filter((c) => c !== id)
      );
    } else {
      onCompetencyIdsChange([...selectedCompetencyIds, id]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {isAdmin && directory.length > 0 && (
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          aria-label="Assign goal to employee"
          className={selectClass}
        >
          <option value="">Myself</option>
          {directory.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.jobTitle}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="Goal title"
        className={inputClass}
      />
      {fieldErrors.title && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.title}
        </p>
      )}
      <textarea
        placeholder="Description (optional)"
        aria-label="Goal description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      {fieldErrors.description && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.description}
        </p>
      )}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Goal category"
        className={selectClass}
      >
        <option value="individual">Individual</option>
        <option value="department">Department</option>
        <option value="company">Company</option>
      </select>
      <div className="flex gap-3">
        <input
          type="date"
          aria-label="Due date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
          className={`${selectClass} min-w-0 flex-1`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      {fieldErrors.due_date && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.due_date}
        </p>
      )}
      <input
        type="text"
        placeholder="Target (e.g. 25 packages/day)"
        aria-label="Goal target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={inputClass}
      />
      {fieldErrors.target && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.target}
        </p>
      )}
      {isAdmin && competencies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Competencies
          </p>
          <div className="flex flex-wrap gap-1.5">
            {competencies.map((c) => {
              const active = selectedCompetencyIds.includes(c.id);
              return (
                <Chip
                  key={c.id}
                  active={active}
                  onClick={() => toggleCompetency(c.id)}
                >
                  {c.name}
                </Chip>
              );
            })}
          </div>
          {selectedCompetencyIds.length === 0 && (
            <p className="text-xs text-muted">No competencies linked</p>
          )}
        </div>
      )}
      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
          className={selectClass}
        >
          {GOAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            aria-label="Progress percent"
            className="min-w-0 flex-1 accent-accent"
          />
          <span className="w-10 shrink-0 text-right text-xs text-muted">
            {progress}%
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={updateGoal.submitting}>
          {updateGoal.submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function GoalsPage() {
  const { isAdmin } = useHrAuth();
  const { directory, getDirectoryUser } = useDirectory();
  const [isCreateGoalModalOpen, setIsCreateGoalModalOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sortBy, setSortBy] = useState<"due_date" | "priority" | "title">(
    "due_date"
  );
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);
  const [confirmingDeleteGoal, setConfirmingDeleteGoal] = useState<Goal | null>(
    null
  );
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>(
    []
  );

  const CREATE_GOAL_TITLE_ID = "create-goal-title";

  const {
    data: goals,
    loading,
    error,
    refetch,
  } = useApiResource<Goal>({
    path: "goals",
    listKey: "goals",
    errorMessage: "Could not load goals. Please try again.",
  });

  const { data: competencies } = useApiResource<Competency>({
    path: "competency",
    listKey: "competencies",
  });

  const {
    data: goalCompetencyLinks,
    refetch: refetchGoalCompetencies,
  } = useApiResource<GoalCompetencyLink>({
    path: "goal-competencies",
    listKey: "goal_competencies",
  });

  const goalCompetencyMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of goalCompetencyLinks) {
      const list = map.get(link.goal_id) ?? [];
      list.push(link.competency_id);
      map.set(link.goal_id, list);
    }
    return map;
  }, [goalCompetencyLinks]);

  const saveCompetencyMutation = useApiMutation({
    path: "goal-competencies",
    method: "PUT",
    onSuccess: () => {
      refetchGoalCompetencies();
    },
  });

  async function saveCompetencyLinks(goalId: string, competencyIds: string[]) {
    await saveCompetencyMutation.submit({
      goal_id: goalId,
      competency_ids: competencyIds,
    });
  }

  const deleteGoalMutation = useApiMutation({
    path: "goals",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingDeleteGoal(null);
      refetch();
    },
  });

  async function confirmDeleteGoal(id: string) {
    const { error: submitError } = await deleteGoalMutation.submit(null, {
      id,
    });
    if (!submitError) {
      toast.success("Goal deleted successfully.");
      setConfirmingDeleteGoal(null);
    } else {
      toast.error("Failed to delete goal. Please try again.");
    }
  }

  const filteredGoals = goals
    .filter((goal) => {
      if (filter === "overdue") return isOverdue(goal);
      if (filter === "all") return true;
      return goal.status === filter;
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "priority")
        return priorityRank(a.priority) - priorityRank(b.priority);
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

  function getLinkedCompetencies(goalId: string): GoalCompetencyLink[] {
    return goalCompetencyLinks.filter((l) => l.goal_id === goalId);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Goals"
        subtitle="Track your objectives, update progress, and keep your manager in the loop."
        actions={
          <Button onClick={() => setIsCreateGoalModalOpen(true)}>
            New Goal
          </Button>
        }
      />

      <Modal
        open={isCreateGoalModalOpen}
        onClose={() => setIsCreateGoalModalOpen(false)}
        title="Create Goal"
        titleId={CREATE_GOAL_TITLE_ID}
      >
        <GoalForm
          isAdmin={isAdmin}
          directory={directory}
          competencies={competencies}
          selectedCompetencyIds={selectedCompetencyIds}
          onCompetencyIdsChange={setSelectedCompetencyIds}
          onSaveCompetencyLinks={saveCompetencyLinks}
          onGoalCreated={refetch}
          onCancel={() => setIsCreateGoalModalOpen(false)}
        />
      </Modal>

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
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "due_date" | "priority" | "title")
              }
              aria-label="Sort goals"
              className={controlSmallClass}
            >
              <option value="due_date">Due date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      )}

      {!loading && goals.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description={'Click "New Goal" above to create your first goal.'}
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
        <DataTable columns={["Goal", "Priority", "Status", "Due", "Progress", ""]}>
          {filteredGoals.map((goal) => {
            const displayProgress = goal.progress_percent ?? 0;
            const linked = getLinkedCompetencies(goal.id);
            return (
              <DataTableRow key={goal.id}>
                <TableCell>
                  <div className="max-w-xs">
                    <p className="truncate font-medium text-ink dark:text-paper">
                      {goal.title}
                    </p>
                    {(() => {
                      const owner = getDirectoryUser(goal.employee_id);
                      if (!owner) return null;
                      return (
                        <p className="truncate text-xs text-muted">
                          {owner.name}
                          {owner.jobTitle && ` · ${owner.jobTitle}`}
                        </p>
                      );
                    })()}
                    {linked.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {linked.map((l) => (
                          <Badge key={l.id} variant="neutral">
                            {l.hr3_competencies?.name ?? "Unknown"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isOverdue(goal) && <Badge variant="danger">Overdue</Badge>}
                    {goal.priority && (
                      <Badge variant={priorityVariant(goal.priority)}>
                        {priorityLabel(goal.priority)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(goal.status)}>
                    {statusLabel(goal.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {goal.due_date ? (
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        isOverdue(goal)
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-muted"
                      }`}
                    >
                      <CalendarClock size={12} />
                      {formatDate(goal.due_date)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={displayProgress}
                      label={`Progress for ${goal.title}`}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-xs text-muted">
                      {displayProgress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <TableActions
                    actions={[
                      {
                        label: "View",
                        icon: <Eye size={14} />,
                        onClick: () => setViewingGoal(goal),
                      },
                      {
                        label: "Edit",
                        icon: <Pencil size={14} />,
                        onClick: () => {
                          setEditingGoal(goal);
                          setSelectedCompetencyIds(
                            goalCompetencyMap.get(goal.id) ?? []
                          );
                        },
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => setConfirmingDeleteGoal(goal),
                      },
                    ]}
                  />
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      {/* View details */}
      <Modal
        open={!!viewingGoal}
        onClose={() => setViewingGoal(null)}
        title="Goal Details"
        size="lg"
      >
        {viewingGoal && (
          <dl className="divide-y divide-line dark:divide-paper/15">
            <div className="pb-4">
              <p className="font-bricolage text-lg font-semibold text-ink dark:text-paper">
                {viewingGoal.title}
              </p>
              {(() => {
                const owner = getDirectoryUser(viewingGoal.employee_id);
                if (!owner) return null;
                return (
                  <p className="mt-0.5 text-xs text-muted">
                    {owner.name}
                    {owner.jobTitle && ` · ${owner.jobTitle}`}
                  </p>
                );
              })()}
            </div>
            <DetailRow
              label="Status"
              value={
                <Badge variant={statusVariant(viewingGoal.status)}>
                  {statusLabel(viewingGoal.status)}
                </Badge>
              }
            />
            <DetailRow
              label="Priority"
              value={
                viewingGoal.priority ? (
                  <Badge variant={priorityVariant(viewingGoal.priority)}>
                    {priorityLabel(viewingGoal.priority)}
                  </Badge>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Category"
              value={
                viewingGoal.category ? (
                  <span className="capitalize">{viewingGoal.category}</span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Due date"
              value={
                viewingGoal.due_date
                  ? `${formatDate(viewingGoal.due_date)}${
                      isOverdue(viewingGoal) ? " (overdue)" : ""
                    }`
                  : "—"
              }
            />
            <DetailRow
              label="Target"
              value={viewingGoal.target ?? "—"}
            />
            <DetailRow
              label="Competencies"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {getLinkedCompetencies(viewingGoal.id).map((l) => (
                    <Badge key={l.id} variant="neutral">
                      {l.hr3_competencies?.name ?? "Unknown"}
                    </Badge>
                  ))}
                  {getLinkedCompetencies(viewingGoal.id).length === 0 && (
                    <span className="text-muted">None</span>
                  )}
                </div>
              }
            />
            <div className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Progress
              </p>
              <div className="flex items-center gap-3">
                <ProgressBar
                  value={viewingGoal.progress_percent ?? 0}
                  label={`Progress for ${viewingGoal.title}`}
                  className="flex-1"
                />
                <span className="w-10 shrink-0 text-right text-xs text-muted">
                  {viewingGoal.progress_percent ?? 0}%
                </span>
              </div>
            </div>
            {viewingGoal.description && (
              <div className="pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink dark:text-paper">
                  {viewingGoal.description}
                </p>
              </div>
            )}
          </dl>
        )}
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editingGoal}
        onClose={() => setEditingGoal(null)}
        title="Edit Goal"
        size="md"
      >
        {editingGoal && (
          <GoalEditForm
            goal={editingGoal}
            isAdmin={isAdmin}
            directory={directory}
            competencies={competencies}
            selectedCompetencyIds={selectedCompetencyIds}
            onCompetencyIdsChange={setSelectedCompetencyIds}
            onSaveCompetencyLinks={saveCompetencyLinks}
            onSaved={() => {
              refetch();
              refetchGoalCompetencies();
              setEditingGoal(null);
            }}
            onCancel={() => setEditingGoal(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmingDeleteGoal}
        onClose={() => setConfirmingDeleteGoal(null)}
        title="Delete Goal"
        size="sm"
      >
        <p className="text-sm text-muted">
          Delete this goal? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() =>
              confirmingDeleteGoal && confirmDeleteGoal(confirmingDeleteGoal.id)
            }
            loading={deleteGoalMutation.submitting}
          >
            {deleteGoalMutation.submitting ? "Deleting…" : "Confirm Delete"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDeleteGoal(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
