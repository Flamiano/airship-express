"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import {
  Skeleton,
  SkeletonRegion,
  SkeletonText,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/Skeleton";
import { fadeUp } from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";

type Insights = {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
};

type AiInsightsResponse = {
  success: boolean;
  mock: boolean;
  insights: Insights;
};

const DEMO_PAYLOAD = {
  employee: {
    name: "Demo Employee",
    role: "Employee",
  },
  goals: [
    {
      title: "Complete assigned performance goals",
    },
  ],
  appraisal: {},
  feedback: [
    {
      message: "Consistently contributes to team objectives",
      feedback_type: "positive",
    },
  ],
  competencies: [
    {
      name: "Communication",
      score: 85,
    },
  ],
};

export default function AiInsights() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/performance-development-dashboard/api/ai-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEMO_PAYLOAD),
        });
        if (!res.ok) throw new Error("Failed to load AI insights");
        const json: AiInsightsResponse = await res.json();
        if (cancelled) return;
        setMock(Boolean(json.mock));
        setInsights(json.insights || null);
      } catch {
        if (!cancelled) {
          setError("Could not load AI insights. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasInsights =
    insights !== null &&
    (insights.summary ||
      (Array.isArray(insights.strengths) && insights.strengths.length > 0) ||
      (Array.isArray(insights.areasForImprovement) &&
        insights.areasForImprovement.length > 0) ||
      (Array.isArray(insights.recommendations) &&
        insights.recommendations.length > 0));

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-bricolage text-lg font-semibold tracking-tight">
              {mock ? "Demo AI Insights" : "AI Performance Insights"}
              <Badge variant={mock ? "warning" : "success"}>
                {mock ? "Demo" : "Live"}
              </Badge>
            </h2>
            <p className="text-[12.5px] text-muted">
              Highlights surfaced from team activity.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="ai-insights-panel"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:border-paper/15 dark:bg-ink dark:text-paper"
        >
          {open ? "Hide Insights" : "Show Insights"}
          <ChevronDown
            size={14}
            aria-hidden
            className={`transition-transform duration-200 motion-reduce:transition-none ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
      </div>

      {open && (
        <motion.div
          id="ai-insights-panel"
          variants={fadeUp}
          initial="hidden"
          animate="shown"
          className="mt-4"
        >
          {loading && (
            <SkeletonRegion label="Loading AI insights…">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-line bg-paper p-5 dark:border-paper/15 dark:bg-ink"
                  >
                    <Skeleton className="mb-3 h-4 w-24" />
                    <SkeletonText lines={3} />
                  </div>
                ))}
              </div>
            </SkeletonRegion>
          )}

          {!loading && error && (
            <Card className="p-5">
              <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
            </Card>
          )}

          {!loading && !error && !hasInsights && (
            <Card className="p-5">
              <p className="text-[13px] text-muted">
                No AI insights available right now.
              </p>
            </Card>
          )}

          {!loading && !error && hasInsights && insights && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5 sm:col-span-2 lg:col-span-2">
                <Badge variant="neutral">Summary</Badge>
                <p className="mt-3 text-[13px] leading-relaxed text-ink dark:text-paper">
                  {insights.summary}
                </p>
              </Card>

              <Card className="p-5">
                <Badge variant="success">Strengths</Badge>
                <ul className="mt-3 flex flex-col gap-2">
                  {insights.strengths.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] leading-relaxed text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-5">
                <Badge variant="warning">Areas for Improvement</Badge>
                <ul className="mt-3 flex flex-col gap-2">
                  {insights.areasForImprovement.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] leading-relaxed text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-5">
                <Badge variant="neutral">Recommendations</Badge>
                <ul className="mt-3 flex flex-col gap-2">
                  {insights.recommendations.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] leading-relaxed text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
}
