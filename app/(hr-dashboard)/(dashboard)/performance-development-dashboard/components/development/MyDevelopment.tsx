"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  ClipboardList,
  Gauge,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/performance-development-dashboard/components/ui/EmptyState";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformancePanel,
  PerformanceProgress,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import { DEV_PLAN_ITEM_STATUS_LABELS } from "@/performance-development-dashboard/types";
import type {
  CurrentPerDevUser,
  DevPlanItemStatus,
  MyDevelopmentData,
} from "@/performance-development-dashboard/types";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";
import {
  PerDevHttpError,
  perDevFetch,
} from "@/performance-development-dashboard/lib/api/perDevFetch";

const MY_DEVELOPMENT_API =
  "/performance-development-dashboard/api/performance/my-development";
const LEARNING_AND_DEVELOPMENT_PATH =
  "/performance-development-dashboard/learning-development";

type Props = {
  serverUser: CurrentPerDevUser;
};

function devActionTone(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "in_progress":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "bg-line text-muted";
  }
}

function devActionLabel(status: string): string {
  return (
    DEV_PLAN_ITEM_STATUS_LABELS[status as DevPlanItemStatus] ?? status
  );
}

function courseStatusTone(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "in_progress":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "bg-accent/10 text-accent";
  }
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <PerformancePanel>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[22px] font-semibold tabular-nums leading-none text-ink">
            {value}
          </p>
          <p className="mt-1 truncate text-[12px] font-medium text-muted">
            {label}
          </p>
        </div>
      </div>
    </PerformancePanel>
  );
}

export function MyDevelopment({ serverUser }: Props) {
  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const [data, setData] = useState<MyDevelopmentData | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      // Paramless by design: identity is resolved server-side. Nothing
      // identifying the employee is ever sent from this client.
      const result = (await perDevFetch(MY_DEVELOPMENT_API, {
        sessionExpiredMessage: "Your session has expired. Please sign in again.",
      })) as MyDevelopmentData;
      setData(result);
      setLoadedAt(Date.now());
    } catch (err) {
      if (err instanceof PerDevHttpError && err.status === 403) {
        setData(null);
        setLoadedAt(null);
        setDenied(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load My Development."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* Mount-only fetch (same pattern as PerDevNotificationBell). */
  /* eslint-disable react-hooks/set-state-in-effect -- mount-only async fetch */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="My Development"
        description={`Hello ${firstName}. Track your development actions, competencies, learning, and certifications.`}
        actions={
          <PerformanceButton
            variant="ghost"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </PerformanceButton>
        }
      />

      {error && (
        <PerformanceErrorBanner message={error} onRetry={load} />
      )}

      {loading ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading your development overview...</span>
          <SkeletonList rows={4} />
        </div>
      ) : denied ? (
        <PerformancePanel>
          <PerformanceSectionHeader
            eyebrow="Unavailable"
            title="My Development is not available"
            description="This view is available for accounts with a linked employee record."
          />
        </PerformancePanel>
      ) : (
        data && (
          <>
            <div
              className="grid grid-cols-2 gap-3 xl:grid-cols-4"
              aria-label="Development summary"
            >
              <SummaryCard
                icon={<ClipboardList size={17} strokeWidth={1.9} />}
                label="Open Development Actions"
                value={data.summary.openDevelopmentActions}
              />
              <SummaryCard
                icon={<Gauge size={17} strokeWidth={1.9} />}
                label="Competency Gaps"
                value={data.summary.competencyGaps}
              />
              <SummaryCard
                icon={<GraduationCap size={17} strokeWidth={1.9} />}
                label="Learning in Progress"
                value={data.summary.learningInProgress}
              />
              <SummaryCard
                icon={<Award size={17} strokeWidth={1.9} />}
                label="Certifications"
                value={data.summary.certifications}
              />
            </div>

            <PerformancePanel>
              <PerformanceSectionHeader
                eyebrow="Follow-through"
                title="Development Actions"
                description="Development actions from your finalized appraisal history. Read-only — history is never edited here."
              />
              <div className="mt-4">
                {data.developmentActions.length === 0 ? (
                  <EmptyState message="No development actions yet. Actions from finalized appraisals will appear here." />
                ) : (
                  <ul className="divide-y divide-line dark:divide-paper/10">
                    {data.developmentActions.map((item) => (
                      <li
                        key={item.id}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 font-medium text-[13.5px] leading-snug text-ink">
                            {item.action}
                          </p>
                          <PerformanceStatusBadge
                            tone={devActionTone(item.status)}
                          >
                            {devActionLabel(item.status)}
                          </PerformanceStatusBadge>
                        </div>
                        {item.target && (
                          <p className="mt-1 text-[12px] text-muted">
                            Target: {item.target}
                          </p>
                        )}
                        <p className="mt-1 text-[11.5px] text-muted">
                          From:{" "}
                          {[
                            item.appraisalReviewPeriod ?? "Unknown review",
                            item.appraisalCycleName,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PerformancePanel>

            <PerformancePanel>
              <PerformanceSectionHeader
                eyebrow="Growth"
                title="Competency Development"
                description="Your current competency levels against required levels. Reference only — never an appraisal score."
              />
              <div className="mt-4">
                {data.competencies.length === 0 ? (
                  <EmptyState message="No competency development data available yet." />
                ) : (
                  <ul className="divide-y divide-line dark:divide-paper/10">
                    {data.competencies.map((competency) => (
                      <li
                        key={competency.competencyId}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-ink">
                            {competency.competencyName}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            {competency.competencyCategory ?? "Competency"}
                            {" · "}Current level {competency.currentLevel}
                            {" · "}Required{" "}
                            {competency.effectiveRequiredLevel ?? "—"}
                          </p>
                        </div>
                        {competency.gap !== null && competency.gap > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-700 dark:text-amber-400">
                            Development gap +{competency.gap}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11.5px] text-muted">
                            {competency.gap === null
                              ? "No target set"
                              : "Meets required level"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PerformancePanel>

            <PerformancePanel>
              <PerformanceSectionHeader
                eyebrow="Learning"
                title="Learning"
                description="A summary of your current learning. Enrollments, evaluations, and attendance live in Learning & Development."
                action={
                  <Link
                    href={LEARNING_AND_DEVELOPMENT_PATH}
                    aria-label="View Learning and Development workspace"
                    className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
                  >
                    View Learning &amp; Development
                  </Link>
                }
              />
              <div className="mt-4 flex flex-col gap-6">
                <section aria-label="Course enrollments">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Course enrollments
                  </p>
                  {data.learning.courseEnrollments.length === 0 ? (
                    <div className="mt-2">
                      <EmptyState message="No course enrollments yet." />
                    </div>
                  ) : (
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                      {data.learning.courseEnrollments.map((enrollment) => (
                        <li
                          key={enrollment.id}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {enrollment.courseTitle ?? "Untitled course"}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-muted">
                              Enrolled {formatDate(enrollment.enrolledAt)}
                              {enrollment.completedAt
                                ? ` · Completed ${formatDate(enrollment.completedAt)}`
                                : ""}
                            </p>
                            <div className="mt-2 flex max-w-[280px] items-center gap-2">
                              <div className="flex-1">
                                <PerformanceProgress
                                  value={enrollment.progressPercent}
                                  label={`Course progress ${Math.round(enrollment.progressPercent)}% for ${enrollment.courseTitle ?? "course"}`}
                                />
                              </div>
                              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
                                {Math.round(enrollment.progressPercent)}%
                              </span>
                            </div>
                          </div>
                          <PerformanceStatusBadge
                            tone={courseStatusTone(enrollment.status)}
                            className="shrink-0 self-start sm:self-center"
                          >
                            {enrollment.status}
                          </PerformanceStatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Training enrollments">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Training enrollments
                  </p>
                  {data.learning.trainingEnrollments.length === 0 ? (
                    <div className="mt-2">
                      <EmptyState message="No training enrollments yet." />
                    </div>
                  ) : (
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                      {data.learning.trainingEnrollments.map((enrollment) => (
                        <li
                          key={enrollment.id}
                          className="px-4 py-3"
                        >
                          <p className="truncate text-[13px] font-medium text-ink">
                            {enrollment.sessionTitle ?? "Untitled session"}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            {[
                              enrollment.scheduleDate
                                ? formatDate(enrollment.scheduleDate)
                                : null,
                              enrollment.trainerName
                                ? `by ${enrollment.trainerName}`
                                : null,
                              enrollment.mode,
                              enrollment.venue,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Session details unavailable"}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            Approval: {enrollment.approvalStatus}
                            {enrollment.attendanceStatus
                              ? ` · Attendance: ${enrollment.attendanceStatus}`
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {data.learning.courseEnrollments.length === 0 &&
                  data.learning.trainingEnrollments.length === 0 && (
                    <p className="text-[12.5px] text-muted">
                      No active learning activities yet.
                    </p>
                  )}
              </div>
            </PerformancePanel>

            <PerformancePanel>
              <PerformanceSectionHeader
                eyebrow="Credentials"
                title="Certifications"
              />
              <div className="mt-4">
                {data.certifications.length === 0 ? (
                  <EmptyState message="No certifications recorded yet." />
                ) : (
                  <ul className="divide-y divide-line dark:divide-paper/10">
                    {data.certifications.map((certification) => {
                      const isExpired =
                        certification.expiresAt !== null &&
                        loadedAt !== null &&
                        new Date(
                          `${certification.expiresAt}T00:00:00Z`
                        ).getTime() < loadedAt;
                      return (
                        <li
                          key={certification.id}
                          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {certification.courseTitle ??
                                "Untitled certification"}
                            </p>
                            <p className="mt-1 text-[11.5px] text-muted">
                              Issued {formatDate(certification.issuedAt)}
                              {certification.expiresAt
                                ? ` · Expires ${formatDate(certification.expiresAt)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {certification.certificateUrl && (
                              <a
                                href={certification.certificateUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`View certificate for ${certification.courseTitle ?? "certification"}`}
                                className="text-[12px] font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
                              >
                                View certificate
                              </a>
                            )}
                            {isExpired && (
                              <PerformanceStatusBadge tone="bg-red-500/10 text-red-600 dark:text-red-400">
                                Expired
                              </PerformanceStatusBadge>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </PerformancePanel>
          </>
        )
      )}
    </div>
  );
}
