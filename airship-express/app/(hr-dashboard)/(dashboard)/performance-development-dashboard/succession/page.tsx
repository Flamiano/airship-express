"use client";

import { useState } from "react";
import {
  Badge,
  Button,
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
  sectionTitleClass,
  textareaClass,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/ui";
import { useHrAuth } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/hr-auth";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
import { useApiResource, useApiMutation } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/use-api";
import { useCandidateEvidence, CandidateEvidence } from "./evidence-data";
import { Eye, Lock, Pencil, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

type Hr1JobPosition = {
  id: string;
  title: string;
  department: string | null;
  is_active: boolean | null;
};

type CriticalPosition = {
  id: string;
  position_id: string;
  risk_level: string;
  reason: string | null;
  hr1_job_positions: Hr1JobPosition | Hr1JobPosition[] | null;
};

type Candidate = {
  id: string;
  employee_id: string | null;
  readiness_level: string;
  potential_rating: number | null;
  performance_rating: number | null;
  development_notes: string | null;
  hr3_critical_positions:
    | (CriticalPosition & {
        hr1_job_positions: Hr1JobPosition | Hr1JobPosition[] | null;
      })
    | null;
};

function pickJobPosition(
  raw: Hr1JobPosition | Hr1JobPosition[] | null | undefined
): Hr1JobPosition | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function readinessLabel(level: string) {
  if (level === "ready_now") return "Ready Now";
  if (level === "1-2_years") return "Ready in 1-2 Years";
  return "Ready in 3+ Years";
}

function readinessVariant(
  level: string
): "success" | "warning" | "danger" | "neutral" {
  if (level === "ready_now") return "success";
  if (level === "1-2_years") return "warning";
  return "neutral";
}

function riskLabel(risk: string) {
  return `${risk} risk`;
}

function riskVariant(
  risk: string
): "success" | "warning" | "danger" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "neutral";
}

function readinessRank(level: string) {
  if (level === "ready_now") return 0;
  if (level === "1-2_years") return 1;
  return 2;
}

function bestReadiness(candidates: Candidate[]) {
  let best: Candidate | null = null;
  for (const c of candidates) {
    if (
      !best ||
      readinessRank(c.readiness_level) < readinessRank(best.readiness_level)
    ) {
      best = c;
    }
  }
  return best;
}

function coverageVariant(
  level: string
): "success" | "warning" | "danger" | "neutral" {
  if (level === "ready_now") return "success";
  if (level === "1-2_years") return "warning";
  return "neutral";
}

export default function SuccessionPage() {
  const { isAdmin } = useHrAuth();
  const { directory, getDirectoryUser } = useDirectory();

  const [candidateEmployeeId, setCandidateEmployeeId] = useState("");
  const [candidatePositionId, setCandidatePositionId] = useState("");
  const [readiness, setReadiness] = useState("ready_now");
  const [potentialRating, setPotentialRating] = useState("");
  const [performanceRating, setPerformanceRating] = useState("");
  const [developmentNotes, setDevelopmentNotes] = useState("");

  const [newPositionId, setNewPositionId] = useState("");
  const [newRiskLevel, setNewRiskLevel] = useState("medium");
  const [newReason, setNewReason] = useState("");

  const [confirmingCandidate, setConfirmingCandidate] = useState<Candidate | null>(null);
  const [confirmingPosition, setConfirmingPosition] = useState<CriticalPosition | null>(null);

  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editDraft, setEditDraft] = useState<{
    readiness_level: string;
    potential_rating: string;
    performance_rating: string;
    development_notes: string;
  } | null>(null);

  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);

  const [search, setSearch] = useState("");

  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] =
    useState(false);
  const [isFlagPositionModalOpen, setIsFlagPositionModalOpen] =
    useState(false);

  const ADD_CANDIDATE_TITLE_ID = "add-candidate-title";
  const FLAG_POSITION_TITLE_ID = "flag-position-title";

  const {
    data: candidates,
    loading: candidatesLoading,
    error: candidatesError,
    refetch: refetchCandidates,
  } = useApiResource<Candidate>({
    path: "succession-candidates",
    listKey: "candidates",
    disabled: !isAdmin,
    errorMessage: "Could not load succession data. Please try again.",
  });

  const {
    data: positions,
    loading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = useApiResource<CriticalPosition>({
    path: "critical-positions",
    listKey: "positions",
    disabled: !isAdmin,
    errorMessage: "Could not load succession data. Please try again.",
  });

  const candidateEvidence = useCandidateEvidence(!isAdmin);

  const {
    data: jobPositions,
    loading: jobPositionsLoading,
    error: jobPositionsError,
  } = useApiResource<Hr1JobPosition>({
    path: "job-positions",
    listKey: "job_positions",
    disabled: !isAdmin,
    errorMessage: "Could not load job positions. Please try again.",
  });

  const loading = candidatesLoading || positionsLoading;

  const error = candidatesError || positionsError;

  function refetch() {
    refetchCandidates();
    refetchPositions();
  }

  const addCandidateMutation = useApiMutation({
    path: "succession-candidates",
    method: "POST",
    onSuccess: () => {
      setCandidateEmployeeId("");
      setCandidatePositionId("");
      setReadiness("ready_now");
      setPotentialRating("");
      setPerformanceRating("");
      setDevelopmentNotes("");
      setIsAddCandidateModalOpen(false);
      refetch();
      toast.success("Candidate added successfully.");
    },
  });

  const addPositionMutation = useApiMutation({
    path: "critical-positions",
    method: "POST",
    onSuccess: () => {
      setNewPositionId("");
      setNewRiskLevel("medium");
      setNewReason("");
      setIsFlagPositionModalOpen(false);
      refetch();
      toast.success("Position flagged successfully.");
    },
  });

  const updateCandidateMutation = useApiMutation({
    path: "succession-candidates",
    method: "PUT",
    onSuccess: () => {
      setEditingCandidate(null);
      setEditDraft(null);
      refetch();
      toast.success("Candidate updated successfully.");
    },
  });

  const removeCandidateMutation = useApiMutation({
    path: "succession-candidates",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingCandidate(null);
      refetch();
    },
  });

  const removePositionMutation = useApiMutation({
    path: "critical-positions",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingPosition(null);
      refetch();
    },
  });

  async function addCandidate(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await addCandidateMutation.submit({
      position_id: candidatePositionId,
      employee_id: candidateEmployeeId,
      readiness_level: readiness,
      potential_rating: potentialRating ? parseInt(potentialRating) : null,
      performance_rating: performanceRating
        ? parseInt(performanceRating)
        : null,
      development_notes: developmentNotes,
    });
    if (submitError) {
      toast.error("Failed to add candidate. Please try again.");
    }
  }

  async function addPosition(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await addPositionMutation.submit({
      position_id: newPositionId,
      risk_level: newRiskLevel,
      reason: newReason,
    });
    if (submitError) {
      toast.error("Failed to flag position. Please try again.");
    }
  }

  function startEdit(candidate: Candidate) {
    setEditingCandidate(candidate);
    setEditDraft({
      readiness_level: candidate.readiness_level,
      potential_rating: candidate.potential_rating?.toString() ?? "",
      performance_rating: candidate.performance_rating?.toString() ?? "",
      development_notes: candidate.development_notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editingCandidate || !editDraft) return;
    const { error: submitError } = await updateCandidateMutation.submit({
      id: editingCandidate.id,
      readiness_level: editDraft.readiness_level,
      potential_rating: editDraft.potential_rating
        ? parseInt(editDraft.potential_rating)
        : null,
      performance_rating: editDraft.performance_rating
        ? parseInt(editDraft.performance_rating)
        : null,
      development_notes: editDraft.development_notes,
    });
    if (submitError) {
      toast.error("Failed to update candidate. Please try again.");
    }
  }

  async function removeCandidate(candidate: Candidate) {
    const { error: submitError } = await removeCandidateMutation.submit(null, {
      id: candidate.id,
    });
    if (!submitError) {
      toast.success("Candidate removed successfully.");
    } else {
      toast.error("Failed to remove candidate. Please try again.");
    }
  }

  async function removePosition(position: CriticalPosition) {
    const { error: submitError } = await removePositionMutation.submit(null, {
      id: position.id,
    });
    if (!submitError) {
      toast.success("Position removed successfully.");
    } else {
      toast.error("Failed to remove position. Please try again.");
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          eyebrow="Succession Planning"
          title="Succession Planning"
          subtitle="Who could step into critical roles if needed."
        />
        <EmptyState
          icon={Lock}
          title="Restricted"
          description="Succession planning is visible to managers and HR admin only."
        />
      </div>
    );
  }

  const candidatesByPosition = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const pid = c.hr3_critical_positions?.id;
    if (!pid) continue;
    const list = candidatesByPosition.get(pid);
    if (list) list.push(c);
    else candidatesByPosition.set(pid, [c]);
  }

  const query = search.trim().toLowerCase();
  const visibleCandidates = query
    ? candidates.filter((c) => {
        const employeeName = getDirectoryUser(c.employee_id)?.name?.toLowerCase() ?? "";
        const positionName = (
          pickJobPosition(c.hr3_critical_positions?.hr1_job_positions)?.title ?? ""
        ).toLowerCase();
        return employeeName.includes(query) || positionName.includes(query);
      })
    : candidates;

  const covered = positions.filter(
    (p) => (candidatesByPosition.get(p.id)?.length ?? 0) > 0
  );
  const uncovered = positions.filter(
    (p) => (candidatesByPosition.get(p.id)?.length ?? 0) === 0
  );
  const highRiskUncovered = uncovered.filter(
    (p) => p.risk_level === "high"
  );

  const stats = [
    { label: "Critical Positions", value: positions.length },
    { label: "Covered", value: covered.length },
    { label: "No Successor", value: uncovered.length },
    { label: "High-Risk Uncovered", value: highRiskUncovered.length },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Succession Planning"
        title="Succession Planning"
        subtitle="Track readiness for critical roles so the company is never caught short."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setIsAddCandidateModalOpen(true)}>
              Add Candidate
            </Button>
            <Button onClick={() => setIsFlagPositionModalOpen(true)}>
              Flag Position
            </Button>
          </div>
        }
      />

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading succession data…">
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

      <Modal
        open={isAddCandidateModalOpen}
        onClose={() => setIsAddCandidateModalOpen(false)}
        title="Add Candidate"
        titleId={ADD_CANDIDATE_TITLE_ID}
      >
        <form onSubmit={addCandidate} className="flex flex-col gap-3">
              <select
                value={candidatePositionId}
                onChange={(e) => setCandidatePositionId(e.target.value)}
                required
                aria-label="Select position"
                className={selectClass}
              >
                <option value="" disabled>
                  Select position
                </option>
                {positions.map((p) => {
                  const jp = pickJobPosition(p.hr1_job_positions);
                  return (
                    <option key={p.id} value={p.id}>
                      {jp?.title ?? "Unknown position"}
                    </option>
                  );
                })}
              </select>
              <select
                value={candidateEmployeeId}
                onChange={(e) => setCandidateEmployeeId(e.target.value)}
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
                value={readiness}
                onChange={(e) => setReadiness(e.target.value)}
                aria-label="Readiness level"
                className={selectClass}
              >
                <option value="ready_now">Ready Now</option>
                <option value="1-2_years">Ready in 1-2 Years</option>
                <option value="3+_years">Ready in 3+ Years</option>
              </select>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="1"
                  max="5"
                  placeholder="Potential (1-5)"
                  aria-label="Potential rating"
                  value={potentialRating}
                  onChange={(e) => setPotentialRating(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <input
                  type="number"
                  min="1"
                  max="5"
                  placeholder="Performance (1-5)"
                  aria-label="Performance rating"
                  value={performanceRating}
                  onChange={(e) => setPerformanceRating(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                />
              </div>
              <textarea
                placeholder="Development notes (optional)"
                aria-label="Development notes"
                value={developmentNotes}
                onChange={(e) => setDevelopmentNotes(e.target.value)}
                className={textareaClass}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddCandidateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={addCandidateMutation.submitting}>
                  {addCandidateMutation.submitting
                    ? "Saving…"
                    : "Add Candidate"}
                </Button>
              </div>
            </form>
        </Modal>

      {isAdmin && positions.length === 0 && (
        <p className="mb-6 text-xs text-muted">
          Add a critical position below first — candidates are linked to
          positions.
        </p>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={sectionTitleClass}>Candidates</h2>
        <input
          type="search"
          placeholder="Search by employee or position..."
          aria-label="Search candidates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${controlSmallClass} min-w-[200px]`}
        />
      </div>

      {!loading && candidates.length > 0 && visibleCandidates.length === 0 && (
        <p className="mb-6 text-sm text-muted">No candidates match your search.</p>
      )}

      {!loading && candidates.length > 0 && (
        <DataTable
          columns={["Employee", "Position", "Readiness", "Potential", "Performance", ""]}
          className="mb-8"
        >
          {visibleCandidates.map((c) => {
            const employee = getDirectoryUser(c.employee_id);
            return (
              <DataTableRow key={c.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-ink dark:text-paper">
                      {employee?.name ?? "Unknown employee"}
                    </p>
                    {employee?.jobTitle && (
                      <p className="text-xs capitalize text-muted">
                        {employee.jobTitle}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-ink dark:text-paper">
                    {pickJobPosition(c.hr3_critical_positions?.hr1_job_positions)?.title ?? "Unknown position"}
                  </span>
                  {c.hr3_critical_positions && (
                    <Badge variant={riskVariant(c.hr3_critical_positions.risk_level)}>
                      {riskLabel(c.hr3_critical_positions.risk_level)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={readinessVariant(c.readiness_level)}>
                    {readinessLabel(c.readiness_level)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted">{c.potential_rating ?? "—"}/5</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">{c.performance_rating ?? "—"}/5</span>
                </TableCell>
                <TableCell className="text-right">
                  <TableActions
                    actions={[
                      {
                        label: "View",
                        icon: <Eye size={14} />,
                        onClick: () => setViewingCandidate(c),
                      },
                      {
                        label: "Edit",
                        icon: <Pencil size={14} />,
                        onClick: () => startEdit(c),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => setConfirmingCandidate(c),
                      },
                    ]}
                  />
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      {!loading && candidates.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="No candidates yet"
          description={
            isAdmin
              ? 'Click "Add Candidate" above to get started.'
              : "HR has not added succession candidates yet."
          }
        />
      )}

      {/* View candidate details */}
      <Modal
        open={!!viewingCandidate}
        onClose={() => setViewingCandidate(null)}
        title="Candidate Details"
        size="lg"
      >
        {viewingCandidate && (
          <div>
            <dl>
              <DetailRow
                label="Employee"
                value={getDirectoryUser(viewingCandidate.employee_id)?.name ?? "Unknown"}
              />
              {getDirectoryUser(viewingCandidate.employee_id)?.jobTitle && (
                <DetailRow
                  label="Title"
                  value={getDirectoryUser(viewingCandidate.employee_id)!.jobTitle}
                />
              )}
              <DetailRow
                label="Position"
                value={
                  pickJobPosition(viewingCandidate.hr3_critical_positions?.hr1_job_positions)?.title ?? "Unknown position"
                }
              />
              {viewingCandidate.hr3_critical_positions && (
                <DetailRow
                  label="Risk Level"
                  value={
                    <Badge variant={riskVariant(viewingCandidate.hr3_critical_positions.risk_level)}>
                      {riskLabel(viewingCandidate.hr3_critical_positions.risk_level)}
                    </Badge>
                  }
                />
              )}
              <DetailRow
                label="Readiness"
                value={
                  <Badge variant={readinessVariant(viewingCandidate.readiness_level)}>
                    {readinessLabel(viewingCandidate.readiness_level)}
                  </Badge>
                }
              />
              <DetailRow
                label="Potential"
                value={`${viewingCandidate.potential_rating ?? "—"}/5`}
              />
              <DetailRow
                label="Performance"
                value={`${viewingCandidate.performance_rating ?? "—"}/5`}
              />
              {viewingCandidate.development_notes && (
                <DetailRow
                  label="Development Notes"
                  value={viewingCandidate.development_notes}
                />
              )}
            </dl>
            <CandidateEvidence
              employeeId={viewingCandidate.employee_id}
              evidence={candidateEvidence}
            />
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingCandidate(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit candidate */}
      <Modal
        open={!!editingCandidate}
        onClose={() => { setEditingCandidate(null); setEditDraft(null); }}
        title="Edit Candidate"
        size="md"
      >
        {editingCandidate && editDraft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
            className="flex flex-col gap-3"
          >
            <select
              value={editDraft.readiness_level}
              onChange={(e) =>
                setEditDraft((prev) =>
                  prev ? { ...prev, readiness_level: e.target.value } : prev
                )
              }
              aria-label="Readiness level"
              className={selectClass}
            >
              <option value="ready_now">Ready Now</option>
              <option value="1-2_years">Ready in 1-2 Years</option>
              <option value="3+_years">Ready in 3+ Years</option>
            </select>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                max="5"
                placeholder="Potential (1-5)"
                aria-label="Potential rating"
                value={editDraft.potential_rating}
                onChange={(e) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, potential_rating: e.target.value } : prev
                  )
                }
                className={`${inputClass} min-w-0 flex-1`}
              />
              <input
                type="number"
                min="1"
                max="5"
                placeholder="Performance (1-5)"
                aria-label="Performance rating"
                value={editDraft.performance_rating}
                onChange={(e) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, performance_rating: e.target.value } : prev
                  )
                }
                className={`${inputClass} min-w-0 flex-1`}
              />
            </div>
            <textarea
              placeholder="Development notes (optional)"
              aria-label="Development notes"
              value={editDraft.development_notes}
              onChange={(e) =>
                setEditDraft((prev) =>
                  prev ? { ...prev, development_notes: e.target.value } : prev
                )
              }
              className={textareaClass}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setEditingCandidate(null); setEditDraft(null); }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updateCandidateMutation.submitting}>
                {updateCandidateMutation.submitting ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete candidate */}
      <Modal
        open={!!confirmingCandidate}
        onClose={() => setConfirmingCandidate(null)}
        title="Delete Candidate"
        size="sm"
      >
        <p className="text-sm text-muted">
          {confirmingCandidate &&
            (getDirectoryUser(confirmingCandidate.employee_id)?.name
              ? `Remove ${getDirectoryUser(confirmingCandidate.employee_id)?.name} as a succession candidate? This cannot be undone.`
              : "Remove this succession candidate? This cannot be undone.")}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => confirmingCandidate && removeCandidate(confirmingCandidate)}
            loading={removeCandidateMutation.submitting}
          >
            {removeCandidateMutation.submitting ? "Removing…" : "Confirm Remove"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingCandidate(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <h2 className={`mb-3 ${sectionTitleClass}`}>Critical Positions</h2>
      <Modal
        open={isFlagPositionModalOpen}
        onClose={() => setIsFlagPositionModalOpen(false)}
        title="Flag Position"
        titleId={FLAG_POSITION_TITLE_ID}
      >
          <form onSubmit={addPosition} className="flex flex-col gap-3">
            <select
                value={newPositionId}
                onChange={(e) => setNewPositionId(e.target.value)}
                required
                aria-label="Select job position"
                disabled={jobPositionsLoading}
                className={selectClass}
              >
                <option value="" disabled>
                  {jobPositionsLoading
                    ? "Loading positions…"
                    : jobPositionsError
                      ? "Could not load positions"
                      : "Select job position"}
                </option>
                {!jobPositionsLoading && !jobPositionsError && jobPositions.length === 0 && (
                  <option value="" disabled>
                    No active job positions available
                  </option>
                )}
                {jobPositions.map((jp) => (
                  <option key={jp.id} value={jp.id}>
                    {jp.title}
                    {jp.department ? ` — ${jp.department}` : ""}
                  </option>
                ))}
              </select>
              {jobPositionsError && (
                <p className={`${errorTextClass} text-xs`} role="alert">
                  {jobPositionsError}
                </p>
              )}
              <div className="flex gap-3">
                <select
                  value={newRiskLevel}
                  onChange={(e) => setNewRiskLevel(e.target.value)}
                  aria-label="Risk level"
                  className={selectClass}
                >
                  <option value="low">Low risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="high">High risk</option>
                </select>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  aria-label="Reason"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsFlagPositionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={addPositionMutation.submitting}>
                  {addPositionMutation.submitting
                    ? "Saving…"
                    : "Flag Position"}
                </Button>
              </div>
            </form>
        </Modal>
      {!loading && positions.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="No critical positions"
          description="No critical positions flagged."
        />
      )}
      {!loading && positions.length > 0 && (
        <DataTable columns={["Position", "Successors", "Coverage", "Risk", ""]}>
          {positions.map((p) => {
            const successors = candidatesByPosition.get(p.id) ?? [];
            const best = bestReadiness(successors);
            return (
              <DataTableRow key={p.id}>
                <TableCell>
                  <div>
                    <span className="font-medium text-ink dark:text-paper">
                      {pickJobPosition(p.hr1_job_positions)?.title ?? "Unknown position"}
                    </span>
                    {p.reason && (
                      <p className="text-xs text-muted">{p.reason}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted">
                    {successors.length > 0 && best
                      ? `${successors.length} successor${successors.length > 1 ? "s" : ""} · Best: ${readinessLabel(best.readiness_level)}`
                      : "No successor flagged"}
                  </span>
                </TableCell>
                <TableCell>
                  {successors.length > 0 && best ? (
                    <Badge variant={coverageVariant(best.readiness_level)}>
                      Covered
                    </Badge>
                  ) : (
                    <Badge variant="danger">No Successor</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={riskVariant(p.risk_level)}>
                    {riskLabel(p.risk_level)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <TableActions
                    actions={[
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => setConfirmingPosition(p),
                      },
                    ]}
                  />
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      {/* Delete position */}
      <Modal
        open={!!confirmingPosition}
        onClose={() => setConfirmingPosition(null)}
        title="Delete Position"
        size="sm"
      >
        <p className="text-sm text-muted">
          Remove this critical position? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => confirmingPosition && removePosition(confirmingPosition)}
            loading={removePositionMutation.submitting}
          >
            {removePositionMutation.submitting ? "Removing…" : "Confirm Remove"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingPosition(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
