"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  ArcElement,
  PieController,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

Chart.register(ArcElement, PieController, Tooltip);

type Insight = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  valueSuffix?: string;
  borderLeft?: boolean;
};

const pieColors = ["#ec4899", "#f43f5e", "#8b5cf6", "#10b981", "#f59e0b", "#38bdf8"];

export default function CostOptimizationInsights({ insights }: { insights: Insight[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || insights.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const values = insights.map((insight) => {
      const parsed = Number.parseFloat((insight.value ?? "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    });

    const chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: insights.map((insight) => insight.label),
        datasets: [
          {
            data: values,
            backgroundColor: insights.map((_, index) => pieColors[index % pieColors.length]),
            borderColor: "#ffffff",
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 350,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed}%`,
            },
          },
        },
      },
    } satisfies ChartConfiguration<"pie">);

    return () => {
      chart.destroy();
    };
  }, [insights]);

  return (
    <div className="cost-panel flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pink-600">Financial overview</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Cost Optimization Insights
          </h3>
        </div>
        <span className="material-symbols-outlined rounded-lg bg-pink-50 p-2 text-xl text-pink-600">insights</span>
      </div>

      {insights.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,150px)_1fr] items-center gap-4">
          <div className="h-32 w-full">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>

          <div className="space-y-2.5">
            {insights.map((insight, index) => (
              <div key={insight.label} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  />
                  <span className="truncate text-xs font-medium text-slate-600">{insight.label}</span>
                </div>
                <span className={`text-xs font-bold ${insight.valueColor || "text-pink-600"}`}>
                  {insight.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl bg-slate-50 text-sm text-secondary">
          No financial insight data yet.
        </div>
      )}
    </div>
  );
}
