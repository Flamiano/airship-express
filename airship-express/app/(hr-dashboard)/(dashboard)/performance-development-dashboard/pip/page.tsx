"use client";

import { useState } from "react";
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
  SkeletonCards,
  SkeletonRegion,
  StatCard,
  TableActions,
  TableCell,
  errorTextClass,
  inputClass,
  selectClass,
  textareaClass,
} from "../components/ui";
import { useHrAuth } from "../lib/hr-auth";
import { useDirectory } from "../lib/directory";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { formatDate } from "../lib/datetime";
import { usePerformanceContext, PerformanceContext } from "./performance-context";
import { Eye, Pencil, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type PIP = {
  id: string;
  employee_id: string | null;
  reason: string | null;
  action_plan: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const PIP_STATUSES = ["active", "completed", "failed"] as const;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

type PipFormProps = {
  isAdmin: boolean;
  directory: ReturnType<typeof useDirectory>["directory"];
  initial?: PIP;
  onDone: () => void;
  onCancel: () => void;
};

function PipForm({ isAdmin, directory, initial, onDone, onCancel }: PipFormProps) {
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [actionPlan, setActionPlan] = useState(initial?.action_plan ?? "");
  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");

  const mutation = useApiMutation({
    path: "pip",
    method: initial ? "PUT" : "POST",
    onSuccess: onDone,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      reason,
      action_plan: actionPlan,
      start_date: startDate,
      end_date: endDate || null,
    };
    if (initial) {
      payload.id = initial.id;
      payload.status = status;
    }
    const { error: submitError } = await mutation.submit(payload);
    if (submitError) {
      toast.error(
        initial
          ? "Failed to update PIP. Please try again."
          : "Failed to create PIP. Please try again."
      );
      return;
    }
    if (!initial) {
      toast.success("PIP created successfully.");
    } else {
      toast.success("PIP updated successfully.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {isAdmin && (
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
          aria-label="Employee"
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
      )}
      <div className="flex gap-3">
        <input
          type="date"
          aria-label="Start date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className={`${inputClass} flex-1`}
        />
        <input
          type="date"
          aria-label="End date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={`${inputClass} flex-1`}
        />
      </div>
      <input
        type="text"
        placeholder="Reason"
        aria-label="PIP reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        className={inputClass}
      />
      <textarea
        placeholder="Action plan"
        aria-label="Action plan"
        value={actionPlan}
        onChange={(e) => setActionPlan(e.target.value)}
        required
        className={textareaClass}
      />
      {initial && isAdmin && (
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
          className={selectClass}
        >
          {PIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.submitting}>
          {mutation.submitting
            ? initial
              ? "Saving…"
              : "Creating…"
            : initial
              ? "Save Changes"
              : "Create PIP"}
        </Button>
      </div>
    </form>
  );
}

export default function PIPPage() {
  const { isAdmin } = useHrAuth();
  const { directory, getDirectoryUser } = useDirectory();
  const [isCreatePipModalOpen, setIsCreatePipModalOpen] = useState(false);
  const [editingPip, setEditingPip] = useState<PIP | null>(null);
  const [viewingPip, setViewingPip] = useState<PIP | null>(null);
  const [confirmingDeletePip, setConfirmingDeletePip] = useState<PIP | null>(
    null
  );
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  const CREATE_PIP_TITLE_ID = "create-pip-title";

  const {
    data: pips,
    loading,
    error,
    refetch,
  } = useApiResource<PIP>({
    path: "pip",
    listKey: "pips",
    errorMessage: "Could not load PIPs. Please try again.",
  });

  const performanceContext = usePerformanceContext();

  const stats = [
    { label: "Total", value: pips.length },
    { label: "Active", value: pips.filter((p) => p.status === "active").length },
    { label: "Completed", value: pips.filter((p) => p.status === "completed").length },
    { label: "Failed", value: pips.filter((p) => p.status === "failed").length },
  ];

  const filteredPips = filter === "all" ? pips : pips.filter((p) => p.status === filter);

  const updatePip = useApiMutation({
    path: "pip",
    method: "PUT",
    onSuccess: () => refetch(),
  });

  const deletePipMutation = useApiMutation({
    path: "pip",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingDeletePip(null);
      refetch();
    },
  });

  async function confirmDeletePip(pip: PIP) {
    const { error: submitError } = await deletePipMutation.submit(null, {
      id: pip.id,
    });
    if (!submitError) {
      toast.success("PIP deleted successfully.");
      setConfirmingDeletePip(null);
    } else {
      toast.error("Failed to delete PIP. Please try again.");
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error: submitError } = await updatePip.submit({ id, status });
    if (!submitError) {
      toast.success("PIP updated successfully.");
      setViewingPip(null);
    } else {
      toast.error("Failed to update PIP. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Performance Improvement Plans"
        subtitle="A structured plan to support an employee in getting back on track."
        actions={
          isAdmin ? (
            <Button onClick={() => setIsCreatePipModalOpen(true)}>
              New PIP
            </Button>
          ) : undefined
        }
      />

      {!loading && pips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {(["active", "completed", "failed"] as const).map((status) => (
            <Chip
              key={status}
              active={filter === status}
              onClick={() => setFilter(status)}
            >
              {statusLabel(status)}
            </Chip>
          ))}
        </div>
      )}

      {isAdmin && (
        <Modal
          open={isCreatePipModalOpen}
          onClose={() => setIsCreatePipModalOpen(false)}
          title="Create Performance Improvement Plan"
          titleId={CREATE_PIP_TITLE_ID}
          size="md"
        >
          <PipForm
            isAdmin={true}
            directory={directory}
            onDone={() => {
              refetch();
              setIsCreatePipModalOpen(false);
            }}
            onCancel={() => setIsCreatePipModalOpen(false)}
          />
        </Modal>
      )}

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {loading && (
        <SkeletonRegion label="Loading improvement plans…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && pips.length === 0 && (
        <EmptyState
          icon={TrendingUp}
          title="No PIPs yet"
          description='Click "New PIP" above to create your first plan.'
        />
      )}

      {!loading && pips.length > 0 && filteredPips.length === 0 && (
        <EmptyState
          icon={TrendingUp}
          title="No PIPs match"
          description="Try a different filter to see more plans."
        />
      )}

      {!loading && filteredPips.length > 0 && (
        <DataTable
          columns={["Reason", "Employee", "Status", "Start", "Due", ""]}
        >
          {filteredPips.map((pip) => {
            const employee = getDirectoryUser(pip.employee_id);
            return (
              <DataTableRow key={pip.id}>
                <TableCell>
                  <span
                    className="max-w-xs cursor-pointer truncate font-medium text-ink hover:text-accent dark:text-paper"
                    onClick={() => setViewingPip(pip)}
                    title="View details"
                  >
                    {pip.reason}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted">
                    {employee
                      ? `${employee.name}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(pip.status)}>
                    {statusLabel(pip.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {pip.start_date ? formatDate(pip.start_date) : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {pip.end_date ? formatDate(pip.end_date) : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <TableActions
                    actions={[
                      {
                        label: "View",
                        icon: <Eye size={14} />,
                        onClick: () => setViewingPip(pip),
                      },
                      ...(isAdmin
                        ? [
                            {
                              label: "Edit",
                              icon: <Pencil size={14} />,
                              onClick: () => setEditingPip(pip),
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 size={14} />,
                              danger: true,
                              onClick: () => setConfirmingDeletePip(pip),
                            },
                          ]
                        : []),
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
        open={!!viewingPip}
        onClose={() => setViewingPip(null)}
        title="PIP Details"
        size="lg"
      >
        {viewingPip && (
          <dl className="divide-y divide-line dark:divide-paper/15">
            <div className="pb-4">
              <p className="font-bricolage text-lg font-semibold text-ink dark:text-paper">
                {viewingPip.reason}
              </p>
              {(() => {
                const employee = getDirectoryUser(viewingPip.employee_id);
                if (!employee) return null;
                return (
                  <p className="mt-0.5 text-xs text-muted">
                    {employee.name}
                    {employee.jobTitle && ` · ${employee.jobTitle}`}
                  </p>
                );
              })()}
            </div>
            <DetailRow
              label="Status"
              value={
                <Badge variant={statusVariant(viewingPip.status)}>
                  {statusLabel(viewingPip.status)}
                </Badge>
              }
            />
            <DetailRow
              label="Start date"
              value={viewingPip.start_date ? formatDate(viewingPip.start_date) : "—"}
            />
            <DetailRow
              label="Due date"
              value={viewingPip.end_date ? formatDate(viewingPip.end_date) : "—"}
            />
            <DetailRow
              label="Action plan"
              value={viewingPip.action_plan ?? "—"}
            />
            {isAdmin && viewingPip.status === "active" && (
              <div className="flex flex-wrap items-center gap-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => updateStatus(viewingPip.id, "completed")}
                >
                  Mark Completed
                </Button>
                <Button
                  variant="danger"
                  onClick={() => updateStatus(viewingPip.id, "failed")}
                >
                  Mark Failed
                </Button>
              </div>
            )}
            <div className="pt-4">
              <PerformanceContext
                employeeId={viewingPip.employee_id}
                data={performanceContext}
              />
            </div>
          </dl>
        )}
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editingPip}
        onClose={() => setEditingPip(null)}
        title="Edit Performance Improvement Plan"
        size="md"
      >
        {editingPip && (
          <PipForm
            isAdmin={true}
            directory={directory}
            initial={editingPip}
            onDone={() => {
              refetch();
              setEditingPip(null);
            }}
            onCancel={() => setEditingPip(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmingDeletePip}
        onClose={() => setConfirmingDeletePip(null)}
        title="Delete PIP"
        size="sm"
      >
        <p className="text-sm text-muted">
          Delete this PIP? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() =>
              confirmingDeletePip && confirmDeletePip(confirmingDeletePip)
            }
            loading={deletePipMutation.submitting}
          >
            {deletePipMutation.submitting ? "Deleting…" : "Confirm Delete"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmingDeletePip(null)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
