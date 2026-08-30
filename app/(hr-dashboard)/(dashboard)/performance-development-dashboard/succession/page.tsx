"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/EmptyState";
import StatCard from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/StatCard";
import {
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/Skeleton";
import {
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/motion";
import {
  inputClass,
  listRowClass,
  quietDangerClass,
  selectClass,
  textareaClass,
  errorTextClass,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/hr-auth";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
import { readApiError } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/api-error";
import { Lock, UserCog } from "lucide-react";
import { toast } from "sonner";

type CriticalPosition = {
  id: string;
  position_id: string;
  risk_level: string;
  reason: string | null;
};

type Candidate = {
  id: string;
  employee_id: string | null;
  readiness_level: string;
  potential_rating: number | null;
  performance_rating: number | null;
  development_notes: string | null;
  hr3_critical_positions: CriticalPosition | null;
};

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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<CriticalPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [candidateEmployeeId, setCandidateEmployeeId] = useState("");
  const [candidatePositionId, setCandidatePositionId] = useState("");
  const [readiness, setReadiness] = useState("ready_now");
  const [potentialRating, setPotentialRating] = useState("");
  const [performanceRating, setPerformanceRating] = useState("");
  const [developmentNotes, setDevelopmentNotes] = useState("");
  const [submittingCandidate, setSubmittingCandidate] = useState(false);

  const [newPositionId, setNewPositionId] = useState("");
  const [newRiskLevel, setNewRiskLevel] = useState("medium");
  const [newReason, setNewReason] = useState("");
  const [submittingPosition, setSubmittingPosition] = useState(false);

  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(
    null
  );
  const [editDrafts, setEditDrafts] = useState<
    Record<
      string,
      {
        readiness_level: string;
        potential_rating: string;
        performance_rating: string;
        development_notes: string;
      }
    >
  >({});

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function load() {
      try {
        const [candRes, posRes] = await Promise.all([
          fetch("/performance-development-dashboard/api/succession-candidates"),
          fetch("/performance-development-dashboard/api/critical-positions"),
        ]);
        if (!candRes.ok || !posRes.ok) {
          throw new Error("Failed to load succession data");
        }
        const candJson = await candRes.json();
        const posJson = await posRes.json();
        if (cancelled) return;
        setCandidates(candJson.candidates || []);
        setPositions(posJson.positions || []);
      } catch {
        if (!cancelled) setError("Could not load succession data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  async function addCandidate(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingCandidate(true);
    setError(null);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/succession-candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position_id: candidatePositionId,
            employee_id: candidateEmployeeId,
            readiness_level: readiness,
            potential_rating: potentialRating
              ? parseInt(potentialRating)
              : null,
            performance_rating: performanceRating
              ? parseInt(performanceRating)
              : null,
            development_notes: developmentNotes,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to add candidate");
      }
      setCandidateEmployeeId("");
      setCandidatePositionId("");
      setReadiness("ready_now");
      setPotentialRating("");
      setPerformanceRating("");
      setDevelopmentNotes("");
      refetch();
      toast.success("Candidate added successfully.");
    } catch {
      toast.error("Failed to add candidate. Please try again.");
    } finally {
      setSubmittingCandidate(false);
    }
  }

  async function addPosition(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingPosition(true);
    setError(null);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/critical-positions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position_id: newPositionId,
            risk_level: newRiskLevel,
            reason: newReason,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to flag position");
      }
      setNewPositionId("");
      setNewRiskLevel("medium");
      setNewReason("");
      refetch();
      toast.success("Position flagged successfully.");
    } catch {
      toast.error("Failed to flag position. Please try again.");
    } finally {
      setSubmittingPosition(false);
    }
  }

  function startEdit(candidate: Candidate) {
    setEditingCandidateId(candidate.id);
    setEditDrafts((prev) => ({
      ...prev,
      [candidate.id]: {
        readiness_level: candidate.readiness_level,
        potential_rating: candidate.potential_rating?.toString() ?? "",
        performance_rating: candidate.performance_rating?.toString() ?? "",
        development_notes: candidate.development_notes ?? "",
      },
    }));
  }

  async function saveEdit(candidate: Candidate) {
    const draft = editDrafts[candidate.id];
    if (!draft) return;
    setError(null);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/succession-candidates",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: candidate.id,
            readiness_level: draft.readiness_level,
            potential_rating: draft.potential_rating
              ? parseInt(draft.potential_rating)
              : null,
            performance_rating: draft.performance_rating
              ? parseInt(draft.performance_rating)
              : null,
            development_notes: draft.development_notes,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to update candidate");
      }
      setEditingCandidateId(null);
      refetch();
      toast.success("Candidate updated successfully.");
    } catch {
      toast.error("Failed to update candidate. Please try again.");
    }
  }

  async function removeCandidate(candidate: Candidate) {
    const name = getDirectoryUser(candidate.employee_id)?.name;
    if (
      !window.confirm(
        `Remove ${name ?? "this employee"} as a succession candidate?`
      )
    )
      return;
    setError(null);
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/succession-candidates?id=${candidate.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to remove candidate");
      }
      refetch();
      toast.success("Candidate removed successfully.");
    } catch {
      toast.error("Failed to remove candidate. Please try again.");
    }
  }

  async function removePosition(position: CriticalPosition) {
    if (
      !window.confirm(
        `Remove "${position.position_id}" from critical positions?`
      )
    )
      return;
    setError(null);
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/critical-positions?id=${position.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to remove position");
      }
      refetch();
      toast.success("Position removed successfully.");
    } catch {
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

      {isAdmin && (
        <form
          onSubmit={addCandidate}
          className="mb-8 flex max-w-md flex-col gap-3"
        >
          <h2 className="text-lg font-semibold font-bricolage">
            Add Succession Candidate
          </h2>
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
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.position_id}
              </option>
            ))}
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
          <Button type="submit" loading={submittingCandidate}>
            {submittingCandidate ? "Saving…" : "Add Candidate"}
          </Button>
        </form>
      )}

      {isAdmin && positions.length === 0 && (
        <p className="mb-6 text-xs text-muted">
          Add a critical position below first — candidates are linked to
          positions.
        </p>
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Candidates
      </h2>

      {!loading && candidates.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="mb-8 flex max-w-md flex-col gap-4"
        >
          {candidates.map((c) => {
            const employee = getDirectoryUser(c.employee_id);
            const draft = editDrafts[c.id];
            return (
              <motion.div key={c.id} variants={staggerItem}>
                <Card>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="font-semibold font-bricolage">
                      {employee?.name ?? "Unknown employee"}
                      {employee?.jobTitle && (
                        <span className="block text-xs font-normal text-muted">
                          {employee.jobTitle}
                        </span>
                      )}
                    </h3>
                    <Badge variant={readinessVariant(c.readiness_level)}>
                      {readinessLabel(c.readiness_level)}
                    </Badge>
                  </div>
                  {editingCandidateId === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEdit(c);
                      }}
                      className="mt-4 flex flex-col gap-3 border-t border-line pt-4"
                    >
                      <select
                        value={draft?.readiness_level ?? c.readiness_level}
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...prev[c.id],
                              readiness_level: e.target.value,
                            },
                          }))
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
                          value={draft?.potential_rating ?? ""}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...prev[c.id],
                                potential_rating: e.target.value,
                              },
                            }))
                          }
                          className={`${inputClass} min-w-0 flex-1`}
                        />
                        <input
                          type="number"
                          min="1"
                          max="5"
                          placeholder="Performance (1-5)"
                          aria-label="Performance rating"
                          value={draft?.performance_rating ?? ""}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...prev[c.id],
                                performance_rating: e.target.value,
                              },
                            }))
                          }
                          className={`${inputClass} min-w-0 flex-1`}
                        />
                      </div>
                      <textarea
                        placeholder="Development notes (optional)"
                        aria-label="Development notes"
                        value={draft?.development_notes ?? ""}
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...prev[c.id],
                              development_notes: e.target.value,
                            },
                          }))
                        }
                        className={textareaClass}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" loading={false}>
                          Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingCandidateId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="mb-2 text-sm text-muted">
                        <span className="font-medium">Position:</span>{" "}
                        {c.hr3_critical_positions?.position_id ?? "—"}
                        {c.hr3_critical_positions && (
                          <Badge
                            variant={riskVariant(
                              c.hr3_critical_positions.risk_level
                            )}
                          >
                            {riskLabel(c.hr3_critical_positions.risk_level)}
                          </Badge>
                        )}
                      </p>
                      <p className="mb-1 text-sm text-muted">
                        Potential: {c.potential_rating ?? "—"}/5 · Performance:{" "}
                        {c.performance_rating ?? "—"}/5
                      </p>
                      {c.development_notes && (
                        <p className="mt-2 text-sm">{c.development_notes}</p>
                      )}
                      {isAdmin && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => startEdit(c)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => removeCandidate(c)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!loading && candidates.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="No candidates yet"
          description={
            isAdmin
              ? "Add a candidate above to get started."
              : "HR has not added succession candidates yet."
          }
        />
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Critical Positions
      </h2>
      {isAdmin && (
        <form
          onSubmit={addPosition}
          className="mb-6 flex max-w-md flex-col gap-3"
        >
          <h3 className="text-sm font-medium">Flag a Critical Position</h3>
          <input
            type="text"
            placeholder="Position (e.g. Dispatcher)"
            aria-label="Position name"
            value={newPositionId}
            onChange={(e) => setNewPositionId(e.target.value)}
            required
            className={inputClass}
          />
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
          <Button type="submit" loading={submittingPosition}>
            {submittingPosition ? "Saving…" : "Add Position"}
          </Button>
        </form>
      )}
      {!loading && positions.length === 0 && (
        <p className="text-sm text-muted">
          No critical positions flagged.
        </p>
      )}
      {!loading && positions.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-2"
        >
          {positions.map((p) => {
            const successors = candidatesByPosition.get(p.id) ?? [];
            const best = bestReadiness(successors);
            return (
              <motion.div
                key={p.id}
                variants={staggerItem}
                className={`flex items-center justify-between gap-3 px-4 py-2 ${listRowClass}`}
              >
                <div>
                  <span className="text-sm font-medium">{p.position_id}</span>
                  {p.reason && (
                    <p className="text-xs text-muted">{p.reason}</p>
                  )}
                  <p className="text-xs text-muted">
                    {successors.length > 0 && best
                      ? `${successors.length} successor${successors.length > 1 ? "s" : ""} · Best: ${readinessLabel(best.readiness_level)}`
                      : "No successor flagged"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {successors.length > 0 && best ? (
                    <Badge variant={coverageVariant(best.readiness_level)}>
                      Covered
                    </Badge>
                  ) : (
                    <Badge variant="danger">No Successor</Badge>
                  )}
                  <Badge variant={riskVariant(p.risk_level)}>
                    {riskLabel(p.risk_level)}
                  </Badge>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removePosition(p)}
                      className={quietDangerClass}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
