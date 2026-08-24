"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/performance-development-dashboard/components/EmptyState";
import Chip from "@/app/(hr-dashboard)/performance-development-dashboard/components/Chip";
import ProgressBar from "@/app/(hr-dashboard)/performance-development-dashboard/components/ProgressBar";
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
  controlSmallClass,
  errorTextClass,
  iconEditClass,
  inputClass,
  listRowClass,
  quietDangerClass,
  selectClass,
  textareaClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";
import {
  useDirectory,
} from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import type { DirectoryUser } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/types";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { Award, LayoutGrid, Pencil, Users } from "lucide-react";
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

function gapStatus(
  current: number,
  required: number | null
): "meets" | "close" | "gap" | null {
  if (required === null) return null;
  if (current >= required) return "meets";
  if (current >= required - 1) return "close";
  return "gap";
}

function gapVariant(
  current: number,
  required: number | null
): "success" | "warning" | "danger" | "neutral" {
  if (required === null) return "neutral";
  if (current >= required) return "success";
  if (current >= required - 1) return "warning";
  return "danger";
}

function gapLabel(
  current: number,
  required: number | null
): string | null {
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

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
  });
}

function LevelBar({
  current,
  required,
}: {
  current: number;
  required: number | null;
}) {
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

function ScoreForm({
  competencies,
  onRecorded,
}: {
  competencies: Competency[];
  onRecorded: () => void;
}) {
  const { directory } = useDirectory();
  const [employeeId, setEmployeeId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [requiredLevel, setRequiredLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !competencyId) {
      toast.error("Choose an employee and a competency.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/competency-scores",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            competency_id: competencyId,
            current_level: currentLevel ? parseInt(currentLevel) : 0,
            required_level: requiredLevel ? parseInt(requiredLevel) : null,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to record score");
      }
      setEmployeeId("");
      setCompetencyId("");
      setCurrentLevel("");
      setRequiredLevel("");
      onRecorded();
      toast.success("Score recorded successfully.");
    } catch {
      toast.error("Failed to record score. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex max-w-md flex-col gap-3"
    >
      <h2 className="text-lg font-semibold font-bricolage">Record Score</h2>
      <select
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
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
        value={competencyId}
        onChange={(e) => setCompetencyId(e.target.value)}
        required
        aria-label="Select competency"
        className={selectClass}
      >
        <option value="" disabled>
          Select competency
        </option>
        {competencies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <input
          type="number"
          min="1"
          max="5"
          placeholder="Current level (1-5)"
          aria-label="Current level"
          value={currentLevel}
          onChange={(e) => setCurrentLevel(e.target.value)}
          required
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          type="number"
          min="1"
          max="5"
          placeholder="Required (optional)"
          aria-label="Required level"
          value={requiredLevel}
          onChange={(e) => setRequiredLevel(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      <p className="text-xs text-muted">{LEVEL_SCALE_HINT}</p>
      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Save Score"}
      </Button>
    </form>
  );
}

function ScoreEditForm({
  score,
  onUpdated,
}: {
  score: Score;
  onUpdated: () => void;
}) {
  const [currentLevel, setCurrentLevel] = useState(
    score.current_level.toString()
  );
  const [requiredLevel, setRequiredLevel] = useState(
    score.required_level?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        "/performance-development-dashboard/api/competency-scores",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: score.id,
            current_level: currentLevel ? parseInt(currentLevel) : 0,
            required_level: requiredLevel ? parseInt(requiredLevel) : null,
          }),
        }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to update score");
      }
      onUpdated();
      toast.success("Score updated successfully.");
    } catch {
      toast.error("Failed to update score. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
    >
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          max="5"
          placeholder="Current level (1-5)"
          aria-label="Current level"
          value={currentLevel}
          onChange={(e) => setCurrentLevel(e.target.value)}
          className={`${controlSmallClass} min-w-0 flex-1`}
        />
        <input
          type="number"
          min="1"
          max="5"
          placeholder="Required (optional)"
          aria-label="Required level"
          value={requiredLevel}
          onChange={(e) => setRequiredLevel(e.target.value)}
          className={`${controlSmallClass} min-w-0 flex-1`}
        />
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

function CompetencyForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/competency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to create competency");
      }
      setName("");
      setCategory("");
      setDescription("");
      onCreated();
      toast.success("Competency created successfully.");
    } catch {
      toast.error("Failed to create competency. Please try again.");
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
        Add Competency
      </h2>
      <input
        type="text"
        placeholder="Name (e.g. Parcel Handling)"
        aria-label="Competency name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className={inputClass}
      />
      <input
        type="text"
        placeholder="Category (e.g. Operations)"
        aria-label="Competency category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className={inputClass}
      />
      <textarea
        placeholder="Description (optional)"
        aria-label="Competency description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Add Competency"}
      </Button>
    </form>
  );
}

function CompetencyEdit({
  competency,
  onUpdated,
}: {
  competency: Competency;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(competency.name);
  const [category, setCategory] = useState(competency.category ?? "");
  const description = competency.description ?? "";
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/competency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: competency.id,
          name,
          category,
          description,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update competency");
      }
      onUpdated();
      toast.success("Competency updated successfully.");
    } catch {
      toast.error("Failed to update competency. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-label="Competency name"
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Category"
          aria-label="Competency category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
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

const GAP_CELL_TEXT: Record<string, string> = {
  gap: "text-red-600 dark:text-red-400",
  close: "text-amber-600 dark:text-amber-400",
  meets: "text-green-600 dark:text-green-400",
};

function MatrixCell({ score }: { score: Score | undefined }) {
  if (!score) {
    return (
      <td className="px-3 py-2 text-center text-muted">—</td>
    );
  }
  const status = gapStatus(score.current_level, score.required_level);
  const textClass = status ? GAP_CELL_TEXT[status] : "text-muted";
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 text-center ${textClass}`}
      title={
        levelLabel(score.current_level)
          ? `${score.current_level} ${levelLabel(score.current_level)}` +
            (score.required_level
              ? ` → ${score.required_level} ${levelLabel(score.required_level)}`
              : "")
          : undefined
      }
    >
      {score.current_level}/{score.required_level ?? "—"}
    </td>
  );
}

function SkillsMatrix({
  rows,
  competencies,
}: {
  rows: {
    employeeId: string;
    employee: DirectoryUser | undefined;
    scores: Score[];
  }[];
  competencies: Competency[];
}) {
  if (rows.length === 0 || competencies.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Nothing to show"
        description="Record scores to build the skills matrix."
      />
    );
  }
  return (
    <div className="mb-8 overflow-x-auto rounded-lg border border-line bg-white dark:border-paper/15 dark:bg-ink">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-line dark:border-paper/15">
            <th className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-left font-medium dark:bg-ink">
              Employee
            </th>
            {competencies.map((c) => (
              <th
                key={c.id}
                title={c.description ?? undefined}
                className="whitespace-nowrap px-3 py-2 text-center font-medium"
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.employeeId}
              className="border-b border-line last:border-0 dark:border-paper/15"
            >
              <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 dark:bg-ink">
                {row.employee?.name ?? "Unknown"}
                {row.employee?.jobTitle && (
                  <span className="block text-xs capitalize text-muted">
                    {row.employee.jobTitle}
                  </span>
                )}
              </td>
              {competencies.map((c) => {
                const score = row.scores.find(
                  (s) => s.competency_id === c.id
                );
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
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editingCompetencyId, setEditingCompetencyId] = useState<
    string | null
  >(null);
  const [view, setView] = useState<"list" | "matrix">("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [gapFilter, setGapFilter] = useState<(typeof GAP_FILTERS)[number]>(
    "all"
  );
  const [sortBy, setSortBy] = useState<"employee" | "competency" | "level" | "gap">(
    "employee"
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [compRes, scoreRes] = await Promise.all([
          fetch("/performance-development-dashboard/api/competency"),
          fetch("/performance-development-dashboard/api/competency-scores"),
        ]);
        if (!compRes.ok || !scoreRes.ok) {
          throw new Error("Failed to load competency data");
        }
        const compJson = await compRes.json();
        const scoreJson = await scoreRes.json();
        if (cancelled) return;
        setCompetencies(compJson.competencies || []);
        setScores(scoreJson.scores || []);
      } catch {
        if (!cancelled) setError("Could not load competency data. Please try again.");
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

  async function deleteScore(id: string) {
    if (!window.confirm("Delete this score?")) return;
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/competency-scores?id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete score");
      }
      refetch();
      toast.success("Score deleted successfully.");
    } catch {
      toast.error("Failed to delete score. Please try again.");
    }
  }

  async function deleteCompetency(id: string) {
    if (!window.confirm("Delete this competency? Existing scores will be orphaned."))
      return;
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/competency?id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete competency");
      }
      refetch();
      toast.success("Competency deleted successfully.");
    } catch {
      toast.error("Failed to delete competency. Please try again.");
    }
  }

  const visibleScores = isAdmin
    ? scores
    : scores.filter((s) => s.employee_id === user?.employeeId);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          competencies
            .map((c) => c.category)
            .filter((c): c is string => !!c)
        )
      ).sort(),
    [competencies]
  );

  const q = search.trim().toLowerCase();

  const filteredScores = useMemo(() => {
    return visibleScores.filter((score) => {
      if (
        category !== "all" &&
        (score.hr3_competencies?.category ?? null) !== category
      ) {
        return false;
      }
      if (
        gapFilter !== "all" &&
        gapStatus(score.current_level, score.required_level) !== gapFilter
      ) {
        return false;
      }
      if (q) {
        const empName =
          getDirectoryUser(score.employee_id)?.name.toLowerCase() ?? "";
        const compName =
          (score.hr3_competencies?.name ?? "").toLowerCase();
        if (!empName.includes(q) && !compName.includes(q)) return false;
      }
      return true;
    });
  }, [visibleScores, category, gapFilter, q, getDirectoryUser]);

  const groupedScores = useMemo(() => {
    const groups = new Map<string, Score[]>();
    for (const score of filteredScores) {
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
      .sort((a, b) =>
        (a.employee?.name ?? "Unknown").localeCompare(
          b.employee?.name ?? "Unknown"
        )
      )
      .map((group) => ({
        ...group,
        scores: [...group.scores].sort((a, b) => {
          if (sortBy === "competency")
            return (a.hr3_competencies?.name ?? "").localeCompare(
              b.hr3_competencies?.name ?? ""
            );
          if (sortBy === "level") return b.current_level - a.current_level;
          if (sortBy === "gap") return gapRank(a) - gapRank(b);
          return 0;
        }),
      }));
  }, [filteredScores, sortBy, getDirectoryUser]);

  const categoryAppliedScores = useMemo(
    () =>
      visibleScores.filter(
        (score) =>
          category === "all" ||
          (score.hr3_competencies?.category ?? null) === category
      ),
    [visibleScores, category]
  );

  const matrixRows = useMemo(() => {
    const groups = new Map<string, Score[]>();
    for (const score of categoryAppliedScores) {
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
      .sort((a, b) =>
        (a.employee?.name ?? "Unknown").localeCompare(
          b.employee?.name ?? "Unknown"
        )
      )
      .filter((row) => {
        if (!q) return true;
        if (row.employee?.name.toLowerCase().includes(q)) return true;
        return row.scores.some((s) =>
          (s.hr3_competencies?.name ?? "").toLowerCase().includes(q)
        );
      });
  }, [categoryAppliedScores, q, getDirectoryUser]);

  const matrixCompetencies = useMemo(
    () =>
      competencies
        .filter((c) => {
          if (category !== "all" && (c.category ?? null) !== category)
            return false;
          if (q && !c.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            (a.category ?? "").localeCompare(b.category ?? "") ||
            a.name.localeCompare(b.name)
        ),
    [competencies, category, q]
  );

  const gapCount = scores.filter(
    (s) => s.required_level !== null && s.current_level < s.required_level
  ).length;
  const assessedEmployees = new Set(
    scores.map((s) => s.employee_id)
  ).size;

  const stats = [
    { label: "Scores Recorded", value: scores.length },
    { label: "Employees Assessed", value: assessedEmployees },
    { label: "Gaps", value: gapCount },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Competency Management"
        title="Competencies"
        subtitle="Assess skill levels, spot gaps, and manage the competency library."
      />

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading competency data…">
          <SkeletonStats count={3} />
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

      {!loading && (
        <p className="mb-6 text-xs text-muted">
          {LEVEL_SCALE_HINT}
        </p>
      )}

      {!loading && isAdmin && (
        <ScoreForm competencies={competencies} onRecorded={refetch} />
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Competency Scores
      </h2>

      {!loading && visibleScores.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Chip
            active={view === "list"}
            onClick={() => setView("list")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />
              By Employee
            </span>
          </Chip>
          <Chip
            active={view === "matrix"}
            onClick={() => setView("matrix")}
          >
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid size={14} />
              Skills Matrix
            </span>
          </Chip>
          <input
            type="search"
            placeholder="Search employee or competency..."
            aria-label="Search employee or competency"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${controlSmallClass} min-w-[200px]`}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className={controlSmallClass}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {capitalize(c)}
              </option>
            ))}
          </select>
          {view === "list" && (
            <>
              {GAP_FILTERS.map((value) => (
                <Chip
                  key={value}
                  active={gapFilter === value}
                  onClick={() => setGapFilter(value)}
                >
                  {value === "all" ? "All gaps" : capitalize(value)}
                </Chip>
              ))}
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "employee"
                      | "competency"
                      | "level"
                      | "gap"
                  )
                }
                aria-label="Sort scores"
                className={`ml-auto ${controlSmallClass}`}
              >
                <option value="employee">Sort by employee</option>
                <option value="competency">Sort by competency</option>
                <option value="level">Sort by level</option>
                <option value="gap">Sort by gap</option>
              </select>
            </>
          )}
        </div>
      )}

      {!loading && visibleScores.length === 0 && (
        <EmptyState
          icon={Award}
          title="No scores yet"
          description={
            isAdmin
              ? "Record a score above to get started."
              : "Your manager hasn't recorded scores for you yet."
          }
        />
      )}

      {view === "list" ? (
        <>
          {!loading &&
            visibleScores.length > 0 &&
            filteredScores.length === 0 && (
              <EmptyState
                icon={Award}
                title="No scores match"
                description="Try a different search or filter to see more scores."
              />
            )}
          {!loading && groupedScores.length > 0 && (
            <motion.div
              key={`${refreshKey}-${category}-${gapFilter}-${q}`}
              variants={staggerContainer}
              initial="hidden"
              animate="shown"
              className="mb-8 flex max-w-md flex-col gap-4"
            >
              {groupedScores.map((group) => (
                <motion.div key={group.employeeId} variants={staggerItem}>
                  <Card>
                    <div className="mb-3">
                      <h3 className="font-semibold font-bricolage">
                        {group.employee?.name ?? "Unknown employee"}
                      </h3>
                      {group.employee?.jobTitle && (
                        <p className="text-xs capitalize text-muted">
                          {group.employee.jobTitle}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      {group.scores.map((score) => (
                        <div
                          key={score.id}
                          className={`p-3 ${listRowClass}`}
                        >
                          {editingScoreId === score.id ? (
                            <ScoreEditForm
                              score={score}
                              onUpdated={() => {
                                refetch();
                                setEditingScoreId(null);
                              }}
                            />
                          ) : (
                            <>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <h4 className="text-sm font-medium">
                                  {score.hr3_competencies?.name ?? "Competency"}
                                </h4>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Badge
                                    variant={gapVariant(
                                      score.current_level,
                                      score.required_level
                                    )}
                                  >
                                    {score.current_level} /{" "}
                                    {score.required_level ?? "—"}
                                  </Badge>
                                  {gapLabel(
                                    score.current_level,
                                    score.required_level
                                  ) && (
                                    <Badge
                                      variant={gapVariant(
                                        score.current_level,
                                        score.required_level
                                      )}
                                    >
                                      {gapLabel(
                                        score.current_level,
                                        score.required_level
                                      )}
                                    </Badge>
                                  )}
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingScoreId(
                                          editingScoreId === score.id
                                            ? null
                                            : score.id
                                        )
                                      }
                                      aria-label={
                                        editingScoreId === score.id
                                          ? "Close score editor"
                                          : "Edit score"
                                      }
                                      aria-expanded={editingScoreId === score.id}
                                      className={iconEditClass}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <LevelBar
                                  current={score.current_level}
                                  required={score.required_level}
                                />
                                {levelLabel(score.current_level) && (
                                  <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                                    {levelLabel(score.current_level)}
                                  </span>
                                )}
                              </div>
                              {score.hr3_competencies?.category && (
                                <span className="text-xs capitalize text-muted">
                                  {score.hr3_competencies.category}
                                </span>
                              )}
                              {(score.assessed_by || score.assessed_at) && (
                                <p className="mt-1 text-xs text-muted">
                                  Assessed by{" "}
                                  {getDirectoryUser(score.assessed_by)?.name ??
                                    "—"}
                                  {score.assessed_at &&
                                    ` · ${formatDate(score.assessed_at)}`}
                                </p>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => deleteScore(score.id)}
                                  className={`mt-2 ${quietDangerClass}`}
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      ) : (
        <SkillsMatrix
          rows={matrixRows}
          competencies={matrixCompetencies}
        />
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Competency Library
      </h2>
      {!loading && isAdmin && (
        <CompetencyForm onCreated={refetch} />
      )}
      {!loading && competencies.length === 0 && (
        <p className="mb-4 text-sm text-muted">
          No competencies in the library yet.
        </p>
      )}
      {!loading && competencies.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-2"
        >
          {competencies.map((c) =>
            editingCompetencyId === c.id ? (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-4 py-2 ${listRowClass}`}
              >
                <CompetencyEdit
                  competency={c}
                  onUpdated={() => {
                    refetch();
                    setEditingCompetencyId(null);
                  }}
                />
              </div>
            ) : (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-2 px-4 py-2 ${listRowClass}`}
              >
                <div>
                  <span className="text-sm">{c.name}</span>
                  {c.category && (
                    <Badge variant="neutral">
                      <span className="capitalize">{c.category}</span>
                    </Badge>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCompetencyId(
                          editingCompetencyId === c.id ? null : c.id
                        )
                      }
                      aria-label={
                        editingCompetencyId === c.id
                          ? "Close competency editor"
                          : "Edit competency"
                      }
                      aria-expanded={editingCompetencyId === c.id}
                      className={iconEditClass}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCompetency(c.id)}
                      className={quietDangerClass}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </motion.div>
      )}
    </div>
  );
}
