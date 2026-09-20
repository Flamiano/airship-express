"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Download,
  GitBranch,
  GraduationCap,
  RefreshCw,
  Target,
  Trophy,
} from "lucide-react";
import { EmptyState } from "@/performance-development-dashboard/components/ui/EmptyState";
import { SkeletonPanel, SkeletonStatTile } from "@/performance-development-dashboard/components/ui/Skeleton";
import { ExportReportModal, type ExportFormat } from "@/performance-development-dashboard/components/reports/ExportReportModal";
import type {
  CurrentPerDevUser,
  PerformanceReportsSnapshot,
} from "@/performance-development-dashboard/types";
import {
  APPRAISAL_STATUS_LABELS,
  APPRAISAL_STATUS_TONES,
  LEGACY_APPRAISAL_STATUS_TONES,
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
  PERFORMANCE_CYCLE_STATUS_LABELS,
  successionReadinessTone,
  successionRiskTone,
} from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";

const REPORTS_API = "/performance-development-dashboard/api/performance/reports";

const STATUS_PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

const TABS = [
  { key: "performance", label: "Performance Scores", icon: BarChart3 },
  { key: "goals", label: "Goals", icon: Target },
  { key: "competencies", label: "Competencies", icon: Award },
  { key: "learning", label: "Learning & Development", icon: GraduationCap },
  { key: "succession", label: "Succession", icon: GitBranch },
  { key: "recognition", label: "Recognition & Rewards", icon: Trophy },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* Display-only tone lookup: display labels are stable constants, so we can map
 * the server-provided label back to the existing status tone. */
const GOAL_LABEL_TONES: Record<string, string> = {
  [PERFORMANCE_GOAL_STATUS_LABELS.not_started]: PERFORMANCE_GOAL_STATUS_TONES.not_started,
  [PERFORMANCE_GOAL_STATUS_LABELS.in_progress]: PERFORMANCE_GOAL_STATUS_TONES.in_progress,
  [PERFORMANCE_GOAL_STATUS_LABELS.pending_completion]:
    PERFORMANCE_GOAL_STATUS_TONES.pending_completion,
  [PERFORMANCE_GOAL_STATUS_LABELS.completed]: PERFORMANCE_GOAL_STATUS_TONES.completed,
};

const APPRAISAL_LABEL_TONES: Record<string, string> = {
  [APPRAISAL_STATUS_LABELS.draft]: APPRAISAL_STATUS_TONES.draft,
  [APPRAISAL_STATUS_LABELS.self_assessment]: APPRAISAL_STATUS_TONES.self_assessment,
  [APPRAISAL_STATUS_LABELS.manager_assessment]: APPRAISAL_STATUS_TONES.manager_assessment,
  [APPRAISAL_STATUS_LABELS.finalized]: APPRAISAL_STATUS_TONES.finalized,
  [APPRAISAL_STATUS_LABELS.acknowledged]: APPRAISAL_STATUS_TONES.acknowledged,
  "Legacy · Reviewed": LEGACY_APPRAISAL_STATUS_TONES.reviewed,
};

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(snapshot: PerformanceReportsSnapshot): string {
  const rows: string[][] = [["Section", "Metric", "Value"]];

  const add = (section: string, metric: string, value: unknown) => {
    rows.push([section, metric, Array.isArray(value) ? value.join(", ") : String(value)]);
  };

  const scores = snapshot.performanceScores;
  add("Performance Scores", "Total appraisals", scores.totalAppraisals);
  add("Performance Scores", "Officially completed (finalized/acknowledged)", scores.officiallyCompleted);
  add("Performance Scores", "Average final score", fmt(scores.averageFinalScore));
  add("Performance Scores", "Completion rate", fmtPercent(scores.completionRate));
  for (const band of scores.distribution) {
    add("Performance Scores", `Distribution · ${band.label}`, band.count);
  }
  for (const item of scores.byStatus) {
    add("Performance Scores", `Status · ${item.label}`, item.count);
  }

  add("Goals", "Total goals", snapshot.goals.totalGoals);
  add("Goals", "Average progress", fmt(Math.round(snapshot.goals.averageProgress ?? 0), 0));
  for (const item of snapshot.goals.byStatus) {
    add("Goals", `Status · ${item.label}`, item.count);
  }
  for (const item of snapshot.goals.byDepartment) {
    add("Goals", "Department breakdown", `${item.label}: ${item.count}`);
  }
  for (const item of snapshot.goals.byPosition) {
    add("Goals", "Position breakdown", `${item.label}: ${item.count}`);
  }
  for (const item of snapshot.goals.byCycle) {
    add("Goals", "Cycle breakdown", `${item.label}: ${item.count}`);
  }

  add("Competencies", "Employees assessed", snapshot.competencies.employeesAssessed);
  add("Competencies", "Active assessments", snapshot.competencies.assessments);
  add("Competencies", "Average current level", fmt(snapshot.competencies.averageCurrentLevel));
  add("Competencies", "Positive gaps", snapshot.competencies.positiveGapCount);
  for (const gap of snapshot.competencies.gapsByCompetency) {
    add(
      "Competencies",
      `Gap · ${gap.competencyName}`,
      `positive: ${gap.positiveGapCount}, avg gap: ${fmt(gap.averageGap)}`,
    );
  }

  const learning = snapshot.learning;
  add("Learning & Development", "Courses", learning.courses);
  add("Learning & Development", "Training sessions", learning.trainingSessions);
  add("Learning & Development", "Course enrollments (total)", learning.courseEnrollments.total);
  add("Learning & Development", "Course enrollments (in progress)", learning.courseEnrollments.inProgress);
  add("Learning & Development", "Course enrollments (completed)", learning.courseEnrollments.completed);
  add("Learning & Development", "Course completion rate", fmtPercent(learning.courseEnrollments.completionRate));
  add("Learning & Development", "Training enrollments (total)", learning.trainingEnrollments.total);
  add("Learning & Development", "Training enrollments (approved)", learning.trainingEnrollments.approved);
  add("Learning & Development", "Training attendance (attended)", learning.trainingEnrollments.attended);
  add("Learning & Development", "Certifications", learning.certifications);
  add("Learning & Development", "Training evaluations (rated)", learning.trainingEvaluations.rated);
  add("Learning & Development", "Average evaluation rating", fmt(learning.trainingEvaluations.averageRating));

  add("Succession", "Critical positions", snapshot.succession.criticalPositionCount);
  for (const item of snapshot.succession.byRisk) {
    add("Succession", `Risk · ${item.label}`, item.count);
  }
  add("Succession", "Candidates", snapshot.succession.candidateCount);
  for (const item of snapshot.succession.candidatesPerPosition) {
    add("Succession", `Candidates · ${item.label}`, item.count);
  }
  for (const item of snapshot.succession.readinessMix) {
    add("Succession", `Readiness · ${item.label}`, item.count);
  }
  add("Succession", "Average potential rating", fmt(snapshot.succession.averagePotentialRating));

  add("Recognition & Rewards", "Recognitions", snapshot.recognition.recognitionCount);
  add("Recognition & Rewards", "Points awarded", snapshot.recognition.pointsAwarded);
  for (const item of snapshot.recognition.recognitionsByMonth) {
    add("Recognition & Rewards", `Monthly volume · ${item.month}`, item.count);
  }
  for (const item of snapshot.recognition.badgeUsage) {
    add("Recognition & Rewards", `Badge · ${item.badgeName}`, `used ${item.usageCount}`);
  }
  add("Recognition & Rewards", "Redemptions (total)", snapshot.recognition.redemptionTotal);
  for (const item of snapshot.recognition.redemptionsByStatus) {
    add("Recognition & Rewards", `Redemption status · ${item.label}`, item.count);
  }

  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <div>
        <h2 className="font-bricolage text-[15px] font-medium tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 dark:border-paper/10">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11.5px] text-muted">{sub}</p>}
    </div>
  );
}

function CountBar({ label, count, max, tone }: {
  label: string;
  count: number;
  max: number;
  tone?: string;
}) {
  const width = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line px-4 py-3 dark:border-paper/10">
      <div className="flex items-center justify-between gap-3">
        <span className={cn(STATUS_PILL, "shrink-0", tone ?? "bg-line text-muted")}>
          {label}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
          {count}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full transition-all", tone ? "bg-accent" : "bg-accent")} style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function LabeledCountRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 dark:border-paper/10">
      <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{label}</span>
      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
        {count}
      </span>
    </li>
  );
}

function SelectFilter({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type Props = {
  serverUser: CurrentPerDevUser;
};

export function ReportsAnalytics({ serverUser }: Props) {
  const firstName = serverUser.fullName.split(" ")[0];

  const [department, setDepartment] = useState("");
  const [positionId, setPositionId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [snapshot, setSnapshot] = useState<PerformanceReportsSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("performance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchSnapshot = useCallback(
    async (filters: { department: string; positionId: string; cycleId: string }) => {
      const params = new URLSearchParams();
      if (filters.department) params.set("department", filters.department);
      if (filters.positionId) params.set("position_id", filters.positionId);
      if (filters.cycleId) params.set("cycle_id", filters.cycleId);
      const queryString = params.toString();

      const response = await fetch(
        `${REPORTS_API}${queryString ? `?${queryString}` : ""}`,
        { credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body && typeof body === "object" && "error" in body && body.error
            ? body.error
            : `Request failed with status ${response.status}`,
        );
      }

      return body as PerformanceReportsSnapshot;
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    fetchSnapshot({ department: "", positionId: "", cycleId: "" }).then(
      (nextSnapshot) => {
        if (mounted) {
          setSnapshot(nextSnapshot);
          setError(null);
        }
      },
      (err) => {
        if (mounted) {
          setSnapshot(null);
          setError(
            err instanceof Error ? err.message : "Failed to load the reports snapshot.",
          );
        }
      },
    ).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [fetchSnapshot]);

  const commitSnapshot = (promise: Promise<PerformanceReportsSnapshot>) => {
    promise.then(
      (nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setError(null);
      },
      (err) => {
        setSnapshot(null);
        setError(
          err instanceof Error ? err.message : "Failed to load the reports snapshot.",
        );
      },
    ).finally(() => {
      setLoading(false);
    });
  };

  const applyFilters = useCallback(
    (patch: { department?: string; positionId?: string; cycleId?: string }) => {
      const next = { department, positionId, cycleId, ...patch };
      if (patch.department !== undefined) setDepartment(patch.department);
      if (patch.positionId !== undefined) setPositionId(patch.positionId);
      if (patch.cycleId !== undefined) setCycleId(patch.cycleId);
      setLoading(true);
      setError(null);
      commitSnapshot(fetchSnapshot(next));
    },
    [department, positionId, cycleId, fetchSnapshot],
  );

  const handleDepartmentChange = (value: string) => applyFilters({ department: value });
  const handlePositionChange = (value: string) => applyFilters({ positionId: value });
  const handleCycleChange = (value: string) => applyFilters({ cycleId: value });

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    commitSnapshot(fetchSnapshot({ department, positionId, cycleId }));
  };

  const handleExportCsv = () => {
    if (!snapshot) return;
    const blob = new Blob([buildCsv(snapshot)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = (format: ExportFormat) => {
    setExportModalOpen(false);
    if (format === "pdf") {
      window.setTimeout(() => handlePrint(), 0);
    } else {
      handleExportCsv();
    }
  };

  const departmentOptions = useMemo(
    () => (snapshot?.filterOptions.departments ?? []).map((d) => ({ value: d, label: d })),
    [snapshot],
  );
  const positionOptions = useMemo(
    () =>
      (snapshot?.filterOptions.positions ?? []).map((p) => ({
        value: p.id,
        label: p.title,
      })),
    [snapshot],
  );
  const cycleOptions = useMemo(
    () =>
      (snapshot?.filterOptions.cycles ?? []).map((c) => ({
        value: c.id,
        label: `${c.name} · ${PERFORMANCE_CYCLE_STATUS_LABELS[c.status as keyof typeof PERFORMANCE_CYCLE_STATUS_LABELS] ?? c.status}`,
      })),
    [snapshot],
  );

  const hasActiveFilters = Boolean(department || positionId || cycleId);

  return (
    <div className="print-area space-y-6">
      <style>{`
        .print-only { display: none !important; }

        @media print {
          @page { size: A4; margin: 12mm 12mm 16mm 12mm; }

          .perdev-scope {
            overflow: visible !important;
            height: auto !important;
            --ink: #17171a !important;
            --muted: #5b5b63 !important;
            --paper: #ffffff !important;
            --line: #dcdce1 !important;
            --accent: #d81f7f !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .perdev-scope > aside { display: none !important; }
          .perdev-scope > div > header { display: none !important; }

          .perdev-scope > div > main {
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-only { display: block !important; }
          .print-hidden { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; }
          .print-area > .print-only { margin-top: 0 !important; }

          .print-report { color: var(--ink); font-size: 11pt; line-height: 1.5; }

          .print-report-header {
            border-bottom: 2px solid var(--accent);
            padding-bottom: 9pt;
            margin-bottom: 4pt;
            break-after: avoid;
          }
          .print-brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10pt;
          }
          .print-logo { height: 22pt !important; width: auto !important; }
          .print-brand-name {
            font-size: 9.5pt;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-align: right;
            line-height: 1.3;
          }
          .print-report-title {
            margin: 14pt 0 0;
            font-size: 20pt;
            font-weight: 700;
            letter-spacing: 0.01em;
            line-height: 1.15;
          }
          .print-report-title span {
            display: block;
            margin-top: 3pt;
            color: var(--accent);
            font-size: 11pt;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .print-meta-row {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 4pt 12pt;
            margin-top: 10pt;
            font-size: 10pt;
          }
          .print-meta-row strong { font-weight: 700; }

          .print-exec-summary { break-inside: avoid; }
          .print-exec-title {
            margin: 0 0 6pt;
            padding-bottom: 3pt;
            border-bottom: 1px solid var(--line);
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: 0.04em;
          }
          .print-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6pt;
          }
          .print-summary-item { border: 1px solid var(--line); padding: 6pt 7pt; }
          .print-summary-label {
            display: block;
            font-size: 7pt;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--muted);
          }
          .print-summary-value {
            display: block;
            margin-top: 2pt;
            font-size: 15pt;
            font-weight: 700;
            line-height: 1.1;
          }
          .print-summary-sub { display: block; margin-top: 2pt; font-size: 7.5pt; color: var(--muted); }

          .print-report { counter-reset: print-section; }
          .print-report .print-section { margin-top: 14pt; break-inside: auto; }
          .print-report .print-section > section {
            counter-increment: print-section;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
          }

          .print-report .print-section section > div:first-child > span { display: none !important; }
          .print-report .print-section h2 {
            margin: 0;
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: 0.02em;
            break-after: avoid;
          }
          .print-report .print-section h2::before { content: counter(print-section) ". "; font-weight: 700; }
          .print-report .print-section h2 ~ p {
            font-size: 8.5pt;
            color: var(--muted);
            margin-top: 2pt;
            line-height: 1.4;
          }

          .print-report section .rounded-2xl.border,
          .print-report section .rounded-xl.border {
            border-radius: 2pt !important;
            background: transparent !important;
            box-shadow: none !important;
            border-color: var(--line) !important;
          }
          .print-report section li {
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 2pt 0 !important;
          }
          .print-report section .inline-flex { background: transparent !important; }
          .print-report section .h-1\\.5 { display: none !important; }

          .print-report section .text-\\[13px\\] { font-size: 10pt !important; }
          .print-report section .text-\\[12\\.5px\\] { font-size: 9.5pt !important; }
          .print-report section .text-\\[12px\\] { font-size: 9.5pt !important; }
          .print-report section .text-\\[11\\.5px\\] { font-size: 9pt !important; }
          .print-report section .text-\\[11px\\] { font-size: 8.5pt !important; }
          .print-report section .text-\\[10\\.5px\\] { font-size: 8pt !important; }
          .print-report section .text-\\[22px\\] { font-size: 16pt !important; }

          .print-report-footer {
            display: flex;
            justify-content: space-between;
            gap: 8pt;
            margin-top: 18pt;
            padding-top: 6pt;
            border-top: 1px solid var(--line);
            font-size: 8pt;
            color: var(--muted);
          }
        }
      `}</style>

      <div className="space-y-6 print-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ReportHeaderText firstName={firstName} />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!snapshot}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <Download size={14} strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !snapshot}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper px-4 py-4 dark:border-paper/10 print-hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Filters · selection scope only
            </p>
          </div>
          <SelectFilter
            id="reports-department"
            label="Department"
            value={department}
            onChange={handleDepartmentChange}
            placeholder="All departments"
            options={departmentOptions}
          />
          <SelectFilter
            id="reports-position"
            label="Position"
            value={positionId}
            onChange={handlePositionChange}
            placeholder="All positions"
            options={positionOptions}
          />
          <SelectFilter
            id="reports-cycle"
            label="Performance Cycle"
            value={cycleId}
            onChange={handleCycleChange}
            placeholder="All cycles"
            options={cycleOptions}
          />
          {hasActiveFilters && (
            <div className="flex items-end pb-2">
              <button
                type="button"
                onClick={() => {
                  setDepartment("");
                  setPositionId("");
                  setCycleId("");
                  setLoading(true);
                  setError(null);
                  commitSnapshot(fetchSnapshot({ department: "", positionId: "", cycleId: "" }));
                }}
                className="text-[12.5px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        <ReportContextLine snapshot={snapshot} hasActiveFilters={hasActiveFilters} />
      </div>

      {loading && (
        <div className="space-y-5" aria-busy="true" role="status">
          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonStatTile key={index} />
            ))}
          </div>
          <SkeletonPanel lines={7} />
        </div>
      )}

      {!loading && error && (
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

      {!loading && !error && snapshot && (
        <>
          <SummaryMetrics snapshot={snapshot} />

          <div className="flex flex-wrap gap-1.5 border-b border-line pb-3 print-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors",
                    activeTab === tab.key
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {activeTab === "performance" && <PerformanceSection snapshot={snapshot} />}
            {activeTab === "goals" && <GoalsSection snapshot={snapshot} />}
            {activeTab === "competencies" && <CompetenciesSection snapshot={snapshot} />}
            {activeTab === "learning" && <LearningSection snapshot={snapshot} />}
            {activeTab === "succession" && <SuccessionSection snapshot={snapshot} />}
            {activeTab === "recognition" && <RecognitionSection snapshot={snapshot} />}
          </div>

          <RecentActivitySection snapshot={snapshot} />
        </>
      )}
      </div>

      {!loading && !error && snapshot && (
        <div className="print-only print-report">
          <PrintReportHeader snapshot={snapshot} />
          <PrintExecutiveSummary snapshot={snapshot} />
          <div className="print-section">
            <PerformanceSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <GoalsSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <CompetenciesSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <LearningSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <SuccessionSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <RecognitionSection snapshot={snapshot} />
          </div>
          <div className="print-section">
            <RecentActivitySection snapshot={snapshot} />
          </div>
          <PrintReportFooter generatedAt={snapshot.generatedAt} />
        </div>
      )}

      {exportModalOpen && (
        <div className="print-hidden">
          <ExportReportModal
            onClose={() => setExportModalOpen(false)}
            onExport={handleExport}
          />
        </div>
      )}
    </div>
  );
}

function ReportHeaderText({ firstName }: { firstName: string }) {
  return (
    <div>
      <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
        Reports &amp; Analytics
      </h1>
      <p className="mt-2 max-w-xl text-[13px] text-muted">
        {`Hello ${firstName}. This is an organization-level snapshot of existing
        performance development data. Everything here is read-only — no score,
        goal, or record is changed by viewing or exporting a report.`}
      </p>
    </div>
  );
}

function ReportContextLine({
  snapshot,
  hasActiveFilters,
}: {
  snapshot: PerformanceReportsSnapshot | null;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
      {snapshot?.filters.positionTitle && (
        <span>Position: {snapshot.filters.positionTitle}</span>
      )}
      {snapshot?.filters.cycleName && <span>Cycle: {snapshot.filters.cycleName}</span>}
      {snapshot?.filters.department && <span>Department: {snapshot.filters.department}</span>}
      {!hasActiveFilters && <span>Showing the full organization snapshot.</span>}
      <span className="text-line">|</span>
      <span>
        Generated {snapshot ? new Date(snapshot.generatedAt).toLocaleTimeString() : "—"}
      </span>
      {snapshot?.currentCycle && (
        <>
          <span className="text-line">|</span>
          <span>
            Current cycle: {snapshot.currentCycle.name} ·{" "}
            {PERFORMANCE_CYCLE_STATUS_LABELS[
              snapshot.currentCycle.status as keyof typeof PERFORMANCE_CYCLE_STATUS_LABELS
            ] ?? snapshot.currentCycle.status}
          </span>
        </>
      )}
    </div>
  );
}

function SummaryMetrics({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Average Final Score"
        value={fmt(snapshot.performanceScores.averageFinalScore)}
        sub={
          snapshot.performanceScores.officiallyCompleted === 0
            ? "No finalized appraisals available"
            : "Based on finalized/acknowledged appraisals"
        }
      />
      <StatCard
        label="Appraisal Completion"
        value={fmtPercent(snapshot.performanceScores.completionRate)}
        sub={`${snapshot.performanceScores.officiallyCompleted} of ${snapshot.performanceScores.totalAppraisals} finalized or acknowledged`}
      />
      <StatCard
        label="Goal Progress"
        value={fmt(Math.round(snapshot.goals.averageProgress ?? 0), 0)}
        sub={`${snapshot.goals.totalGoals} goals in scope`}
      />
      <StatCard
        label="Employees Assessed"
        value={String(snapshot.competencies.employeesAssessed)}
        sub="With competency assessments"
      />
      <StatCard
        label="Learning & Training"
        value={String(
          snapshot.learning.courses +
            snapshot.learning.trainingSessions +
            snapshot.learning.certifications,
        )}
        sub={`${snapshot.learning.trainingSessions} training sessions, ${snapshot.learning.certifications} certifications`}
      />
      <StatCard
        label="Critical Positions"
        value={String(snapshot.succession.criticalPositionCount)}
        sub={`${snapshot.succession.candidateCount} succession candidates`}
      />
      <StatCard
        label="Recognitions"
        value={String(snapshot.recognition.recognitionCount)}
        sub={`${snapshot.recognition.pointsAwarded} points awarded`}
      />
      <StatCard
        label="Recent Activity"
        value={String(snapshot.recentActivity.length)}
        sub="Latest recorded audit events"
      />
    </div>
  );
}

function PrintReportHeader({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const reportDate = new Date(snapshot.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const scopeParts: string[] = [];
  if (snapshot.filters.department) {
    scopeParts.push(`Department: ${snapshot.filters.department}`);
  }
  if (snapshot.filters.positionTitle) {
    scopeParts.push(`Position: ${snapshot.filters.positionTitle}`);
  }
  if (snapshot.filters.cycleName) {
    scopeParts.push(`Cycle: ${snapshot.filters.cycleName}`);
  }
  if (scopeParts.length === 0) {
    scopeParts.push("Full Organization");
  }

  return (
    <div className="print-report-header">
      <div className="print-brand-row">
        <Image
          src="/images/logo-remove-bg.png"
          alt="Airship Express"
          width={140}
          height={38}
          priority
          className="print-logo"
        />
        <span className="print-brand-name">AIRSHIP EXPRESS COURIER SERVICES</span>
      </div>
      <h1 className="print-report-title">
        PERFORMANCE DEVELOPMENT
        <span>Reports &amp; Analytics · Organization Performance Report</span>
      </h1>
      <div className="print-meta-row">
        <span>
          Report Date: <strong>{reportDate}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Scope: <strong>{scopeParts.join(" · ")}</strong>
        </span>
      </div>
    </div>
  );
}

function PrintExecutiveSummary({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const items = [
    {
      label: "Average Final Score",
      value: fmt(snapshot.performanceScores.averageFinalScore),
      sub:
        snapshot.performanceScores.officiallyCompleted === 0
          ? "No finalized appraisals available"
          : "Based on finalized/acknowledged appraisals",
    },
    {
      label: "Appraisal Completion",
      value: fmtPercent(snapshot.performanceScores.completionRate),
      sub: `${snapshot.performanceScores.officiallyCompleted} of ${snapshot.performanceScores.totalAppraisals} finalized or acknowledged`,
    },
    {
      label: "Goal Progress",
      value: fmt(Math.round(snapshot.goals.averageProgress ?? 0), 0),
      sub: `${snapshot.goals.totalGoals} goals in scope`,
    },
    {
      label: "Employees Assessed",
      value: String(snapshot.competencies.employeesAssessed),
      sub: "With competency assessments",
    },
    {
      label: "Learning & Training",
      value: String(
        snapshot.learning.courses +
          snapshot.learning.trainingSessions +
          snapshot.learning.certifications,
      ),
      sub: `${snapshot.learning.trainingSessions} training sessions, ${snapshot.learning.certifications} certifications`,
    },
    {
      label: "Critical Positions",
      value: String(snapshot.succession.criticalPositionCount),
      sub: `${snapshot.succession.candidateCount} succession candidates`,
    },
    {
      label: "Recognitions",
      value: String(snapshot.recognition.recognitionCount),
      sub: `${snapshot.recognition.pointsAwarded} points awarded`,
    },
    {
      label: "Recent Activity",
      value: String(snapshot.recentActivity.length),
      sub: "Latest recorded audit events",
    },
  ];

  return (
    <div className="print-exec-summary">
      <h2 className="print-exec-title">Executive Summary</h2>
      <div className="print-summary-grid">
        {items.map((item) => (
          <div key={item.label} className="print-summary-item">
            <span className="print-summary-label">{item.label}</span>
            <span className="print-summary-value">{item.value}</span>
            <span className="print-summary-sub">{item.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintReportFooter({ generatedAt }: { generatedAt: string }) {
  const generated = new Date(generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="print-report-footer">
      <span>Performance Development · Reports &amp; Analytics</span>
      <span>Generated {generated}</span>
    </div>
  );
}

function RecentActivitySection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<Activity size={17} strokeWidth={1.75} />}
        title="Recent Activity"
        subtitle="The latest recorded audit events. Not scoped by the current filters."
      />
      <div className="mt-4">
        {snapshot.recentActivity.length === 0 ? (
          <EmptyState message="No recent activity recorded yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshot.recentActivity.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {event.action}
                    <span className="text-muted"> · {event.entityType}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11.5px] text-muted">
                  {event.actorName && <span>{event.actorName}</span>}
                  <span className="text-line">|</span>
                  <span>
                    {new Date(event.createdAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PerformanceSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const scores = snapshot.performanceScores;
  const maxBand = Math.max(...scores.distribution.map((band) => band.count), 1);

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<BarChart3 size={17} strokeWidth={1.75} />}
        title="Performance Scores"
        subtitle="Only finalized and acknowledged appraisals contribute to official scores and the rating-band distribution."
      />
      <div className="mt-4">
        {scores.totalAppraisals === 0 ? (
          <EmptyState message="No appraisals available." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Appraisals in scope"
                value={String(scores.totalAppraisals)}
                sub="All statuses"
              />
              <StatCard
                label="Finalized or acknowledged"
                value={String(scores.officiallyCompleted)}
                sub="Contribute to official scores"
              />
              <StatCard
                label="Completion rate"
                value={fmtPercent(scores.completionRate)}
                sub={`Average final score ${fmt(scores.averageFinalScore)} / 5.00`}
              />
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Final-score distribution
            </p>
            {scores.officiallyCompleted === 0 ? (
              <div className="mt-2">
                <EmptyState message="No finalized appraisals available." />
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {scores.distribution.map((band) => {
                  const percentage = Math.round((band.count / scores.officiallyCompleted) * 100);
                  return (
                    <li
                      key={band.key}
                      className="flex flex-col gap-1.5 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-[13px] font-medium text-ink">{band.label}</span>
                      <div className="flex items-center gap-3 sm:w-1/2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(band.count / maxBand) * 100}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted">
                          {band.count}
                        </span>
                        <span className="shrink-0 w-11 text-right text-[11.5px] tabular-nums text-muted">
                          {percentage}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Status pipeline
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {scores.byStatus.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    STATUS_PILL,
                    APPRAISAL_LABEL_TONES[item.label] ?? "bg-line text-muted",
                  )}
                >
                  {item.label} · {item.count}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function GoalsSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const goals = snapshot.goals;
  const maxStatus = Math.max(...goals.byStatus.map((item) => item.count), 1);

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<Target size={17} strokeWidth={1.75} />}
        title="Goals"
        subtitle={`${goals.totalGoals} goals in scope · average progress ${fmt(
          Math.round(goals.averageProgress ?? 0),
          0,
        )}%`}
      />
      <div className="mt-4">
        {goals.totalGoals === 0 ? (
          <EmptyState message="No performance goals in scope." />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {goals.byStatus.map((item) => (
                <CountBar
                  key={item.label}
                  label={item.label}
                  count={item.count}
                  max={maxStatus}
                  tone={GOAL_LABEL_TONES[item.label]}
                />
              ))}
            </ul>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  By department
                </p>
                {goals.byDepartment.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No goals in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {goals.byDepartment.map((item) => (
                      <LabeledCountRow key={item.label} label={item.label} count={item.count} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  By position
                </p>
                {goals.byPosition.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No goals in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {goals.byPosition.map((item) => (
                      <LabeledCountRow key={item.label} label={item.label} count={item.count} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  By cycle
                </p>
                {goals.byCycle.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No goals in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {goals.byCycle.map((item) => (
                      <LabeledCountRow key={item.label} label={item.label} count={item.count} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function CompetenciesSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const competencies = snapshot.competencies;

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<Award size={17} strokeWidth={1.75} />}
        title="Competencies"
        subtitle="Uses the latest assessment per employee and competency. Levels shown are assessment levels, not appraisal competency ratings."
      />
      <div className="mt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Employees assessed"
            value={String(competencies.employeesAssessed)}
            sub={`${competencies.assessments} active assessments`}
          />
          <StatCard
            label="Average current level"
            value={fmt(competencies.averageCurrentLevel, 1)}
            sub="Latest assessment level"
          />
          <StatCard
            label="Positive competency gaps"
            value={String(competencies.positiveGapCount)}
            sub="Current level below required"
          />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Gap summary
        </p>
        {!competencies.hasAssessments ? (
          <div className="mt-2">
            <EmptyState message="No competency assessments available." />
          </div>
        ) : !competencies.hasPositiveGaps ? (
          <div className="mt-2">
            <EmptyState message="No gaps identified." />
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {competencies.gapsByCompetency.map((gap) => (
              <li
                key={gap.competencyId}
                className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {gap.competencyName}
                  </p>
                  {gap.category && (
                    <p className="mt-0.5 text-[11.5px] text-muted">{gap.category}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[12px] text-muted">
                    Avg current level vs required
                  </span>
                  <span className={cn(STATUS_PILL, "bg-amber-500/10 text-amber-600")}>
                    {gap.positiveGapCount} employee
                    {gap.positiveGapCount === 1 ? "" : "s"} · avg {fmt(gap.averageGap, 1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LearningSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const learning = snapshot.learning;
  const hasLearning =
    learning.courses > 0 ||
    learning.trainingSessions > 0 ||
    learning.courseEnrollments.total > 0 ||
    learning.trainingEnrollments.total > 0 ||
    learning.certifications > 0;

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<GraduationCap size={17} strokeWidth={1.75} />}
        title="Learning & Development"
        subtitle="Informational only — learning activity never affects a performance score."
      />
      <div className="mt-4">
        {!hasLearning ? (
          <EmptyState message="No learning activity available." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Courses" value={String(learning.courses)} sub="Course library" />
              <StatCard
                label="Training sessions"
                value={String(learning.trainingSessions)}
                sub="Scheduled sessions"
              />
              <StatCard
                label="Certifications"
                value={String(learning.certifications)}
                sub="Issued certificates"
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-line px-4 py-3 dark:border-paper/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Course enrollments
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  <LabeledCountRow label="Total enrollments" count={learning.courseEnrollments.total} />
                  <LabeledCountRow label="In progress" count={learning.courseEnrollments.inProgress} />
                  <LabeledCountRow label="Completed" count={learning.courseEnrollments.completed} />
                  <LabeledCountRow
                    label="Completion rate"
                    count={Math.round(learning.courseEnrollments.completionRate ?? 0)}
                  />
                </ul>
              </div>
              <div className="rounded-xl border border-line px-4 py-3 dark:border-paper/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Training enrollments
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  <LabeledCountRow label="Total" count={learning.trainingEnrollments.total} />
                  <LabeledCountRow label="Pending approval" count={learning.trainingEnrollments.pending} />
                  <LabeledCountRow label="Approved" count={learning.trainingEnrollments.approved} />
                  <LabeledCountRow label="Attended" count={learning.trainingEnrollments.attended} />
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-line px-4 py-3 dark:border-paper/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Training evaluations
              </p>
              <p className="mt-2 text-[13px] text-ink">
                {learning.trainingEvaluations.total === 0
                  ? "No training evaluations available."
                  : `${learning.trainingEvaluations.rated} rated of ${learning.trainingEvaluations.total} total · average rating ${fmt(
                      learning.trainingEvaluations.averageRating,
                      2,
                    )} / 5`}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SuccessionSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const succession = snapshot.succession;
  const hasRecords = succession.criticalPositionCount > 0 || succession.candidateCount > 0;

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<GitBranch size={17} strokeWidth={1.75} />}
        title="Succession"
        subtitle="Risk and readiness values are stored free text and counted as recorded — no readiness timeline or manager relationship is derived."
      />
      <div className="mt-4">
        {!hasRecords ? (
          <EmptyState message="No succession records available." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Critical positions"
                value={String(succession.criticalPositionCount)}
                sub="Marked as critical"
              />
              <StatCard
                label="Succession candidates"
                value={String(succession.candidateCount)}
                sub="Across critical positions"
              />
              <StatCard
                label="Average potential rating"
                value={fmt(succession.averagePotentialRating, 1)}
                sub="1 – 5 scale"
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Critical positions by risk
                </p>
                {succession.byRisk.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No critical positions in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {succession.byRisk.map((item) => (
                      <li
                        key={item.label}
                        className={cn(
                          STATUS_PILL,
                          "normal-case",
                          successionRiskTone(item.label),
                        )}
                      >
                        {item.label} · {item.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Readiness mix
                </p>
                {succession.readinessMix.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No candidates in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {succession.readinessMix.map((item) => (
                      <li
                        key={item.label}
                        className={cn(
                          STATUS_PILL,
                          "normal-case",
                          successionReadinessTone(item.label),
                        )}
                      >
                        {item.label} · {item.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Candidates per critical position
            </p>
            {succession.candidatesPerPosition.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">No critical positions in scope.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {succession.candidatesPerPosition.map((item) => (
                  <LabeledCountRow key={item.label} label={item.label} count={item.count} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RecognitionSection({ snapshot }: { snapshot: PerformanceReportsSnapshot }) {
  const recognition = snapshot.recognition;
  const hasRecords =
    recognition.recognitionCount > 0 ||
    recognition.redemptionTotal > 0 ||
    recognition.badgeUsage.length > 0;

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
      <SectionHeading
        icon={<Trophy size={17} strokeWidth={1.75} />}
        title="Recognition & Rewards"
        subtitle="No reward catalog exists, so payout or cost is never calculated here — only what was recorded."
      />
      <div className="mt-4">
        {!hasRecords ? (
          <EmptyState message="No recognition or reward records available." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Recognitions"
                value={String(recognition.recognitionCount)}
                sub="Posted recognition records"
              />
              <StatCard
                label="Points awarded"
                value={String(recognition.pointsAwarded)}
                sub="Points attached to recognitions"
              />
              <StatCard
                label="Redemptions"
                value={String(recognition.redemptionTotal)}
                sub="Reward redemption requests"
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Recognition volume by month
                </p>
                {recognition.recognitionsByMonth.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No recognitions in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {recognition.recognitionsByMonth.map((item) => (
                      <LabeledCountRow key={item.month} label={item.month} count={item.count} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Badge usage
                </p>
                {recognition.badgeUsage.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">No badges used in scope.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {recognition.badgeUsage.map((item) => (
                      <LabeledCountRow key={item.badgeId} label={item.badgeName} count={item.usageCount} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Redemption pipeline
            </p>
            {recognition.redemptionsByStatus.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">No redemption requests in scope.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {recognition.redemptionsByStatus.map((item) => (
                  <li
                    key={item.label}
                    className={cn(STATUS_PILL, "normal-case", "bg-line text-muted")}
                  >
                    {item.label} · {item.count}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}