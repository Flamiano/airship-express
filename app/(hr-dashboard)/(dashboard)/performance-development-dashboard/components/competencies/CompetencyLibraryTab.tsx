"use client";

import { useMemo, useState } from "react";
import { Award, Pencil, Plus, Search } from "lucide-react";
import type { Competency, CompetencyCategory, CompetencyInput } from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { CreateEditCompetencyModal } from "@/performance-development-dashboard/components/competencies/CreateEditCompetencyModal";

type Props = {
  competencies: Competency[];
  isHrAdmin: boolean;
  submitting?: boolean;
  onCreate: (input: CompetencyInput) => Promise<void>;
  onUpdate: (id: string, input: CompetencyInput) => Promise<void>;
};

const CATEGORY_TONES: Record<CompetencyCategory, string> = {
  technical: "bg-accent/10 text-accent",
  behavioral: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function CompetencyLibraryTab({
  competencies,
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

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(competency: Competency) {
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
      <FilterBar className="sm:justify-between">
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

          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-line bg-paper p-1 dark:border-paper/15">
              {(["all", "technical", "behavioral"] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                    categoryFilter === category
                      ? "bg-accent text-paper"
                      : "text-muted hover:text-ink"
                  )}
                >
                  {category === "all" ? "All" : category}
                </button>
              ))}
            </div>

            {isHrAdmin && (
              <button
                type="button"
                onClick={openCreate}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} strokeWidth={2} />
                Add competency
              </button>
            )}
          </div>
      </FilterBar>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Award size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search || categoryFilter !== "all"
              ? "No matching competencies"
              : "No competencies yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search || categoryFilter !== "all"
              ? "Try a different search term."
              : isHrAdmin
                ? "Define the competency library to start mapping position requirements and employee profiles."
                : "The performance team has not published any competencies yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((competency) => (
            <div
              key={competency.id}
              className="group flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 dark:border-paper/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bricolage text-[16px] font-medium tracking-tight text-ink">
                    {competency.name}
                  </h3>
                  <span
                    className={cn(
                      "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                      CATEGORY_TONES[competency.category]
                    )}
                  >
                    {competency.category}
                  </span>
                </div>
                {isHrAdmin && (
                  <Tooltip label="Edit competency">
                    <button
                      type="button"
                      onClick={() => openEdit(competency)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-accent"
                      aria-label={`Edit ${competency.name}`}
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                  </Tooltip>
                )}
              </div>

              {competency.description ? (
                <p className="text-[13px] leading-relaxed text-muted">
                  {competency.description}
                </p>
              ) : (
                <p className="text-[13px] italic text-muted/60">
                  No description.
                </p>
              )}
            </div>
          ))}
        </div>
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