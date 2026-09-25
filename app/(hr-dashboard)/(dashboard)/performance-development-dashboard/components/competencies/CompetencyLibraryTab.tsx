"use client";

import { useMemo, useState } from "react";
import { Award, Plus, Search } from "lucide-react";
import type {
  Competency,
  CompetencyCategory,
  CompetencyInput,
  PositionCompetencyRequirement,
  PositionOption,
} from "@/performance-development-dashboard/types";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformanceSelect,
} from "@/performance-development-dashboard/components/ui/performance";
import { CompetencyCard } from "@/performance-development-dashboard/components/competencies/CompetencyCard";
import { CompetencyDetailDialog } from "@/performance-development-dashboard/components/competencies/CompetencyDetailDialog";
import { CreateEditCompetencyModal } from "@/performance-development-dashboard/components/competencies/CreateEditCompetencyModal";

type Props = {
  competencies: Competency[];
  requirements: PositionCompetencyRequirement[];
  positions: PositionOption[];
  isHrAdmin: boolean;
  submitting?: boolean;
  onCreate: (input: CompetencyInput) => Promise<void>;
  onUpdate: (id: string, input: CompetencyInput) => Promise<void>;
};

export function CompetencyLibraryTab({
  competencies,
  requirements,
  positions,
  isHrAdmin,
  submitting,
  onCreate,
  onUpdate,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    CompetencyCategory | "all"
  >("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [viewing, setViewing] = useState<Competency | null>(null);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return competencies.filter((competency) => {
      if (categoryFilter !== "all" && competency.category !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        competency.name.toLowerCase().includes(query) ||
        (competency.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [competencies, search, categoryFilter]);

  const filtering = search.trim() !== "" || categoryFilter !== "all";

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(competency: Competency) {
    setViewing(null);
    setEditing(competency);
    setModalOpen(true);
  }

  async function handleSubmit(input: CompetencyInput) {
    if (editing) {
      await onUpdate(editing.id, input);
    } else {
      await onCreate(input);
    }
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search competencies</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search competencies..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <PerformanceSelect
            id="competency-category-filter"
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as CompetencyCategory | "all")
            }
            className="sm:w-auto sm:min-w-[170px]"
          >
            <option value="all">All categories</option>
            <option value="technical">Technical</option>
            <option value="behavioral">Behavioral</option>
          </PerformanceSelect>

          {filtering && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {isHrAdmin && (
          <PerformanceButton onClick={openCreate} disabled={submitting}>
            <Plus size={15} strokeWidth={2} />
            Add competency
          </PerformanceButton>
        )}
      </FilterBar>

      {displayed.length === 0 ? (
        <PerformanceEmptyState
          icon={<Award size={22} strokeWidth={1.5} className="text-muted" />}
          title={filtering ? "No matching competencies" : "No competencies yet"}
          message={
            filtering
              ? "Try a different search term or category."
              : isHrAdmin
                ? "Define the competency library to start mapping position requirements and employee profiles."
                : "The performance team has not published any competencies yet."
          }
          action={
            isHrAdmin && !filtering ? (
              <PerformanceButton onClick={openCreate} className="mt-1">
                <Plus size={15} strokeWidth={2} />
                Add your first competency
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((competency) => (
            <CompetencyCard
              key={competency.id}
              competency={competency}
              requirements={requirements}
              positions={positions}
              isHrAdmin={isHrAdmin}
              onView={() => setViewing(competency)}
              onEdit={isHrAdmin ? () => openEdit(competency) : undefined}
            />
          ))}
        </div>
      )}

      {viewing && (
        <CompetencyDetailDialog
          competency={viewing}
          requirements={requirements}
          positions={positions}
          isHrAdmin={isHrAdmin}
          onEdit={isHrAdmin ? () => openEdit(viewing) : undefined}
          onClose={() => setViewing(null)}
        />
      )}

      {modalOpen && (
        <CreateEditCompetencyModal
          competency={editing}
          submitting={submitting ?? false}
          onSubmit={handleSubmit}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
