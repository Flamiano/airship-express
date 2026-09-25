"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
} from "lucide-react";
import type {
  EmployeeOption,
  TrainingEnrollment,
  TrainingEnrollmentInput,
  TrainingEvaluation,
  TrainingEvaluationInput,
  TrainingSession,
  TrainingSessionInput,
  UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { EmptyState } from "@/performance-development-dashboard/components/ui/EmptyState";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformancePanel,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import { CreateEditSessionModal } from "@/performance-development-dashboard/components/learning/CreateEditSessionModal";
import { EnrollInSessionModal } from "@/performance-development-dashboard/components/learning/EnrollInSessionModal";
import { UpdateTrainingEnrollmentModal } from "@/performance-development-dashboard/components/learning/UpdateTrainingEnrollmentModal";
import { EvaluateSessionModal } from "@/performance-development-dashboard/components/learning/EvaluateSessionModal";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";

type Props = {
  sessions: TrainingSession[];
  trainingEnrollments: TrainingEnrollment[];
  evaluations: TrainingEvaluation[];
  employees: EmployeeOption[];
  competenciesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  isHrAdmin: boolean;
  currentUserEmployeeId: string | null;
  defaultEmployeeId: string | null;
  submitting?: boolean;
  onCreateSession: (input: TrainingSessionInput) => Promise<void>;
  onUpdateSession: (id: string, input: TrainingSessionInput) => Promise<void>;
  onCreateEnrollment: (input: TrainingEnrollmentInput) => Promise<void>;
  onUpdateEnrollment: (
    id: string,
    input: UpdateTrainingEnrollmentInput
  ) => Promise<void>;
  onCreateEvaluation: (input: TrainingEvaluationInput) => Promise<void>;
};

/** Tones mirror the previous pills; unknown free-text values stay neutral. */
function sessionStatusTone(status: string | null | undefined): string {
  switch (status) {
    case "scheduled":
      return "bg-accent/10 text-accent";
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "cancelled":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

function approvalTone(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "approved":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "rejected":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

function attendanceTone(status: string | null | undefined): string {
  switch (status) {
    case "attended":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "absent":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

export function TrainingTab({
  sessions,
  trainingEnrollments,
  evaluations,
  employees,
  competenciesById,
  employeeNamesById,
  isHrAdmin,
  currentUserEmployeeId,
  defaultEmployeeId,
  submitting,
  onCreateSession,
  onUpdateSession,
  onCreateEnrollment,
  onUpdateEnrollment,
  onCreateEvaluation,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions[0]?.id ?? null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(
    null
  );
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [updating, setUpdating] = useState<TrainingEnrollment | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(query) ||
        (session.venue ?? "").toLowerCase().includes(query) ||
        (session.trainer_name ?? "").toLowerCase().includes(query)
    );
  }, [sessions, search]);

  const filtering = search.trim() !== "";

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? null;

  const sessionEnrollments = useMemo(
    () =>
      selectedSession
        ? trainingEnrollments.filter(
            (enrollment) => enrollment.session_id === selectedSession.id
          )
        : [],
    [trainingEnrollments, selectedSession]
  );

  const sessionEvaluations = useMemo(
    () =>
      selectedSession
        ? evaluations.filter(
            (evaluation) => evaluation.session_id === selectedSession.id
          )
        : [],
    [evaluations, selectedSession]
  );

  const myEnrollment = selectedSession
    ? sessionEnrollments.find(
        (enrollment) => enrollment.employee_id === currentUserEmployeeId
      ) ?? null
    : null;

  const myEvaluation = selectedSession
    ? sessionEvaluations.find(
        (evaluation) => evaluation.employee_id === currentUserEmployeeId
      ) ?? null
    : null;

  return (
    <div className="space-y-4">
      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search training sessions</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {filtering && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Clear search
            </button>
          )}
        </div>

        {isHrAdmin && (
          <PerformanceButton
            onClick={() => setCreateOpen(true)}
            disabled={submitting}
          >
            <Plus size={15} strokeWidth={2} />
            New session
          </PerformanceButton>
        )}
      </FilterBar>

      {sessions.length === 0 ? (
        <PerformanceEmptyState
          icon={<CalendarDays size={22} strokeWidth={1.5} className="text-muted" />}
          title="No training sessions yet"
          message={
            isHrAdmin
              ? "Schedule the first training session to start tracking attendance and evaluations."
              : "The performance team has not scheduled any training sessions yet."
          }
          action={
            isHrAdmin ? (
              <PerformanceButton
                onClick={() => setCreateOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Schedule a session
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : displayed.length === 0 ? (
        <PerformanceEmptyState
          icon={<CalendarDays size={22} strokeWidth={1.5} className="text-muted" />}
          title="No matching sessions"
          message="Try a different search term."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((session) => {
            const competencyName = session.competency_id
              ? competenciesById[session.competency_id] ?? null
              : null;
            const selected = selectedSession?.id === session.id;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border bg-paper p-5 text-left transition-colors dark:border-paper/10",
                  selected
                    ? "border-accent/60 shadow-sm shadow-accent/10"
                    : "border-line hover:border-accent/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 truncate font-bricolage text-[15px] font-medium tracking-tight text-ink">
                    {session.title}
                  </h3>
                  <PerformanceStatusBadge
                    tone={sessionStatusTone(session.status)}
                    className="shrink-0"
                  >
                    {session.status || "scheduled"}
                  </PerformanceStatusBadge>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  {session.schedule_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} strokeWidth={1.75} />
                      {formatDate(session.schedule_date)}
                    </span>
                  )}
                  {session.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} strokeWidth={1.75} />
                      {session.venue}
                    </span>
                  )}
                </div>

                {(session.trainer_name || competencyName) && (
                  <p className="mt-1 truncate text-[11.5px] text-muted">
                    {[session.trainer_name ?? null, competencyName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedSession && (
        <PerformancePanel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
                  {selectedSession.title}
                </h2>
                <PerformanceStatusBadge
                  tone={sessionStatusTone(selectedSession.status)}
                >
                  {selectedSession.status || "scheduled"}
                </PerformanceStatusBadge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                {selectedSession.session_type && (
                  <span className="capitalize">
                    Type · {selectedSession.session_type}
                  </span>
                )}
                {selectedSession.schedule_date && (
                  <span>{formatDate(selectedSession.schedule_date)}</span>
                )}
                {selectedSession.mode && (
                  <span className="capitalize">{selectedSession.mode}</span>
                )}
                {selectedSession.capacity !== null &&
                  selectedSession.capacity !== undefined && (
                    <span>{selectedSession.capacity} seats</span>
                  )}
                {selectedSession.cost !== null &&
                  selectedSession.cost !== undefined && (
                    <span>
                      Cost · {Number(selectedSession.cost).toLocaleString()}
                    </span>
                  )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                {selectedSession.trainer_name && (
                  <span>Trainer · {selectedSession.trainer_name}</span>
                )}
                {selectedSession.venue && <span>Venue · {selectedSession.venue}</span>}
                {selectedSession.competency_id && (
                  <span>
                    Linked competency ·{" "}
                    {competenciesById[selectedSession.competency_id] ??
                      "Unknown"}
                  </span>
                )}
              </div>
            </div>

            {isHrAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <PerformanceButton
                  variant="ghost"
                  onClick={() => setEditingSession(selectedSession)}
                >
                  <Pencil size={13} strokeWidth={1.75} />
                  Edit
                </PerformanceButton>
                <PerformanceButton
                  onClick={() => setEnrollOpen(true)}
                  disabled={submitting}
                >
                  <CalendarPlus size={13} strokeWidth={1.75} />
                  Enroll employee
                </PerformanceButton>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            {/* Enrollments */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Enrollments ({sessionEnrollments.length})
                </h3>
              </div>

              {sessionEnrollments.length === 0 ? (
                <EmptyState
                  message={
                    isHrAdmin
                      ? "No one is enrolled yet. Enroll an employee to begin tracking."
                      : "You are not enrolled in this session."
                  }
                />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                  {sessionEnrollments.map((enrollment) => (
                    <li
                      key={enrollment.id}
                      className="flex items-center gap-2 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {employeeNamesById[enrollment.employee_id] ??
                            "Unknown employee"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PerformanceStatusBadge
                            tone={approvalTone(enrollment.approval_status)}
                          >
                            {enrollment.approval_status || "—"}
                          </PerformanceStatusBadge>
                          <PerformanceStatusBadge
                            tone={attendanceTone(enrollment.attendance_status)}
                          >
                            {enrollment.attendance_status || "Not recorded"}
                          </PerformanceStatusBadge>
                        </div>
                      </div>

                      {isHrAdmin && (
                        <button
                          type="button"
                          onClick={() => setUpdating(enrollment)}
                          disabled={submitting}
                          aria-label={`Update enrollment for ${employeeNamesById[enrollment.employee_id] ?? "employee"}`}
                          className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                        >
                          Update
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!isHrAdmin && myEnrollment === null && (
                <p className="mt-2 text-[11.5px] text-muted">
                  Enrollments are managed by your performance team.
                </p>
              )}
            </section>

            {/* Evaluations */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Evaluations ({sessionEvaluations.length})
                </h3>
                {(isHrAdmin ||
                  (!isHrAdmin && myEnrollment !== null)) && (
                  <button
                    type="button"
                    onClick={() => setEvaluating(true)}
                    disabled={
                      submitting || (isHrAdmin && sessionEnrollments.length === 0)
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                  >
                    <Star size={12} strokeWidth={1.75} />
                    {isHrAdmin ? "Add evaluation" : "Submit evaluation"}
                  </button>
                )}
              </div>

              {sessionEvaluations.length === 0 ? (
                <EmptyState
                  message={
                    !isHrAdmin &&
                    myEnrollment === null &&
                    myEvaluation === null
                      ? "Ask your performance team to enroll you, then rate this session."
                      : "No evaluations yet."
                  }
                />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                  {sessionEvaluations.map((evaluation) => {
                    const rating = evaluation.rating;
                    return (
                      <li key={evaluation.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                            {employeeNamesById[evaluation.employee_id] ??
                              "Unknown employee"}
                          </p>
                          <div
                            className="flex shrink-0 items-center gap-0.5"
                            role="img"
                            aria-label={
                              rating === null
                                ? "No rating"
                                : `Rated ${rating} out of 5`
                            }
                          >
                            {[1, 2, 3, 4, 5].map((value) => (
                              <Star
                                key={value}
                                size={12}
                                strokeWidth={1.75}
                                aria-hidden="true"
                                className={
                                  rating !== null && value <= rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted/40"
                                }
                              />
                            ))}
                          </div>
                        </div>
                        {evaluation.comments && (
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                            {evaluation.comments}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </PerformancePanel>
      )}

      {createOpen && (
        <CreateEditSessionModal
          session={null}
          competenciesById={competenciesById}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onCreateSession(input);
            setCreateOpen(false);
          }}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editingSession && (
        <CreateEditSessionModal
          session={editingSession}
          competenciesById={competenciesById}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onUpdateSession(editingSession.id, input);
            setEditingSession(null);
          }}
          onClose={() => setEditingSession(null)}
        />
      )}

      {enrollOpen && selectedSession && (
        <EnrollInSessionModal
          employees={employees}
          defaultEmployeeId={defaultEmployeeId ?? employees[0]?.id ?? ""}
          sessionId={selectedSession.id}
          sessionTitle={selectedSession.title}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onCreateEnrollment(input);
            setEnrollOpen(false);
          }}
          onClose={() => setEnrollOpen(false)}
        />
      )}

      {updating && (
        <UpdateTrainingEnrollmentModal
          enrollment={updating}
          employeeName={
            employeeNamesById[updating.employee_id] ?? "Unknown employee"
          }
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onUpdateEnrollment(updating.id, input);
            setUpdating(null);
          }}
          onClose={() => setUpdating(null)}
        />
      )}

      {evaluating && selectedSession && (
        <EvaluateSessionModal
          sessionId={selectedSession.id}
          sessionTitle={selectedSession.title}
          employees={employees}
          defaultEmployeeId={
            isHrAdmin
              ? defaultEmployeeId ?? sessionEnrollments[0]?.employee_id ?? ""
              : (currentUserEmployeeId ?? "")
          }
          isHrAdmin={isHrAdmin}
          enrolledEmployeeIds={sessionEnrollments.map(
            (enrollment) => enrollment.employee_id
          )}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onCreateEvaluation(input);
            setEvaluating(false);
          }}
          onClose={() => setEvaluating(false)}
        />
      )}
    </div>
  );
}
