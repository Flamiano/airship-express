"use client";

import { useState } from "react";
import { useApiResource } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/use-api";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
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

type Recognition = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string | null;
  reason_category: string | null;
  points: number | null;
  visibility: string | null;
  created_at: string;
  hr3_badges: { name: string; icon_url: string | null } | null;
};

type CourseEnrollment = {
  id: string;
  employee_id: string | null;
  status: string;
  progress_percent: number | null;
  completed_at: string | null;
  enrolled_at: string | null;
  hr3_courses: { title: string } | null;
};

type TrainingEnrollment = {
  id: string;
  employee_id: string | null;
  approval_status: string | null;
  attendance_status: string | null;
  enrolled_at: string | null;
  hr3_training_sessions: {
    title: string | null;
    schedule_date: string | null;
    session_type: string | null;
    trainer_name: string | null;
    mode: string | null;
  } | null;
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

export type CandidateEvidenceData = {
  appraisals: Appraisal[];
  competencyScores: CompetencyScore[];
  recognitions: Recognition[];
  enrollments: CourseEnrollment[];
  trainingEnrollments: TrainingEnrollment[];
};

export function useCandidateEvidence(disabled?: boolean): CandidateEvidenceData {
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
  const { data: recognitions } = useApiResource<Recognition>({
    path: "recognitions",
    listKey: "recognitions",
    disabled,
  });
  const { data: enrollments } = useApiResource<CourseEnrollment>({
    path: "enrollments",
    listKey: "enrollments",
    disabled,
  });
  const { data: trainingEnrollments } = useApiResource<TrainingEnrollment>({
    path: "training-enrollments",
    listKey: "enrollments",
    disabled,
  });

  return {
    appraisals,
    competencyScores,
    recognitions,
    enrollments,
    trainingEnrollments,
  };
}

export function CandidateEvidence({
  employeeId,
  evidence,
}: {
  employeeId: string | null;
  evidence: CandidateEvidenceData;
}) {
  const { getDirectoryUser } = useDirectory();
  const [open, setOpen] = useState(false);

  if (!employeeId) return <EvidenceEmptyNote />;

  const employeeAppraisals = evidence.appraisals
    .filter((a) => a.employee_id === employeeId)
    .sort((x, y) =>
      (y.finalized_at ?? y.created_at).localeCompare(x.finalized_at ?? x.created_at)
    );
  const latestFinalized = employeeAppraisals.find((a) => a.status === "finalized");

  const employeeCompetencies = evidence.competencyScores.filter(
    (s) => s.employee_id === employeeId
  );
  const employeeRecognitions = evidence.recognitions.filter(
    (r) => r.recipient_id === employeeId
  );
  const employeeEnrollments = evidence.enrollments.filter(
    (e) => e.employee_id === employeeId
  );
  const employeeTraining = evidence.trainingEnrollments.filter(
    (t) => t.employee_id === employeeId
  );

  const hasAny =
    employeeAppraisals.length > 0 ||
    employeeCompetencies.length > 0 ||
    employeeRecognitions.length > 0 ||
    employeeEnrollments.length > 0 ||
    employeeTraining.length > 0;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        className="h-8 shrink-0 text-xs"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? "Hide evidence" : "Show performance evidence"}
      </Button>

      {open && !hasAny && <EvidenceEmptyNote />}

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
                      <span className="ml-1 capitalize">
                        ({a.status}
                        {latestFinalized?.id === a.id ? " · finalized" : ""}
                        )
                      </span>
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

          {employeeRecognitions.length > 0 && (
            <>
              {sectionHeading("Recognition")}
              <div className="flex flex-col gap-1">
                {employeeRecognitions.slice(0, 3).map((r) => {
                  const sender = getDirectoryUser(r.sender_id);
                  return (
                    <div key={r.id} className="text-xs text-muted">
                      {r.reason_category && (
                        <span className="mr-2 capitalize">
                          {r.reason_category.replace(/_/g, " ")}
                        </span>
                      )}
                      {r.message && <span className="mr-2">{r.message}</span>}
                      {r.hr3_badges?.name && (
                        <span className="mr-2">Badge: {r.hr3_badges.name}</span>
                      )}
                      {r.points !== null && r.points !== undefined && (
                        <span className="mr-2">{r.points} pts</span>
                      )}
                      {sender && <span className="mr-2">from {sender.name}</span>}
                      {r.visibility === "private" && (
                        <Badge variant="neutral">Private</Badge>
                      )}
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {employeeEnrollments.length > 0 && (
            <>
              {sectionHeading("Learning & Development")}
              <div className="flex flex-col gap-1">
                {employeeEnrollments.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-muted">
                      {e.hr3_courses?.title ?? "Unknown course"}
                    </span>
                    <span className="shrink-0 text-muted">
                      {e.progress_percent !== null && `${e.progress_percent}%`}
                      {e.status && <span className="ml-1">{e.status}</span>}
                      {e.completed_at && (
                        <span className="ml-1">
                          · Completed {formatDate(e.completed_at)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {employeeTraining.length > 0 && (
            <>
              {sectionHeading("Training")}
              <div className="flex flex-col gap-1">
                {employeeTraining.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-muted">
                      {t.hr3_training_sessions?.title ?? "Unknown session"}
                    </span>
                    <span className="shrink-0 text-muted">
                      {t.hr3_training_sessions?.session_type && (
                        <span className="mr-2 capitalize">
                          {t.hr3_training_sessions.session_type}
                        </span>
                      )}
                      {t.approval_status && (
                        <span className="mr-2">{t.approval_status}</span>
                      )}
                      {t.attendance_status && (
                        <span className="mr-2">{t.attendance_status}</span>
                      )}
                      {t.hr3_training_sessions?.schedule_date && (
                        <span>{formatDate(t.hr3_training_sessions.schedule_date)}</span>
                      )}
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

function EvidenceEmptyNote() {
  return (
    <div className="mt-3 rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted">
      No appraisal or development records available for this employee.
    </div>
  );
}
