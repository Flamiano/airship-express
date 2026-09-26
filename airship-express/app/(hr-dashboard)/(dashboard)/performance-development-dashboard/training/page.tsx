"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
  StatCard,
  TableActions,
  DataTable,
  DataTableRow,
  TableCell,
  DetailRow,
  errorTextClass,
  inputClass,
  miniActionClass,
  quietDangerClass,
  selectClass,
  sectionTitleClass,
} from "../components/ui";
import { useHrAuth } from "../lib/hr-auth";
import {
  useDirectory,
} from "../lib/directory";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { formatDate, todayManila } from "../lib/datetime";
import {
  ChevronDown,
  Eye,
  GraduationCap,
  Pencil,
  Trash2,
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
  hr3_training_sessions: { title: string; schedule_date: string | null; session_type: string | null; trainer_name: string | null; mode: string | null; venue: string | null } | null;
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

function formatPHP(amount: number | null) {
  if (amount === null) return "—";
  return `₱${amount.toLocaleString("en-PH")}`;
}

function isUpcoming(session: Session) {
  return !!session.schedule_date && session.schedule_date >= todayManila();
}

const MY_STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
  "attended",
  "missed",
] as const;

type MyStatusFilter = (typeof MY_STATUS_FILTERS)[number];

const MY_STATUS_LABELS: Record<MyStatusFilter, string> = {
  all: "All statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  attended: "Attended",
  missed: "Missed",
};

function EmployeeInfo({ name, jobTitle }: { name: string; jobTitle: string | null }) {
  return (
    <div>
      <span className="text-sm">{name}</span>
      {jobTitle && (
        <span className="block text-xs capitalize text-muted">
          {jobTitle}
        </span>
      )}
    </div>
  );
}

function SessionFields({
  title,
  onTitleChange,
  sessionType,
  onSessionTypeChange,
  trainerName,
  onTrainerNameChange,
  trainerType,
  onTrainerTypeChange,
  mode,
  onModeChange,
  venue,
  onVenueChange,
  scheduleDate,
  onScheduleDateChange,
  capacity,
  onCapacityChange,
  cost,
  onCostChange,
  competencyId,
  onCompetencyIdChange,
  competencies,
  layout = "stacked",
}: {
  title: string;
  onTitleChange: (v: string) => void;
  sessionType: string;
  onSessionTypeChange: (v: string) => void;
  trainerName: string;
  onTrainerNameChange: (v: string) => void;
  trainerType?: string;
  onTrainerTypeChange?: (v: string) => void;
  mode: string;
  onModeChange: (v: string) => void;
  venue: string;
  onVenueChange: (v: string) => void;
  scheduleDate: string;
  onScheduleDateChange: (v: string) => void;
  capacity: string;
  onCapacityChange: (v: string) => void;
  cost: string;
  onCostChange: (v: string) => void;
  competencyId: string;
  onCompetencyIdChange: (v: string) => void;
  competencies: Competency[];
  layout?: "stacked" | "compact";
}) {
  const competencyOptions = (
    <option value="">{layout === "compact" ? "No linked competency" : "Trains: no linked competency"}</option>
  );

  if (layout === "compact") {
    return (
      <>
        <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} required aria-label="Session title" className={inputClass} />
        <select value={sessionType} onChange={(e) => onSessionTypeChange(e.target.value)} aria-label="Session type" className={selectClass}>
          <option value="development">Development</option>
          <option value="mandatory">Mandatory</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <input type="text" placeholder="Trainer" aria-label="Trainer name" value={trainerName} onChange={(e) => onTrainerNameChange(e.target.value)} className={`${inputClass} min-w-[120px] flex-1`} />
          <input type="text" placeholder="Mode" aria-label="Mode" value={mode} onChange={(e) => onModeChange(e.target.value)} className={`${inputClass} min-w-[100px] flex-1`} />
          <input type="text" placeholder="Venue" aria-label="Venue" value={venue} onChange={(e) => onVenueChange(e.target.value)} className={`${inputClass} min-w-[100px] flex-1`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" aria-label="Schedule date" value={scheduleDate} onChange={(e) => onScheduleDateChange(e.target.value)} className={`${inputClass} min-w-[140px] flex-1`} />
          <input type="number" min="1" placeholder="Capacity" aria-label="Capacity" value={capacity} onChange={(e) => onCapacityChange(e.target.value)} className={`${inputClass} min-w-[90px] flex-1`} />
          <input type="number" min="0" step="0.01" placeholder="Cost" aria-label="Cost in Philippine pesos" value={cost} onChange={(e) => onCostChange(e.target.value)} className={`${inputClass} min-w-[90px] flex-1`} />
          <select value={competencyId} onChange={(e) => onCompetencyIdChange(e.target.value)} aria-label="Linked competency" className={`${selectClass} min-w-[160px] flex-1`}>
            {competencyOptions}
            {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </>
    );
  }

  return (
    <>
      <input type="text" placeholder="Title (e.g. Warehouse Fire Drill)" aria-label="Session title" value={title} onChange={(e) => onTitleChange(e.target.value)} required className={inputClass} />
      <select value={sessionType} onChange={(e) => onSessionTypeChange(e.target.value)} aria-label="Session type" className={selectClass}>
        <option value="development">Development — for staff being groomed</option>
        <option value="mandatory">Mandatory — everyone must attend (safety, fire, first aid)</option>
      </select>
      <div className="flex gap-3">
        <input type="text" placeholder="Trainer name" aria-label="Trainer name" value={trainerName} onChange={(e) => onTrainerNameChange(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
        {onTrainerTypeChange && (
          <select value={trainerType ?? ""} onChange={(e) => onTrainerTypeChange(e.target.value)} aria-label="Trainer type" className={`${selectClass} min-w-0 flex-1`}>
            <option value="">Trainer type</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        )}
      </div>
      <div className="flex gap-3">
        <input type="text" placeholder="Mode (e.g. In-person)" aria-label="Mode" value={mode} onChange={(e) => onModeChange(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
        <input type="text" placeholder="Venue" aria-label="Venue" value={venue} onChange={(e) => onVenueChange(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
      </div>
      <input type="date" aria-label="Schedule date" value={scheduleDate} onChange={(e) => onScheduleDateChange(e.target.value)} className={inputClass} />
      <div className="flex gap-3">
        <input type="number" min="1" placeholder="Capacity" aria-label="Capacity" value={capacity} onChange={(e) => onCapacityChange(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
        <input type="number" min="0" step="0.01" placeholder="Cost (PHP)" aria-label="Cost in Philippine pesos" value={cost} onChange={(e) => onCostChange(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
      </div>
      <select value={competencyId} onChange={(e) => onCompetencyIdChange(e.target.value)} aria-label="Linked competency" className={selectClass}>
        {competencyOptions}
        {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </>
  );
}

function SessionForm({
  competencies,
  onCreated,
  onCancel,
}: {
  competencies: Competency[];
  onCreated: () => void;
  onCancel: () => void;
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
  const [autoEnroll, setAutoEnroll] = useState(false);

  const { submit, submitting } = useApiMutation({
    path: "sessions",
    method: "POST",
    onSuccess: () => {
      setTitle("");
      setTrainerName("");
      setTrainerType("");
      setMode("");
      setVenue("");
      setScheduleDate("");
      setCapacity("");
      setCost("");
      setCompetencyId("");
      setAutoEnroll(false);
      onCreated();
      onCancel();
      toast.success("Training session created successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await submit({
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
      auto_enroll: sessionType === "mandatory" && autoEnroll,
    });
    if (error) {
      toast.error("Failed to create training session. Please try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Session Details
        </p>
        <div className="flex flex-col gap-3">
          <input type="text" placeholder="Title (e.g. Warehouse Fire Drill)" aria-label="Session title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} aria-label="Session type" className={selectClass}>
            <option value="development">Development — for staff being groomed</option>
            <option value="mandatory">Mandatory — everyone must attend (safety, fire, first aid)</option>
          </select>
          {sessionType === "mandatory" && (
            <label className="flex items-center gap-2 text-sm text-ink dark:text-paper cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnroll}
                onChange={(e) => setAutoEnroll(e.target.checked)}
                aria-label="Auto-enroll all active employees"
                className="h-4 w-4 rounded border-line accent-accent"
              />
              Auto-enroll all active employees
            </label>
          )}
          <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} aria-label="Linked competency" className={selectClass}>
            <option value="">No linked competency</option>
            {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Instructor
        </p>
        <div className="flex gap-3">
          <input type="text" placeholder="Trainer name" aria-label="Trainer name" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
          <select value={trainerType} onChange={(e) => setTrainerType(e.target.value)} aria-label="Trainer type" className={`${selectClass} min-w-0 flex-1`}>
            <option value="">Trainer type</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Location &amp; Schedule
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input type="text" placeholder="Mode (e.g. In-person)" aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
            <input type="text" placeholder="Venue" aria-label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
          </div>
          <input type="date" aria-label="Schedule date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Capacity &amp; Cost
        </p>
        <div className="flex gap-3">
          <input type="number" min="1" placeholder="Capacity" aria-label="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
          <input type="number" min="0" step="0.01" placeholder="Cost (PHP)" aria-label="Cost in Philippine pesos" value={cost} onChange={(e) => setCost(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitting ? "Saving…" : "Schedule Session"}
        </Button>
      </div>
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

  const { submit, submitting } = useApiMutation({
    path: "sessions",
    method: "PUT",
    onSuccess: () => {
      onUpdated();
      toast.success("Training session updated successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await submit({
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
    });
    if (error) {
      toast.error("Failed to update training session. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <SessionFields
        title={title} onTitleChange={setTitle}
        sessionType={sessionType} onSessionTypeChange={setSessionType}
        trainerName={trainerName} onTrainerNameChange={setTrainerName}
        mode={mode} onModeChange={setMode}
        venue={venue} onVenueChange={setVenue}
        scheduleDate={scheduleDate} onScheduleDateChange={setScheduleDate}
        capacity={capacity} onCapacityChange={setCapacity}
        cost={cost} onCostChange={setCost}
        competencyId={competencyId} onCompetencyIdChange={setCompetencyId}
        competencies={competencies}
        layout="compact"
      />
      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
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
  const [rosterSearch, setRosterSearch] = useState("");
  const [confirmingEnrollmentId, setConfirmingEnrollmentId] = useState<
    string | null
  >(null);

  const createEnrollment = useApiMutation({
    path: "training-enrollments",
    method: "POST",
  });

  const updateEnrollment = useApiMutation({
    path: "training-enrollments",
    method: "PUT",
  });

  const deleteEnrollment = useApiMutation({
    path: "training-enrollments",
    method: "DELETE",
  });

  const busy = createEnrollment.submitting || updateEnrollment.submitting || deleteEnrollment.submitting;

  const assignedCount = enrollments.length;
  const full = session.capacity !== null && assignedCount >= session.capacity;

  const visibleDirectory = rosterSearch.trim()
    ? directory.filter((user) =>
        user.name.toLowerCase().includes(rosterSearch.trim().toLowerCase())
      )
    : directory;

  async function assign(employeeId: string) {
    const { error } = await createEnrollment.submit({
      employee_id: employeeId,
      session_id: session.id,
    });
    if (error) {
      toast.error("Failed to assign employee. Please try again.");
    } else {
      onChanged();
      toast.success("Employee assigned successfully.");
    }
  }

  async function markAttendance(
    employeeId: string,
    attendanceStatus: string
  ) {
    const enrollment = enrollments.find(
      (e) => e.employee_id === employeeId
    );
    let enrollmentId = enrollment?.id;
    if (!enrollmentId) {
      const createResult = await createEnrollment.submit({
        employee_id: employeeId,
        session_id: session.id,
      });
      if (createResult.error) {
        toast.error("Failed to assign employee. Please try again.");
        return;
      }
      enrollmentId = ((createResult.data as Record<string, unknown>)?.enrollment as { id: string } | undefined)?.id;
    }
    const { error } = await updateEnrollment.submit({
      id: enrollmentId,
      attendance_status: attendanceStatus,
    });
    if (error) {
      toast.error("Failed to update attendance. Please try again.");
    } else {
      onChanged();
      toast.success("Attendance marked successfully.");
    }
  }

  async function setApproval(enrollmentId: string, approvalStatus: string) {
    const { error } = await updateEnrollment.submit({
      id: enrollmentId,
      approval_status: approvalStatus,
    });
    if (error) {
      toast.error("Failed to update approval. Please try again.");
    } else {
      onChanged();
      toast.success(
        approvalStatus === "approved"
          ? "Enrollment approved."
          : "Enrollment rejected."
      );
    }
  }

  async function unassign(enrollmentId: string) {
    const { error } = await deleteEnrollment.submit(null, { id: enrollmentId });
    setConfirmingEnrollmentId(null);
    if (error) {
      toast.error("Failed to unassign employee. Please try again.");
    } else {
      onChanged();
      toast.success("Employee removed successfully.");
    }
  }

  async function markAllAttended() {
    const updates: Array<Record<string, unknown>> = [];
    const creates: Array<Record<string, unknown>> = [];

    for (const user of directory) {
      const enrollment = enrollments.find(
        (e) => e.employee_id === user.id
      );
      if (enrollment?.attendance_status === "attended") continue;
      if (enrollment) {
        updates.push({
          id: enrollment.id,
          attendance_status: "attended",
        });
      } else {
        creates.push({
          employee_id: user.id,
          session_id: session.id,
        });
      }
    }

    for (const body of creates) {
      const { error } = await createEnrollment.submit(body);
      if (error) {
        toast.error("Failed to update attendance. Please try again.");
        return;
      }
    }
    for (const body of updates) {
      const { error } = await updateEnrollment.submit(body);
      if (error) {
        toast.error("Failed to update attendance. Please try again.");
        return;
      }
    }

    onChanged();
    toast.success("All attendance marked successfully.");
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
      <input
        type="text"
        value={rosterSearch}
        onChange={(e) => setRosterSearch(e.target.value)}
        placeholder="Search employees…"
        aria-label="Search employees to assign"
        className={`${inputClass} mb-2 w-full max-w-xs`}
      />
      {visibleDirectory.length === 0 ? (
        <p className="py-2 text-xs text-muted">
          No employees match &quot;{rosterSearch}&quot;.
        </p>
      ) : (
        <div className="flex flex-col">
        {visibleDirectory.map((user) => {
          const enrollment = enrollments.find(
            (e) => e.employee_id === user.id
          );
          return (
            <div
              key={user.id}
              className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0"
            >
              <EmployeeInfo name={user.name} jobTitle={user.jobTitle} />
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
                    {confirmingEnrollmentId === enrollment.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-muted">
                          Remove {user.name.split(" ")[0]}?
                        </span>
                        <button
                          type="button"
                          className={quietDangerClass}
                          onClick={() => unassign(enrollment.id)}
                          disabled={busy}
                        >
                          {deleteEnrollment.submitting
                            ? "Removing…"
                            : "Confirm"}
                        </button>
                        <button
                          type="button"
                          className={miniActionClass}
                          onClick={() => setConfirmingEnrollmentId(null)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={quietDangerClass}
                        onClick={() => setConfirmingEnrollmentId(enrollment.id)}
                        disabled={busy}
                      >
                        Unassign
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

export default function TrainingPage() {
  const { user, isAdmin } = useHrAuth();
  const { directory } = useDirectory();
  const isEmployee = !isAdmin;
  const [openRosterId, setOpenRosterId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [myStatusFilter, setMyStatusFilter] = useState<MyStatusFilter>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(
    null
  );
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const sessions = useApiResource<Session>({ path: "sessions", listKey: "sessions", errorMessage: "Could not load training data. Please try again." });
  const enrollments = useApiResource<Enrollment>({ path: "training-enrollments", listKey: "enrollments", errorMessage: "Could not load training data. Please try again." });
  const competencies = useApiResource<Competency>({ path: "competency", listKey: "competencies", errorMessage: "Could not load training data. Please try again." });
  const onboarding = useApiResource<OnboardingRecord>({ path: "onboarding-records", listKey: "records", errorMessage: "Could not load training data. Please try again." });

  const loading = sessions.loading || enrollments.loading || competencies.loading || onboarding.loading;
  const error = sessions.error || enrollments.error || competencies.error || onboarding.error;

  function refetch() {
    sessions.refetch();
    enrollments.refetch();
    competencies.refetch();
    onboarding.refetch();
  }

  const updateOnboardingMutation = useApiMutation({
    path: "onboarding-records",
    method: "PUT",
  });

  const deleteSessionMutation = useApiMutation({
    path: "sessions",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingSessionId(null);
      refetch();
    },
  });

  const requestSeatMutation = useApiMutation({
    path: "training-enrollments",
    method: "POST",
  });

  const myEmployeeId = isEmployee ? user?.employeeId ?? null : null;

  async function updateOnboarding(employeeId: string, briefed: boolean) {
    const { error } = await updateOnboardingMutation.submit({
      employee_id: employeeId,
      briefed,
    });
    if (error) {
      toast.error("Failed to update onboarding. Please try again.");
    } else {
      refetch();
      toast.success("Onboarding status updated successfully.");
    }
  }

  async function deleteSession(id: string) {
    const { error } = await deleteSessionMutation.submit(null, { id });
    if (error) {
      toast.error("Failed to delete training session. Please try again.");
    } else {
      refetch();
      toast.success("Training session deleted successfully.");
    }
  }

  const onboardingByEmployee = useMemo(() => {
    const map = new Map<string, OnboardingRecord>();
    for (const record of onboarding.data) {
      if (record.employee_id) map.set(record.employee_id, record);
    }
    return map;
  }, [onboarding.data]);

  const notBriefed = directory.filter(
    (u) => !onboardingByEmployee.get(u.id)?.briefed
  ).length;

  const enrollmentsBySession = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    for (const enrollment of enrollments.data) {
      if (!enrollment.session_id) continue;
      const list = map.get(enrollment.session_id) ?? [];
      list.push(enrollment);
      map.set(enrollment.session_id, list);
    }
    return map;
  }, [enrollments.data]);

  const upcomingSessions = sessions.data.filter(isUpcoming).length;
  const missed = enrollments.data.filter(
    (e) => e.attendance_status === "missed"
  ).length;

  const myEnrollments = useMemo(
    () =>
      myEmployeeId
        ? enrollments.data.filter((e) => e.employee_id === myEmployeeId)
        : [],
    [enrollments.data, myEmployeeId]
  );

  const filteredMyEnrollments = useMemo(() => {
    return myEnrollments.filter((e) => {
      if (myStatusFilter === "all") return true;
      if (
        myStatusFilter === "pending" ||
        myStatusFilter === "approved" ||
        myStatusFilter === "rejected"
      ) {
        return e.approval_status === myStatusFilter;
      }
      return e.attendance_status === myStatusFilter;
    });
  }, [myEnrollments, myStatusFilter]);

  async function requestSeat(sessionId: string) {
    const { error } = await requestSeatMutation.submit({
      session_id: sessionId,
    });
    if (error) {
      toast.error("Could not request a seat. Please try again.");
    } else {
      refetch();
      toast.success("Seat requested. Waiting for HR approval.");
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
        { label: "Sessions", value: sessions.data.length },
        { label: "Missed", value: missed },
      ];

  const viewingSession = viewingSessionId
    ? sessions.data.find((s) => s.id === viewingSessionId)
    : null;

  const viewingEnrollment = viewingSessionId && myEmployeeId
    ? myEnrollments.find((e) => e.session_id === viewingSessionId)
    : null;

  const editingSession = editingSessionId
    ? sessions.data.find((s) => s.id === editingSessionId)
    : null;

  const confirmingSession = confirmingSessionId
    ? sessions.data.find((s) => s.id === confirmingSessionId)
    : null;

  const rosterSession = openRosterId
    ? sessions.data.find((s) => s.id === openRosterId)
    : null;

  const rosterEnrollments = openRosterId
    ? (enrollmentsBySession.get(openRosterId) ?? [])
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Training Management"
        title="Training"
        subtitle="Onboard new staff, schedule sessions, and record who actually attended."
        actions={
          isAdmin ? (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Schedule Session
            </Button>
          ) : undefined
        }
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
          <h2 className={`mb-3 ${sectionTitleClass}`}>My Sessions</h2>
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
          {!loading && myEmployeeId !== null && myEnrollments.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {MY_STATUS_FILTERS.map((value) => (
                <Chip
                  key={value}
                  active={myStatusFilter === value}
                  onClick={() => setMyStatusFilter(value)}
                >
                  {MY_STATUS_LABELS[value]}
                </Chip>
              ))}
            </div>
          )}
          {!loading &&
            myEnrollments.length > 0 &&
            filteredMyEnrollments.length === 0 && (
              <EmptyState
                icon={GraduationCap}
                title="No sessions match"
                description="Try a different status filter to see more sessions."
              />
            )}
          {!loading && filteredMyEnrollments.length > 0 && (
            <DataTable columns={["Session", "Date", "Type", "Approval", "Attendance", ""]} className="mb-8">
              {filteredMyEnrollments.map((e) => {
                const s = e.hr3_training_sessions;
                return (
                  <DataTableRow key={e.id}>
                    <TableCell className="font-medium">{s?.title ?? "—"}</TableCell>
                    <TableCell className="text-muted">
                      {s?.schedule_date ? formatDate(s.schedule_date) : "—"}
                    </TableCell>
                    <TableCell>
                      {s?.session_type && (
                        <Badge variant={sessionTypeVariant(s.session_type)}>
                          {sessionTypeLabel(s.session_type)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={approvalVariant(e.approval_status)}>
                        {approvalLabel(e.approval_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={attendanceVariant(e.attendance_status)}>
                        {attendanceLabel(e.attendance_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TableActions
                        actions={[
                          {
                            label: "View",
                            icon: <Eye size={14} />,
                            onClick: () => {
                              setEditingSessionId(null);
                              setConfirmingSessionId(null);
                              setOpenRosterId(null);
                              setViewingSessionId(e.session_id);
                            },
                          },
                        ]}
                      />
                    </TableCell>
                  </DataTableRow>
                );
              })}
            </DataTable>
          )}

          <h2 className={`mb-3 ${sectionTitleClass}`}>Upcoming Sessions</h2>
          {!loading &&
            sessions.data.filter(isUpcoming).length === 0 && (
              <EmptyState
                icon={GraduationCap}
                title="No upcoming sessions"
                description="New training sessions will appear here when HR schedules them."
              />
            )}
          {!loading && sessions.data.filter(isUpcoming).length > 0 && (
            <DataTable columns={["Session", "Date", "Details", "Seats", "Type", ""]}>
              {sessions.data
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
                    <DataTableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell className="text-muted">
                        {session.schedule_date ? formatDate(session.schedule_date) : "—"}
                      </TableCell>
                      <TableCell className="text-muted">
                        {[session.trainer_name, session.mode, session.venue]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted">
                        {session.capacity !== null
                          ? `${seatsTaken}/${session.capacity}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sessionTypeVariant(session.session_type)}>
                          {sessionTypeLabel(session.session_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          onClick={() => requestSeat(session.id)}
                          loading={requestSeatMutation.submitting}
                          disabled={
                            requestSeatMutation.submitting || full || alreadyRequested || !myEmployeeId
                          }
                          title={
                            !myEmployeeId
                              ? "Your account is not linked to an employee profile yet"
                              : alreadyRequested
                                ? "You already requested a seat in this session"
                                : full
                                  ? "This session has reached its capacity"
                                  : undefined
                          }
                          className="h-8 px-3 text-xs"
                        >
                          {alreadyRequested
                            ? "Requested"
                            : full
                              ? "Full"
                              : requestSeatMutation.submitting
                                ? "Requesting…"
                                : "Request seat"}
                        </Button>
                      </TableCell>
                    </DataTableRow>
                  );
                })}
            </DataTable>
          )}
        </>
      ) : (
        <>
          <h2 className={`mb-3 ${sectionTitleClass}`}>Sessions</h2>
          {!loading && sessions.data.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No sessions yet"
              description="Click Schedule Session above to get started."
            />
          )}
          {!loading && sessions.data.length > 0 && (
            <DataTable columns={["Session", "Date", "Type", "Cost", "Seats", ""]} className="mb-8">
              {sessions.data.map((session) => {
                const sessionEnrollments =
                  enrollmentsBySession.get(session.id) ?? [];
                const assignedCount = sessionEnrollments.length;
                return (
                  <DataTableRow key={session.id}>
                    <TableCell className="font-medium">{session.title}</TableCell>
                    <TableCell className="text-muted">
                      {session.schedule_date ? formatDate(session.schedule_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sessionTypeVariant(session.session_type)}>
                        {sessionTypeLabel(session.session_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted">{formatPHP(session.cost)}</TableCell>
                    <TableCell className="text-muted">
                      {session.capacity !== null
                        ? `${assignedCount}/${session.capacity}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingSessionId(null);
                            setEditingSessionId(null);
                            setConfirmingSessionId(null);
                            setOpenRosterId(session.id);
                          }}
                          className={miniActionClass}
                          title="Manage roster"
                        >
                          <Users size={14} />
                        </button>
                        <TableActions
                          actions={[
                            {
                              label: "View",
                              icon: <Eye size={14} />,
                              onClick: () => {
                                setEditingSessionId(null);
                                setConfirmingSessionId(null);
                                setOpenRosterId(null);
                                setViewingSessionId(session.id);
                              },
                            },
                            {
                              label: "Edit",
                              icon: <Pencil size={14} />,
                              onClick: () => {
                                setViewingSessionId(null);
                                setConfirmingSessionId(null);
                                setOpenRosterId(null);
                                setEditingSessionId(session.id);
                              },
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 size={14} />,
                              onClick: () => {
                                setViewingSessionId(null);
                                setEditingSessionId(null);
                                setOpenRosterId(null);
                                setConfirmingSessionId(session.id);
                              },
                              danger: true,
                            },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </DataTableRow>
                );
              })}
            </DataTable>
          )}

          <h2 className={`mb-3 ${sectionTitleClass}`}>Onboarding</h2>
          {!loading && notBriefed === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="All briefed"
              description="Everyone has completed their first-day briefing."
            />
          )}
          {!loading && (
            <>
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(!isOnboardingOpen)}
                className="mb-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
                aria-expanded={isOnboardingOpen}
              >
                {isOnboardingOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronDown size={14} className="-rotate-90" />
                )}
                {notBriefed > 0
                  ? `${notBriefed} need briefing`
                  : "All briefed"}
              </button>
              {isOnboardingOpen && (
                <DataTable columns={["Employee", "Status", ""]}>
                  {directory.map((u) => {
                    const record = onboardingByEmployee.get(u.id);
                    return (
                      <DataTableRow key={u.id}>
                        <TableCell>
                          <EmployeeInfo name={u.name} jobTitle={u.jobTitle} />
                        </TableCell>
                        <TableCell>
                          {record?.briefed ? (
                            <Badge variant="success">
                              Briefed{record.briefed_at
                                ? ` · ${formatDate(record.briefed_at)}`
                                : ""}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted">Not briefed</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!record?.briefed && (
                            <Button
                              variant="secondary"
                              onClick={() => updateOnboarding(u.id, true)}
                              className="h-8 px-3 text-xs"
                            >
                              Mark Briefed
                            </Button>
                          )}
                        </TableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTable>
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule a Session"
        titleId="create-session-title"
      >
        <SessionForm
          competencies={competencies.data}
          onCreated={refetch}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        open={viewingSessionId !== null}
        onClose={() => setViewingSessionId(null)}
        title={viewingSession?.title ?? "Session Details"}
        size="lg"
      >
        {viewingSession && (
          <dl>
            <DetailRow label="Title" value={viewingSession.title} />
            <DetailRow
              label="Type"
              value={
                <Badge variant={sessionTypeVariant(viewingSession.session_type)}>
                  {sessionTypeLabel(viewingSession.session_type)}
                </Badge>
              }
            />
            <DetailRow label="Trainer" value={viewingSession.trainer_name ?? "—"} />
            {viewingSession.trainer_type && (
              <DetailRow label="Trainer Type" value={viewingSession.trainer_type} />
            )}
            <DetailRow label="Mode" value={viewingSession.mode ?? "—"} />
            <DetailRow label="Venue" value={viewingSession.venue ?? "—"} />
            <DetailRow
              label="Schedule"
              value={viewingSession.schedule_date ? formatDate(viewingSession.schedule_date) : "—"}
            />
            <DetailRow
              label="Capacity"
              value={viewingSession.capacity !== null ? `${viewingSession.capacity}` : "—"}
            />
            <DetailRow label="Cost" value={formatPHP(viewingSession.cost)} />
            {viewingSession.hr3_competencies?.name && (
              <DetailRow label="Linked Competency" value={viewingSession.hr3_competencies.name} />
            )}
            {viewingEnrollment && (
              <>
                <DetailRow
                  label="Approval"
                  value={
                    <Badge variant={approvalVariant(viewingEnrollment.approval_status)}>
                      {approvalLabel(viewingEnrollment.approval_status)}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Attendance"
                  value={
                    <Badge variant={attendanceVariant(viewingEnrollment.attendance_status)}>
                      {attendanceLabel(viewingEnrollment.attendance_status)}
                    </Badge>
                  }
                />
              </>
            )}
          </dl>
        )}
      </Modal>

      <Modal
        open={editingSessionId !== null}
        onClose={() => setEditingSessionId(null)}
        title="Edit Session"
        size="xl"
      >
        {editingSession && (
          <SessionEditForm
            session={editingSession}
            competencies={competencies.data}
            onUpdated={() => {
              refetch();
              setEditingSessionId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={confirmingSessionId !== null}
        onClose={() => setConfirmingSessionId(null)}
        title="Delete Session"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingSessionId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteSessionMutation.submitting}
              onClick={() => confirmingSessionId && deleteSession(confirmingSessionId)}
            >
              {deleteSessionMutation.submitting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Are you sure you want to delete{" "}
          <strong className="text-ink dark:text-paper">{confirmingSession?.title}</strong>?
          This action cannot be undone.
        </p>
      </Modal>

      <Modal
        open={openRosterId !== null}
        onClose={() => setOpenRosterId(null)}
        title={rosterSession ? `Roster — ${rosterSession.title}` : "Roster"}
        size="xl"
      >
        {rosterSession && (
          <RosterPanel
            session={rosterSession}
            enrollments={rosterEnrollments}
            onChanged={refetch}
          />
        )}
      </Modal>
    </div>
  );
}
