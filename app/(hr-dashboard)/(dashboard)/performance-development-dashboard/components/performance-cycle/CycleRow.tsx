"use client";

import { ArrowRight, Lock, Play } from "lucide-react";
import type { PerformanceCycle, PerformanceCycleStage } from "@/performance-development-dashboard/types";
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
  onOpen: (id: string) => void;
  onAdvance: (id: string) => void;
  onClose: (id: string) => void;
};

function visibleActions(cycle: PerformanceCycle): Action[] {
  if (cycle.status === "draft") return ["open"];
  if (cycle.stage === "closed") return [];
  if (cycle.stage === "finalization") return ["advance", "close"];
  return ["advance"];
}

function StageStepper({ stage }: { stage: PerformanceCycleStage }) {
  const currentIndex = PERFORMANCE_CYCLE_STAGES.indexOf(stage);

  return (
    <ol className="flex items-center gap-0.5 sm:gap-2">
      {PERFORMANCE_CYCLE_STAGES.map((s, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const reached = index <= currentIndex;
        return (
          <li
            key={s}
            className="flex items-center gap-0.5 sm:gap-2"
            aria-label={PERFORMANCE_CYCLE_STAGE_LABELS[s]}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={active ? "text-accent" : done ? "text-emerald-600" : "text-line"}
              title={PERFORMANCE_CYCLE_STAGE_LABELS[s]}
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

export function CycleRow({ cycle, busyAction, onOpen, onAdvance, onClose }: Props) {
  const actions = visibleActions(cycle);
  const busy = busyAction ?? null;

  const statusTone =
    PERFORMANCE_CYCLE_STATUS_TONES[cycle.status] ?? PERFORMANCE_CYCLE_STATUS_TONES.draft;

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
          </p>
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
            {actions.includes("advance") && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onAdvance(cycle.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "advance" ? <Spinner /> : <ArrowRight size={13} strokeWidth={2} />}
                Advance
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
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4 dark:border-paper/10">
        <StageStepper stage={cycle.stage} />
      </div>
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