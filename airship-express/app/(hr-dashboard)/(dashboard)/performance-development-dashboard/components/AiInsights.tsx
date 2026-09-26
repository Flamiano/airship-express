"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  PencilLine,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Button, Card, Chip, SkeletonRegion } from "./ui";

const API_BASE = "/performance-development-dashboard/api";

type InsightPayload = {
  success: boolean;
  source: "gemini" | "heuristic";
  subjectName: string;
  scope: "self" | "org";
  insufficientData: boolean;
  insights: {
    summary: string;
    strengths: string[];
    developmentAreas: string[];
    recommendedActions: string[];
    recommendedLearning: string[];
    attention: string[];
  };
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: InsightPayload };

type SectionProps = {
  title?: string;
  items: string[];
  tone?: "strength" | "development" | "action" | "learning" | "attention";
};

function SectionList({ title, items, tone = "action" }: SectionProps) {
  if (!items || items.length === 0) return null;
  const iconClass = {
    strength: "text-green-600 dark:text-green-400",
    development: "text-amber-600 dark:text-amber-400",
    action: "text-accent",
    learning: "text-sky-600 dark:text-sky-400",
    attention: "text-red-600 dark:text-red-400",
  }[tone];
  const Icon = {
    strength: CheckCircle2,
    development: PencilLine,
    action: Target,
    learning: BrainCircuit,
    attention: ShieldAlert,
  }[tone];
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title ?? "AI recommendation"}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink dark:text-paper">
            <Icon size={13} className={`mt-0.5 shrink-0 ${iconClass}`} aria-hidden />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiInsights() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [activeSection, setActiveSection] = useState<
    "strengths" | "development" | "actions" | "learning"
  >("strengths");

  const run = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`${API_BASE}/ai-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let message = "Something went wrong generating insights.";
        try {
          const err = (await res.json()) as { error?: string };
          if (err?.error) message = err.error;
        } catch {
          /* keep default message */
        }
        setState({ status: "error", message });
        return;
      }
      const payload = (await res.json()) as InsightPayload;
      setState({ status: "ready", payload });
    } catch {
      setState({
        status: "error",
        message: "Unable to reach the insights service. Please try again.",
      });
    }
  }, []);

  const isGenerating = state.status === "loading";

  return (
    <Card className="border-accent/25 bg-accent/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink dark:text-paper">
              AI Insights
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Generate an on-demand summary of performance and development
              signals.
            </p>
          </div>
        </div>
        <Button
          onClick={run}
          loading={isGenerating}
          disabled={isGenerating}
          variant="secondary"
          className="h-9 shrink-0 text-[13px]"
        >
          {state.status === "ready" ? (
            <>
              <RefreshCw size={14} /> Refresh
            </>
          ) : (
            <>
              <Sparkles size={14} /> Generate insights
            </>
          )}
        </Button>
      </div>

      {state.status === "idle" && (
        <div className="mt-4">
          <p className="rounded-lg border border-dashed border-accent/30 bg-paper/40 px-4 py-3 text-[13px] leading-relaxed text-muted dark:bg-ink/40">
            Generate a personal snapshot of how things are tracking. The AI
            reviews:
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink dark:text-paper">
            {["Goals", "Feedback", "Appraisals", "Competencies", "Learning activity"].map(
              (label, i) => (
                <span key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-muted" aria-hidden>
                      ·
                    </span>
                  )}
                  <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11.5px] text-muted dark:border-paper/15 dark:bg-ink">
                    {label}
                  </span>
                </span>
              )
            )}
          </p>
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded-lg border border-red-600/25 bg-red-600/5 px-4 py-3 text-[13px] text-red-700 dark:text-red-400">
          {state.message}
        </div>
      )}

      {state.status === "loading" && (
        <SkeletonRegion label="Generating AI insights…" className="mt-4">
          <div className="flex flex-col gap-3">
            <div className="h-3 w-3/4 animate-pulse rounded-md bg-line dark:bg-paper/15" />
            <div className="h-3 w-full animate-pulse rounded-md bg-line dark:bg-paper/15" />
            <div className="h-3 w-5/6 animate-pulse rounded-md bg-line dark:bg-paper/15" />
          </div>
        </SkeletonRegion>
      )}

      {state.status === "ready" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {state.payload.scope === "org" ? "Team-wide" : state.payload.subjectName}
            </Badge>
            {state.payload.insufficientData && (
              <Badge variant="warning">Limited data</Badge>
            )}
          </div>

          {state.payload.insufficientData ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-400">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>{state.payload.insights.summary}</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <p
                className="rounded-lg border border-accent/20 bg-accent/[0.04] px-4 py-3 text-[13.5px] leading-relaxed text-ink dark:text-paper"
                title={
                  state.payload.source === "gemini"
                    ? "Generated by Gemini"
                    : "Heuristic analysis"
                }
              >
                {state.payload.insights.summary}
              </p>

              <div
                className="mt-3 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Insight categories"
              >
                <Chip
                  active={activeSection === "strengths"}
                  onClick={() => setActiveSection("strengths")}
                >
                  Strengths
                </Chip>
                <Chip
                  active={activeSection === "development"}
                  onClick={() => setActiveSection("development")}
                >
                  Development areas
                </Chip>
                <Chip
                  active={activeSection === "actions"}
                  onClick={() => setActiveSection("actions")}
                >
                  Recommended actions
                </Chip>
                <Chip
                  active={activeSection === "learning"}
                  onClick={() => setActiveSection("learning")}
                >
                  Recommended learning
                </Chip>
              </div>

              <div className="mt-3">
                {activeSection === "strengths" && (
                  <SectionList
                    title="Strengths"
                    items={state.payload.insights.strengths}
                    tone="strength"
                  />
                )}
                {activeSection === "development" && (
                  <SectionList
                    title="Development areas"
                    items={state.payload.insights.developmentAreas}
                    tone="development"
                  />
                )}
                {activeSection === "actions" && (
                  <SectionList
                    title="Recommended actions"
                    items={state.payload.insights.recommendedActions}
                    tone="action"
                  />
                )}
                {activeSection === "learning" && (
                  <SectionList
                    title="Recommended learning"
                    items={state.payload.insights.recommendedLearning}
                    tone="learning"
                  />
                )}
              </div>

              <div className="mt-4">
                <SectionList
                  title="Attention / risk indicators"
                  items={state.payload.insights.attention}
                  tone="attention"
                />
              </div>
            </div>
          )}

          <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted dark:border-paper/15">
            AI-generated recommendations are guidance only. Always confirm
            against your actual records before acting.
          </p>
        </div>
      )}
    </Card>
  );
}
