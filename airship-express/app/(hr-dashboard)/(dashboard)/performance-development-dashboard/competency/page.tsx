"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  DataTableRow,
  EmptyState,
  Modal,
  PageHeader,
  ProgressBar,
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
  tableClass,
  tableWrapClass,
  tdClass,
  textareaClass,
  thClass,
  trClass,
} from "../components/ui";
import { useHrAuth } from "../lib/hr-auth";
import { useDirectory } from "../lib/directory";
import type { DirectoryUser } from "../lib/types";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { formatDate } from "../lib/datetime";
import {
  Award,
  LayoutGrid,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Competency = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

type Score = {
  id: string;
  employee_id: string | null;
  competency_id: string | null;
  current_level: number;
  required_level: number | null;
  assessed_by: string | null;
  assessed_at: string | null;
  hr3_competencies: { name: string; category: string } | null;
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Competent",
  4: "Proficient",
  5: "Expert",
};

const LEVEL_SCALE_HINT =
  "Scale: 1 Beginner · 2 Basic · 3 Competent · 4 Proficient · 5 Expert";

function levelLabel(level: number | null) {
  if (level === null || level < 1 || level > 5) return null;
  return LEVEL_LABELS[level];
}

function gapStatus(current: number, required: number | null): "meets" | "close" | "gap" | null {
  if (required === null) return null;
  if (current >= required) return "meets";
  if (current >= required - 1) return "close";
  return "gap";
}

function gapVariant(current: number, required: number | null): "success" | "warning" | "danger" | "neutral" {
  if (required === null) return "neutral";
  if (current >= required) return "success";
  if (current >= required - 1) return "warning";
  return "danger";
}

function gapLabel(current: number, required: number | null): string | null {
  if (required === null) return null;
  if (current >= required) return "Meets";
  if (current >= required - 1) return "Close";
  return "Gap";
}

function gapRank(score: Score) {
  const status = gapStatus(score.current_level, score.required_level);
  if (status === "gap") return 0;
  if (status === "close") return 1;
  if (status === "meets") return 2;
  return 3;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type ScoreGroup = { employeeId: string; employee: DirectoryUser | undefined; scores: Score[] };

function groupScoresByEmployee(scores: Score[], getDirectoryUser: (id: string | null) => DirectoryUser | undefined): ScoreGroup[] {
  const groups = new Map<string, Score[]>();
  for (const score of scores) {
    const key = score.employee_id ?? "unknown";
    const list = groups.get(key) ?? [];
    list.push(score);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([employeeId, list]) => ({
      employeeId,
      employee: getDirectoryUser(employeeId),
      scores: list,
    }))
    .sort((a, b) => (a.employee?.name ?? "Unknown").localeCompare(b.employee?.name ?? "Unknown"));
}

async function confirmAndDelete(
  mutation: { submit: (body: null, params: { id: string }) => Promise<{ error: unknown }> },
  id: string,
  successMsg: string,
  errorMsg: string,
) {
  const { error } = await mutation.submit(null, { id });
  if (!error) {
    toast.success(successMsg);
  } else {
    toast.error(errorMsg);
  }
}

function LevelBar({ current, required }: { current: number; required: number | null }) {
  const width = required
    ? Math.min(100, Math.round((current / required) * 100))
    : Math.min(100, current * 20);
  const status = gapStatus(current, required);
  return (
    <ProgressBar
      value={width}
      tone={status === "meets" ? "success" : "accent"}
      label={`Level ${current} of ${required ?? 5}`}
      className="flex-1"
    />
  );
}

function ScoreForm({ competencies, onRecorded, onClose }: { competencies: Competency[]; onRecorded: () => void; onClose: () => void }) {
  const { directory } = useDirectory();
  const [employeeId, setEmployeeId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [requiredLevel, setRequiredLevel] = useState("");

  const recordScore = useApiMutation({
    path: "competency-scores",
    method: "POST",
    onSuccess: () => {
      setEmployeeId("");
      setCompetencyId("");
      setCurrentLevel("");
      setRequiredLevel("");
      onRecorded();
      toast.success("Score recorded successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !competencyId) {
      toast.error("Choose an employee and a competency.");
      return;
    }
    const { error: submitError } = await recordScore.submit({
      employee_id: employeeId,
      competency_id: competencyId,
      current_level: currentLevel ? parseInt(currentLevel) : 0,
      required_level: requiredLevel ? parseInt(requiredLevel) : null,
    });
    if (submitError) {
      toast.error("Failed to record score. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required aria-label="Select employee" className={selectClass}>
        <option value="" disabled>Select employee</option>
        {directory.map((u) => (
          <option key={u.id} value={u.id}>{u.name} — {u.jobTitle}</option>
        ))}
      </select>
      <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} required aria-label="Select competency" className={selectClass}>
        <option value="" disabled>Select competency</option>
        {competencies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex gap-3">
        <input type="number" min="1" max="5" placeholder="Current level (1-5)" aria-label="Current level" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} required className={`${inputClass} min-w-0 flex-1`} />
        <input type="number" min="1" max="5" placeholder="Required (optional)" aria-label="Required level" value={requiredLevel} onChange={(e) => setRequiredLevel(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
      </div>
      <p className="text-xs text-muted">{LEVEL_SCALE_HINT}</p>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={recordScore.submitting}>
          {recordScore.submitting ? "Saving…" : "Record Score"}
        </Button>
      </div>
    </form>
  );
}

function ScoreEditForm({ score, onUpdated }: { score: Score; onUpdated: () => void }) {
  const [currentLevel, setCurrentLevel] = useState(score.current_level.toString());
  const [requiredLevel, setRequiredLevel] = useState(score.required_level?.toString() ?? "");

  const updateScore = useApiMutation({
    path: "competency-scores",
    method: "PUT",
    onSuccess: () => {
      onUpdated();
      toast.success("Score updated successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await updateScore.submit({
      id: score.id,
      current_level: currentLevel ? parseInt(currentLevel) : 0,
      required_level: requiredLevel ? parseInt(requiredLevel) : null,
    });
    if (submitError) {
      toast.error("Failed to update score. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input type="number" min="1" max="5" placeholder="Current level (1-5)" aria-label="Current level" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} className={`${controlSmallClass} min-w-0 flex-1`} />
        <input type="number" min="1" max="5" placeholder="Required (optional)" aria-label="Required level" value={requiredLevel} onChange={(e) => setRequiredLevel(e.target.value)} className={`${controlSmallClass} min-w-0 flex-1`} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={updateScore.submitting}>Save</Button>
        <Button type="button" variant="secondary" onClick={onUpdated}>Cancel</Button>
      </div>
    </form>
  );
}

function CompetencyForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const createCompetency = useApiMutation({
    path: "competency",
    method: "POST",
    onSuccess: () => {
      setName("");
      setCategory("");
      setDescription("");
      onCreated();
      toast.success("Competency created successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await createCompetency.submit({ name, category, description });
    if (submitError) {
      toast.error("Failed to create competency. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="text" placeholder="Name (e.g. Parcel Handling)" aria-label="Competency name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      <input type="text" placeholder="Category (e.g. Operations)" aria-label="Competency category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
      <textarea placeholder="Description (optional)" aria-label="Competency description" value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={createCompetency.submitting}>
          {createCompetency.submitting ? "Saving…" : "Add Competency"}
        </Button>
      </div>
    </form>
  );
}

function CompetencyEdit({ competency, onUpdated, onCancel }: { competency: Competency; onUpdated: () => void; onCancel: () => void }) {
  const [name, setName] = useState(competency.name);
  const [category, setCategory] = useState(competency.category ?? "");
  const [description, setDescription] = useState(competency.description ?? "");

  const updateCompetency = useApiMutation({
    path: "competency",
    method: "PUT",
    onSuccess: () => {
      onUpdated();
      toast.success("Competency updated successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await updateCompetency.submit({ id: competency.id, name, category, description });
    if (submitError) {
      toast.error("Failed to update competency. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required aria-label="Competency name" className={inputClass} />
      <input type="text" placeholder="Category" aria-label="Competency category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
      <textarea placeholder="Description (optional)" aria-label="Competency description" value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={updateCompetency.submitting}>
          {updateCompetency.submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MatrixCell({ score }: { score: Score | undefined }) {
  if (!score) {
    return <td className={`${tdClass} text-center text-muted`} aria-label="Not assessed">—</td>;
  }
  const detail =
    levelLabel(score.current_level)
      ? `${score.current_level} ${levelLabel(score.current_level)}` + (score.required_level ? ` → ${score.required_level} ${levelLabel(score.required_level)}` : "")
      : `${score.current_level} of 5`;
  return (
    <td className={tdClass} title={detail}>
      <span className="flex justify-center">
        <Badge variant={gapVariant(score.current_level, score.required_level)}>
          <span aria-label={`Current level detail: ${detail}`}>
            {score.current_level}/{score.required_level ?? "—"}
          </span>
        </Badge>
      </span>
    </td>
  );
}

function SkillsMatrix({ rows, competencies }: { rows: { employeeId: string; employee: DirectoryUser | undefined; scores: Score[] }[]; competencies: Competency[] }) {
  if (rows.length === 0 || competencies.length === 0) {
    return <EmptyState icon={LayoutGrid} title="Nothing to show" description="Record scores to build the skills matrix." />;
  }
  return (
    <div className={`mb-8 ${tableWrapClass}`}>
      <table className={`${tableClass} min-w-max`}>
        <caption className="sr-only">Skills matrix showing current and required levels per employee</caption>
        <thead>
          <tr>
            <th scope="col" className={`${thClass} sticky left-0 bg-paper dark:bg-ink`}>Employee</th>
            {competencies.map((c) => (
              <th key={c.id} scope="col" title={c.description ?? undefined} className={`${thClass} text-center`}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId} className={trClass}>
              <td className={`${tdClass} sticky left-0 bg-paper dark:bg-ink`}>
                {row.employee?.name ?? "Unknown"}
                {row.employee?.jobTitle && <span className="block text-xs capitalize text-muted">{row.employee.jobTitle}</span>}
              </td>
              {competencies.map((c) => {
                const score = row.scores.find((s) => s.competency_id === c.id);
                return <MatrixCell key={c.id} score={score} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GAP_FILTERS = ["all", "gap", "close", "meets"] as const;

export default function CompetencyPage() {
  const { user, isAdmin } = useHrAuth();
  const { getDirectoryUser } = useDirectory();
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null);
  const [view, setView] = useState<"list" | "matrix">("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [gapFilter, setGapFilter] = useState<(typeof GAP_FILTERS)[number]>("all");
  const [sortBy, setSortBy] = useState<"employee" | "competency" | "level" | "gap">("employee");
  const [isRecordScoreModalOpen, setIsRecordScoreModalOpen] = useState(false);
  const [isAddCompetencyModalOpen, setIsAddCompetencyModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [confirmingScore, setConfirmingScore] = useState<Score | null>(null);
  const [confirmingCompetency, setConfirmingCompetency] = useState<
    Competency | null
  >(null);

  const RECORD_SCORE_TITLE_ID = "record-competency-score-title";
  const ADD_COMPETENCY_TITLE_ID = "add-competency-title";

  const {
    data: competencies,
    loading: competenciesLoading,
    error: competenciesError,
    refetch: refetchCompetencies,
  } = useApiResource<Competency>({ path: "competency", listKey: "competencies", errorMessage: "Could not load competency data. Please try again." });

  const {
    data: scores,
    loading: scoresLoading,
    error: scoresError,
    refetch: refetchScores,
  } = useApiResource<Score>({ path: "competency-scores", listKey: "scores", errorMessage: "Could not load competency data. Please try again." });

  const loading = competenciesLoading || scoresLoading;
  const error = competenciesError || scoresError;

  function refetch() {
    refetchCompetencies();
    refetchScores();
  }

  const deleteScoreMutation = useApiMutation({
    path: "competency-scores",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingScore(null);
      refetch();
    },
  });

  const deleteCompetencyMutation = useApiMutation({
    path: "competency",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingCompetency(null);
      refetch();
    },
  });

  async function deleteScore(id: string) {
    await confirmAndDelete(deleteScoreMutation, id, "Score deleted successfully.", "Failed to delete score. Please try again.");
    setConfirmingScore(null);
  }

  async function deleteCompetency(id: string) {
    await confirmAndDelete(deleteCompetencyMutation, id, "Competency deleted successfully.", "Failed to delete competency. Please try again.");
    setConfirmingCompetency(null);
  }

  const visibleScores = isAdmin ? scores : scores.filter((s) => s.employee_id === user?.employeeId);

  const categories = useMemo(
    () => Array.from(new Set(competencies.map((c) => c.category).filter((c): c is string => !!c))).sort(),
    [competencies]
  );

  const q = search.trim().toLowerCase();

  const filteredScores = useMemo(() => {
    return visibleScores.filter((score) => {
      if (category !== "all" && (score.hr3_competencies?.category ?? null) !== category) return false;
      if (gapFilter !== "all" && gapStatus(score.current_level, score.required_level) !== gapFilter) return false;
      if (q) {
        const empName = getDirectoryUser(score.employee_id)?.name.toLowerCase() ?? "";
        const compName = (score.hr3_competencies?.name ?? "").toLowerCase();
        if (!empName.includes(q) && !compName.includes(q)) return false;
      }
      return true;
    });
  }, [visibleScores, category, gapFilter, q, getDirectoryUser]);

  const groupedScores = useMemo(() => {
    return groupScoresByEmployee(filteredScores, getDirectoryUser).map((group) => ({
      ...group,
      scores: [...group.scores].sort((a, b) => {
        if (sortBy === "competency") return (a.hr3_competencies?.name ?? "").localeCompare(b.hr3_competencies?.name ?? "");
        if (sortBy === "level") return b.current_level - a.current_level;
        if (sortBy === "gap") return gapRank(a) - gapRank(b);
        return 0;
      }),
    }));
  }, [filteredScores, sortBy, getDirectoryUser]);

  const categoryAppliedScores = useMemo(
    () => visibleScores.filter((score) => category === "all" || (score.hr3_competencies?.category ?? null) === category),
    [visibleScores, category]
  );

  const matrixRows = useMemo(() => {
    return groupScoresByEmployee(categoryAppliedScores, getDirectoryUser).filter((row) => {
      if (!q) return true;
      if (row.employee?.name.toLowerCase().includes(q)) return true;
      return row.scores.some((s) => (s.hr3_competencies?.name ?? "").toLowerCase().includes(q));
    });
  }, [categoryAppliedScores, q, getDirectoryUser]);

  const matrixCompetencies = useMemo(
    () =>
      competencies
        .filter((c) => {
          if (category !== "all" && (c.category ?? null) !== category) return false;
          if (q && !c.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name)),
    [competencies, category, q]
  );

  const gapCount = scores.filter((s) => s.required_level !== null && s.current_level < s.required_level).length;
  const assessedEmployees = new Set(scores.map((s) => s.employee_id)).size;

  const stats = [
    { label: "Scores Recorded", value: scores.length },
    { label: "Employees Assessed", value: assessedEmployees },
    { label: "Gaps", value: gapCount },
  ];

  const hasCategoryFilter = category !== "all";
  const hasGapFilter = view === "list" && gapFilter !== "all";
  const hasActiveFilters = hasCategoryFilter || hasGapFilter;
  const activeFilterCount =
    (hasCategoryFilter ? 1 : 0) + (hasGapFilter ? 1 : 0);

  function clearFilters() {
    setCategory("all");
    setGapFilter("all");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Competency Management"
        title="Competencies"
        subtitle="Assess skill levels, spot gaps, and manage the competency library."
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Button onClick={() => setIsRecordScoreModalOpen(true)}>
                Record Score
              </Button>
              <Button onClick={() => setIsAddCompetencyModalOpen(true)}>
                Add Competency
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && <p className={`mb-6 ${errorTextClass}`} role="alert">{error}</p>}

      {loading && (
        <SkeletonRegion label="Loading competency data…">
          <SkeletonStats count={3} />
          <SkeletonCards rows={3} className="mt-8 max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} />)}
        </div>
      )}

      {!loading && <p className="mb-6 text-xs text-muted">{LEVEL_SCALE_HINT}</p>}

      {!loading && (
        <Modal
          open={isRecordScoreModalOpen}
          onClose={() => setIsRecordScoreModalOpen(false)}
          title="Record Competency Score"
          titleId={RECORD_SCORE_TITLE_ID}
        >
          <ScoreForm competencies={competencies} onRecorded={() => { refetch(); setIsRecordScoreModalOpen(false); }} onClose={() => setIsRecordScoreModalOpen(false)} />
        </Modal>
      )}

      <h2 className={`mb-3 ${sectionTitleClass}`}>Competency Scores</h2>

      {!loading && visibleScores.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="View"
            >
              <Chip active={view === "list"} onClick={() => setView("list")}>
                <span className="inline-flex items-center gap-1.5"><Users size={14} /> By Employee</span>
              </Chip>
              <Chip active={view === "matrix"} onClick={() => setView("matrix")}>
                <span className="inline-flex items-center gap-1.5"><LayoutGrid size={14} /> Skills Matrix</span>
              </Chip>
            </div>
            <input
              type="search"
              placeholder="Search employee or competency..."
              aria-label="Search employee or competency"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${controlSmallClass} w-full sm:w-72`}
            />
          </div>

          <div className="mb-2 hidden items-center gap-3 rounded-xl border border-line px-3 py-2.5 dark:border-paper/15 md:flex">
            <div className="flex items-center gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className={controlSmallClass}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{capitalize(c)}</option>
                ))}
              </select>
              {view === "list" && (
                <>
                  <span className="mx-1 h-5 w-px bg-line dark:bg-paper/15" aria-hidden="true" />
                  <div className="flex items-center gap-1.5" role="group" aria-label="Filter by gap">
                    {GAP_FILTERS.map((value) => (
                      <Chip key={value} active={gapFilter === value} onClick={() => setGapFilter(value)}>
                        {value === "all" ? "All gaps" : capitalize(value)}
                      </Chip>
                    ))}
                  </div>
                  <span className="mx-1 h-5 w-px bg-line dark:bg-paper/15" aria-hidden="true" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort scores" className={controlSmallClass}>
                    <option value="employee">Sort by employee</option>
                    <option value="competency">Sort by competency</option>
                    <option value="level">Sort by level</option>
                    <option value="gap">Sort by gap</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 md:hidden">
            <Button
              variant="secondary"
              onClick={() => setIsFiltersOpen(true)}
              className="w-full"
            >
              <SlidersHorizontal size={16} />
              Filters &amp; Sort
              {hasActiveFilters && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-paper">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Modal
              open={isFiltersOpen}
              onClose={() => setIsFiltersOpen(false)}
              title="Filters & Sort"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    Category
                  </p>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className={`${selectClass} w-full`}>
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{capitalize(c)}</option>
                    ))}
                  </select>
                </div>
                {view === "list" && (
                  <>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        Gap
                      </p>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by gap">
                        {GAP_FILTERS.map((value) => (
                          <Chip key={value} active={gapFilter === value} onClick={() => setGapFilter(value)}>
                            {value === "all" ? "All gaps" : capitalize(value)}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        Sort
                      </p>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort scores" className={`${selectClass} w-full`}>
                        <option value="employee">Sort by employee</option>
                        <option value="competency">Sort by competency</option>
                        <option value="level">Sort by level</option>
                        <option value="gap">Sort by gap</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm text-muted underline-offset-2 hover:underline hover:text-ink"
                  >
                    Clear all filters
                  </button>
                  <Button variant="primary" onClick={() => setIsFiltersOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </Modal>
          </div>

          {hasActiveFilters && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {hasCategoryFilter && (
                <Badge variant="neutral">
                  <span className="inline-flex items-center gap-1">
                    Category: {capitalize(category)}
                    <button
                      type="button"
                      onClick={() => setCategory("all")}
                      aria-label="Clear category filter"
                      className="text-muted transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </Badge>
              )}
              {hasGapFilter && (
                <Badge variant="neutral">
                  <span className="inline-flex items-center gap-1">
                    Gap: {capitalize(gapFilter)}
                    <button
                      type="button"
                      onClick={() => setGapFilter("all")}
                      aria-label="Clear gap filter"
                      className="text-muted transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </Badge>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-muted underline-offset-2 hover:underline hover:text-ink"
              >
                Clear all
              </button>
            </div>
          )}
        </>
      )}

      {!loading && visibleScores.length === 0 && (
        <EmptyState icon={Award} title="No scores yet" description={isAdmin ? 'Click "Record Score" above to get started.' : "Your manager hasn't recorded scores for you yet."} />
      )}

      {view === "list" ? (
        <>
          {!loading && visibleScores.length > 0 && filteredScores.length === 0 && (
            <EmptyState icon={Award} title="No scores match" description="Try a different search or filter to see more scores." />
          )}
          {!loading && groupedScores.length > 0 && (
            <DataTable
              columns={["Employee", "Competency", "Level", "Gap", "Assessed", ""]}
              className="mb-8"
            >
              {groupedScores.map((group) =>
                group.scores.map((score) => (
                  <DataTableRow key={score.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-ink dark:text-paper">
                          {group.employee?.name ?? "Unknown employee"}
                        </p>
                        {group.employee?.jobTitle && (
                          <p className="text-xs capitalize text-muted">
                            {group.employee.jobTitle}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-ink dark:text-paper">
                        {score.hr3_competencies?.name ?? "Competency"}
                      </span>
                      {score.hr3_competencies?.category && (
                        <span className="ml-2 text-xs capitalize text-muted">
                          {score.hr3_competencies.category}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <LevelBar
                          current={score.current_level}
                          required={score.required_level}
                        />
                        <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                          {score.current_level}/{score.required_level ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {gapLabel(score.current_level, score.required_level) ? (
                        <Badge variant={gapVariant(score.current_level, score.required_level)}>
                          {gapLabel(score.current_level, score.required_level)}
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {score.assessed_by || score.assessed_at ? (
                        <span className="text-xs text-muted">
                          {getDirectoryUser(score.assessed_by)?.name ?? "—"}
                          {score.assessed_at && ` · ${formatDate(score.assessed_at)}`}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <TableActions
                          actions={[
                            {
                              label: "Edit",
                              icon: <Pencil size={14} />,
                              onClick: () => setEditingScore(score),
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 size={14} />,
                              danger: true,
                              onClick: () => setConfirmingScore(score),
                            },
                          ]}
                        />
                      )}
                    </TableCell>
                  </DataTableRow>
                ))
              )}
            </DataTable>
          )}
        </>
      ) : (
        <SkillsMatrix rows={matrixRows} competencies={matrixCompetencies} />
      )}

      {/* Edit score */}
      <Modal
        open={!!editingScore}
        onClose={() => setEditingScore(null)}
        title="Edit Score"
        size="sm"
      >
        {editingScore && (
          <ScoreEditForm
            score={editingScore}
            onUpdated={() => {
              refetch();
              setEditingScore(null);
            }}
          />
        )}
      </Modal>

      {/* Delete score */}
      <Modal
        open={!!confirmingScore}
        onClose={() => setConfirmingScore(null)}
        title="Delete Score"
        size="sm"
      >
        <p className="text-sm text-muted">
          Delete this score? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => confirmingScore && deleteScore(confirmingScore.id)}
            loading={deleteScoreMutation.submitting}
          >
            {deleteScoreMutation.submitting ? "Deleting…" : "Confirm Delete"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingScore(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <h2 className={`mb-3 ${sectionTitleClass}`}>Competency Library</h2>
      {!loading && (
        <Modal
          open={isAddCompetencyModalOpen}
          onClose={() => setIsAddCompetencyModalOpen(false)}
          title="Add Competency"
          titleId={ADD_COMPETENCY_TITLE_ID}
        >
          <CompetencyForm onCreated={() => { refetch(); setIsAddCompetencyModalOpen(false); }} onClose={() => setIsAddCompetencyModalOpen(false)} />
        </Modal>
      )}
      {!loading && competencies.length === 0 && (
        <EmptyState icon={Award} title="No competencies yet" description="No competencies in the library yet." />
      )}
      {!loading && competencies.length > 0 && (
        <DataTable columns={["Competency", "Category", ""]} className="max-w-lg">
          {competencies.map((c) => (
            <DataTableRow key={c.id}>
              <TableCell>
                <span className="font-medium text-ink dark:text-paper">
                  {c.name}
                </span>
              </TableCell>
              <TableCell>
                {c.category ? (
                  <Badge variant="neutral">
                    <span className="capitalize">{c.category}</span>
                  </Badge>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {isAdmin && (
                  <TableActions
                    actions={[
                      {
                        label: "Edit",
                        icon: <Pencil size={14} />,
                        onClick: () => setEditingCompetency(c),
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => setConfirmingCompetency(c),
                      },
                    ]}
                  />
                )}
              </TableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {/* Edit competency */}
      <Modal
        open={!!editingCompetency}
        onClose={() => setEditingCompetency(null)}
        title="Edit Competency"
        size="md"
      >
        {editingCompetency && (
          <CompetencyEdit
            competency={editingCompetency}
            onUpdated={() => {
              refetch();
              setEditingCompetency(null);
            }}
            onCancel={() => setEditingCompetency(null)}
          />
        )}
      </Modal>

      {/* Delete competency */}
      <Modal
        open={!!confirmingCompetency}
        onClose={() => setConfirmingCompetency(null)}
        title="Delete Competency"
        size="sm"
      >
        <p className="text-sm text-muted">
          Delete this competency? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() =>
              confirmingCompetency && deleteCompetency(confirmingCompetency.id)
            }
            loading={deleteCompetencyMutation.submitting}
          >
            {deleteCompetencyMutation.submitting ? "Deleting…" : "Confirm Delete"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmingCompetency(null)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
