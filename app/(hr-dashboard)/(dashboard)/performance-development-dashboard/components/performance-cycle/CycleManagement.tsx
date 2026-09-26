"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { StatTile } from "@/performance-development-dashboard/components/ui/StatTile";
import type {
  CycleCreateInput,
  CurrentPerDevUser,
  PerformanceCycle,
  PerformanceCycleClosureReadiness,
  PerformanceCycleReadiness,
} from "@/performance-development-dashboard/types";
import { useCycleApi } from "@/performance-development-dashboard/hooks/useCycleApi";
import { PerDevHttpError } from "@/performance-development-dashboard/lib/api/perDevFetch";
import { AdvanceCycleModal } from "@/performance-development-dashboard/components/performance-cycle/AdvanceCycleModal";
import { CloseCycleModal } from "@/performance-development-dashboard/components/performance-cycle/CloseCycleModal";
import { CycleRow } from "@/performance-development-dashboard/components/performance-cycle/CycleRow";
import { CreateCycleModal } from "@/performance-development-dashboard/components/performance-cycle/CreateCycleModal";

type PendingAdvance = {
  cycle: PerformanceCycle;
  readiness: PerformanceCycleReadiness;
};

type PendingClose = {
  cycle: PerformanceCycle;
  closureReadiness: PerformanceCycleClosureReadiness | null;
};

type Props = {
  serverUser: CurrentPerDevUser;
  initialCycles: PerformanceCycle[];
  initialError?: string;
};

export function CycleManagement({
  serverUser,
  initialCycles,
  initialError,
}: Props) {
  const api = useCycleApi();
  const [cycles, setCycles] = useState<PerformanceCycle[]>(initialCycles);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAdvanceId, setCheckingAdvanceId] = useState<string | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<PendingAdvance | null>(
    null
  );
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  /**
   * Advisory per-cycle readiness, loaded from the existing readiness
   * endpoint (same engine the advance operation enforces). A missing entry
   * means "not loaded or load failed" — rows then keep their existing CTA
   * behavior and the confirmation modal fetches fresh readiness on demand.
   * Entries are dropped whenever a cycle changes stage so stale readiness
   * is never displayed.
   */
  const [readinessById, setReadinessById] = useState<
    Record<string, PerformanceCycleReadiness>
  >({});
  const readinessCheckedRef = useRef<Record<string, string>>({});

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const openCount = cycles.filter((c) => c.status === "open").length;
  const inReviewCount = cycles.filter((c) => c.status === "in_review").length;
  const closedCount = cycles.filter((c) => c.status === "closed").length;

  function applyCycle(updated: PerformanceCycle) {
    setCycles((prev) =>
      prev.map((cycle) => (cycle.id === updated.id ? updated : cycle))
    );
    // Stage changed: row readiness is stale, refetch it below.
    delete readinessCheckedRef.current[updated.id];
    setReadinessById((prev) => {
      if (!(updated.id in prev)) return prev;
      const next = { ...prev };
      delete next[updated.id];
      return next;
    });
  }

  /**
   * Authoritative reconciliation after a successful mutation. The instant
   * `applyCycle` patch above keeps the UI responsive, but a single mutation
   * response must never be the final truth: if the response was stale, lost,
   * or raced with another writer, the row would stay wrong until a manual
   * refresh. This quiet re-read heals any such drift (and refreshes counts
   * and readiness inputs); failures surface a toast and leave the
   * already-applied optimistic state intact for manual Refresh.
   */
  async function refreshCyclesQuietly() {
    try {
      const list = await api.list();
      setCycles(list);
      setError(null);
      readinessCheckedRef.current = {};
      setReadinessById({});
    } catch {
      toast.error(
        "Action succeeded, but the cycle list failed to refresh. Please use Refresh."
      );
    }
  }

  async function handleCreate(input: CycleCreateInput) {
    const cycle = await api.create(input);
    setCycles((prev) => [cycle, ...prev]);
    setCreateOpen(false);
    toast.success(`Cycle "${cycle.name}" created.`);
    await refreshCyclesQuietly();
  }

  async function handleOpen(id: string) {
    try {
      const next = await api.runAction(id, "open", api.open);
      applyCycle(next);
      toast.success(`Cycle "${next.name}" is now open.`);
      await refreshCyclesQuietly();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open cycle.");
    }
  }

  async function handleAdvance(id: string) {
    const cycle = cycles.find((item) => item.id === id);
    if (!cycle) return;

    setCheckingAdvanceId(id);
    try {
      const readiness = await api.getReadiness(id);
      setPendingAdvance({ cycle, readiness });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to check cycle readiness."
      );
    } finally {
      setCheckingAdvanceId(null);
    }
  }

  async function confirmAdvance() {
    if (!pendingAdvance) return;

    try {
      const next = await api.runAction(
        pendingAdvance.cycle.id,
        "advance",
        api.advance
      );
      applyCycle(next);
      setPendingAdvance(null);
      toast.success(`Cycle "${next.name}" advanced a stage.`);
      await refreshCyclesQuietly();
    } catch (err) {
      if (
        err instanceof PerDevHttpError &&
        err.status === 409 &&
        err.body !== null &&
        typeof err.body === "object" &&
        "readiness" in err.body
      ) {
        setPendingAdvance({
          cycle: pendingAdvance.cycle,
          readiness: (err.body as { readiness: PerformanceCycleReadiness }).readiness,
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to advance cycle.");
    }
  }

  // Close is confirmed through a modal (consequences + server 409
  // blockers), never fired directly from the row.
  function handleClose(id: string) {
    const cycle = cycles.find((item) => item.id === id);
    if (!cycle) return;
    setPendingClose({ cycle, closureReadiness: null });
  }

  async function confirmClose() {
    if (!pendingClose) return;

    try {
      const next = await api.runAction(
        pendingClose.cycle.id,
        "close",
        api.close
      );
      applyCycle(next);
      setPendingClose(null);
      toast.success(`Cycle "${next.name}" is closed.`);
      await refreshCyclesQuietly();
    } catch (err) {
      if (
        err instanceof PerDevHttpError &&
        err.status === 409 &&
        err.body !== null &&
        typeof err.body === "object" &&
        "closureReadiness" in err.body
      ) {
        setPendingClose({
          cycle: pendingClose.cycle,
          closureReadiness: (
            err.body as { closureReadiness: PerformanceCycleClosureReadiness }
          ).closureReadiness,
        });
        return;
      }
      setPendingClose(null);
      toast.error(err instanceof Error ? err.message : "Failed to close cycle.");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const list = await api.list();
      setCycles(list);
      setError(null);
      readinessCheckedRef.current = {};
      setReadinessById({});
      toast.success("Performance cycles refreshed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh performance cycles."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // Advisory readiness fan-out: one existing-endpoint read per non-closed
  // cycle. Closed cycles never advance, so they are skipped. Failures are
  // silent by design — rows simply keep their default CTA behavior and the
  // confirmation modal fetches fresh readiness on demand.
  useEffect(() => {
    const pending = cycles.filter(
      (cycle) =>
        cycle.stage !== "closed" &&
        readinessCheckedRef.current[cycle.id] !== cycle.stage
    );
    if (pending.length === 0) return;
    let cancelled = false;
    for (const cycle of pending) {
      readinessCheckedRef.current[cycle.id] = cycle.stage;
    }
    void (async () => {
      const results = await Promise.allSettled(
        pending.map((cycle) => api.getReadiness(cycle.id))
      );
      if (cancelled) return;
      setReadinessById((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[pending[index].id] = result.value;
          }
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Performance Cycles
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            Hello {firstName}. Create the cycle, open it when ready, and advance
            it one stage at a time through the performance lifecycle.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
          >
            <Plus size={15} strokeWidth={2} />
            New cycle
          </button>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
<StatTile label="Total cycles" value={cycles.length} tone="bg-accent-dark" />
              <StatTile label="Open" value={openCount} tone="bg-accent" />
              <StatTile label="In review" value={inReviewCount} tone="bg-ink" />
              <StatTile label="Closed" value={closedCount} tone="bg-emerald-600" />
      </div>

      <div className="rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
        <p className="text-[13px] font-medium text-ink">
          How performance cycles work
        </p>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          Prepare a cycle, open it to start active performance activity, then
          monitor progress while employees and managers work independently.
          Intermediate stages are coordination context — closing the cycle is
          the terminal step, and it requires every linked appraisal to be
          finalized or acknowledged.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <p className="text-[13px] font-medium text-red-600">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {cycles.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No performance cycles yet
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            Create your first cycle to start managing the performance lifecycle
            for the organization.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
          >
            <Plus size={15} strokeWidth={2} />
            Create your first cycle
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cycles.map((cycle) => (
            <CycleRow
              key={cycle.id}
              cycle={cycle}
              busyAction={
                api.busy?.id === cycle.id
                  ? api.busy.action
                  : checkingAdvanceId === cycle.id
                    ? "advance"
                    : undefined
              }
              readiness={readinessById[cycle.id] ?? null}
              onOpen={handleOpen}
              onAdvance={handleAdvance}
              onClose={handleClose}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateCycleModal
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {pendingAdvance && (
        <AdvanceCycleModal
          cycle={pendingAdvance.cycle}
          readiness={pendingAdvance.readiness}
          confirming={api.busy?.action === "advance"}
          onClose={() => setPendingAdvance(null)}
          onConfirm={confirmAdvance}
        />
      )}

      {pendingClose && (
        <CloseCycleModal
          cycle={pendingClose.cycle}
          closureReadiness={pendingClose.closureReadiness}
          confirming={api.busy?.action === "close"}
          onClose={() => setPendingClose(null)}
          onConfirm={confirmClose}
        />
      )}
    </div>
  );
}
