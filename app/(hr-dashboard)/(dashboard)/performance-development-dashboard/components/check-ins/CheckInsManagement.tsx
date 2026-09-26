"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Plus, RefreshCw, Search } from "lucide-react";
import type {
  CheckInCreateInput,
  CheckInMessageCreateInput,
  CreateGoalEvidenceInput,
  CurrentPerDevUser,
  EmployeeOption,
  GoalEvidenceAttachmentInput,
  PerformanceCheckIn,
  PerformanceCheckInThread,
} from "@/performance-development-dashboard/types";
import { useCheckInApi } from "@/performance-development-dashboard/hooks/useCheckInApi";
import { useGoalApi } from "@/performance-development-dashboard/hooks/useGoalApi";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformanceTabs,
} from "@/performance-development-dashboard/components/ui/performance";
import { CheckInCard } from "@/performance-development-dashboard/components/check-ins/CheckInCard";
import type { CheckInClassification } from "@/performance-development-dashboard/components/check-ins/CheckInCard";
import { CreateCheckInModal } from "@/performance-development-dashboard/components/check-ins/CreateCheckInModal";
import { CheckInThread } from "@/performance-development-dashboard/components/check-ins/CheckInThread";

type Props = {
  serverUser: CurrentPerDevUser;
  actorType: "hr_admin" | "manager" | "employee";
  /**
   * Server-resolved PerDev HR Admin flag (super_admin /
   * hr_performance_admin). actorType alone is not sufficient: non-PerDev HR
   * roles share actorType "hr_admin" but are denied by every check-in API.
   */
  isPerDevHrAdmin: boolean;
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
  isPerDevHrAdmin,
  initialCheckIns,
  initialError,
  employees,
  employeeNamesById,
  defaultEmployeeId,
  actorEmployeeUuid,
}: Props) {
  const api = useCheckInApi();
  const goalApi = useGoalApi();

  const isHrAdmin = isPerDevHrAdmin;
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
  const [typeFilter, setTypeFilter] = useState<"all" | "linked" | "general">(
    "all"
  );
  const searchParams = useSearchParams();
  const deepLinkConsumedRef = useRef<string | null>(null);

  /**
   * Goal-linkage classification per check-in, resolved from the existing
   * thread endpoint (the only list-safe evidence signal). Kept in state so
   * renders stay consistent; entries persist across quiet list reloads and
   * are cleared only on explicit refresh.
   */
  const [classifications, setClassifications] = useState<
    Record<string, CheckInClassification>
  >({});

  useEffect(() => {
    const missing = checkIns
      .map((checkIn) => checkIn.id)
      .filter((id) => !(id in classifications));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.allSettled(
        missing.map((id) => api.getThread(id))
      );
      if (cancelled) return;
      setClassifications((previous) => {
        let changed = false;
        const next = { ...previous };
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          if (missing[index] in next) return;
          const evidence = result.value.evidence ?? [];
          const latest = evidence[evidence.length - 1];
          next[missing[index]] =
            evidence.length > 0 && latest
              ? {
                  status: "linked",
                  goalTitle: latest.goal_title ?? "Goal",
                  snapshot: latest.progress_percent,
                  evidenceCount: evidence.length,
                }
              : { status: "general" };
          changed = true;
        });
        return changed ? next : previous;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [checkIns, api, classifications]);

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return checkIns.filter((checkIn) => {
      if (typeFilter !== "all") {
        const classification = classifications[checkIn.id];
        if (!classification) return false;
        if (
          (typeFilter === "linked") !== (classification.status === "linked")
        ) {
          return false;
        }
      }
      if (!query) return true;
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
  }, [checkIns, search, resolvedEmployeeNamesById, typeFilter, classifications]);

  async function handleCreate(input: Record<string, unknown>) {
    setCreating(true);
    try {
      const message = String(input.message ?? "");
      const payload: CheckInCreateInput = {
        message,
      };
      if (
        canSelectEmployee &&
        typeof input.employee_id === "string" &&
        input.employee_id
      ) {
        payload.employee_id = input.employee_id;
      }

      // Goal-linkage intent for the server-side closed-cycle pre-write
      // guard: the linked goal's cycle must not be closed. The check-in row
      // itself stores no goal (schema unchanged); the durable link is the
      // evidence row filed below via check_in_id.
      const linkedGoalId =
        typeof input.goal_id === "string" && input.goal_id
          ? input.goal_id
          : null;
      if (linkedGoalId) {
        payload.goal_id = linkedGoalId;
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

      // Goal-linked check-in: the check-in above is created first with the
      // unchanged flow, then evidence is filed against it. The evidence API
      // is the authorization boundary (owner-only, server-enforced).
      const goalId = linkedGoalId;

      if (goalId) {
        const rawProgress = input.progress_percent;
        const evidenceInput: CreateGoalEvidenceInput = {
          check_in_id: created.id,
          progress_percent:
            typeof rawProgress === "number" && Number.isFinite(rawProgress)
              ? Math.min(100, Math.max(0, Math.round(rawProgress)))
              : 0,
          note: message,
        };
        const rawAttachment = input.attachment;
        if (
          rawAttachment !== undefined &&
          rawAttachment !== null &&
          typeof rawAttachment === "object"
        ) {
          evidenceInput.attachment =
            rawAttachment as GoalEvidenceAttachmentInput;
        }

        try {
          await goalApi.createEvidence(goalId, evidenceInput);
        } catch (err) {
          // Preserve the created check-in, surface a clear error, and stop:
          // never pretend the evidence was saved, never delete the check-in,
          // never retry silently.
          setCheckIns((previous) => [created, ...previous]);
          setCreateOpen(false);
          toast.error(
            `Check-in saved, but goal evidence was not saved: ${
              err instanceof Error ? err.message : "Evidence request failed."
            }`
          );
          return;
        }
      }

      setCheckIns((previous) => [created, ...previous]);
      setCreateOpen(false);
      toast.success(
        goalId ? "Check-in and goal evidence saved." : "Check-in added."
      );
    } finally {
      setCreating(false);
    }
  }

  const typeCounts = useMemo(() => {
    let linked = 0;
    let general = 0;
    for (const checkIn of checkIns) {
      const classification = classifications[checkIn.id];
      if (classification?.status === "linked") linked += 1;
      else if (classification) general += 1;
    }
    return { linked, general };
  }, [checkIns, classifications]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      setClassifications({});
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

  /**
   * Record deep-link: `?checkin=<id>` (e.g. from a notification) opens the
   * check-in thread directly. Resolution is server-authorized: the row is
   * found in the scope-filtered list when present, otherwise the list is
   * refreshed once through the scoped endpoint. Invalid, deleted, or
   * out-of-scope ids surface the standard error banner — never the record.
   */
  useEffect(() => {
    const id = searchParams.get("checkin");
    if (!id || deepLinkConsumedRef.current === id) return;
    deepLinkConsumedRef.current = id;
    let cancelled = false;
    void (async () => {
      const listed = checkIns.find((checkIn) => checkIn.id === id);
      if (listed) {
        if (!cancelled) await handleOpenThread(listed);
        return;
      }
      try {
        const fresh = await api.list();
        if (cancelled) return;
        setCheckIns(fresh);
        const found = fresh.find((checkIn) => checkIn.id === id);
        if (found) {
          await handleOpenThread(found);
        } else {
          setError(
            "That check-in is no longer available. It may have been removed or moved outside your current scope."
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "That check-in is no longer available. It may have been removed or moved outside your current scope."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // Mirrors createCheckInMessage scope (checkins.ts): PerDev HR may comment
  // on any authorized thread; managers only within self + active direct
  // reports (the `employees` prop carries exactly that set for managers);
  // everyone else only on own threads. Non-PerDev HR never passes.
  const threadIsOwn =
    actorEmployeeUuid != null &&
    threadCheckIn != null &&
    threadCheckIn.employee_id === actorEmployeeUuid;
  const threadInManagerScope =
    isManager &&
    threadCheckIn != null &&
    employees.some((employee) => employee.id === threadCheckIn.employee_id);
  const threadCanComment =
    isHrAdmin ||
    ((actorType === "manager" || actorType === "employee") &&
      (threadIsOwn || threadInManagerScope));

  const threadCanAcknowledge =
    actorEmployeeUuid != null &&
    threadCheckIn != null &&
    threadCheckIn.employee_id === actorEmployeeUuid;

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Check-ins"
        description={
          isHrAdmin
            ? `Hello ${firstName}. Capture ongoing performance discussions and feedback with every employee.`
            : isManager
              ? `Hello ${firstName}. Capture ongoing performance discussions and feedback with your team.`
              : `Hello ${firstName}. Keep a running record of your ongoing performance discussions and feedback.`
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
            <PerformanceButton
              onClick={() => setCreateOpen(true)}
              disabled={creating}
            >
              <Plus size={15} strokeWidth={2} />
              New check-in
            </PerformanceButton>
          </>
        }
      />

      <PerformanceTabs
        tabs={[
          { key: "all", label: "All", count: checkIns.length },
          { key: "linked", label: "Goal-linked", count: typeCounts.linked },
          { key: "general", label: "General", count: typeCounts.general },
        ]}
        active={typeFilter}
        onChange={setTypeFilter}
        ariaLabel="Check-in type"
      />

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
        <p
          aria-live="polite"
          className="text-[12px] tabular-nums text-muted sm:ml-auto"
        >
          {displayed.length} of {checkIns.length} check-in{displayed.length === 1 ? "" : "s"}
        </p>
      </FilterBar>

      {error && (
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading check-ins...</span>
          <SkeletonList rows={3} />
        </div>
      ) : displayed.length === 0 && !error ? (
        <PerformanceEmptyState
          icon={<MessageSquare size={22} strokeWidth={1.5} className="text-muted" />}
          title={
            search || typeFilter !== "all"
              ? "No matching check-ins"
              : "No check-ins yet"
          }
          message={
            search || typeFilter !== "all"
              ? "Try a different search term or type filter."
              : isHrAdmin
                ? "Add the first check-in to start an ongoing performance conversation."
                : isManager
                  ? "Add the first check-in to start an ongoing performance conversation with your team."
                  : "Write your first check-in to keep a running record of your work and feedback."
          }
          action={
            !search && typeFilter === "all" ? (
              <PerformanceButton
                onClick={() => setCreateOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                New check-in
              </PerformanceButton>
            ) : undefined
          }
        />
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
              classification={classifications[checkIn.id]}
              onOpen={() => handleOpenThread(checkIn)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateCheckInModal
          canSelectEmployee={canSelectEmployee}
          actorType={actorType}
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