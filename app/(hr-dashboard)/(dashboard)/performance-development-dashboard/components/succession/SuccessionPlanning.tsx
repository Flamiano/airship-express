"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, Target, Users } from "lucide-react";
import { SkeletonPanel } from "@/performance-development-dashboard/components/ui/Skeleton";
import type {
  CriticalPositionInput,
  CriticalPositionListItem,
  CurrentPerDevUser,
  EmployeeOption,
  JobPositionOption,
  SuccessionCandidateInput,
  SuccessionCandidateListItem,
  UpdateCriticalPositionInput,
  UpdateSuccessionCandidateInput,
} from "@/performance-development-dashboard/types";
import { useSuccessionApi } from "@/performance-development-dashboard/hooks/useSuccessionApi";
import { CriticalPositionsPanel } from "@/performance-development-dashboard/components/succession/CriticalPositionsPanel";
import { CandidatesPanel } from "@/performance-development-dashboard/components/succession/CandidatesPanel";
import { CriticalPositionModal } from "@/performance-development-dashboard/components/succession/CriticalPositionModal";
import { CandidateModal } from "@/performance-development-dashboard/components/succession/CandidateModal";

type Props = {
  serverUser: CurrentPerDevUser;
  initialPositions: CriticalPositionListItem[];
  initialCandidates: SuccessionCandidateListItem[];
  initialError?: string;
  employees: EmployeeOption[];
  jobPositions: JobPositionOption[];
};

type TabKey = "positions" | "candidates";

const TABS: { key: TabKey; label: string; icon: typeof Target }[] = [
  { key: "positions", label: "Critical Positions", icon: ShieldAlert },
  { key: "candidates", label: "Succession Candidates", icon: Users },
];

type PositionModalState = {
  open: boolean;
  editing: CriticalPositionListItem | null;
};

type CandidateModalState = {
  open: boolean;
  editing: SuccessionCandidateListItem | null;
  positionId: string;
};

const EMPTY_CANDIDATE_MODAL: CandidateModalState = {
  open: false,
  editing: null,
  positionId: "",
};

export function SuccessionPlanning({
  serverUser,
  initialPositions,
  initialCandidates,
  initialError,
  employees,
  jobPositions,
}: Props) {
  const api = useSuccessionApi();

  const [positions, setPositions] = useState<CriticalPositionListItem[]>(
    initialPositions
  );
  const [candidates, setCandidates] = useState<SuccessionCandidateListItem[]>(
    initialCandidates
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("positions");
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    null
  );
  const [positionModal, setPositionModal] = useState<PositionModalState>({
    open: false,
    editing: null,
  });
  const [candidateModal, setCandidateModal] = useState<CandidateModalState>(
    EMPTY_CANDIDATE_MODAL
  );

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const candidatesForSelected = selectedPositionId
    ? candidates.filter(
        (candidate) => candidate.position_id === selectedPositionId
      )
    : [];

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [nextPositions, nextCandidates] = await Promise.all([
        api.listCriticalPositions(),
        api.listAllCandidates(),
      ]);
      setPositions(nextPositions);
      setCandidates(nextCandidates);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh succession data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreatePosition(input: CriticalPositionInput) {
    setRefreshing(true);
    try {
      await api.runCreateCriticalPosition(input);
      setPositionModal({ open: false, editing: null });
      await refreshAll();
      setActiveTab("positions");
      toast.success("Critical position added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add position.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUpdatePosition(
    id: string,
    input: UpdateCriticalPositionInput
  ) {
    setRefreshing(true);
    try {
      await api.runUpdateCriticalPosition(id, input);
      setPositionModal({ open: false, editing: null });
      await refreshAll();
      toast.success("Critical position updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update position."
      );
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeletePosition(position: CriticalPositionListItem) {
    setRefreshing(true);
    try {
      await api.runDeleteCriticalPosition(position.id);
      if (selectedPositionId === position.id) setSelectedPositionId(null);
      await refreshAll();
      toast.success("Critical position removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete position.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddCandidate(input: SuccessionCandidateInput) {
    setRefreshing(true);
    try {
      await api.runAddCandidate(candidateModal.positionId, input);
      setCandidateModal(EMPTY_CANDIDATE_MODAL);
      await refreshAll();
      toast.success("Candidate added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add candidate.");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUpdateCandidate(
    id: string,
    input: UpdateSuccessionCandidateInput
  ) {
    setRefreshing(true);
    try {
      await api.runUpdateCandidate(id, input);
      setCandidateModal(EMPTY_CANDIDATE_MODAL);
      await refreshAll();
      toast.success("Candidate updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update candidate."
      );
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRemoveCandidate(
    candidate: SuccessionCandidateListItem
  ) {
    setRefreshing(true);
    try {
      await api.runRemoveCandidate(candidate.id);
      await refreshAll();
      toast.success("Candidate removed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove candidate."
      );
      throw err;
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Succession Planning
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {`Hello ${firstName}. Record which positions are critical and who the
            recorded successors are. Adding a candidate only records who may
            step up — it never changes a role, promotion, manager, or score.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1 dark:border-paper/10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-accent text-paper shadow-sm shadow-accent/25"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
              }`}
            >
              <tab.icon size={14} strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <p className="text-[13px] font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={refreshAll}
              className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {refreshing &&
        activeTab === "positions" &&
        positions.length === 0 ? (
          <div aria-busy="true" role="status">
            <SkeletonPanel lines={6} />
          </div>
        ) : (
          <>
            {activeTab === "positions" && (
              <CriticalPositionsPanel
                positions={positions}
                selectedPositionId={selectedPositionId}
                candidatesForSelected={candidatesForSelected}
                submitting={api.busy}
                onSelectPosition={setSelectedPositionId}
                onOpenCreate={() =>
                  setPositionModal({ open: true, editing: null })
                }
                onOpenEdit={(position) =>
                  setPositionModal({ open: true, editing: position })
                }
                onDelete={handleDeletePosition}
                onAddCandidate={(position) => {
                  setSelectedPositionId(position.id);
                  setCandidateModal({
                    open: true,
                    editing: null,
                    positionId: position.id,
                  });
                }}
                onEditCandidate={(candidate) =>
                  setCandidateModal({
                    open: true,
                    editing: candidate,
                    positionId: candidate.position_id,
                  })
                }
                onRemoveCandidate={handleRemoveCandidate}
              />
            )}

            {activeTab === "candidates" && (
              <CandidatesPanel
                candidates={candidates}
                positions={positions}
                submitting={api.busy}
                onEditCandidate={(candidate) =>
                  setCandidateModal({
                    open: true,
                    editing: candidate,
                    positionId: candidate.position_id,
                  })
                }
                onRemoveCandidate={handleRemoveCandidate}
              />
            )}
          </>
        )}
      </div>

      {positionModal.open && (
        <CriticalPositionModal
          position={positionModal.editing}
          jobPositions={jobPositions}
          submitting={api.busy}
          onSubmit={(input) =>
            positionModal.editing
              ? handleUpdatePosition(positionModal.editing.id, input)
              : handleCreatePosition(input)
          }
          onClose={() => setPositionModal({ open: false, editing: null })}
        />
      )}

      {candidateModal.open && (
        <CandidateModal
          candidate={candidateModal.editing}
          employees={employees}
          submitting={api.busy}
          onSubmit={(input) =>
            candidateModal.editing
              ? handleUpdateCandidate(candidateModal.editing.id, input)
              : handleAddCandidate(input)
          }
          onClose={() => setCandidateModal(EMPTY_CANDIDATE_MODAL)}
        />
      )}
    </div>
  );
}