"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import { StatTile } from "@/performance-development-dashboard/components/ui/StatTile";
import { Skeleton, SkeletonPanel, SkeletonStatTile } from "@/performance-development-dashboard/components/ui/Skeleton";
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
  initialError?: string;
};

export function PerformanceDashboard({ serverUser, actorType = "hr_admin", initialError }: Props) {
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xl space-y-2.5">
            <Skeleton className="h-3 w-56 rounded-full" />
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-3 w-full max-w-[360px] rounded-full" />
          </div>
          <div className="flex shrink-0 justify-end">
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatTile key={index} />
          ))}
        </div>

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
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
        <p className="text-[13px] font-medium text-red-600">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Try again
        </button>
      </div>
    );
  }

  const firstName = serverUser?.fullName.split(" ")[0] || "there";
  const actionItemsTotal =
    (data?.actionItems.goalsPendingCompletion ?? 0) +
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            Hello {firstName}. {subtitleByActor[actorType] ?? subtitleByActor.hr_admin}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          {data ? (
            <p className="text-[11.5px] text-muted">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      </div>

      {error && data && (
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

      {!data ? null : (
        <>
          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total goals"
              value={data.goals.total}
              tone="bg-accent-dark"
              href={GOALS_PATH}
            />
            <StatTile
              label="Total appraisals"
              value={data.appraisals.total}
              tone="bg-accent"
              href={APPRAISALS_PATH}
            />
            <StatTile
              label="Competencies"
              value={data.competencyAndDevelopment.competencies}
              tone="bg-ink"
              href={COMPETENCIES_PATH}
            />
            <StatTile
              label="Action items"
              value={actionItemsTotal}
              tone="bg-emerald-600"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <CurrentCyclePanel cycle={data.currentCycle} />
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

function CurrentCyclePanel({
  cycle,
}: {
  cycle: DashboardCurrentCycle;
}) {
  return (
    <PanelCard title="Current Cycle" subtitle="Latest active performance cycle">
      {!cycle ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[13px] text-muted">No active performance cycle.</p>
          <Link
            href={CYCLES_PATH}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
          >
            Manage cycles
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={
                PERFORMANCE_CYCLE_STATUS_LABELS[
                  cycle.status as PerformanceCycleStatus
                ] ?? cycle.status
              }
              tone={
                PERFORMANCE_CYCLE_STATUS_TONES[
                  cycle.status as PerformanceCycleStatus
                ] ?? "bg-line text-muted"
              }
            />
            <StatusPill
              label={
                PERFORMANCE_CYCLE_STAGE_LABELS[
                  cycle.stage as PerformanceCycleStage
                ] ?? cycle.stage
              }
              tone="bg-accent/10 text-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-bricolage text-[22px] font-medium tracking-tight text-ink">
              {cycle.name}
            </p>
            <p className="text-[12.5px] text-muted">
              {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}
            </p>
          </div>

          <Link
            href={CYCLES_PATH}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent transition-colors hover:text-accent-dark"
          >
            Open cycles page
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </PanelCard>
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
      tone: "bg-amber-500",
    },
    {
      count: data.actionItems.appraisalsAwaitingManagerAssessment,
      label: "Appraisals awaiting manager assessment",
      tone: "bg-accent",
    },
    {
      count: data.actionItems.appraisalsAwaitingFinalization,
      label: "Appraisals awaiting finalization",
      tone: "bg-purple-500",
    },
    {
      count: data.actionItems.redemptionsPending,
      label: "Pending reward redemptions",
      tone: "bg-emerald-500",
    },
    {
      count: data.actionItems.trainingEnrollmentsPending,
      label: "Training approvals pending",
      tone: "bg-ink",
    },
  ];

  return (
    <PanelCard
      title="Action Required"
      subtitle="Items awaiting attention"
      icon={<AlertTriangle size={15} />}
    >
      {total === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] font-medium text-emerald-600">
          <CheckCircle2 size={15} />
          All caught up
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line dark:divide-paper/10">
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex items-center gap-2.5 text-[13px] text-ink">
                  <span
                    className={`h-2 w-2 rounded-full ${item.tone}`}
                    aria-hidden="true"
                  />
                  {item.label}
                </span>
                <span className="font-bricolage text-[16px] font-medium text-ink">
                  {item.count}
                </span>
              </li>
            ))}
        </ul>
      )}
    </PanelCard>
  );
}

function GoalProgressPanel({ breakdown }: { breakdown: DashboardStatusBreakdown }) {
  return (
    <PanelCard title="Goal Progress" subtitle="Goals by status">
      <StatusBreakdown
        breakdown={breakdown}
        statusKeys={GOAL_STATUS_KEYS}
        labels={PERFORMANCE_GOAL_STATUS_LABELS}
        tones={PERFORMANCE_GOAL_STATUS_TONES}
        barTones={GOAL_BAR_TONES}
        emptyText="No goals yet"
      />
    </PanelCard>
  );
}

function AppraisalProgressPanel({
  breakdown,
}: {
  breakdown: DashboardStatusBreakdown;
}) {
  return (
    <PanelCard title="Appraisal Progress" subtitle="Appraisals by status">
      <StatusBreakdown
        breakdown={breakdown}
        statusKeys={APPRAISAL_STATUS_KEYS}
        labels={{ ...APPRAISAL_STATUS_LABELS, ...LEGACY_APPRAISAL_STATUS_LABELS }}
        tones={{ ...APPRAISAL_STATUS_TONES, ...LEGACY_APPRAISAL_STATUS_TONES }}
        barTones={APPRAISAL_BAR_TONES}
        emptyText="No appraisals yet"
      />
    </PanelCard>
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
      <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {keys.map((status) => {
          const count = breakdown.byStatus[status] ?? 0;
          const width = Math.round((count / total) * 100);
          return (
            <div
              key={status}
              className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 dark:border-paper/10"
            >
              <span className="flex items-center gap-2 text-[12.5px] text-ink">
                <StatusPill
                  label={labels[status] ?? status}
                  tone={tones[status] ?? "bg-line text-muted"}
                />
              </span>
              <span className="text-[13px] text-muted">
                {count}
                <span className="ml-1 text-[11.5px]">{width}%</span>
              </span>
            </div>
          );
        })}
      </div>
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
    <PanelCard
      title="Competency & Development"
      subtitle="Competencies, training and learning"
      icon={<GraduationCap size={15} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <CompactStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </PanelCard>
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
    <PanelCard
      title="Succession & Recognition"
      subtitle="Critical roles, successors and rewards"
      icon={<Trophy size={15} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <CompactStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </PanelCard>
  );
}

function RecentActivityPanel({
  items,
}: {
  items: PerformanceDashboardSnapshot["recentActivity"];
}) {
  return (
    <PanelCard
      title="Recent Activity"
      subtitle="Latest audit trail events"
      action={
        <Link
          href={RECENT_ACTIVITY_PATH}
          className="text-[12.5px] font-medium text-accent hover:text-accent-dark"
        >
          View all
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">No recent activity.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line dark:divide-paper/10">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-ink">
                  {item.actorName ?? "System"}
                </p>
                <p className="text-[11.5px] text-muted">
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
    </PanelCard>
  );
}

function DirectReportsPanel({
  reports,
}: {
  reports: DirectReportSummary[];
}) {
  return (
    <PanelCard
      title="Direct Reports"
      subtitle={`${reports.length} team member${reports.length === 1 ? "" : "s"}`}
      icon={<Users size={15} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line dark:border-paper/10">
              <th className="pb-2 pr-4 font-medium text-muted">Name</th>
              <th className="pb-2 pr-4 font-medium text-muted">Dept</th>
              <th className="pb-2 pr-4 text-center font-medium text-muted">Goals</th>
              <th className="pb-2 pr-4 text-center font-medium text-muted">Appraisal</th>
              <th className="pb-2 font-medium text-muted">Last Check-in</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.employeeUuid}
                className="border-b border-line last:border-0 dark:border-paper/10"
              >
                <td className="py-2.5 pr-4 font-medium text-ink">
                  {report.name}
                  {report.employeeIdNumber ? (
                    <span className="ml-1.5 text-[11px] text-muted">
                      {report.employeeIdNumber}
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-4 text-muted">
                  {report.department ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-center">
                  {report.goalsTotal > 0 ? (
                    <span className="text-ink">
                      {report.goalsCompleted}/{report.goalsTotal}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-center">
                  {report.appraisalStatus ? (
                    <StatusPill
                      label={
                        APPRAISAL_STATUS_LABELS[
                          report.appraisalStatus as AppraisalStatus
                        ] ?? report.appraisalStatus
                      }
                      tone={
                        APPRAISAL_STATUS_TONES[
                          report.appraisalStatus as AppraisalStatus
                        ] ?? "bg-line text-muted"
                      }
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5 text-muted">
                  {report.latestCheckIn
                    ? formatDate(report.latestCheckIn)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}

function PanelCard({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line p-5 dark:border-paper/15">
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="font-bricolage text-[15px] font-medium tracking-tight text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-[12px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <span className="ml-auto shrink-0">{action}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CompactStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-line px-3.5 py-3 dark:border-paper/10">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink">
        {value === null ? "—" : value}
      </p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${tone}`}
    >
      {label}
    </span>
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