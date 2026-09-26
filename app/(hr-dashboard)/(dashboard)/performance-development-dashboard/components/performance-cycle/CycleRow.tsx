"use client";

import { ArrowRight, Lock, Play } from "lucide-react";
import type {
  PerformanceCycle,
  PerformanceCycleReadiness,
  PerformanceCycleStage,
} from "@/performance-development-dashboard/types";
import {
  PERFORMANCE_CYCLE_STAGES,
  PERFORMANCE_CYCLE_STAGE_LABELS,
  PERFORMANCE_CYCLE_STATUS_LABELS,
  PERFORMANCE_CYCLE_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import { formatDate, formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

type Action = "open" | "advance" | "close";

type Props = {
  cycle: PerformanceCycle;
  busyAction?: string;
  /**
   * Advisory readiness from the existing readiness engine. Null while not
   * loaded (or on load failure) — the row then keeps its default CTA
   * behavior and the confirmation modal fetches fresh readiness.
   */
  readiness?: PerformanceCycleReadiness | null;
  onOpen: (id: string) => void;
  onAdvance: (id: string) => void;
  onClose: (id: string) => void;
};

function visibleActions(cycle: PerformanceCycle): Action[] {
  if (cycle.status === "draft") return ["open"];
  if (cycle.stage === "closed") return [];
  // Open/Monitor/Close model: closing is available on any active cycle
  // (server enforces closure readiness); intermediate advancement stays
  // available as optional coordination.
  return ["advance", "close"];
}

function StageStepper({ stage }: { stage: PerformanceCycleStage }) {
  const currentIndex = PERFORMANCE_CYCLE_STAGES.indexOf(stage);

  return (
    <ol className="flex items-center gap-0.5 sm:gap-2">
      {PERFORMANCE_CYCLE_STAGES.map((s, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const reached = index <= currentIndex;
        const stateText = active
          ? "Current stage"
          : done
            ? "Completed stage"
            : "Upcoming stage";
        return (
          <li
            key={s}
            className="flex items-center gap-0.5 sm:gap-2"
            aria-label={`${PERFORMANCE_CYCLE_STAGE_LABELS[s]}: ${stateText}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="sr-only">{stateText}</span>
            <span
              className={active ? "text-accent" : done ? "text-emerald-600" : "text-line"}
              title={PERFORMANCE_CYCLE_STAGE_LABELS[s]}
              aria-hidden="true"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                {active ? (
                  <circle cx="5" cy="5" r="5" fill="currentColor" />
                ) : done ? (
                  <path d="M1 5.2 4 8l5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                )}
              </svg>
            </span>
            {index < PERFORMANCE_CYCLE_STAGES.length - 1 && (
              <span
                className={`h-px w-3 sm:w-5 ${reached ? "bg-accent/40" : "bg-line"}`}
              />
            )}
            {active && (
              <span className="hidden text-[10.5px] font-medium uppercase tracking-wide text-accent sm:block">
                {PERFORMANCE_CYCLE_STAGE_LABELS[s]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CycleRow({ cycle, busyAction, readiness, onOpen, onAdvance, onClose }: Props) {
  const actions = visibleActions(cycle);
  const busy = busyAction ?? null;

  const statusTone =
    PERFORMANCE_CYCLE_STATUS_TONES[cycle.status] ?? PERFORMANCE_CYCLE_STATUS_TONES.draft;

  // Next stage derived from the canonical stage order (same order the
  // server transition map follows). Null for closed cycles.
  const stageIndex = PERFORMANCE_CYCLE_STAGES.indexOf(cycle.stage);
  const nextStage: PerformanceCycleStage | null =
    stageIndex >= 0 ? (PERFORMANCE_CYCLE_STAGES[stageIndex + 1] ?? null) : null;

  const isClosed = cycle.stage === "closed";
  const isDraft = cycle.status === "draft";

  // Advisory readiness display only. The server revalidates on confirm, so
  // a stale or missing snapshot here can never authorize a transition.
  const showReadiness = !isClosed && !isDraft && readiness !== null && readiness !== undefined;
  const readinessData = showReadiness ? (readiness ?? null) : null;
  const blocked = readinessData !== null && !readinessData.ready;
  const needsReview =
    readinessData !== null &&
    readinessData.ready &&
    readinessData.warnings.length > 0;

  return (
    <div className="w-full rounded-2xl border border-line bg-paper px-5 py-5 dark:border-paper/10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {cycle.name}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {formatDateOnly(cycle.period_start)} - {formatDateOnly(cycle.period_end)}
            <span className="mx-2 text-line">|</span>
            Created {formatDate(cycle.created_at)}
            {isClosed && cycle.closed_at && (
              <>
                <span className="mx-2 text-line">|</span>
                Closed {formatDateOnly(cycle.closed_at)}
              </>
            )}
          </p>
          {!isClosed && nextStage && (
            <p className="mt-1 text-[12px] text-muted">
              Current stage:{" "}
              <span className="font-medium text-ink">
                {PERFORMANCE_CYCLE_STAGE_LABELS[cycle.stage]}
              </span>
              <span className="mx-2 text-line">|</span>
              Next stage:{" "}
              <span className="font-medium text-ink">
                {PERFORMANCE_CYCLE_STAGE_LABELS[nextStage]}
              </span>
            </p>
          )}
          {isDraft && (
            <p className="mt-1 text-[12px] text-muted">
              Draft cycle — open it to begin Goal Setting.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={statusTone + " rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"}>
            {PERFORMANCE_CYCLE_STATUS_LABELS[cycle.status]}
          </span>
          <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {PERFORMANCE_CYCLE_STAGE_LABELS[cycle.stage]}
          </span>

          <div className="flex items-center gap-2">
            {actions.includes("open") && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onOpen(cycle.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "open" ? <Spinner /> : <Play size={13} strokeWidth={2} />}
                Open
              </button>
            )}
            {actions.includes("advance") && nextStage && (
              <button
                type="button"
                disabled={busy !== null || blocked}
                title={
                  blocked
                    ? "Resolve the listed blockers before advancing this cycle."
                    : `Advance to ${PERFORMANCE_CYCLE_STAGE_LABELS[nextStage]}`
                }
                onClick={() => onAdvance(cycle.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "advance" ? <Spinner /> : <ArrowRight size={13} strokeWidth={2} />}
                Advance to {PERFORMANCE_CYCLE_STAGE_LABELS[nextStage]}
              </button>
            )}
            {actions.includes("close") && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onClose(cycle.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
              >
                {busy === "close" ? <Spinner /> : <Lock size={13} strokeWidth={2} />}
                Close Cycle
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4 dark:border-paper/10">
        <StageStepper stage={cycle.stage} />
      </div>

      {readinessData && (
        <div className="mt-4 border-t border-line pt-4 dark:border-paper/10">
          <div className="flex flex-wrap items-center gap-2">
            {blocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                Not ready
              </span>
            ) : needsReview ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Review required — ready to advance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Ready to advance
              </span>
            )}
            <span className="text-[12px] text-muted">{readinessData.summary}</span>
          </div>

          {readinessData.blockers.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Before advancing
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {readinessData.blockers.map((blocker) => (
                  <li
                    key={blocker.code}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2"
                  >
                    <p className="text-[12.5px] font-semibold text-red-600">
                      {blocker.label}
                      {blocker.count > 0 ? ` (${blocker.count})` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-red-600/90">
                      {blocker.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readinessData.warnings.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Review before advancing
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {readinessData.warnings.map((warning) => (
                  <li
                    key={warning.code}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                  >
                    <p className="text-[12.5px] font-medium text-amber-700 dark:text-amber-400">
                      {warning.label}
                    </p>
                    <p className="mt-0.5 text-[12px] text-amber-700/90 dark:text-amber-400/90">
                      {warning.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[11.5px] text-muted">
            Readiness is based on records currently associated with this
            cycle.
          </p>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}