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
  User as UserIcon,
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

function badge(value: string | null | undefined, map: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "bg-line text-muted";
  return map[value] ?? "bg-line text-muted";
}

const APPROVAL_TONES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};

const ATTENDANCE_TONES: Record<string, string> = {
  attended: "bg-emerald-500/10 text-emerald-600",
  absent: "bg-red-500/10 text-red-600",
};

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
      <FilterBar className="sm:justify-between">
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

          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} />
              New session
            </button>
          )}
      </FilterBar>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <CalendarDays size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No training sessions yet
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {isHrAdmin
              ? "Schedule the first training session to start tracking attendance and evaluations."
              : "The performance team has not scheduled any training sessions yet."}
          </p>
          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Schedule a session
            </button>
          )}
        </div>
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
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border bg-paper p-5 text-left transition-colors dark:border-paper/10",
                  selected
                    ? "border-accent/60 shadow-sm shadow-accent/10"
                    : "border-line hover:border-accent/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="truncate font-bricolage text-[15px] font-medium tracking-tight text-ink">
                    {session.title}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                      badge(session.status, {
                        scheduled: "bg-accent/10 text-accent",
                        completed: "bg-emerald-500/10 text-emerald-600",
                        cancelled: "bg-red-500/10 text-red-600",
                      })
                    )}
                  >
                    {session.status ?? "scheduled"}
                  </span>
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

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {(session.trainer_name || competencyName) && (
                    <span className="text-[11.5px] capitalize text-muted">
                      {[session.trainer_name ?? null, competencyName].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedSession && (
        <div className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
                {selectedSession.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                {selectedSession.status && (
                  <span className="capitalize">
                    Status · {selectedSession.status}
                  </span>
                )}
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

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
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
                <button
                  type="button"
                  onClick={() => setEditingSession(selectedSession)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink dark:border-paper/15"
                >
                  <Pencil size={13} strokeWidth={1.75} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollOpen(true)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CalendarPlus size={13} strokeWidth={1.75} />
                  Enroll employee
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Enrollments */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Enrollments
                </h3>
                <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                  <UserIcon size={12} strokeWidth={1.75} />
                  {sessionEnrollments.length}
                </span>
              </div>

              {sessionEnrollments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center dark:border-paper/15">
                  <p className="text-[12.5px] text-muted">
                    {isHrAdmin
                      ? "No one is enrolled yet. Enroll an employee to begin tracking."
                      : "You are not enrolled in this session."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sessionEnrollments.map((enrollment) => {
                    const approvalBadge = badge(
                      enrollment.approval_status,
                      APPROVAL_TONES
                    );
                    const attendanceBadge = badge(
                      enrollment.attendance_status,
                      ATTENDANCE_TONES
                    );
                    return (
                      <div
                        key={enrollment.id}
                        className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {employeeNamesById[enrollment.employee_id] ??
                              "Unknown employee"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize",
                                enrollment.approval_status
                                  ? approvalBadge
                                  : "bg-line text-muted"
                              )}
                            >
                              {enrollment.approval_status || "—"}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize",
                                enrollment.attendance_status
                                  ? attendanceBadge
                                  : "bg-line text-muted"
                              )}
                            >
                              {enrollment.attendance_status || "Not recorded"}
                            </span>
                          </div>
                        </div>

                        {isHrAdmin && (
                          <button
                            type="button"
                            onClick={() => setUpdating(enrollment)}
                            disabled={submitting}
                            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                          >
                            Update
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isHrAdmin && myEnrollment === null && (
                <p className="mt-2 text-[11.5px] text-muted">
                  Enrollments are managed by your performance team.
                </p>
              )}
            </div>

            {/* Evaluations */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Evaluations
                </h3>
                {(isHrAdmin ||
                  (!isHrAdmin && myEnrollment !== null)) && (
                  <button
                    type="button"
                    onClick={() => setEvaluating(true)}
                    disabled={
                      submitting || (isHrAdmin && sessionEnrollments.length === 0)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                  >
                    <Star size={12} strokeWidth={1.75} />
                    {isHrAdmin ? "Add evaluation" : "Submit evaluation"}
                  </button>
                )}
              </div>

              {sessionEvaluations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center dark:border-paper/15">
                  {!isHrAdmin &&
                  myEnrollment === null &&
                  myEvaluation === null ? (
                    <p className="text-[12.5px] text-muted">
                      Ask your performance team to enroll you, then rate this
                      session.
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-muted">
                      No evaluations yet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sessionEvaluations.map((evaluation) => {
                    const rating = evaluation.rating;
                    return (
                      <div
                        key={evaluation.id}
                        className="rounded-xl border border-line px-4 py-3 dark:border-paper/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {employeeNamesById[evaluation.employee_id] ??
                              "Unknown employee"}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <Star
                                key={value}
                                size={12}
                                strokeWidth={1.75}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
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