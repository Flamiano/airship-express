"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  CriticalPositionListItem,
  SuccessionCandidateListItem,
} from "@/performance-development-dashboard/types";
import { successionRiskTone } from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { CandidateCard } from "@/performance-development-dashboard/components/succession/CandidateCard";

type Props = {
  positions: CriticalPositionListItem[];
  selectedPositionId: string | null;
  candidatesForSelected: SuccessionCandidateListItem[];
  submitting: boolean;
  onSelectPosition: (id: string | null) => void;
  onOpenCreate: () => void;
  onOpenEdit: (position: CriticalPositionListItem) => void;
  onDelete: (position: CriticalPositionListItem) => void;
  onAddCandidate: (position: CriticalPositionListItem) => void;
  onEditCandidate: (candidate: SuccessionCandidateListItem) => void;
  onRemoveCandidate: (candidate: SuccessionCandidateListItem) => void;
};

export function CriticalPositionsPanel({
  positions,
  selectedPositionId,
  candidatesForSelected,
  submitting,
  onSelectPosition,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onAddCandidate,
  onEditCandidate,
  onRemoveCandidate,
}: Props) {
  const [search, setSearch] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return positions;
    return positions.filter(
      (position) =>
        position.positionTitle.toLowerCase().includes(query) ||
        position.positionDepartment.toLowerCase().includes(query) ||
        position.risk_level.toLowerCase().includes(query) ||
        (position.reason ?? "").toLowerCase().includes(query)
    );
  }, [positions, search]);

  return (
    <div className="space-y-4">
      <FilterBar className="sm:justify-between">
          <label className="relative block w-full sm:max-w-[320px]">
            <span className="sr-only">Search critical positions</span>
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search positions..."
              className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setConfirmingDeleteId(null);
              onOpenCreate();
            }}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2} />
            Add critical position
          </button>
      </FilterBar>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <ShieldAlert size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search ? "No matching positions" : "No critical positions yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : "Mark job positions as critical, then record which employees are considered successors for each one."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((position) => {
            const selected = position.id === selectedPositionId;
            return (
              <div
                key={position.id}
                className="overflow-hidden rounded-2xl border border-line bg-paper dark:border-paper/10"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bricolage text-[15.5px] font-medium tracking-tight text-ink">
                        {position.positionTitle}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${successionRiskTone(
                          position.risk_level
                        )}`}
                      >
                        {position.risk_level || "Not set"}
                      </span>
                      {!position.positionActive && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                          Position inactive
                        </span>
                      )}
                    </div>
                    {position.positionDepartment && (
                      <p className="mt-1 text-[11.5px] text-muted">
                        {position.positionDepartment}
                      </p>
                    )}
                    {position.reason && (
                      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                        {position.reason}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11.5px] text-muted">
                      {position.candidateCount} candidate
                      {position.candidateCount === 1 ? "" : "s"} · added{" "}
                      {new Date(position.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectPosition(selected ? null : position.id)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink dark:border-paper/15"
                    >
                      {selected ? (
                        <ChevronUp size={14} strokeWidth={1.75} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={1.75} />
                      )}
                      {selected ? "Hide candidates" : "Candidates"}
                    </button>
                    <Tooltip label="Edit position">
                      <button
                        type="button"
                        onClick={() => onOpenEdit(position)}
                        disabled={submitting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-accent disabled:opacity-40 dark:border-paper/15"
                        aria-label={`Edit ${position.positionTitle}`}
                      >
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Delete position (blocked if it has candidates)">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmingDeleteId === position.id) {
                            setConfirmingDeleteId(null);
                            onDelete(position);
                          } else {
                            setConfirmingDeleteId(position.id);
                          }
                        }}
                        disabled={submitting}
                        className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-line px-2 text-[12px] font-medium transition-colors disabled:opacity-40 ${
                          confirmingDeleteId === position.id
                            ? "border-red-500/40 bg-red-500/10 text-red-600"
                            : "text-muted hover:text-red-600 dark:border-paper/15"
                        }`}
                        aria-label={`Delete ${position.positionTitle}`}
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                        {confirmingDeleteId === position.id ? "Confirm" : ""}
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {selected && (
                  <div className="border-t border-line px-4 py-4 dark:border-paper/10">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users size={14} strokeWidth={1.75} className="text-muted" />
                        <p className="text-[13px] font-medium text-ink">
                          Succession candidates for {position.positionTitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddCandidate(position)}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-accent dark:border-paper/15"
                      >
                        <UserPlus size={13} strokeWidth={1.75} />
                        Add candidate
                      </button>
                    </div>

                    {candidatesForSelected.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-6 text-[13px] text-muted dark:border-paper/10">
                        <Users size={15} strokeWidth={1.5} />
                        No successors recorded for this position yet. Adding a
                        candidate records who may step up — it does not change
                        anyone&apos;s role.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {candidatesForSelected.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            submitting={submitting}
                            onEdit={onEditCandidate}
                            onRemove={onRemoveCandidate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}