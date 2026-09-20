"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import type {
  CriticalPositionListItem,
  SuccessionCandidateListItem,
} from "@/performance-development-dashboard/types";
import { CandidateCard } from "@/performance-development-dashboard/components/succession/CandidateCard";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";

type Props = {
  candidates: SuccessionCandidateListItem[];
  positions: CriticalPositionListItem[];
  submitting: boolean;
  onEditCandidate: (candidate: SuccessionCandidateListItem) => void;
  onRemoveCandidate: (candidate: SuccessionCandidateListItem) => void;
};

export function CandidatesPanel({
  candidates,
  positions,
  submitting,
  onEditCandidate,
  onRemoveCandidate,
}: Props) {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (positionFilter && candidate.position_id !== positionFilter) {
        return false;
      }
      if (!query) return true;
      return (
        candidate.employeeName.toLowerCase().includes(query) ||
        candidate.employeeNumber.toLowerCase().includes(query) ||
        candidate.positionTitle.toLowerCase().includes(query) ||
        candidate.readiness_level.toLowerCase().includes(query) ||
        (candidate.employeeJobPosition ?? "").toLowerCase().includes(query) ||
        (candidate.development_notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [candidates, search, positionFilter]);

  return (
    <div className="space-y-4">
      <FilterBar className="sm:justify-between">
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search candidates</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent sm:w-auto dark:border-paper/15"
          aria-label="Filter by position"
        >
          <option value="">All positions</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.positionTitle}
            </option>
          ))}
        </select>
      </FilterBar>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Users size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {candidates.length === 0
              ? "No succession candidates yet"
              : "No matching candidates"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {candidates.length === 0
              ? "Open a critical position and add its successor candidates there."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((candidate) => (
            <div
              key={candidate.id}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 dark:border-paper/10"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Successor to · {candidate.positionTitle}
                {candidate.positionDepartment
                  ? ` · ${candidate.positionDepartment}`
                  : ""}
              </p>
              <CandidateCard
                candidate={candidate}
                submitting={submitting}
                onEdit={onEditCandidate}
                onRemove={onRemoveCandidate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}