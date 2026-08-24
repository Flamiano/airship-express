"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/performance-development-dashboard/components/EmptyState";
import StatCard from "@/app/(hr-dashboard)/performance-development-dashboard/components/StatCard";
import {
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/Skeleton";
import {
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";
import {
  errorTextClass,
  iconEditClass,
  inputClass,
  listRowClass,
  miniActionClass,
  quietDangerClass,
  selectClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";
import {
  useDirectory,
} from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import {
  GraduationCap,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string;
  title: string;
  trainer_name: string | null;
  trainer_type: string | null;
  mode: string | null;
  venue: string | null;
  schedule_date: string | null;
  capacity: number | null;
  cost: number | null;
  session_type: string | null;
  competency_id: string | null;
  hr3_competencies: { name: string } | null;
};

type Enrollment = {
  id: string;
  employee_id: string | null;
  session_id: string | null;
  attendance_status: string | null;
  approval_status: string | null;
  hr3_training_sessions: { title: string; schedule_date: string | null; session_type: string | null } | null;
};

type Competency = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

type OnboardingRecord = {
  id: string;
  employee_id: string | null;
  briefed: boolean;
  briefed_at: string | null;
  briefed_by: string | null;
  notes: string | null;
};

function sessionTypeLabel(type: string | null) {
  if (type === "mandatory") return "Mandatory";
  if (type === "development") return "Development";
  return "Session";
}

function sessionTypeVariant(
  type: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (type === "mandatory") return "danger";
  if (type === "development") return "neutral";
  return "neutral";
}

function attendanceLabel(status: string | null) {
  if (status === "attended") return "Attended";
  if (status === "missed") return "Missed";
  return "Not marked";
}

function attendanceVariant(
  status: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (status === "attended") return "success";
  if (status === "missed") return "danger";
  return "neutral";
}

function approvalLabel(status: string | null) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending approval";
}

function approvalVariant(
  status: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
  });
}

function formatPHP(amount: number | null) {
  if (amount === null) return "—";
  return `₱${amount.toLocaleString("en-PH")}`;
}

function todayManila() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}

function isUpcoming(session: Session) {
  return !!session.schedule_date && session.schedule_date >= todayManila();
}

const rosterToggleClass =
  "inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-paper/15";

function SessionForm({
  competencies,
  onCreated,
}: {
  competencies: Competency[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState("development");
  const [trainerName, setTrainerName] = useState("");
  const [trainerType, setTrainerType] = useState("");
  const [mode, setMode] = useState("");
  const [venue, setVenue] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [cost, setCost] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          session_type: sessionType,
          trainer_name: trainerName,
          trainer_type: trainerType,
          mode,
          venue,
          schedule_date: scheduleDate || null,
          capacity: capacity ? parseInt(capacity) : null,
          cost: cost ? parseFloat(cost) : null,
          competency_id: competencyId || null,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to create session");
      }
      setTitle("");
      setTrainerName("");
      setTrainerType("");
      setMode("");
      setVenue("");
      setScheduleDate("");
      setCapacity("");
      setCost("");
      setCompetencyId("");
      onCreated();
      toast.success("Training session created successfully.");
    } catch {
      toast.error("Failed to create training session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex max-w-md flex-col gap-3"
    >
      <h2 className="text-lg font-semibold font-bricolage">
        Schedule a Session
      </h2>
      <input
        type="text"
        placeholder="Title (e.g. Warehouse Fire Drill)"
        aria-label="Session title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      <select
        value={sessionType}
        onChange={(e) => setSessionType(e.target.value)}
        aria-label="Session type"
        className={selectClass}
      >
        <option value="development">
          Development — for staff being groomed
        </option>
        <option value="mandatory">
          Mandatory — everyone must attend (safety, fire, first aid)
        </option>
      </select>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Trainer name"
          aria-label="Trainer name"
          value={trainerName}
          onChange={(e) => setTrainerName(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          value={trainerType}
          onChange={(e) => setTrainerType(e.target.value)}
          aria-label="Trainer type"
          className={`${selectClass} min-w-0 flex-1`}
        >
          <option value="">Trainer type</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Mode (e.g. In-person)"
          aria-label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          type="text"
          placeholder="Venue"
          aria-label="Venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      <input
        type="date"
        aria-label="Schedule date"
        value={scheduleDate}
        onChange={(e) => setScheduleDate(e.target.value)}
        className={inputClass}
      />
      <div className="flex gap-3">
        <input
          type="number"
          min="1"
          placeholder="Capacity"
          aria-label="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Cost (PHP)"
          aria-label="Cost in Philippine pesos"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      <select
        value={competencyId}
        onChange={(e) => setCompetencyId(e.target.value)}
        aria-label="Linked competency"
        className={selectClass}
      >
        <option value="">Trains: no linked competency</option>
        {competencies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Schedule Session"}
      </Button>
    </form>
  );
}

function SessionEditForm({
  session,
  competencies,
  onUpdated,
}: {
  session: Session;
  competencies: Competency[];
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [sessionType, setSessionType] = useState(
    session.session_type ?? "development"
  );
  const [trainerName, setTrainerName] = useState(session.trainer_name ?? "");
  const [mode, setMode] = useState(session.mode ?? "");
  const [venue, setVenue] = useState(session.venue ?? "");
  const [scheduleDate, setScheduleDate] = useState(
    session.schedule_date?.slice(0, 10) ?? ""
  );
  const [capacity, setCapacity] = useState(
    session.capacity?.toString() ?? ""
  );
  const [cost, setCost] = useState(session.cost?.toString() ?? "");
  const [competencyId, setCompetencyId] = useState(
    session.competency_id ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: session.id,
          title,
          session_type: sessionType,
          trainer_name: trainerName,
          trainer_type: session.trainer_type,
          mode,
          venue,
          schedule_date: scheduleDate || null,
          capacity: capacity ? parseInt(capacity) : null,
          cost: cost ? parseFloat(cost) : null,
          competency_id: competencyId || null,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update session");
      }
      onUpdated();
      toast.success("Training session updated successfully.");
    } catch {
      toast.error("Failed to update training session. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="Session title"
        className={inputClass}
      />
      <select
        value={sessionType}
        onChange={(e) => setSessionType(e.target.value)}
        aria-label="Session type"
        className={selectClass}
      >
        <option value="development">Development</option>
        <option value="mandatory">Mandatory</option>
      </select>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Trainer"
          aria-label="Trainer name"
          value={trainerName}
          onChange={(e) => setTrainerName(e.target.value)}
          className={`${inputClass} min-w-[120px] flex-1`}
        />
        <input
          type="text"
          placeholder="Mode"
          aria-label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className={`${inputClass} min-w-[100px] flex-1`}
        />
        <input
          type="text"
          placeholder="Venue"
          aria-label="Venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className={`${inputClass} min-w-[100px] flex-1`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          aria-label="Schedule date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className={`${inputClass} min-w-[140px] flex-1`}
        />
        <input
          type="number"
          min="1"
          placeholder="Capacity"
          aria-label="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className={`${inputClass} min-w-[90px] flex-1`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Cost"
          aria-label="Cost in Philippine pesos"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className={`${inputClass} min-w-[90px] flex-1`}
        />
        <select
          value={competencyId}
          onChange={(e) => setCompetencyId(e.target.value)}
          aria-label="Linked competency"
          className={`${selectClass} min-w-[160px] flex-1`}
        >
          <option value="">No linked competency</option>
          {competencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onUpdated}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RosterPanel({
  session,
  enrollments,
  onChanged,
}: {
  session: Session;
  enrollments: Enrollment[];
  onChanged: () => void;
}) {
  const { directory } = useDirectory();
  const [busy, setBusy] = useState(false);

  const assignedCount = enrollments.length;
  const full = session.capacity !== null && assignedCount >= session.capacity;

  async function assign(employeeId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/training-enrollments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            session_id: session.id,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to assign");
      }
      onChanged();
      toast.success("Employee assigned successfully.");
    } catch {
      toast.error("Failed to assign employee. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markAttendance(
    employeeId: string,
    attendanceStatus: string
  ) {
    setBusy(true);
    try {
      const enrollment = enrollments.find(
        (e) => e.employee_id === employeeId
      );
      let enrollmentId = enrollment?.id;
      if (!enrollmentId) {
        const createRes = await fetch(
          "/performance-development-dashboard/api/training-enrollments",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employee_id: employeeId,
              session_id: session.id,
            }),
          }
        );
        if (!createRes.ok) {
          throw await readApiError(createRes, "Failed to assign");
        }
        const created = await createRes.json();
        enrollmentId = created.enrollment?.id;
      }
      const res = await fetch(
        "/performance-development-dashboard/api/training-enrollments",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: enrollmentId,
            attendance_status: attendanceStatus,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to update attendance");
      }
      onChanged();
      toast.success("Attendance marked successfully.");
    } catch {
      toast.error("Failed to update attendance. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setApproval(enrollmentId: string, approvalStatus: string) {
    setBusy(true);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/training-enrollments",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: enrollmentId,
            approval_status: approvalStatus,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to update approval");
      }
      onChanged();
      toast.success(
        approvalStatus === "approved"
          ? "Enrollment approved."
          : "Enrollment rejected."
      );
    } catch {
      toast.error("Failed to update approval. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unassign(enrollmentId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/training-enrollments?id=${enrollmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to unassign");
      }
      onChanged();
      toast.success("Employee removed successfully.");
    } catch {
      toast.error("Failed to unassign employee. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllAttended() {
    setBusy(true);
    try {
      for (const user of directory) {
        const enrollment = enrollments.find(
          (e) => e.employee_id === user.id
        );
        if (enrollment?.attendance_status === "attended") continue;
        let enrollmentId = enrollment?.id;
        if (!enrollmentId) {
          const createRes = await fetch(
            "/performance-development-dashboard/api/training-enrollments",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                employee_id: user.id,
                session_id: session.id,
              }),
            }
          );
          if (!createRes.ok) {
            throw await readApiError(createRes, "Failed to assign");
          }
          const created = await createRes.json();
          enrollmentId = created.enrollment?.id;
        }
        const res = await fetch(
          "/performance-development-dashboard/api/training-enrollments",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: enrollmentId,
              attendance_status: "attended",
            }),
          }
        );
        if (!res.ok) {
          throw await readApiError(res, "Failed to update attendance");
        }
      }
      onChanged();
      toast.success("All attendance marked successfully.");
    } catch {
      toast.error("Failed to update attendance. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">
          Roster · {assignedCount}
          {session.capacity !== null && ` / ${session.capacity}`} assigned
        </p>
        {session.session_type === "mandatory" && (
          <Button variant="secondary" onClick={markAllAttended} loading={busy}>
            Mark all as attended
          </Button>
        )}
      </div>
      <div className="flex flex-col">
        {directory.map((user) => {
          const enrollment = enrollments.find(
            (e) => e.employee_id === user.id
          );
          return (
            <div
              key={user.id}
              className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0"
            >
              <div>
                <span className="text-sm">{user.name}</span>
                <span className="block text-xs capitalize text-muted">
                  {user.jobTitle}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!enrollment ? (
                  full ? (
                    <Badge variant="neutral">Full</Badge>
                  ) : (
                    <button
                      type="button"
                      className={miniActionClass}
                      onClick={() => assign(user.id)}
                      disabled={busy}
                    >
                      Assign
                    </button>
                  )
                ) : (
                  <>
                    {enrollment.approval_status === "pending" && (
                      <>
                        <button
                          type="button"
                          className={miniActionClass}
                          onClick={() =>
                            setApproval(enrollment.id, "approved")
                          }
                          disabled={busy}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={miniActionClass}
                          onClick={() =>
                            setApproval(enrollment.id, "rejected")
                          }
                          disabled={busy}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {enrollment.approval_status &&
                      enrollment.approval_status !== "approved" && (
                        <Badge
                          variant={approvalVariant(enrollment.approval_status)}
                        >
                          {approvalLabel(enrollment.approval_status)}
                        </Badge>
                      )}
                    {enrollment.attendance_status ? (
                      <Badge variant={attendanceVariant(enrollment.attendance_status)}>
                        {attendanceLabel(enrollment.attendance_status)}
                      </Badge>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={miniActionClass}
                          onClick={() => markAttendance(user.id, "attended")}
                          disabled={busy}
                        >
                          Attended
                        </button>
                        <button
                          type="button"
                          className={miniActionClass}
                          onClick={() => markAttendance(user.id, "missed")}
                          disabled={busy}
                        >
                          Missed
                        </button>
                      </>
                    )}
                    {enrollment.attendance_status && (
                      <button
                        type="button"
                        className={miniActionClass}
                        onClick={() => markAttendance(user.id, "")}
                        disabled={busy}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      className={quietDangerClass}
                      onClick={() => unassign(enrollment.id)}
                      disabled={busy}
                    >
                      Unassign
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const { user, isAdmin } = useHrAuth();
  const { directory } = useDirectory();
  const isEmployee = !isAdmin;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openRosterId, setOpenRosterId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const myEmployeeId = isEmployee ? user?.employeeId ?? null : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sessionRes, enrollRes, compRes, onboardingRes] =
          await Promise.all([
            fetch("/performance-development-dashboard/api/sessions"),
            fetch("/performance-development-dashboard/api/training-enrollments"),
            fetch("/performance-development-dashboard/api/competency"),
            fetch("/performance-development-dashboard/api/onboarding-records"),
          ]);
        if (
          !sessionRes.ok ||
          !enrollRes.ok ||
          !compRes.ok ||
          !onboardingRes.ok
        ) {
          throw new Error("Failed to load training data");
        }
        const sessionJson = await sessionRes.json();
        const enrollJson = await enrollRes.json();
        const compJson = await compRes.json();
        const onboardingJson = await onboardingRes.json();
        if (cancelled) return;
        setSessions(sessionJson.sessions || []);
        setEnrollments(enrollJson.enrollments || []);
        setCompetencies(compJson.competencies || []);
        setOnboarding(onboardingJson.records || []);
      } catch {
        if (!cancelled) setError("Could not load training data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  async function updateOnboarding(employeeId: string, briefed: boolean) {
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/onboarding-records",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            briefed,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to update onboarding");
      }
      refetch();
      toast.success("Onboarding status updated successfully.");
    } catch {
      toast.error("Failed to update onboarding. Please try again.");
    }
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Delete this session? Existing assignments will be removed."))
      return;
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/sessions?id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete session");
      }
      refetch();
      toast.success("Training session deleted successfully.");
    } catch {
      toast.error("Failed to delete training session. Please try again.");
    }
  }

  const onboardingByEmployee = useMemo(() => {
    const map = new Map<string, OnboardingRecord>();
    for (const record of onboarding) {
      if (record.employee_id) map.set(record.employee_id, record);
    }
    return map;
  }, [onboarding]);

  const notBriefed = directory.filter(
    (u) => !onboardingByEmployee.get(u.id)?.briefed
  ).length;

  const enrollmentsBySession = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    for (const enrollment of enrollments) {
      if (!enrollment.session_id) continue;
      const list = map.get(enrollment.session_id) ?? [];
      list.push(enrollment);
      map.set(enrollment.session_id, list);
    }
    return map;
  }, [enrollments]);

  const upcomingSessions = sessions.filter(isUpcoming).length;
  const missed = enrollments.filter(
    (e) => e.attendance_status === "missed"
  ).length;

  const myEnrollments = myEmployeeId
    ? enrollments.filter((e) => e.employee_id === myEmployeeId)
    : [];

  async function requestSeat(sessionId: string) {
    setEnrolling(true);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/training-enrollments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to request a seat");
      }
      refetch();
      toast.success("Seat requested. Waiting for HR approval.");
    } catch {
      toast.error("Could not request a seat. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  const stats = isEmployee
    ? [
        { label: "Assigned", value: myEnrollments.length },
        {
          label: "Attended",
          value: myEnrollments.filter((e) => e.attendance_status === "attended").length,
        },
        { label: "Missed", value: myEnrollments.filter((e) => e.attendance_status === "missed").length },
      ]
    : [
        { label: "Not onboarded", value: notBriefed },
        { label: "Upcoming", value: upcomingSessions },
        { label: "Sessions", value: sessions.length },
        { label: "Missed", value: missed },
      ];

  return (
    <div>
      <PageHeader
        eyebrow="Training Management"
        title="Training"
        subtitle="Onboard new staff, schedule sessions, and record who actually attended."
      />

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading training data…">
          <SkeletonStats count={isEmployee ? 3 : 4} />
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

      {isEmployee ? (
        <>
          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            My Sessions
          </h2>
          {!loading && myEmployeeId === null && (
            <p className="mb-6 text-sm text-muted">
              Your account is not linked to an employee profile yet, so your
              sessions cannot be shown.
            </p>
          )}
          {!loading && myEmployeeId !== null && myEnrollments.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No sessions yet"
              description="Request a seat in an upcoming session below."
            />
          )}
          {!loading && myEnrollments.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="shown"
              className="mb-8 flex max-w-md flex-col gap-3"
            >
              {myEnrollments.map((e) => (
                <motion.div key={e.id} variants={staggerItem}>
                  <Card>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="font-medium">
                        {e.hr3_training_sessions?.title}
                      </h3>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={approvalVariant(e.approval_status)}>
                          {approvalLabel(e.approval_status)}
                        </Badge>
                        <Badge variant={attendanceVariant(e.attendance_status)}>
                          {attendanceLabel(e.attendance_status)}
                        </Badge>
                      </div>
                    </div>
                    {e.hr3_training_sessions?.session_type && (
                      <Badge variant={sessionTypeVariant(e.hr3_training_sessions.session_type)}>
                        {sessionTypeLabel(e.hr3_training_sessions.session_type)}
                      </Badge>
                    )}
                    {e.hr3_training_sessions?.schedule_date && (
                      <p className="mt-1 text-xs text-muted">
                        Scheduled {formatDate(e.hr3_training_sessions.schedule_date)}
                      </p>
                    )}
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            Upcoming Sessions
          </h2>
          {!loading &&
            sessions.filter(isUpcoming).length === 0 && (
              <EmptyState
                icon={GraduationCap}
                title="No upcoming sessions"
                description="New training sessions will appear here when HR schedules them."
              />
            )}
          {!loading && sessions.filter(isUpcoming).length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="shown"
              className="flex max-w-md flex-col gap-3"
            >
              {sessions
                .filter(isUpcoming)
                .map((session) => {
                  const sessionEnrollments =
                    enrollmentsBySession.get(session.id) ?? [];
                  const seatsTaken = sessionEnrollments.length;
                  const full =
                    session.capacity !== null && seatsTaken >= session.capacity;
                  const alreadyRequested = sessionEnrollments.some(
                    (e) => e.employee_id === myEmployeeId
                  );
                  return (
                    <motion.div key={session.id} variants={staggerItem}>
                      <Card>
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className="font-medium">{session.title}</h3>
                          <Badge variant={sessionTypeVariant(session.session_type)}>
                            {sessionTypeLabel(session.session_type)}
                          </Badge>
                        </div>
                        <p className="mb-2 text-xs text-muted">
                          {[session.trainer_name, session.mode, session.venue]
                            .filter(Boolean)
                            .join(" • ") || "Details to be announced"}
                          {session.schedule_date &&
                            ` • ${formatDate(session.schedule_date)}`}
                          {session.capacity !== null &&
                            ` · ${seatsTaken}/${session.capacity} seats`}
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => requestSeat(session.id)}
                          loading={enrolling}
                          disabled={
                            enrolling || full || alreadyRequested || !myEmployeeId
                          }
                        >
                          {alreadyRequested
                            ? "Seat requested"
                            : full
                              ? "Session full"
                              : enrolling
                                ? "Requesting…"
                                : "Request seat"}
                        </Button>
                      </Card>
                    </motion.div>
                  );
                })}
            </motion.div>
          )}
        </>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            Onboarding
          </h2>
          {!loading && notBriefed === 0 && (
            <p className="mb-4 text-sm text-muted">
              Everyone has completed their first-day briefing.
            </p>
          )}
          {!loading && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="shown"
              className="mb-8 flex max-w-md flex-col gap-2"
            >
              {directory.map((u) => {
                const record = onboardingByEmployee.get(u.id);
                return (
                  <motion.div
                    key={u.id}
                    variants={staggerItem}
                    className={`flex items-center justify-between gap-2 px-4 py-2 ${listRowClass}`}
                  >
                    <div>
                      <span className="text-sm">{u.name}</span>
                      <span className="block text-xs capitalize text-muted">
                        {u.jobTitle}
                      </span>
                    </div>
                    {record?.briefed ? (
                      <Badge variant="success">
                        Briefed{record.briefed_at
                          ? ` · ${formatDate(record.briefed_at)}`
                          : ""}
                      </Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => updateOnboarding(u.id, true)}
                      >
                        Mark Briefed
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          <SessionForm
            competencies={competencies}
            onCreated={refetch}
          />

          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            Sessions
          </h2>
          {!loading && sessions.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No sessions yet"
              description="Schedule a session above to get started."
            />
          )}
          {!loading && sessions.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="shown"
              className="flex max-w-xl flex-col gap-3"
            >
              {sessions.map((session) => {
                const sessionEnrollments =
                  enrollmentsBySession.get(session.id) ?? [];
                const assignedCount = sessionEnrollments.length;
                return (
                  <motion.div key={session.id} variants={staggerItem}>
                    <Card>
                      {editingSessionId === session.id ? (
                        <SessionEditForm
                          session={session}
                          competencies={competencies}
                          onUpdated={() => {
                            refetch();
                            setEditingSessionId(null);
                          }}
                        />
                      ) : (
                        <>
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{session.title}</h3>
                              <Badge variant={sessionTypeVariant(session.session_type)}>
                                {sessionTypeLabel(session.session_type)}
                              </Badge>
                              {isUpcoming(session) && (
                                <Badge variant="warning">Upcoming</Badge>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingSessionId(
                                    editingSessionId === session.id
                                      ? null
                                      : session.id
                                  )
                                }
                                aria-label={
                                  editingSessionId === session.id
                                    ? "Close session editor"
                                    : "Edit session"
                                }
                                aria-expanded={editingSessionId === session.id}
                                className={iconEditClass}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSession(session.id)}
                                className={quietDangerClass}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {session.hr3_competencies?.name && (
                            <p className="mb-1 text-sm text-muted">
                              <span className="font-medium text-ink dark:text-paper">
                                Trains:
                              </span>{" "}
                              {session.hr3_competencies.name}
                            </p>
                          )}
                          <p className="mb-1 text-sm text-muted">
                            {[session.trainer_name, session.mode, session.venue]
                              .filter(Boolean)
                              .join(" • ") || "Details to be announced"}
                            {session.schedule_date &&
                              ` • ${formatDate(session.schedule_date)}`}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted">
                              {formatPHP(session.cost)}
                              {session.capacity !== null &&
                                ` · ${assignedCount}/${session.capacity} seats`}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenRosterId(
                                  openRosterId === session.id ? null : session.id
                                )
                              }
                              aria-expanded={openRosterId === session.id}
                              className={rosterToggleClass}
                            >
                              <Users size={14} />
                              {openRosterId === session.id
                                ? "Close roster"
                                : "Manage roster"}
                            </button>
                          </div>
                        </>
                      )}
                      {editingSessionId !== session.id &&
                        openRosterId === session.id && (
                          <RosterPanel
                            session={session}
                            enrollments={sessionEnrollments}
                            onChanged={refetch}
                          />
                        )}
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
