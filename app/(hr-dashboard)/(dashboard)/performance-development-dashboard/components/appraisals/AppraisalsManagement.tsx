"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Plus, RefreshCw, Search } from "lucide-react";
import type {
  AppraisalCreateInput,
  AppraisalGoalRatingInput,
  AppraisalCompetencyRatingInput,
  AppraisalScoringInputs,
  CurrentPerDevUser,
  EmployeeOption,
  PerformanceAppraisal,
  PerformanceCycle,
} from "@/performance-development-dashboard/types";
import { useAppraisalApi } from "@/performance-development-dashboard/hooks/useAppraisalApi";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceErrorBanner,
  PerformancePageHeader,
} from "@/performance-development-dashboard/components/ui/performance";
import { AppraisalCard } from "@/performance-development-dashboard/components/appraisals/AppraisalCard";
import { AppraisalDetailModal } from "@/performance-development-dashboard/components/appraisals/AppraisalDetailModal";
import { CreateAppraisalModal } from "@/performance-development-dashboard/components/appraisals/CreateAppraisalModal";

type Props = {
  serverUser: CurrentPerDevUser;
  isHrAdmin: boolean;
  isManager: boolean;
  initialAppraisals: PerformanceAppraisal[];
  initialError?: string;
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  employeeNamesById: Record<string, string>;
  reviewerByAccountNameById: Record<string, string | null>;
  currentUserEmployeeId: string | null;
  defaultEmployeeId?: string | null;
};

export function AppraisalsManagement({
  serverUser,
  isHrAdmin,
  isManager,
  initialAppraisals,
  initialError,
  employees,
  cycles,
  employeeNamesById,
  currentUserEmployeeId,
  defaultEmployeeId,
}: Props) {
  const api = useAppraisalApi();

  const [appraisals, setAppraisals] =
    useState<PerformanceAppraisal[]>(initialAppraisals);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<PerformanceAppraisal | null>(null);
  const [scoringInputs, setScoringInputs] = useState<AppraisalScoringInputs | null>(
    null
  );
  const [scoringLoading, setScoringLoading] = useState(false);
  const [search, setSearch] = useState("");
  const modalOpenRef = useRef(false);
  const searchParams = useSearchParams();
  const deepLinkConsumedRef = useRef<string | null>(null);

  const resolvedEmployeeNamesById = useMemo(() => {
    const names = { ...employeeNamesById };
    for (const employee of employees) {
      names[employee.id] = employee.name;
    }
    return names;
  }, [employeeNamesById, employees]);

  const cycleNamesById = useMemo(() => {
    const names: Record<string, string> = {};
    for (const cycle of cycles) {
      names[cycle.id] = cycle.name;
    }
    return names;
  }, [cycles]);

  function resolveEmployeeName(
    employeeId: string | null | undefined
  ): string {
    if (!employeeId) return "Unknown employee";
    return resolvedEmployeeNamesById[employeeId] ?? "Unknown employee";
  }

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  /**
   * Per-row manager-submission state for manager_assessment appraisals,
   * resolved from the existing scoring-inputs endpoint (submitted ⟺
   * persisted goal ratings exist). Mirrors the check-ins classification
   * pattern: quiet, best-effort, presentation-only. Missing entries mean
   * "unknown" and cards fall back to the raw status label.
   */
  const [submittedById, setSubmittedById] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const missing = appraisals
      .filter(
        (appraisal) =>
          appraisal.status === "manager_assessment" &&
          !(appraisal.id in submittedById)
      )
      .map((appraisal) => appraisal.id);
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.allSettled(
        missing.map((id) => api.getScoringInputs(id))
      );
      if (cancelled) return;
      setSubmittedById((previous) => {
        const next = { ...previous };
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          if (missing[index] in next) return;
          next[missing[index]] =
            result.value.existing_goal_ratings.length > 0;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appraisals]);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return appraisals;
    return appraisals.filter((appraisal) => {
      const employeeName = (
        resolvedEmployeeNamesById[appraisal.employee_id] ?? ""
      ).toLowerCase();
      const reviewerName = (
        resolvedEmployeeNamesById[appraisal.reviewer_id] ?? ""
      ).toLowerCase();
      return (
        appraisal.review_period.toLowerCase().includes(query) ||
        employeeName.includes(query) ||
        reviewerName.includes(query)
      );
    });
  }, [appraisals, search, resolvedEmployeeNamesById]);

  async function replaceAndRefresh(updatedRow: PerformanceAppraisal) {
    const refreshed = await api.list();
    setAppraisals(refreshed);
    if (!modalOpenRef.current) return;
    try {
      const full = await api.getOne(updatedRow.id);
      if (modalOpenRef.current) setSelected(full);
    } catch {
      if (modalOpenRef.current) {
        setSelected(
          refreshed.find((appraisal) => appraisal.id === updatedRow.id) ??
            updatedRow
        );
      }
    }
    setError(null);
  }

  async function handleOpen(appraisal: PerformanceAppraisal) {
    modalOpenRef.current = true;
    setSelected(appraisal);
    setScoringInputs(null);
    setScoringLoading(true);
    try {
      const full = await api.getOne(appraisal.id);
      if (modalOpenRef.current) setSelected(full);
    } catch {
      if (modalOpenRef.current) setSelected(appraisal);
    } finally {
      if (modalOpenRef.current) setScoringLoading(false);
    }

    if (
      (appraisal.status === "manager_assessment" &&
        !!appraisal.currentUserIsEvaluator) ||
      (isHrAdmin &&
        appraisal.status === "manager_assessment" &&
        !!appraisal.currentUserIsHrReviewer)
    ) {
      setScoringLoading(true);
      try {
        setScoringInputs(await api.getScoringInputs(appraisal.id));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load scoring inputs for this appraisal."
        );
      } finally {
        if (modalOpenRef.current) setScoringLoading(false);
      }
    }
  }

  /**
   * Record deep-link: `?appraisal=<id>` (e.g. from a notification) opens the
   * appraisal detail directly. Resolution is server-authorized: the row is
   * found in the scope-filtered list when present, otherwise fetched via the
   * scoped single-record endpoint. Invalid, deleted, or out-of-scope ids
   * surface the standard error banner — never the record.
   */
  useEffect(() => {
    const id = searchParams.get("appraisal");
    if (!id || deepLinkConsumedRef.current === id) return;
    deepLinkConsumedRef.current = id;
    let cancelled = false;
    void (async () => {
      const listed = appraisals.find((appraisal) => appraisal.id === id);
      if (listed) {
        if (!cancelled) await handleOpen(listed);
        return;
      }
      try {
        const fresh = await api.getOne(id);
        if (!cancelled) await handleOpen(fresh);
      } catch {
        if (!cancelled) {
          setError(
            "That appraisal is no longer available. It may have been removed or moved outside your current scope."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleCreate(input: Record<string, unknown>) {
    setCreating(true);
    await api
      .runCreate({
        employee_id: String(input.employee_id ?? ""),
        cycle_id: String(input.cycle_id ?? ""),
        review_period: String(input.review_period ?? ""),
      } satisfies AppraisalCreateInput)
      .then((created) => {
        setAppraisals((previous) => [created, ...previous]);
        setCreateOpen(false);
        toast.success("Appraisal created.");
      })
      .finally(() => setCreating(false));
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const list = await api.list();
      setAppraisals(list);
      setError(null);
      toast.success("Appraisals refreshed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh appraisals."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelfAssessment(input: {
    strengths?: string;
    improvements?: string;
  }) {
    if (!selected) return;
    const updated = await api.runSubmitSelfAssessment(selected.id, input);
    await replaceAndRefresh(updated);
    toast.success("Self assessment submitted.");
  }

  async function handleManagerAssessment(input: {
    goalRatings: AppraisalGoalRatingInput[];
    competencyRatings: AppraisalCompetencyRatingInput[];
    comments: string;
  }) {
    if (!selected) return;
    const updated = await api.runSubmitManagerAssessment(selected.id, input);
    await replaceAndRefresh(updated);
    toast.success("Manager assessment submitted.");
    // Re-fetch scoring inputs so the read-only submitted view shows persisted
    // result rows (existing_goal_ratings / existing_competency_ratings).
    if (modalOpenRef.current) {
      try {
        setScoringInputs(await api.getScoringInputs(updated.id));
      } catch {
        // Best-effort: if scoring re-fetch fails, the modal still works
      }
    }
  }

  async function handleFinalize() {
    if (!selected) return;
    const updated = await api.runFinalize(selected.id);
    await replaceAndRefresh(updated);
    setScoringInputs(null);
    toast.success("Appraisal finalized.");
  }

  async function handleAcknowledge() {
    if (!selected) return;
    const updated = await api.runAcknowledge(selected.id);
    await replaceAndRefresh(updated);
    toast.success("Appraisal acknowledged.");
  }

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Appraisals"
        description={
          isHrAdmin
            ? `Hello ${firstName}. Initiate formal evaluations and move each appraisal through its stages: self assessment, manager assessment, finalized, acknowledged.`
            : isManager
              ? `Hello ${firstName}. Evaluate your direct reports by rating their Goals/KPI and Competencies and submitting the Manager Assessment.`
              : `Hello ${firstName}. Your formal appraisal record, from your self assessment through final acknowledgement.`
        }
        actions={
          <>
            {/* Refresh is available to everyone viewing Appraisals — it only
                reloads list data already in the viewer's authorized scope.
                Administrative actions below stay independently gated. */}
            <PerformanceButton
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </PerformanceButton>
            {isHrAdmin && (
              <PerformanceButton
                onClick={() => setCreateOpen(true)}
                disabled={creating}
              >
                <Plus size={15} strokeWidth={2} />
                Add appraisal
              </PerformanceButton>
            )}
          </>
        }
      />

      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search appraisals</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search review periods or people..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>
        <p
          aria-live="polite"
          className="text-[12px] tabular-nums text-muted sm:ml-auto"
        >
          {displayed.length} of {appraisals.length} appraisal{displayed.length === 1 ? "" : "s"}
        </p>
      </FilterBar>

      {error && (
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading appraisals...</span>
          <SkeletonList rows={3} />
        </div>
      ) : displayed.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <ClipboardList size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search ? "No matching appraisals" : "No appraisals yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : isHrAdmin
                ? "Initiate the first appraisal to start a formal evaluation cycle."
                : isManager
                  ? "No direct reports have appraisals assigned yet."
                  : "Your performance team has not initiated an appraisal for you yet."}
          </p>
          {isHrAdmin && !search && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Add your first appraisal
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((appraisal) => (
            <AppraisalCard
              key={appraisal.id}
              appraisal={appraisal}
              managerSubmitted={submittedById[appraisal.id] ?? null}
              employeeName={resolveEmployeeName(appraisal.employee_id)}
              evaluatorName={resolveEmployeeName(appraisal.evaluator_id)}
              reviewerByAccountName={appraisal.reviewerByAccountName}
              cycleName={
                appraisal.cycleName ??
                (appraisal.cycle_id
                  ? (cycleNamesById[appraisal.cycle_id] ?? null)
                  : null)
              }
              onOpen={() => handleOpen(appraisal)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateAppraisalModal
          employees={employees}
          cycles={cycles}
          defaultEmployeeId={defaultEmployeeId}
          submitting={creating}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {selected && (
          <AppraisalDetailModal
            appraisal={selected}
            isHrAdmin={isHrAdmin}
            currentUserEmployeeId={currentUserEmployeeId}
            employeeName={resolveEmployeeName(selected.employee_id)}
            evaluatorName={resolveEmployeeName(selected.evaluator_id)}
            reviewerByAccountName={selected.reviewerByAccountName ?? null}
            cycleName={
              selected.cycleName ??
              (selected.cycle_id
                ? (cycleNamesById[selected.cycle_id] ?? null)
                : null)
            }
            submitting={api.busy}
          scoringInputs={scoringInputs}
          scoringLoading={scoringLoading}
          onSelfAssessment={handleSelfAssessment}
          onManagerAssessment={handleManagerAssessment}
          onFinalize={handleFinalize}
          onAcknowledge={handleAcknowledge}
          onClose={() => {
            modalOpenRef.current = false;
            setSelected(null);
            setScoringInputs(null);
          }}
        />
      )}
    </div>
  );
}