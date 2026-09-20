"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Plus, RefreshCw, Search } from "lucide-react";
import type {
  CheckInCreateInput,
  CheckInMessageCreateInput,
  CurrentPerDevUser,
  EmployeeOption,
  PerformanceCheckIn,
  PerformanceCheckInThread,
} from "@/performance-development-dashboard/types";
import { useCheckInApi } from "@/performance-development-dashboard/hooks/useCheckInApi";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import { CheckInCard } from "@/performance-development-dashboard/components/check-ins/CheckInCard";
import { CreateCheckInModal } from "@/performance-development-dashboard/components/check-ins/CreateCheckInModal";
import { CheckInThread } from "@/performance-development-dashboard/components/check-ins/CheckInThread";

type Props = {
  serverUser: CurrentPerDevUser;
  actorType: "hr_admin" | "manager" | "employee";
  initialCheckIns: PerformanceCheckIn[];
  initialError?: string;
  employees: EmployeeOption[];
  employeeNamesById: Record<string, string>;
  defaultEmployeeId?: string | null;
  actorEmployeeUuid?: string | null;
};

export function CheckInsManagement({
  serverUser,
  actorType,
  initialCheckIns,
  initialError,
  employees,
  employeeNamesById,
  defaultEmployeeId,
  actorEmployeeUuid,
}: Props) {
  const api = useCheckInApi();

  const isHrAdmin = actorType === "hr_admin";
  const isManager = actorType === "manager";
  const canSelectEmployee = isHrAdmin || isManager;

  const [createdEmployeeNamesById, setCreatedEmployeeNamesById] =
    useState<Record<string, string>>({});

  const resolvedEmployeeNamesById = useMemo(() => {
    const names = { ...employeeNamesById, ...createdEmployeeNamesById };
    for (const employee of employees) {
      names[employee.id] = employee.name;
    }
    return names;
  }, [employeeNamesById, createdEmployeeNamesById, employees]);

  function resolveEmployeeName(
    employeeId: string | null | undefined
  ): string {
    if (!employeeId) return "Unknown employee";
    return resolvedEmployeeNamesById[employeeId] ?? "Unknown employee";
  }

  const [checkIns, setCheckIns] = useState<PerformanceCheckIn[]>(initialCheckIns);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [threadCheckIn, setThreadCheckIn] =
    useState<PerformanceCheckIn | null>(null);
  const [thread, setThread] = useState<PerformanceCheckInThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threadPosting, setThreadPosting] = useState(false);
  const [threadAcknowledging, setThreadAcknowledging] = useState(false);

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return checkIns;
    return checkIns.filter((checkIn) => {
      const employeeName = (
        resolvedEmployeeNamesById[checkIn.employee_id] ?? ""
      ).toLowerCase();
      const givenByName = (
        resolvedEmployeeNamesById[checkIn.given_by] ?? ""
      ).toLowerCase();
      return (
        checkIn.message.toLowerCase().includes(query) ||
        employeeName.includes(query) ||
        givenByName.includes(query)
      );
    });
  }, [checkIns, search, resolvedEmployeeNamesById]);

  async function handleCreate(input: Record<string, unknown>) {
    setCreating(true);
    try {
      const payload: CheckInCreateInput = {
        message: String(input.message ?? ""),
      };
      if (
        canSelectEmployee &&
        typeof input.employee_id === "string" &&
        input.employee_id
      ) {
        payload.employee_id = input.employee_id;
      }

      const created = await api.runCreate(payload);

      const employeeName = employees.find(
        (employee) => employee.id === created.employee_id
      )?.name;
      const givenByName = employees.find(
        (employee) => employee.id === created.given_by
      )?.name;

      setCreatedEmployeeNamesById((previous) => ({
        ...previous,
        ...(employeeName !== undefined
          ? { [created.employee_id]: employeeName }
          : {}),
        ...(givenByName !== undefined
          ? { [created.given_by]: givenByName }
          : {}),
      }));

      setCheckIns((previous) => [created, ...previous]);
      setCreateOpen(false);
      toast.success("Check-in added.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const list = await api.list();
      setCheckIns(list);
      setError(null);
      toast.success("Check-ins refreshed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh check-ins."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshListQuietly() {
    try {
      const list = await api.list();
      setCheckIns(list);
      setError(null);
    } catch {
      // Keep the current list and surface the error contextually instead.
    }
  }

  async function handleOpenThread(checkIn: PerformanceCheckIn) {
    setThreadCheckIn(checkIn);
    setThread(null);
    setThreadError(null);
    setThreadLoading(true);
    try {
      const result = await api.runGetThread(checkIn.id);
      setThread(result);
    } catch (err) {
      setThreadError(
        err instanceof Error
          ? err.message
          : "Failed to load the conversation."
      );
    } finally {
      setThreadLoading(false);
    }
  }

  function closeThread() {
    setThreadCheckIn(null);
    setThread(null);
    setThreadError(null);
  }

  async function handlePostMessage(input: CheckInMessageCreateInput) {
    if (!threadCheckIn) return;
    setThreadPosting(true);
    try {
      const created = await api.runPostMessage(threadCheckIn.id, input);
      setThread((previous) =>
        previous
          ? { ...previous, messages: [...previous.messages, created] }
          : previous
      );
      await refreshListQuietly();
    } finally {
      setThreadPosting(false);
    }
  }

  async function handleAcknowledge() {
    if (!threadCheckIn) return;
    setThreadAcknowledging(true);
    try {
      const acknowledgment = await api.runAcknowledge(threadCheckIn.id);
      setThread((previous) =>
        previous ? { ...previous, acknowledgment } : previous
      );
      await refreshListQuietly();
    } finally {
      setThreadAcknowledging(false);
    }
  }

  const threadCanComment =
    isHrAdmin ||
    isManager ||
    (actorEmployeeUuid != null &&
      threadCheckIn != null &&
      threadCheckIn.employee_id === actorEmployeeUuid);

  const threadCanAcknowledge =
    actorEmployeeUuid != null &&
    threadCheckIn != null &&
    threadCheckIn.employee_id === actorEmployeeUuid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Check-ins
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {isHrAdmin
              ? `Hello ${firstName}. Capture ongoing performance discussions and feedback with every employee.`
              : isManager
                ? `Hello ${firstName}. Capture ongoing performance discussions and feedback with your team.`
                : `Hello ${firstName}. Keep a running record of your ongoing performance discussions and feedback.`}
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2} />
            Add check-in
          </button>
        </div>
      </div>

      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search check-ins</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search check-ins..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>
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
          <MessageSquare size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search ? "No matching check-ins" : "No check-ins yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : isHrAdmin
                ? "Add the first check-in to start an ongoing performance conversation."
                : isManager
                  ? "Add the first check-in to start an ongoing performance conversation with your team."
                  : "Write your first check-in to keep a running record of your work and feedback."}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Add your first check-in
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((checkIn) => (
            <CheckInCard
              key={checkIn.id}
              checkIn={checkIn}
              employeeName={resolveEmployeeName(checkIn.employee_id)}
              givenByName={resolveEmployeeName(checkIn.given_by)}
              givenByAccountName={checkIn.givenByAccountName ?? null}
              isHrAdmin={isHrAdmin}
              onOpen={() => handleOpenThread(checkIn)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateCheckInModal
          canSelectEmployee={canSelectEmployee}
          employees={employees}
          defaultEmployeeId={defaultEmployeeId}
          submitting={creating}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {threadCheckIn && (
        <CheckInThread
          checkIn={threadCheckIn}
          employeeName={resolveEmployeeName(threadCheckIn.employee_id)}
          givenByName={resolveEmployeeName(threadCheckIn.given_by)}
          givenByAccountName={threadCheckIn.givenByAccountName ?? null}
          isHrAdmin={isHrAdmin}
          thread={thread}
          loading={threadLoading}
          error={threadError}
          posting={threadPosting}
          acknowledging={threadAcknowledging}
          canComment={threadCanComment}
          canAcknowledge={threadCanAcknowledge}
          onPostMessage={handlePostMessage}
          onAcknowledge={handleAcknowledge}
          onClose={closeThread}
        />
      )}
    </div>
  );
}