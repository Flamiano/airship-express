"use client";

import { useState } from "react";
import { useApiResource } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/use-api";
import {
  Badge,
  Button,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/ui";
import { formatDate } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/datetime";
import { Appraisal } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";

type CompetencyScore = {
  id: string;
  employee_id: string | null;
  current_level: number;
  required_level: number | null;
  assessed_at: string | null;
  hr3_competencies: { name: string; category: string } | null;
};

type Goal = {
  id: string;
  employee_id: string | null;
  title: string;
  status: string | null;
  progress_percent: number | null;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

function levelLabel(level: number | null) {
  if (level === null || level < 1 || level > 5) return null;
  return LEVEL_LABELS[level];
}

function gapVariant(
  current: number,
  required: number | null
): "success" | "warning" | "danger" | "neutral" {
  if (required === null) return "neutral";
  if (current >= required) return "success";
  if (current >= required - 1) return "warning";
  return "danger";
}

function gapLabel(current: number, required: number | null): string | null {
  if (required === null) return null;
  if (current >= required) return "Meets";
  if (current >= required - 1) return "Close";
  return "Gap";
}

function sectionHeading(text: string) {
  return (
    <p className="mt-3 mb-1 text-xs font-semibold text-muted first:mt-0">
      {text}
    </p>
  );
}

function EmptyContextNote() {
  return (
    <div className="mt-3 rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted">
      No appraisal or performance records available for this employee.
    </div>
  );
}

export type PerformanceContextData = {
  appraisals: Appraisal[];
  competencyScores: CompetencyScore[];
  goals: Goal[];
};

export function usePerformanceContext(disabled?: boolean): PerformanceContextData {
  const { data: appraisals } = useApiResource<Appraisal>({
    path: "appraisals",
    listKey: "appraisals",
    disabled,
  });
  const { data: competencyScores } = useApiResource<CompetencyScore>({
    path: "competency-scores",
    listKey: "scores",
    disabled,
  });
  const { data: goals } = useApiResource<Goal>({
    path: "goals",
    listKey: "goals",
    disabled,
  });

  return { appraisals, competencyScores, goals };
}

export function PerformanceContext({
  employeeId,
  data,
}: {
  employeeId: string | null;
  data: PerformanceContextData;
}) {
  const [open, setOpen] = useState(false);

  if (!employeeId) return <EmptyContextNote />;

  const employeeAppraisals = data.appraisals
    .filter((a) => a.employee_id === employeeId)
    .sort((x, y) =>
      (y.finalized_at ?? y.created_at).localeCompare(x.finalized_at ?? x.created_at)
    );
  const latestAppraisal = employeeAppraisals[0];

  const employeeCompetencies = data.competencyScores.filter(
    (s) => s.employee_id === employeeId
  );
  const employeeGoals = data.goals.filter((g) => g.employee_id === employeeId);

  const hasAny =
    employeeAppraisals.length > 0 ||
    employeeCompetencies.length > 0 ||
    employeeGoals.length > 0;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        className="h-8 shrink-0 text-xs"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? "Hide performance context" : "Show performance context"}
      </Button>

      {open && !hasAny && <EmptyContextNote />}

      {open && hasAny && (
        <div className="mt-3">
          {employeeAppraisals.length > 0 && (
            <>
              {sectionHeading("Appraisal")}
              <div className="flex flex-col gap-1">
                {employeeAppraisals.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-muted">
                      {a.review_period}
                      <span className="ml-1 capitalize">({a.status})</span>
                    </span>
                    <span className="shrink-0 text-muted">
                      {a.final_score !== null && a.final_score !== undefined
                        ? `Final: ${a.final_score}`
                        : a.manager_rating !== null &&
                          a.manager_rating !== undefined
                          ? `Manager: ${a.manager_rating}`
                          : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {latestAppraisal && (
                <p className="mt-1 text-xs text-muted">
                  Manager rating{" "}
                  {latestAppraisal.manager_rating !== null &&
                  latestAppraisal.manager_rating !== undefined
                    ? `: ${latestAppraisal.manager_rating}`
                    : "not recorded for latest appraisal"}
                  {latestAppraisal.status === "finalized" &&
                    latestAppraisal.final_score !== null &&
                    ` · Final score: ${latestAppraisal.final_score}`}
                </p>
              )}
            </>
          )}

          {employeeCompetencies.length > 0 && (
            <>
              {sectionHeading("Competency")}
              <div className="flex flex-col gap-1">
                {employeeCompetencies.map((s) => {
                  const gapCls = gapLabel(s.current_level, s.required_level);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-muted">
                        {s.hr3_competencies?.name ?? "Unknown competency"}
                        {s.hr3_competencies?.category && (
                          <span className="ml-1">
                            ({s.hr3_competencies.category})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted">
                        Level: {s.current_level}
                        {levelLabel(s.current_level)
                          ? ` (${levelLabel(s.current_level)})`
                          : ""}
                        {s.required_level !== null && (
                          <> · Required: {s.required_level}</>
                        )}
                        {gapCls && (
                          <Badge
                            variant={gapVariant(
                              s.current_level,
                              s.required_level
                            )}
                          >
                            {gapCls}
                          </Badge>
                        )}
                        {s.assessed_at && (
                          <span className="ml-1">
                            · {formatDate(s.assessed_at)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {employeeGoals.length > 0 && (
            <>
              {sectionHeading("Goals")}
              <div className="flex flex-col gap-1">
                {employeeGoals.slice(0, 5).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-muted">{g.title}</span>
                    <span className="shrink-0 text-muted">
                      {g.progress_percent !== null &&
                        g.progress_percent !== undefined && (
                          <span className="mr-2">{g.progress_percent}%</span>
                        )}
                      {g.status && <span>{g.status}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
