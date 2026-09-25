"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, MessageSquareText, Plus, RefreshCw, Search, ShieldAlert } from "lucide-react";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  FeedbackRequestListItem,
} from "@/performance-development-dashboard/types";
import { useFeedbackApi } from "@/performance-development-dashboard/hooks/useFeedbackApi";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformanceTabs,
} from "@/performance-development-dashboard/components/ui/performance";
import { FeedbackCard } from "@/performance-development-dashboard/components/feedback/FeedbackCard";
import { RequestFeedbackDialog } from "@/performance-development-dashboard/components/feedback/RequestFeedbackDialog";
import { FeedbackDetailDialog } from "@/performance-development-dashboard/components/feedback/FeedbackDetailDialog";

type Props = {
  serverUser: CurrentPerDevUser;
  actorType: "hr_admin" | "manager" | "employee";
  /**
   * Server-resolved PerDev HR Admin flag (super_admin /
   * hr_performance_admin). actorType alone is not sufficient: non-PerDev HR
   * roles share actorType "hr_admin" but are denied by every feedback API.
   */
  isPerDevHrAdmin: boolean;
  initialRequests: FeedbackRequestListItem[];
  initialError?: string;
  employees: EmployeeOption[];
  actorEmployeeUuid?: string | null;
};

type TabKey = "received" | "given" | "all";

/**
 * Feedback workspace: "Requested by me" (I asked for feedback about myself)
 * and "Requested of me" (I was asked to give feedback) tabs for everyone,
 * plus an organization-wide list tab for PerDev HR Admins.
 * Visibility is presentation-only — every read and write is authorized
 * server-side by the feedback API.
 */
export function FeedbackManagement({
  serverUser,
  actorType,
  isPerDevHrAdmin,
  initialRequests,
  initialError,
  employees,
  actorEmployeeUuid,
}: Props) {
  const api = useFeedbackApi();

  const denied = actorType === "hr_admin" && !isPerDevHrAdmin;

  const [requests, setRequests] =
    useState<FeedbackRequestListItem[]>(initialRequests);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("received");

  const [detail, setDetail] = useState<FeedbackRequestListItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [responding, setResponding] = useState(false);

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const received = useMemo(
    () =>
      actorEmployeeUuid
        ? requests.filter(
            (request) => request.requester_employee_id === actorEmployeeUuid
          )
        : [],
    [requests, actorEmployeeUuid]
  );
  const given = useMemo(
    () =>
      actorEmployeeUuid
        ? requests.filter(
            (request) => request.recipient_employee_id === actorEmployeeUuid
          )
        : [],
    [requests, actorEmployeeUuid]
  );

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string; count: number }[] = [
      { key: "received", label: "Requested by me", count: received.length },
      { key: "given", label: "Requested of me", count: given.length },
    ];
    if (isPerDevHrAdmin) {
      list.push({ key: "all", label: "All requests", count: requests.length });
    }
    return list;
  }, [received.length, given.length, requests.length, isPerDevHrAdmin]);

  const visible =
    tab === "received" ? received : tab === "given" ? given : requests;

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visible;
    return visible.filter((request) => {
      const haystack = [
        request.requesterName,
        request.requesterNumber,
        request.recipientName,
        request.recipientNumber,
        request.request_message ?? "",
        request.response_message ?? "",
        request.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [visible, search]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const list = await api.runList();
      setRequests(list);
      setError(null);
      toast.success("Feedback refreshed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh feedback."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshListQuietly() {
    try {
      const list = await api.runList();
      setRequests(list);
      setError(null);
    } catch {
      // Keep the current list; errors surface on the next explicit action.
    }
  }

  async function handleCreate(input: Record<string, unknown>) {
    setCreating(true);
    try {
      const created = await api.runCreate({
        recipient_employee_id: String(input.recipient_employee_id ?? ""),
        request_message:
          typeof input.request_message === "string"
            ? input.request_message
            : null,
      });
      setRequests((previous) => [created, ...previous]);
      setCreateOpen(false);
      setTab("received");
      toast.success("Feedback request sent.");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenDetail(request: FeedbackRequestListItem) {
    setDetail(request);
    setDetailLoading(true);
    try {
      const fresh = await api.runGet(request.id);
      setDetail(fresh);
    } catch (err) {
      closeDetail();
      toast.error(
        err instanceof Error ? err.message : "Failed to load the request."
      );
      await refreshListQuietly();
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
  }

  async function handleRespond(
    decision: "fulfilled" | "declined",
    message: string | null
  ) {
    if (!detail) return;
    setResponding(true);
    try {
      const updated = await api.runRespond(detail.id, {
        decision,
        response_message: message,
      });
      setDetail(updated);
      await refreshListQuietly();
      closeDetail();
      toast.success(
        decision === "fulfilled"
          ? "Feedback submitted."
          : "Request declined."
      );
    } finally {
      setResponding(false);
    }
  }

  if (denied) {
    return (
      <div className="space-y-6">
        <PerformancePageHeader
          title="Feedback"
          description={`Hello ${firstName}. Request feedback from colleagues and respond to feedback requests you've received.`}
        />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <ShieldAlert size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No access to Feedback
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            Your HR role does not include Performance Development access.
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const canRespond =
    detail !== null &&
    detail.status === "pending" &&
    actorEmployeeUuid !== null &&
    actorEmployeeUuid !== undefined &&
    detail.recipient_employee_id === actorEmployeeUuid;

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Feedback"
        description={`Hello ${firstName}. Request feedback from colleagues and respond to feedback requests you've received.`}
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
            <PerformanceButton onClick={() => setCreateOpen(true)}>
              <Plus size={15} strokeWidth={2} />
              Request Feedback
            </PerformanceButton>
          </>
        }
      />

      <PerformanceTabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        ariaLabel="Feedback views"
      />

      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search feedback</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search feedback..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>
      </FilterBar>

      {error && (
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading feedback...</span>
          <SkeletonList rows={3} />
        </div>
      ) : displayed.length === 0 && !error ? (
        tab === "received" ? (
          <PerformanceEmptyState
            icon={<Inbox size={22} strokeWidth={1.5} className="text-muted" />}
            title={search ? "No matching requests" : "No feedback requests yet"}
            message={
              search
                ? "Try a different search term."
                : "Request feedback from a colleague to start building your feedback history."
            }
            action={
              !search ? (
                <PerformanceButton
                  onClick={() => setCreateOpen(true)}
                  className="mt-1"
                >
                  <Plus size={15} strokeWidth={2} />
                  Request Feedback
                </PerformanceButton>
              ) : undefined
            }
          />
        ) : tab === "given" ? (
          <PerformanceEmptyState
            icon={
              <MessageSquareText
                size={22}
                strokeWidth={1.5}
                className="text-muted"
              />
            }
            title={
              search
                ? "No matching requests"
                : "No feedback requests to respond to"
            }
            message={
              search
                ? "Try a different search term."
                : "When someone asks for your feedback, it will appear here."
            }
          />
        ) : (
          <PerformanceEmptyState
            icon={<Inbox size={22} strokeWidth={1.5} className="text-muted" />}
            title={search ? "No matching requests" : "No feedback requests yet"}
            message={
              search
                ? "Try a different search term."
                : "No one has requested feedback yet."
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((request) => (
            <FeedbackCard
              key={request.id}
              request={request}
              direction={tab}
              onPrimaryAction={() => handleOpenDetail(request)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <RequestFeedbackDialog
          employees={employees}
          actorEmployeeUuid={actorEmployeeUuid}
          submitting={creating}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {detail ? (
        <FeedbackDetailDialog
          request={detail}
          canRespond={!detailLoading && canRespond}
          submitting={detailLoading || responding}
          onRespond={handleRespond}
          onClose={closeDetail}
        />
      ) : null}
    </div>
  );
}
