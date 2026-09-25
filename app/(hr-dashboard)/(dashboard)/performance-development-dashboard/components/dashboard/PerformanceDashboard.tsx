"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Skeleton, SkeletonPanel } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformancePanel,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import type {
  AppraisalStatus,
  CurrentPerDevUser,
  PerformanceCycleStatus,
  PerformanceCycleStage,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import type { DirectReportSummary } from "@/performance-development-dashboard/lib/performance/dashboard";
import {
  APPRAISAL_STATUS_LABELS,
  APPRAISAL_STATUS_TONES,
  LEGACY_APPRAISAL_STATUS_LABELS,
  LEGACY_APPRAISAL_STATUS_TONES,
  PERFORMANCE_CYCLE_STAGE_LABELS,
  PERFORMANCE_CYCLE_STATUS_LABELS,
  PERFORMANCE_CYCLE_STATUS_TONES,
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import type {
  DashboardCurrentCycle,
  DashboardStatusBreakdown,
  PerformanceDashboardSnapshot,
} from "@/performance-development-dashboard/lib/performance/dashboard";
import {
  formatDate,
  formatDateTime,
} from "@/performance-development-dashboard/lib/format/date";

const DASHBOARD_API = "/performance-development-dashboard/api/performance/dashboard";
const CYCLES_PATH = "/performance-development-dashboard/cycles";
const GOALS_PATH = "/performance-development-dashboard/goals";
const APPRAISALS_PATH = "/performance-development-dashboard/appraisals";
const COMPETENCIES_PATH = "/performance-development-dashboard/competencies";
const RECENT_ACTIVITY_PATH = "/performance-development-dashboard/reports-analytics";

const GOAL_STATUS_KEYS: PerformanceGoalStatus[] = [
  "not_started",
  "in_progress",
  "pending_completion",
  "completed",
];
const APPRAISAL_STATUS_KEYS: AppraisalStatus[] = [
  "draft",
  "self_assessment",
  "manager_assessment",
  "finalized",
  "acknowledged",
];

const GOAL_BAR_TONES: Record<string, string> = {
  not_started: "bg-line",
  in_progress: "bg-accent",
  pending_completion: "bg-amber-500",
  completed: "bg-emerald-500",
};

const APPRAISAL_BAR_TONES: Record<string, string> = {
  draft: "bg-line",
  self_assessment: "bg-accent",
  manager_assessment: "bg-amber-500",
  finalized: "bg-purple-500",
  acknowledged: "bg-emerald-500",
};

type Props = {
  serverUser?: CurrentPerDevUser;
  actorType?: "hr_admin" | "manager" | "employee";
  /**
   * Server-resolved PerDev HR Admin flag (super_admin /
   * hr_performance_admin). Only PerDev HR Admin may navigate to the HR-only
   * cycle management page; employees, managers, and non-PerDev HR see the
   * cycle panel read-only.
   */
  isPerDevHrAdmin: boolean;
  initialError?: string;
};

export function PerformanceDashboard({ serverUser, actorType = "hr_admin", isPerDevHrAdmin, initialError }: Props) {
  const [data, setData] = useState<PerformanceDashboardSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const loadData = useCallback(async () => {
    const response = await fetch(DASHBOARD_API, { credentials: "include" });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(
        body && typeof body === "object" && "error" in body && body.error
          ? body.error
          : `Request failed with status ${response.status}`
      );
    }

    return body as PerformanceDashboardSnapshot;
  }, []);

  useEffect(() => {
    let mounted = true;

    loadData().then(
      (snapshot) => {
        if (mounted) setData(snapshot);
      },
      (err) => {
        if (mounted)
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard."
          );
      }
    );

    return () => {
      mounted = false;
    };
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      setData(await loadData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!data && !error) {
    return (
      <div className="space-y-6" aria-busy="true" role="status">
        <span className="sr-only">Loading dashboard...</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xl space-y-2.5">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-3 w-full max-w-[360px] rounded-full" />
          </div>
          <div className="flex shrink-0 justify-end">
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        <SkeletonPanel lines={4} />

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <SkeletonPanel lines={4} />
            <SkeletonPanel lines={5} />
          </div>
          <SkeletonPanel lines={4} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonPanel lines={5} />
          <SkeletonPanel lines={5} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PerformancePageHeader
          title="Performance Development"
          description="Your performance development overview."
        />
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      </div>
    );
  }

  const firstName = serverUser?.fullName.split(" ")[0] || "there";
  const actionItemsTotal =
    (data?.actionItems.goalsPendingCompletion ?? 0) +
    (data?.actionItems.appraisalsAwaitingSelfAssessment ?? 0) +
    (data?.actionItems.appraisalsAwaitingManagerAssessment ?? 0) +
    (data?.actionItems.appraisalsAwaitingFinalization ?? 0) +
    (data?.actionItems.redemptionsPending ?? 0) +
    (data?.actionItems.trainingEnrollmentsPending ?? 0);

  const subtitleByActor: Record<string, string> = {
    hr_admin: "An org-wide snapshot of cycles, goals, appraisals, competencies, succession and recognition.",
    manager: "Your team's performance overview — goals, appraisals and recent activity for your direct reports.",
    employee: "Your personal performance overview — goals, appraisals and recent activity.",
  };

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Performance Development"
        description={`Hello ${firstName}. ${subtitleByActor[actorType] ?? subtitleByActor.hr_admin}`}
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
            {data ? (
              <p className="text-[11.5px] text-muted">
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            ) : null}
          </>
        }
      />

      {error && data && (
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {!data ? null : (
        <>
          <SummaryPanel data={data} actionItemsTotal={actionItemsTotal} />

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <CurrentCyclePanel
                cycle={data.currentCycle}
                canManageCycles={isPerDevHrAdmin}
              />
              <ActionRequiredPanel data={data} total={actionItemsTotal} />
            </div>
            <div className="space-y-5">
              <RecentActivityPanel items={data.recentActivity} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <GoalProgressPanel breakdown={data.goals} />
            <AppraisalProgressPanel breakdown={data.appraisals} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CompetencyDevelopmentPanel data={data} />
            <SuccessionRecognitionPanel data={data} />
          </div>

          {actorType === "manager" && data.directReports.length > 0 && (
            <DirectReportsPanel reports={data.directReports} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Restrained summary: compact factual rows with navigation into the real
 * workflows. No giant colored tiles. `null` renders as "—", never 0 — a
 * failed request surfaces as an error banner, not a zero count.
 */
function SummaryPanel({
  data,
  actionItemsTotal,
}: {
  data: PerformanceDashboardSnapshot;
  actionItemsTotal: number;
}) {
  const rows: { label: string; detail: string; value: number; href?: string }[] = [
    {
      label: "Goals",
      detail: data.actorType === "hr_admin" ? "Organization total" : "In scope",
      value: data.goals.total,
      href: GOALS_PATH,
    },
    {
      label: "Appraisals",
      detail: data.actorType === "hr_admin" ? "Organization total" : "In scope",
      value: data.appraisals.total,
      href: APPRAISALS_PATH,
    },
    {
      label:
        data.actorType === "hr_admin"
          ? "Competencies in library"
          : "Competency assessments",
      detail:
        data.actorType === "hr_admin"
          ? "Organization library"
          : "Recorded for you",
      value: data.competencyAndDevelopment.competencies,
      href: COMPETENCIES_PATH,
    },
    {
      label: "Action items",
      detail: "Awaiting attention",
      value: actionItemsTotal,
    },
  ];

  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Summary"
        title="At a glance"
        description="Factual totals from the current snapshot. Open a module for detail."
      />
      <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {row.label}
              </p>
              <p className="truncate text-[12px] text-muted">{row.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-bricolage text-[20px] font-medium tabular-nums tracking-tight text-ink">
                {row.value}
              </span>
              {row.href ? (
                <Link
                  href={row.href}
                  aria-label={`Open ${row.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
                >
                  <ArrowRight size={14} strokeWidth={1.75} />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </PerformancePanel>
  );
}

function CurrentCyclePanel({
  cycle,
  canManageCycles,
}: {
  cycle: DashboardCurrentCycle;
  canManageCycles: boolean;
}) {
  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Cycle"
        title="Current Cycle"
        description="Latest active performance cycle."
        action={
          canManageCycles && cycle ? (
            <Link
              href={CYCLES_PATH}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent transition-colors hover:text-accent-dark"
            >
              Open cycles page
              <ArrowRight size={13} />
            </Link>
          ) : undefined
        }
      />
      {!cycle ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-[13px] text-muted">No active performance cycle.</p>
          {canManageCycles && (
            <Link
              href={CYCLES_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              Manage cycles
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PerformanceStatusBadge
              tone={
                PERFORMANCE_CYCLE_STATUS_TONES[
                  cycle.status as PerformanceCycleStatus
                ] ?? "bg-line text-muted"
              }
            >
              {PERFORMANCE_CYCLE_STATUS_LABELS[
                cycle.status as PerformanceCycleStatus
              ] ?? cycle.status}
            </PerformanceStatusBadge>
            <PerformanceStatusBadge tone="bg-accent/10 text-accent">
              {PERFORMANCE_CYCLE_STAGE_LABELS[
                cycle.stage as PerformanceCycleStage
              ] ?? cycle.stage}
            </PerformanceStatusBadge>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-bricolage text-[22px] font-medium tracking-tight text-ink">
              {cycle.name}
            </p>
            <p className="text-[12.5px] text-muted">
              {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}
            </p>
          </div>
        </div>
      )}
    </PerformancePanel>
  );
}

function ActionRequiredPanel({
  data,
  total,
}: {
  data: PerformanceDashboardSnapshot;
  total: number;
}) {
  const items = [
    {
      count: data.actionItems.goalsPendingCompletion,
      label: "Goals pending completion",
      href: GOALS_PATH,
    },
    {
      count: data.actionItems.appraisalsAwaitingSelfAssessment,
      label: "Appraisals awaiting self-assessment",
      href: APPRAISALS_PATH,
    },
    {
      count: data.actionItems.appraisalsAwaitingManagerAssessment,
      label: "Appraisals awaiting manager assessment",
      href: APPRAISALS_PATH,
    },
    {
      count: data.actionItems.appraisalsAwaitingFinalization,
      label: "Appraisals awaiting finalization",
      href: APPRAISALS_PATH,
    },
    {
      count: data.actionItems.redemptionsPending,
      label: "Pending reward redemptions",
    },
    {
      count: data.actionItems.trainingEnrollmentsPending,
      label: "Training approvals pending",
    },
  ];

  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Workflow"
        title={total > 0 ? `Action Required (${total})` : "Action Required"}
        description="Items awaiting attention."
      />
      {total === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={15} />
          All caught up
        </div>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line dark:divide-paper/10">
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {item.label}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-bricolage text-[16px] font-medium tabular-nums text-ink">
                    {item.count}
                  </span>
                  {item.href ? (
                    <Link
                      href={item.href}
                      aria-label={`Open ${item.label}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
                    >
                      <ArrowRight size={13} strokeWidth={1.75} />
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
        </ul>
      )}
    </PerformancePanel>
  );
}

function GoalProgressPanel({ breakdown }: { breakdown: DashboardStatusBreakdown }) {
  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Goals"
        title={breakdown.total > 0 ? `Goal Progress (${breakdown.total})` : "Goal Progress"}
        description="Goals by status."
      />
      <div className="mt-4">
        <StatusBreakdown
          breakdown={breakdown}
          statusKeys={GOAL_STATUS_KEYS}
          labels={PERFORMANCE_GOAL_STATUS_LABELS}
          tones={PERFORMANCE_GOAL_STATUS_TONES}
          barTones={GOAL_BAR_TONES}
          emptyText="No goals yet"
        />
      </div>
    </PerformancePanel>
  );
}

function AppraisalProgressPanel({
  breakdown,
}: {
  breakdown: DashboardStatusBreakdown;
}) {
  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Appraisals"
        title={breakdown.total > 0 ? `Appraisal Progress (${breakdown.total})` : "Appraisal Progress"}
        description="Appraisals by status."
      />
      <div className="mt-4">
        <StatusBreakdown
          breakdown={breakdown}
          statusKeys={APPRAISAL_STATUS_KEYS}
          labels={{ ...APPRAISAL_STATUS_LABELS, ...LEGACY_APPRAISAL_STATUS_LABELS }}
          tones={{ ...APPRAISAL_STATUS_TONES, ...LEGACY_APPRAISAL_STATUS_TONES }}
          barTones={APPRAISAL_BAR_TONES}
          emptyText="No appraisals yet"
        />
      </div>
    </PerformancePanel>
  );
}

function StatusBreakdown({
  breakdown,
  statusKeys,
  labels,
  tones,
  barTones,
  emptyText,
}: {
  breakdown: DashboardStatusBreakdown;
  statusKeys: readonly string[];
  labels: Record<string, string>;
  tones: Record<string, string>;
  barTones: Record<string, string>;
  emptyText: string;
}) {
  const keys = [
    ...statusKeys.filter((key) => breakdown.byStatus[key]),
    ...Object.keys(breakdown.byStatus).filter((key) => !statusKeys.includes(key)),
  ];

  if (breakdown.total === 0) {
    return <p className="text-[13px] text-muted">{emptyText}</p>;
  }

  const total = breakdown.total || 1;

  return (
    <div className="space-y-4">
      <div
        className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full"
        role="img"
        aria-label={`Status distribution across ${breakdown.total} records`}
      >
        {keys.map((status) => {
          const count = breakdown.byStatus[status] ?? 0;
          const width = Math.round((count / total) * 100);
          if (width === 0) return null;
          return (
            <span
              key={status}
              className={`h-full rounded-full ${barTones[status] ?? "bg-line"}`}
              style={{ width: `${width}%` }}
              title={`${labels[status] ?? status}: ${count}`}
            />
          );
        })}
      </div>

      <ul className="flex flex-col divide-y divide-line dark:divide-paper/10">
        {keys.map((status) => {
          const count = breakdown.byStatus[status] ?? 0;
          const width = Math.round((count / total) * 100);
          return (
            <li
              key={status}
              className="flex items-center justify-between gap-2 py-2"
            >
              <PerformanceStatusBadge tone={tones[status] ?? "bg-line text-muted"}>
                {labels[status] ?? status}
              </PerformanceStatusBadge>
              <span className="shrink-0 text-[13px] tabular-nums text-muted">
                {count}
                <span className="ml-1 text-[11.5px]">{width}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompetencyDevelopmentPanel({
  data,
}: {
  data: PerformanceDashboardSnapshot;
}) {
  const stats = [
    { label: "Competencies", value: data.competencyAndDevelopment.competencies },
    {
      label: "Position requirements",
      value: data.competencyAndDevelopment.positionRequirements,
    },
    {
      label: "Employees assessed",
      value: data.competencyAndDevelopment.employeesAssessed,
    },
    { label: "Courses", value: data.competencyAndDevelopment.courses },
    {
      label: "Training sessions",
      value: data.competencyAndDevelopment.trainingSessions,
    },
    {
      label: "Active enrollments",
      value: data.competencyAndDevelopment.activeCourseEnrollments,
    },
    {
      label: "Certifications",
      value: data.competencyAndDevelopment.certifications,
    },
  ];

  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Growth"
        title="Competency & Development"
        description="Competencies, training and learning."
      />
      <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
        {stats.map((stat) => (
          <SummaryRow key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </ul>
    </PerformancePanel>
  );
}

function SuccessionRecognitionPanel({
  data,
}: {
  data: PerformanceDashboardSnapshot;
}) {
  const stats = [
    {
      label: "Critical positions",
      value: data.successionAndRecognition.criticalPositions,
    },
    {
      label: "Succession candidates",
      value: data.successionAndRecognition.successionCandidates,
    },
    {
      label: "Recognitions",
      value: data.successionAndRecognition.recognitions,
    },
    { label: "Badges", value: data.successionAndRecognition.badges },
    {
      label: "Recognition points",
      value: data.successionAndRecognition.recognitionPoints,
    },
    {
      label: "Pending redemptions",
      value: data.successionAndRecognition.redemptionsPending,
    },
  ];

  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="People"
        title="Succession & Recognition"
        description="Critical roles, successors and rewards."
      />
      <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
        {stats.map((stat) => (
          <SummaryRow key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </ul>
    </PerformancePanel>
  );
}

/** Compact factual row. `null` (out-of-scope for this role) renders as "—". */
function SummaryRow({ label, value }: { label: string; value: number | null }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 truncate text-[13px] text-muted">{label}</span>
      <span className="shrink-0 text-[13.5px] font-medium tabular-nums text-ink">
        {value === null ? "—" : value}
      </span>
    </li>
  );
}

function RecentActivityPanel({
  items,
}: {
  items: PerformanceDashboardSnapshot["recentActivity"];
}) {
  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Activity"
        title="Recent Activity"
        description="Latest audit trail events."
        action={
          <Link
            href={RECENT_ACTIVITY_PATH}
            className="text-[12.5px] font-medium text-accent hover:text-accent-dark"
          >
            View all
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">No recent activity.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line dark:divide-paper/10">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                  {item.actorName ?? "System"}
                </p>
                <p className="shrink-0 text-[11.5px] tabular-nums text-muted">
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
              <p className="text-[12.5px] text-muted">
                {item.action}
                {item.entityType ? (
                  <>
                    {" · "}
                    <span className="text-ink">{entityLabel(item.entityType)}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PerformancePanel>
  );
}

function DirectReportsPanel({
  reports,
}: {
  reports: DirectReportSummary[];
}) {
  return (
    <PerformancePanel>
      <PerformanceSectionHeader
        eyebrow="Team"
        title="Direct Reports"
        description={`${reports.length} team member${reports.length === 1 ? "" : "s"} — goals, appraisal state, and latest check-in.`}
      />
      <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
        {reports.map((report) => (
          <li key={report.employeeUuid} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {report.name}
                {report.employeeIdNumber ? (
                  <span className="ml-1.5 text-[11px] font-normal text-muted">
                    {report.employeeIdNumber}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted">
                {[report.department ?? null, report.latestCheckIn ? `Last check-in ${formatDate(report.latestCheckIn)}` : "No check-ins"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="text-[12px] tabular-nums text-muted">
                Goals{" "}
                {report.goalsTotal > 0 ? (
                  <span className="font-medium text-ink">
                    {report.goalsCompleted}/{report.goalsTotal}
                  </span>
                ) : (
                  "—"
                )}
              </span>
              {report.appraisalStatus ? (
                <PerformanceStatusBadge
                  tone={
                    APPRAISAL_STATUS_TONES[
                      report.appraisalStatus as AppraisalStatus
                    ] ?? "bg-line text-muted"
                  }
                >
                  {APPRAISAL_STATUS_LABELS[
                    report.appraisalStatus as AppraisalStatus
                  ] ?? report.appraisalStatus}
                </PerformanceStatusBadge>
              ) : (
                <span className="text-[12px] text-muted">No appraisal</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PerformancePanel>
  );
}

function entityLabel(entityType: string): string {
  return entityType
    .replace(/^hr3_/, "")
    .replace(/_/g, " ")
    .replace(/primal|dev-performance|performance|hr\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
