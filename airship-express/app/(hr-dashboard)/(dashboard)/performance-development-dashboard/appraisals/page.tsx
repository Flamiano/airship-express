"use client";

import { useMemo, useState } from "react";
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
  SkeletonStats,
  StatCard,
  TableActions,
  TableCell,
  controlSmallClass,
  errorTextClass,
  inputClass,
  selectClass,
  textareaClass,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/ui";
import { useHrAuth, } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/hr-auth";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
import { useApiResource, useApiMutation } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/use-api";
import { formatDate } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/datetime";
import { Appraisal, type DirectoryUser, type DimensionScore, type GoalScore } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/types";
import { PERFORMANCE_RATING_LABELS, LETTER_GRADE_LABELS, type PerformanceRating, type LetterGrade } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/ratings";
import { Check, ClipboardCheck, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";

type CompetencyScore = {
  id: string;
  employee_id: string | null;
  competency_id: string | null;
  current_level: number;
  required_level: number | null;
  assessed_by: string | null;
  assessed_at: string | null;
  hr3_competencies: { name: string; category: string } | null;
};

type GoalCompetencyLink = {
  id: string;
  goal_id: string;
  competency_id: string;
  created_at: string;
  created_by: string | null;
  hr3_competencies: { name: string; category: string | null } | null;
};

type FeedbackEntry = {
  id: string;
  employee_id: string | null;
  given_by: string;
  message: string;
  feedback_type: string;
  created_at: string;
};

type CourseEnrollment = {
  id: string;
  employee_id: string | null;
  course_id: string | null;
  status: string;
  progress_percent: number | null;
  completed_at: string | null;
  enrolled_at: string | null;
  hr3_courses: { title: string } | null;
};

type TrainingEnrollment = {
  id: string;
  employee_id: string | null;
  session_id: string | null;
  approval_status: string | null;
  attendance_status: string | null;
  enrolled_at: string | null;
  hr3_training_sessions: { title: string; schedule_date: string | null; session_type: string | null; trainer_name: string | null; mode: string | null; venue: string | null } | null;
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

type PIP = {
  id: string;
  employee_id: string;
  reason: string | null;
  action_plan: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

function pipStatusLabel(status: string | null): string {
  if (!status) return "—";
  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

function pipStatusVariant(
  status: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "active") return "warning";
  return "neutral";
}

type GoalDetail = Goal & {
  description?: string | null;
  category?: string | null;
  status?: string | null;
  progress_percent?: number | null;
  target?: string | null;
  priority?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

const DIMENSIONS = [
  "Job Knowledge",
  "Reliability",
  "Customer Service",
  "Teamwork",
  "Speed & Efficiency",
];

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

function priorityLabel(priority: string | null) {
  if (!priority) return null;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Developing",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

function ratingLabel(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  return RATING_LABELS[score];
}

function gapVariant(current: number, required: number | null): "success" | "warning" | "danger" | "neutral" {
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

type Goal = { id: string; title: string; employee_id: string | null };

const FILTERS = ["all", "draft", "reviewed", "finalized"] as const;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    reviewed: "Reviewed",
    finalized: "Finalized",
  };
  return labels[status] ?? status;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "finalized") return "success";
  if (status === "reviewed") return "warning";
  return "neutral";
}

function verdict(
  final: number | null
): { label: string; variant: "success" | "warning" | "danger" | "neutral" } | null {
  if (final === null) return null;
  if (final >= 4) return { label: "Exceeds Expectations", variant: "success" };
  if (final >= 3) return { label: "Meets Expectations", variant: "neutral" };
  return { label: "Needs Improvement", variant: "danger" };
}

function buildDimensionScores(record: Record<string, string>): DimensionScore[] {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    score: Number(record[dimension]),
  })).filter((s) => !Number.isNaN(s.score));
}

function buildGoalScores(record: Record<string, string>, goals: Goal[]): GoalScore[] {
  return goals
    .map((g) => ({
      goal_id: g.id,
      title: g.title,
      score: Number(record[g.id]),
    }))
    .filter((s) => !Number.isNaN(s.score));
}

function RatingSelect({ value, onChange, label, disabled }: { value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={disabled} className={controlSmallClass + (disabled ? " opacity-60" : "")}>
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

function PerformanceRatingSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ratings: PerformanceRating[] = ["E", "S", "VG", "G", "NI", "F"];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={controlSmallClass}>
      <option value="">—</option>
      {ratings.map((r) => (
        <option key={r} value={r}>{r} — {PERFORMANCE_RATING_LABELS[r]}</option>
      ))}
    </select>
  );
}

function LetterGradeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const grades: LetterGrade[] = ["A", "B", "C", "D", "E", "F"];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={controlSmallClass}>
      <option value="">—</option>
      {grades.map((g) => (
        <option key={g} value={g}>{g} — {LETTER_GRADE_LABELS[g]}</option>
      ))}
    </select>
  );
}

function DimensionBreakdown({ managerScores }: { managerScores: DimensionScore[] | null }) {
  if (!managerScores || managerScores.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {managerScores.map((s) => (
        <div key={s.dimension}>
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-muted">{s.dimension}</span>
            <span className="text-muted">{s.score} · {ratingLabel(s.score)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GoalBreakdown({ goalScores }: { goalScores: GoalScore[] | null }) {
  if (!goalScores || goalScores.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Goal Achievement</p>
      {goalScores.map((g) => (
        <div key={g.goal_id} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted">{g.title}</span>
          <span className="shrink-0 text-muted">{g.score} · {ratingLabel(g.score)}</span>
        </div>
      ))}
    </div>
  );
}

function EvidenceSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md border border-line bg-muted/5 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-muted/10 dark:border-paper/15 dark:text-paper"
      >
        <span>{title} ({count})</span>
        <svg
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="mt-2 flex flex-col gap-1 pl-1">{children}</div>}
    </div>
  );
}

function ReviewForm({ appraisal, isOwnAppraisal, onUpdated, getDirectoryUser }: { appraisal: Appraisal; isOwnAppraisal: boolean; onUpdated: () => void; getDirectoryUser: (id: string | null | undefined) => DirectoryUser | undefined }) {
  const initialManager = (appraisal.manager_dimension_scores ?? []).reduce(
    (acc, s) => ({ ...acc, [s.dimension]: s.score.toString() }),
    {} as Record<string, string>
  );
  const initialGoal = (appraisal.goal_scores ?? []).reduce(
    (acc, g) => ({ ...acc, [g.goal_id]: g.score.toString() }),
    {} as Record<string, string>
  );
  const [managerScores, setManagerScores] = useState<Record<string, string>>(initialManager);
  const [goalScores, setGoalScores] = useState<Record<string, string>>(initialGoal);
  const [selfRating, setSelfRating] = useState<string>(appraisal.self_rating?.toString() ?? "");
  const [performanceRating, setPerformanceRating] = useState<string>(appraisal.performance_rating ?? "");
  const [letterGrade, setLetterGrade] = useState<string>(appraisal.letter_grade ?? "");
  const [strengths, setStrengths] = useState(appraisal.strengths ?? "");
  const [improvements, setImprovements] = useState(appraisal.improvements ?? "");
  const [comments, setComments] = useState(appraisal.comments ?? "");

  type ReviewTab = "goals" | "dimensions" | "strengths" | "selfAssessment" | "preview";
  const [activeTab, setActiveTab] = useState<ReviewTab>("goals");

  const { data: allGoals } = useApiResource<Goal>({ path: "goals", listKey: "goals" });
  const goals = allGoals.filter((g) => g.employee_id === appraisal.employee_id);

  const { data: competencyScores } = useApiResource<CompetencyScore>({
    path: "competency-scores",
    listKey: "scores",
  });
  const employeeCompetencies = (competencyScores ?? []).filter(
    (s) => s.employee_id === appraisal.employee_id
  );

  const { data: goalCompetencyLinks } = useApiResource<GoalCompetencyLink>({
    path: "goal-competencies",
    listKey: "goal_competencies",
  });

  const { data: feedbackEntries } = useApiResource<FeedbackEntry>({
    path: "feedback",
    listKey: "feedback",
  });
  const employeeFeedback = (feedbackEntries ?? []).filter(
    (f) => f.employee_id === appraisal.employee_id
  );

  const { data: enrollments } = useApiResource<CourseEnrollment>({
    path: "enrollments",
    listKey: "enrollments",
  });
  const employeeEnrollments = (enrollments ?? []).filter(
    (e) => e.employee_id === appraisal.employee_id
  );

  const { data: trainingEnrollments } = useApiResource<TrainingEnrollment>({
    path: "training-enrollments",
    listKey: "enrollments",
  });
  const employeeTraining = (trainingEnrollments ?? []).filter(
    (t) => t.employee_id === appraisal.employee_id
  );

  const { data: recognitions } = useApiResource<Recognition>({
    path: "recognitions",
    listKey: "recognitions",
  });
  const employeeRecognitions = (recognitions ?? []).filter(
    (r) => r.recipient_id === appraisal.employee_id
  );

  const { data: pips } = useApiResource<PIP>({
    path: "pip",
    listKey: "pips",
  });
  const employeePips = (pips ?? []).filter(
    (p) => p.employee_id === appraisal.employee_id
  );

  const saveMutation = useApiMutation({
    path: "appraisals",
    method: "PUT",
    onSuccess: () => {
      onUpdated();
      toast.success("Appraisal saved successfully.");
    },
  });

  const filled = DIMENSIONS.map((d) => managerScores[d]).filter((v) => v !== undefined && v !== "");
  const managerAverage =
    filled.length > 0
      ? Math.round((filled.reduce((sum, v) => sum + Number(v), 0) / filled.length) * 10) / 10
      : null;
  const allRated = DIMENSIONS.every((d) => managerScores[d]);

  const goalFilled = Object.values(goalScores).filter((v) => v !== undefined && v !== "");
  const goalAverage =
    goalFilled.length > 0
      ? Math.round((goalFilled.reduce((sum, v) => sum + Number(v), 0) / goalFilled.length) * 10) / 10
      : null;

  const previewFinalScore =
    managerAverage !== null && goalAverage !== null
      ? Math.round(((managerAverage + goalAverage) / 2) * 10) / 10
      : managerAverage ?? goalAverage;

  const goalCompetencyMap = useMemo(() => {
    const map = new Map<string, GoalCompetencyLink[]>();
    for (const link of goalCompetencyLinks ?? []) {
      const list = map.get(link.goal_id) ?? [];
      list.push(link);
      map.set(link.goal_id, list);
    }
    return map;
  }, [goalCompetencyLinks]);

  const employeeCompetencyMap = useMemo(() => {
    const map = new Map<string, CompetencyScore>();
    for (const score of employeeCompetencies) {
      if (score.competency_id) {
        map.set(score.competency_id, score);
      }
    }
    return map;
  }, [employeeCompetencies]);

  async function save(nextStatus: string) {
    const { error: submitError } = await saveMutation.submit({
      id: appraisal.id,
      ...(isOwnAppraisal
        ? { self_rating: selfRating ? Number(selfRating) : undefined }
        : {
            manager_dimension_scores: buildDimensionScores(managerScores),
            goal_scores: buildGoalScores(goalScores, goals),
            performance_rating: performanceRating || undefined,
            letter_grade: letterGrade || undefined,
            strengths,
            improvements,
            comments,
            status: nextStatus,
          }),
    });
    if (submitError) {
      const detail =
        submitError.fieldErrors.length > 0
          ? `${submitError.message} (${submitError.fieldErrors
              .map((f) => f.message)
              .join("; ")})`
          : submitError.message;
      toast.error(
        `Failed to save appraisal. ${detail}${
          submitError.requestId ? ` [req: ${submitError.requestId}]` : ""
        }`
      );
    }
  }

  const tabs = [
    { id: "goals" as ReviewTab, label: "Goals" },
    { id: "dimensions" as ReviewTab, label: "Dimensions" },
    { id: "strengths" as ReviewTab, label: "Strengths & Improvements" },
    { id: "selfAssessment" as ReviewTab, label: "Self-Assessment" },
    { id: "preview" as ReviewTab, label: "Preview & Finalize" },
  ];

  const visibleTabs = isOwnAppraisal
    ? tabs.filter((t) => t.id === "selfAssessment" || t.id === "preview")
    : tabs;

  function goToTab(next: ReviewTab) {
    setActiveTab(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Review sections"
        className="flex flex-wrap gap-2"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
              activeTab === tab.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-line bg-paper text-muted hover:border-accent/40 hover:text-ink dark:bg-ink dark:text-muted dark:hover:text-paper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "goals" && !isOwnAppraisal && (
        <div role="tabpanel" id="panel-goals" aria-labelledby="tab-goals" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Goal Achievement</p>
            {goals.length === 0 ? (
              <p className="text-xs text-muted">No goals linked for this employee.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {goals.map((g) => {
                  const detail = g as GoalDetail;
                  return (
                    <div key={g.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm">{g.title}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted">
                            {goalScores[g.id] ? ratingLabel(Number(goalScores[g.id])) : ""}
                          </span>
                          <RatingSelect
                            value={goalScores[g.id] ?? ""}
                            onChange={(value) => setGoalScores((prev) => ({ ...prev, [g.id]: value }))}
                            label={`Goal rating for ${g.title}`}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted">
                        {detail.description && <span>{detail.description} · </span>}
                        {detail.category && <span className="mr-2 capitalize">{detail.category}</span>}
                        {detail.status && <span className="mr-2">{detail.status}</span>}
                        {detail.progress_percent !== undefined && detail.progress_percent !== null && (
                          <span className="mr-2">{detail.progress_percent}%</span>
                        )}
                        {detail.target && <span className="mr-2">Target: {detail.target}</span>}
                        {detail.priority && <span className="mr-2">Priority: {priorityLabel(detail.priority)}</span>}
                        {detail.start_date && <span className="mr-2">Started: {detail.start_date}</span>}
                        {detail.created_at && !detail.start_date && <span className="mr-2">Started: {formatDate(detail.created_at)}</span>}
                        {detail.due_date && <span>Due {detail.due_date}</span>}
                      </div>
                      {(() => {
                        const linked = goalCompetencyMap.get(g.id) ?? [];
                        if (linked.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1">
                            {linked.map((l) => {
                              const comp = employeeCompetencyMap.get(l.competency_id);
                              if (!comp) return null;
                              const current = comp.current_level;
                              const required = comp.required_level;
                              const meets = current >= (required ?? current);
                              return (
                                <Badge key={l.id} variant={meets ? "success" : "warning"}>
                                  {l.hr3_competencies?.name ?? "Unknown"} · {current}/{required ?? "—"} · {meets ? "Meets" : "Gap"}
                                </Badge>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => goToTab("dimensions")}>Next →</Button>
          </div>
        </div>
      )}

      {activeTab === "dimensions" && !isOwnAppraisal && (
        <div role="tabpanel" id="panel-dimensions" aria-labelledby="tab-dimensions" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Manager Rating</p>
            {DIMENSIONS.map((dimension) => (
              <div key={dimension} className="flex items-center justify-between gap-3">
                <span className="text-sm">{dimension}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">
                    {managerScores[dimension] ? ratingLabel(Number(managerScores[dimension])) : ""}
                  </span>
                  <RatingSelect
                    value={managerScores[dimension] ?? ""}
                    onChange={(value) => setManagerScores((prev) => ({ ...prev, [dimension]: value }))}
                    label={`Manager rating for ${dimension}`}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted">
              Average: {managerAverage ?? "—"}
              {appraisal.status === "reviewed" && ` · Final score will be ${previewFinalScore ?? "—"}`}
            </p>
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => goToTab("goals")}>← Back</Button>
            <Button onClick={() => goToTab("strengths")}>Next →</Button>
          </div>
        </div>
      )}

      {activeTab === "strengths" && !isOwnAppraisal && (
        <div role="tabpanel" id="panel-strengths" aria-labelledby="tab-strengths" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Strengths & Improvements</p>
            <textarea placeholder="Strengths" aria-label="Strengths" value={strengths} onChange={(e) => setStrengths(e.target.value)} className={textareaClass} />
            <textarea placeholder="Areas for improvement" aria-label="Areas for improvement" value={improvements} onChange={(e) => setImprovements(e.target.value)} className={textareaClass} />
            <textarea placeholder="Comments" aria-label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} className={textareaClass} />
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => goToTab("dimensions")}>← Back</Button>
            <Button onClick={() => goToTab("selfAssessment")}>Next →</Button>
          </div>
        </div>
      )}

      {activeTab === "selfAssessment" && (
        <div role="tabpanel" id="panel-selfAssessment" aria-labelledby="tab-selfAssessment" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Self Rating</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Self Assessment</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">
                  {selfRating ? ratingLabel(Number(selfRating)) : ""}
                </span>
                <RatingSelect
                  value={selfRating}
                  onChange={(value) => setSelfRating(value)}
                  disabled={!isOwnAppraisal}
                  label="Self rating"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            {visibleTabs.some((t) => t.id === "strengths") && (
              <Button variant="secondary" onClick={() => goToTab("strengths")}>← Back</Button>
            )}
            <Button onClick={() => goToTab("preview")}>Next →</Button>
          </div>
        </div>
      )}

      {activeTab === "preview" && (
        <div role="tabpanel" id="panel-preview" aria-labelledby="tab-preview" className="flex flex-col gap-4">
          <div className="border-t border-line pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Performance Evidence</p>

            {employeeCompetencies.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Competency Assessment</p>
                <div className="flex flex-col gap-1">
                  {employeeCompetencies.map((s) => {
                    const gapCls = gapLabel(s.current_level, s.required_level);
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted">
                          {s.hr3_competencies?.name ?? "Unknown competency"}
                          {s.hr3_competencies?.category && <span className="ml-1">({s.hr3_competencies.category})</span>}
                        </span>
                        <span className="shrink-0 text-muted">
                          Current: {s.current_level} {levelLabel(s.current_level) ? `(${levelLabel(s.current_level)})` : ""} · Required: {s.required_level ?? "—"}
                          {gapCls && (
                            <Badge variant={gapVariant(s.current_level, s.required_level)}>
                              {gapCls}
                            </Badge>
                          )}
                          {s.assessed_at && <span className="ml-1">· {formatDate(s.assessed_at)}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {employeeCompetencies.length > 0 && (() => {
              const avgGap = employeeCompetencies.reduce((sum, s) => sum + ((s.required_level ?? s.current_level) - s.current_level), 0) / employeeCompetencies.length;
              return (
                <div className="mb-4 rounded-md border border-line bg-muted/5 p-2">
                  <p className="text-xs font-medium text-muted">Competency Gap Summary</p>
                  <p className="text-xs text-muted">
                    Average gap: {avgGap > 0 ? `+${avgGap.toFixed(1)} levels below required` : avgGap < 0 ? `${Math.abs(avgGap).toFixed(1)} levels above required` : "Meets all requirements"}
                  </p>
                </div>
              );
            })()}

            {employeeFeedback.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Continuous Feedback</p>
                <div className="flex flex-col gap-1">
                  {employeeFeedback.map((f) => {
                    const giver = getDirectoryUser(f.given_by);
                    return (
                      <div key={f.id} className="text-xs text-muted">
                        <span className="mr-2">{f.feedback_type}</span>
                        <span className="mr-2">{f.message}</span>
                        {giver && <span className="mr-2">from {giver.name}</span>}
                        <span>{formatDate(f.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {employeeFeedback.length > 0 && (() => {
              const typeCounts = employeeFeedback.reduce<Record<string, number>>((acc, f) => {
                acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1;
                return acc;
              }, {});
              return (
                <div className="mb-4 rounded-md border border-line bg-muted/5 p-2">
                  <p className="text-xs font-medium text-muted">Feedback Summary</p>
                  <p className="text-xs text-muted">
                    {Object.entries(typeCounts).map(([type, count]) => `${type}: ${count}`).join(" · ")}
                  </p>
                </div>
              );
            })()}

            {employeeEnrollments.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Learning & Development</p>
                <div className="flex flex-col gap-1">
                  {employeeEnrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted">{e.hr3_courses?.title ?? "Unknown course"}</span>
                      <span className="shrink-0 text-muted">
                        {e.progress_percent !== null && `${e.progress_percent}%`}
                        {e.status && <span className="ml-1">{e.status}</span>}
                        {e.enrolled_at && <span className="ml-1">Enrolled {formatDate(e.enrolled_at)}</span>}
                        {e.completed_at && <span className="ml-1">· Completed {formatDate(e.completed_at)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {employeeEnrollments.length > 0 && (() => {
              const avgProgress = employeeEnrollments.reduce((sum, e) => sum + (e.progress_percent ?? 0), 0) / employeeEnrollments.length;
              return (
                <div className="mb-4 rounded-md border border-line bg-muted/5 p-2">
                  <p className="text-xs font-medium text-muted">Learning Progress</p>
                  <p className="text-xs text-muted">
                    Average progress: {avgProgress.toFixed(0)}% · Completed: {employeeEnrollments.filter((e) => e.status === "completed" || e.completed_at).length}/{employeeEnrollments.length}
                  </p>
                </div>
              );
            })()}

            {employeeTraining.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Training</p>
                <div className="flex flex-col gap-1">
                  {employeeTraining.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted">{t.hr3_training_sessions?.title ?? "Unknown session"}</span>
                      <span className="shrink-0 text-muted">
                        {t.hr3_training_sessions?.schedule_date && <span className="mr-2">{formatDate(t.hr3_training_sessions.schedule_date)}</span>}
                        {t.hr3_training_sessions?.session_type && <span className="mr-2 capitalize">{t.hr3_training_sessions.session_type}</span>}
                        {t.hr3_training_sessions?.trainer_name && <span className="mr-2">Trainer: {t.hr3_training_sessions.trainer_name}</span>}
                        {t.approval_status && <span className="mr-2">{t.approval_status}</span>}
                        {t.attendance_status && <span>{t.attendance_status}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {employeeTraining.length > 0 && (() => {
              const attended = employeeTraining.filter((t) => t.attendance_status === "attended" || t.attendance_status === "completed").length;
              return (
                <div className="mb-4 rounded-md border border-line bg-muted/5 p-2">
                  <p className="text-xs font-medium text-muted">Training Summary</p>
                  <p className="text-xs text-muted">
                    Attended/completed: {attended}/{employeeTraining.length}
                  </p>
                </div>
              );
            })()}

            {employeeRecognitions.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Recognition</p>
                <div className="flex flex-col gap-1">
                  {employeeRecognitions.map((r) => {
                    const sender = getDirectoryUser(r.sender_id);
                    return (
                      <div key={r.id} className="text-xs text-muted">
                        <span className="mr-2 capitalize">{r.reason_category?.replace("_", " ")}</span>
                        <span className="mr-2">{r.message}</span>
                        {r.points !== null && <span className="mr-2">{r.points} pts</span>}
                        {r.hr3_badges?.name && <span className="mr-2">· {r.hr3_badges.name}</span>}
                        {sender && <span className="mr-2">from {sender.name}</span>}
                        {r.visibility === "private" && <Badge variant="neutral">Private</Badge>}
                        <span>{formatDate(r.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {employeeRecognitions.length > 0 && (() => {
              const totalPoints = employeeRecognitions.reduce((sum, r) => sum + (r.points ?? 0), 0);
              const badgeCount = employeeRecognitions.filter((r) => r.hr3_badges?.name).length;
              return (
                <div className="mb-4 rounded-md border border-line bg-muted/5 p-2">
                  <p className="text-xs font-medium text-muted">Recognition Summary</p>
                  <p className="text-xs text-muted">
                    Total points: {totalPoints} · Badges: {badgeCount}
                  </p>
                </div>
              );
            })()}

            {employeeCompetencies.length === 0 &&
              employeeFeedback.length === 0 &&
              employeeEnrollments.length === 0 &&
              employeeTraining.length === 0 &&
              employeeRecognitions.length === 0 &&
              employeePips.length === 0 && (
                <p className="text-xs text-muted">No performance evidence recorded yet.</p>
              )}

            {employeePips.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-medium text-muted">Performance Improvement Plans ({employeePips.length})</p>
                <div className="flex flex-col gap-2">
                  {employeePips.map((p) => (
                    <div key={p.id} className="rounded-md border border-line p-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={pipStatusVariant(p.status)}>
                          {pipStatusLabel(p.status)}
                        </Badge>
                        <span className="text-xs text-muted">
                          {p.start_date && <span className="mr-2">Started {formatDate(p.start_date)}</span>}
                          {p.end_date && <span>Due {formatDate(p.end_date)}</span>}
                        </span>
                      </div>
                      {p.reason && (
                        <p className="mt-1 text-xs">
                          <span className="font-medium text-muted">Reason: </span>
                          <span className="whitespace-normal text-ink dark:text-paper">{p.reason}</span>
                        </p>
                      )}
                      {p.action_plan && (
                        <p className="mt-1 text-xs">
                          <span className="font-medium text-muted">Action plan: </span>
                          <span className="whitespace-normal text-ink dark:text-paper">{p.action_plan}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isOwnAppraisal && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted">Performance Rating</label>
                  <PerformanceRatingSelect
                    value={performanceRating}
                    onChange={(value) => setPerformanceRating(value)}
                    label="Performance rating"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Letter Grade</label>
                  <LetterGradeSelect
                    value={letterGrade}
                    onChange={(value) => setLetterGrade(value)}
                    label="Letter grade"
                  />
                </div>
              </div>

              <textarea placeholder="Strengths" aria-label="Strengths" value={strengths} onChange={(e) => setStrengths(e.target.value)} className={textareaClass} />
              <textarea placeholder="Areas for improvement" aria-label="Areas for improvement" value={improvements} onChange={(e) => setImprovements(e.target.value)} className={textareaClass} />
              <textarea placeholder="Comments" aria-label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} className={textareaClass} />
              <div className="flex gap-2">
                {appraisal.status === "draft" && (
                  <Button onClick={() => save("reviewed")} loading={saveMutation.submitting} disabled={saveMutation.submitting || !allRated}>
                    Save &amp; Mark Reviewed
                  </Button>
                )}
                {appraisal.status === "reviewed" && (
                  <Button onClick={() => save("finalized")} loading={saveMutation.submitting} disabled={saveMutation.submitting || !allRated}>
                    Finalize
                  </Button>
                )}
              </div>
            </>
          )}

          {isOwnAppraisal && (
            <div className="flex gap-2">
              <Button onClick={() => save("draft")} loading={saveMutation.submitting} disabled={saveMutation.submitting}>
                Save Self Rating
              </Button>
            </div>
          )}

          <div className="flex justify-start">
            <Button variant="secondary" onClick={() => goToTab("selfAssessment")}>← Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppraisalsPage() {
  const { user, isAdmin } = useHrAuth();
  const { directory, getDirectoryUser } = useDirectory();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reviewerHrAdminId, setReviewerHrAdminId] = useState("");
  const [isCreateAppraisalModalOpen, setIsCreateAppraisalModalOpen] =
    useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState<Record<string, boolean>>({});

  const CREATE_APPRAISAL_TITLE_ID = "create-appraisal-title";

  const {
    data: hrAdmins,
  } = useApiResource<{ id: string; full_name: string; role: string }>({
    path: "hr-admins",
    listKey: "admins",
  });

  const {
    data: appraisals,
    loading,
    error,
    refetch,
  } = useApiResource<Appraisal>({
    path: "appraisals",
    listKey: "appraisals",
    errorMessage: "Could not load appraisals. Please try again.",
  });

  const createAppraisal = useApiMutation({
    path: "appraisals",
    method: "POST",
    onSuccess: () => {
      setReviewPeriod("");
      setEmployeeId("");
      setReviewerHrAdminId("");
      setIsCreateAppraisalModalOpen(false);
      refetch();
      toast.success("Appraisal created successfully.");
    },
  });

  const acknowledgeMutation = useApiMutation({
    path: "appraisals",
    method: "PUT",
    onSuccess: () => {
      refetch();
      toast.success("Appraisal acknowledged successfully.");
    },
  });

  async function acknowledge(id: string) {
    const { error: submitError } = await acknowledgeMutation.submit({ id, acknowledge: true });
    if (submitError) {
      toast.error(
        `Failed to acknowledge appraisal. ${submitError.message}${
          submitError.requestId ? ` [req: ${submitError.requestId}]` : ""
        }`
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await createAppraisal.submit({
      employee_id: employeeId,
      review_period: reviewPeriod,
      reviewer_hr_admin_id: reviewerHrAdminId || undefined,
    });
    if (submitError) {
      toast.error(
        `Failed to create appraisal. ${submitError.message}${
          submitError.requestId ? ` [req: ${submitError.requestId}]` : ""
        }`
      );
    }
  }

  const query = search.trim().toLowerCase();
  const visibleAppraisals = appraisals
    .filter((a) => (filter === "all" ? true : a.status === filter))
    .filter((a) => {
      if (!query) return true;
      const employeeName = getDirectoryUser(a.employee_id)?.name?.toLowerCase() ?? "";
      return (
        employeeName.includes(query) ||
        a.review_period.toLowerCase().includes(query)
      );
    });

  const stats = [
    { label: "Total", value: appraisals.length },
    { label: "Draft", value: appraisals.filter((a) => a.status === "draft").length },
    { label: "Reviewed", value: appraisals.filter((a) => a.status === "reviewed").length },
    { label: "Finalized", value: appraisals.filter((a) => a.status === "finalized").length },
  ];

  function handleViewDetails(a: Appraisal) {
    setViewingId(a.id);
  }

  function handleReview(a: Appraisal) {
    setReviewingId(a.id);
  }

  function toggleEvidence(section: string) {
    setEvidenceOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  const viewingAppraisal = viewingId ? appraisals.find((a) => a.id === viewingId) : null;
  const reviewingAppraisal = reviewingId ? appraisals.find((a) => a.id === reviewingId) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Appraisals"
        subtitle="Managers rate performance across key areas and finalize each review period."
        actions={
          isAdmin ? (
            <Button onClick={() => setIsCreateAppraisalModalOpen(true)}>
              New Appraisal
            </Button>
          ) : undefined
        }
      />

      <Modal
        open={isCreateAppraisalModalOpen}
        onClose={() => setIsCreateAppraisalModalOpen(false)}
        title="Create Appraisal"
        titleId={CREATE_APPRAISAL_TITLE_ID}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                aria-label="Select employee"
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
              <select
                value={reviewerHrAdminId}
                onChange={(e) => setReviewerHrAdminId(e.target.value)}
                aria-label="Select HR admin reviewer"
                className={selectClass}
              >
                <option value="">No HR admin reviewer</option>
                {hrAdmins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.full_name} — {admin.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Review period (e.g. 2026-H1)"
                aria-label="Review period"
                value={reviewPeriod}
                onChange={(e) => setReviewPeriod(e.target.value)}
                required
                className={inputClass}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateAppraisalModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={createAppraisal.submitting}>
                  {createAppraisal.submitting ? "Creating…" : "Create Appraisal"}
                </Button>
              </div>
            </form>
        </Modal>

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading appraisals…">
          <SkeletonStats />
          <SkeletonCards rows={3} className="mt-8 max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {!loading && appraisals.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {FILTERS.map((value) => (
            <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : statusLabel(value)}
            </Chip>
          ))}
          <input
            type="search"
            placeholder="Search by employee or period..."
            aria-label="Search appraisals"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${controlSmallClass} min-w-[200px]`}
          />
        </div>
      )}

      {!loading && visibleAppraisals.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={appraisals.length === 0 ? "No appraisals yet" : "No appraisals match"}
          description={
            appraisals.length === 0
              ? isAdmin
                ? 'Click "New Appraisal" above to get started.'
                : "Your manager hasn't started an appraisal for you yet."
              : "Try a different filter or search term to see more appraisals."
          }
        />
      )}

      {!loading && visibleAppraisals.length > 0 && (
        <DataTable
          columns={["Period", "Employee", "Status", "Scores", "Actions"]}
        >
          {visibleAppraisals.map((a) => {
            const employee = getDirectoryUser(a.employee_id);
            const finalVerdict = verdict(a.final_score);
            const isAppraisee = !!user?.employeeId && a.employee_id === user.employeeId;
            const isAssignedReviewer =
              !!user?.authUserId &&
              a.reviewer_hr_admin_id != null &&
              a.reviewer_hr_admin_id === user.authUserId;
            const canReview =
              isAdmin &&
              a.status !== "finalized" &&
              !isAppraisee &&
              (!a.reviewer_hr_admin_id || isAssignedReviewer);
            const canSelfRate = isAppraisee && isAdmin && a.status !== "finalized";
            const actions = [
              {
                label: "View",
                icon: <Eye size={14} />,
                onClick: () => handleViewDetails(a),
              },
              ...(canReview
                ? [{
                    label: a.status === "draft" ? "Start Review" : "Continue Review",
                    icon: <Pencil size={14} />,
                    onClick: () => handleReview(a),
                  }]
                : []),
              ...(canSelfRate
                ? [{
                    label: "Set Self Rating",
                    icon: <Pencil size={14} />,
                    onClick: () => handleReview(a),
                  }]
                : []),
            ];
            if (a.status === "finalized" && !a.acknowledged_at && isAppraisee) {
              actions.push({
                label: "Acknowledge",
                icon: <Check size={14} />,
                onClick: () => acknowledge(a.id),
              });
            }
            return (
              <DataTableRow key={a.id}>
                <TableCell>
                  <span className="font-medium">{a.review_period}</span>
                </TableCell>
                <TableCell>
                  {employee ? (
                    <div>
                      <span className="text-sm">{employee.name}</span>
                      {employee.jobTitle && (
                        <span className="ml-1 text-xs text-muted">· {employee.jobTitle}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-muted">M: {a.manager_rating ?? "—"}</span>
                    <span className="text-muted">·</span>
                    <span className="text-xs text-muted">F: {a.final_score ?? "—"}</span>
                    {a.self_rating !== null && a.self_rating !== undefined && (
                      <Badge variant="neutral">Self: {a.self_rating}</Badge>
                    )}
                    {a.performance_rating && (
                      <Badge variant="neutral">{a.performance_rating}</Badge>
                    )}
                    {a.letter_grade && (
                      <Badge variant="neutral">{a.letter_grade}</Badge>
                    )}
                    {finalVerdict && <Badge variant={finalVerdict.variant}>{finalVerdict.label}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <TableActions actions={actions} />
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      {/* View Details Modal */}
      {viewingAppraisal && (() => {
        const va = viewingAppraisal;
        const employee = getDirectoryUser(va.employee_id);
        const reviewer = getDirectoryUser(va.reviewer_id);
        const hrAdminReviewer = getDirectoryUser(va.reviewer_hr_admin_id);
        const finalVerdict = verdict(va.final_score);
        const isAppraisee = !!user?.employeeId && va.employee_id === user.employeeId;
        return (
          <Modal
            open={!!viewingId}
            onClose={() => setViewingId(null)}
            title={`Appraisal — ${va.review_period}`}
            size="lg"
            footer={
              va.status === "finalized" && !va.acknowledged_at && isAppraisee ? (
                <Button onClick={() => { acknowledge(va.id); setViewingId(null); }}>
                  Acknowledge
                </Button>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-1">
              <DetailRow label="Review Period" value={va.review_period} />
              <DetailRow label="Employee" value={employee?.name ?? "—"} />
              {employee?.jobTitle && <DetailRow label="Job Title" value={employee.jobTitle} />}
              <DetailRow label="Status" value={<Badge variant={statusVariant(va.status)}>{statusLabel(va.status)}</Badge>} />
              {reviewer && va.reviewer_id && <DetailRow label="Reviewer" value={reviewer.name} />}
              {hrAdminReviewer && <DetailRow label="HR Admin Reviewer" value={hrAdminReviewer.name} />}
              <DetailRow label="Manager Rating" value={va.manager_rating ?? "—"} />
              <DetailRow label="Self Rating" value={va.self_rating !== null && va.self_rating !== undefined ? `${va.self_rating} — ${ratingLabel(va.self_rating)}` : "—"} />
              <DetailRow label="Final Score" value={va.final_score ?? "—"} />
              {finalVerdict && <DetailRow label="Verdict" value={<Badge variant={finalVerdict.variant}>{finalVerdict.label}</Badge>} />}
              {va.performance_rating && <DetailRow label="Performance Rating" value={va.performance_rating} />}
              {va.letter_grade && <DetailRow label="Letter Grade" value={va.letter_grade} />}
              {va.strengths && <DetailRow label="Strengths" value={<span className="whitespace-normal">{va.strengths}</span>} />}
              {va.improvements && <DetailRow label="Areas for Improvement" value={<span className="whitespace-normal">{va.improvements}</span>} />}
              {va.comments && <DetailRow label="Comments" value={<span className="italic whitespace-normal">&quot;{va.comments}&quot;</span>} />}
              {va.acknowledged_at && (
                <DetailRow
                  label="Acknowledged"
                  value={`On ${new Date(va.acknowledged_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`}
                />
              )}
            </div>

            <DimensionBreakdown managerScores={va.manager_dimension_scores} />
            <GoalBreakdown goalScores={va.goal_scores} />

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Performance Evidence</p>

              <ViewEvidenceContent employeeId={va.employee_id} getDirectoryUser={getDirectoryUser} evidenceOpen={evidenceOpen} toggleEvidence={toggleEvidence} />
            </div>
          </Modal>
        );
      })()}

      {/* Review/Edit Modal (admin-only reviewer path; self-appraisal when admin is own appraisee) */}
      {reviewingAppraisal && isAdmin && (
        <Modal
          open={!!reviewingId}
          onClose={() => setReviewingId(null)}
          title={`${reviewingAppraisal.status === "draft" ? "Review" : "Continue Review"} — ${reviewingAppraisal.review_period}`}
          size="2xl"
        >
          <ReviewForm
            appraisal={reviewingAppraisal}
            isOwnAppraisal={
              !!user?.employeeId &&
              reviewingAppraisal.employee_id === user.employeeId
            }
            onUpdated={() => { refetch(); setReviewingId(null); }}
            getDirectoryUser={getDirectoryUser}
          />
        </Modal>
      )}
    </div>
  );
}

function ViewEvidenceContent({
  employeeId,
  getDirectoryUser,
  evidenceOpen,
  toggleEvidence,
}: {
  employeeId: string | null;
  getDirectoryUser: (id: string | null | undefined) => DirectoryUser | undefined;
  evidenceOpen: Record<string, boolean>;
  toggleEvidence: (section: string) => void;
}) {
  const { data: competencyScores } = useApiResource<CompetencyScore>({
    path: "competency-scores",
    listKey: "scores",
  });
  const employeeCompetencies = (competencyScores ?? []).filter(
    (s) => s.employee_id === employeeId
  );

  const { data: feedbackEntries } = useApiResource<FeedbackEntry>({
    path: "feedback",
    listKey: "feedback",
  });
  const employeeFeedback = (feedbackEntries ?? []).filter(
    (f) => f.employee_id === employeeId
  );

  const { data: enrollments } = useApiResource<CourseEnrollment>({
    path: "enrollments",
    listKey: "enrollments",
  });
  const employeeEnrollments = (enrollments ?? []).filter(
    (e) => e.employee_id === employeeId
  );

  const { data: trainingEnrollments } = useApiResource<TrainingEnrollment>({
    path: "training-enrollments",
    listKey: "enrollments",
  });
  const employeeTraining = (trainingEnrollments ?? []).filter(
    (t) => t.employee_id === employeeId
  );

  const { data: recognitions } = useApiResource<Recognition>({
    path: "recognitions",
    listKey: "recognitions",
  });
  const employeeRecognitions = (recognitions ?? []).filter(
    (r) => r.recipient_id === employeeId
  );

  if (
    employeeCompetencies.length === 0 &&
    employeeFeedback.length === 0 &&
    employeeEnrollments.length === 0 &&
    employeeTraining.length === 0 &&
    employeeRecognitions.length === 0
  ) {
    return <p className="text-xs text-muted">No performance evidence recorded yet.</p>;
  }

  return (
    <>
      {employeeCompetencies.length > 0 && (
        <EvidenceSection
          title="Competency Assessment"
          count={employeeCompetencies.length}
          open={!!evidenceOpen["competency"]}
          onToggle={() => toggleEvidence("competency")}
        >
          {employeeCompetencies.map((s) => {
            const gapCls = gapLabel(s.current_level, s.required_level);
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted">
                  {s.hr3_competencies?.name ?? "Unknown competency"}
                  {s.hr3_competencies?.category && <span className="ml-1">({s.hr3_competencies.category})</span>}
                </span>
                <span className="shrink-0 text-muted">
                  Current: {s.current_level} {levelLabel(s.current_level) ? `(${levelLabel(s.current_level)})` : ""} · Required: {s.required_level ?? "—"}
                  {gapCls && (
                    <Badge variant={gapVariant(s.current_level, s.required_level)}>
                      {gapCls}
                    </Badge>
                  )}
                  {s.assessed_at && <span className="ml-1">· {formatDate(s.assessed_at)}</span>}
                </span>
              </div>
            );
          })}
          {(() => {
            const avgGap = employeeCompetencies.reduce((sum, s) => sum + ((s.required_level ?? s.current_level) - s.current_level), 0) / employeeCompetencies.length;
            return (
              <div className="mt-2 rounded-md border border-line bg-muted/5 p-2">
                <p className="text-xs font-medium text-muted">Competency Gap Summary</p>
                <p className="text-xs text-muted">
                  Average gap: {avgGap > 0 ? `+${avgGap.toFixed(1)} levels below required` : avgGap < 0 ? `${Math.abs(avgGap).toFixed(1)} levels above required` : "Meets all requirements"}
                </p>
              </div>
            );
          })()}
        </EvidenceSection>
      )}

      {employeeFeedback.length > 0 && (
        <EvidenceSection
          title="Continuous Feedback"
          count={employeeFeedback.length}
          open={!!evidenceOpen["feedback"]}
          onToggle={() => toggleEvidence("feedback")}
        >
          {employeeFeedback.map((f) => {
            const giver = getDirectoryUser(f.given_by);
            return (
              <div key={f.id} className="text-xs text-muted">
                <span className="mr-2">{f.feedback_type}</span>
                <span className="mr-2">{f.message}</span>
                {giver && <span className="mr-2">from {giver.name}</span>}
                <span>{formatDate(f.created_at)}</span>
              </div>
            );
          })}
          {(() => {
            const typeCounts = employeeFeedback.reduce<Record<string, number>>((acc, f) => {
              acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1;
              return acc;
            }, {});
            return (
              <div className="mt-2 rounded-md border border-line bg-muted/5 p-2">
                <p className="text-xs font-medium text-muted">Feedback Summary</p>
                <p className="text-xs text-muted">
                  {Object.entries(typeCounts).map(([type, count]) => `${type}: ${count}`).join(" · ")}
                </p>
              </div>
            );
          })()}
        </EvidenceSection>
      )}

      {employeeEnrollments.length > 0 && (
        <EvidenceSection
          title="Learning & Development"
          count={employeeEnrollments.length}
          open={!!evidenceOpen["learning"]}
          onToggle={() => toggleEvidence("learning")}
        >
          {employeeEnrollments.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted">{e.hr3_courses?.title ?? "Unknown course"}</span>
              <span className="shrink-0 text-muted">
                {e.progress_percent !== null && `${e.progress_percent}%`}
                {e.status && <span className="ml-1">{e.status}</span>}
                {e.enrolled_at && <span className="ml-1">Enrolled {formatDate(e.enrolled_at)}</span>}
                {e.completed_at && <span className="ml-1">· Completed {formatDate(e.completed_at)}</span>}
              </span>
            </div>
          ))}
          {(() => {
            const avgProgress = employeeEnrollments.reduce((sum, e) => sum + (e.progress_percent ?? 0), 0) / employeeEnrollments.length;
            return (
              <div className="mt-2 rounded-md border border-line bg-muted/5 p-2">
                <p className="text-xs font-medium text-muted">Learning Progress</p>
                <p className="text-xs text-muted">
                  Average progress: {avgProgress.toFixed(0)}% · Completed: {employeeEnrollments.filter((e) => e.status === "completed" || e.completed_at).length}/{employeeEnrollments.length}
                </p>
              </div>
            );
          })()}
        </EvidenceSection>
      )}

      {employeeTraining.length > 0 && (
        <EvidenceSection
          title="Training"
          count={employeeTraining.length}
          open={!!evidenceOpen["training"]}
          onToggle={() => toggleEvidence("training")}
        >
          {employeeTraining.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted">{t.hr3_training_sessions?.title ?? "Unknown session"}</span>
              <span className="shrink-0 text-muted">
                {t.hr3_training_sessions?.schedule_date && <span className="mr-2">{formatDate(t.hr3_training_sessions.schedule_date)}</span>}
                {t.hr3_training_sessions?.session_type && <span className="mr-2 capitalize">{t.hr3_training_sessions.session_type}</span>}
                {t.hr3_training_sessions?.trainer_name && <span className="mr-2">Trainer: {t.hr3_training_sessions.trainer_name}</span>}
                {t.approval_status && <span className="mr-2">{t.approval_status}</span>}
                {t.attendance_status && <span>{t.attendance_status}</span>}
              </span>
            </div>
          ))}
          {(() => {
            const attended = employeeTraining.filter((t) => t.attendance_status === "attended" || t.attendance_status === "completed").length;
            return (
              <div className="mt-2 rounded-md border border-line bg-muted/5 p-2">
                <p className="text-xs font-medium text-muted">Training Summary</p>
                <p className="text-xs text-muted">
                  Attended/completed: {attended}/{employeeTraining.length}
                </p>
              </div>
            );
          })()}
        </EvidenceSection>
      )}

      {employeeRecognitions.length > 0 && (
        <EvidenceSection
          title="Recognition"
          count={employeeRecognitions.length}
          open={!!evidenceOpen["recognition"]}
          onToggle={() => toggleEvidence("recognition")}
        >
          {employeeRecognitions.map((r) => {
            const sender = getDirectoryUser(r.sender_id);
            return (
              <div key={r.id} className="text-xs text-muted">
                <span className="mr-2 capitalize">{r.reason_category?.replace("_", " ")}</span>
                <span className="mr-2">{r.message}</span>
                {r.points !== null && <span className="mr-2">{r.points} pts</span>}
                {r.hr3_badges?.name && <span className="mr-2">· {r.hr3_badges.name}</span>}
                {sender && <span className="mr-2">from {sender.name}</span>}
                {r.visibility === "private" && <Badge variant="neutral">Private</Badge>}
                <span>{formatDate(r.created_at)}</span>
              </div>
            );
          })}
          {(() => {
            const totalPoints = employeeRecognitions.reduce((sum, r) => sum + (r.points ?? 0), 0);
            const badgeCount = employeeRecognitions.filter((r) => r.hr3_badges?.name).length;
            return (
              <div className="mt-2 rounded-md border border-line bg-muted/5 p-2">
                <p className="text-xs font-medium text-muted">Recognition Summary</p>
                <p className="text-xs text-muted">
                  Total points: {totalPoints} · Badges: {badgeCount}
                </p>
              </div>
            );
          })()}
        </EvidenceSection>
      )}
    </>
  );
}
