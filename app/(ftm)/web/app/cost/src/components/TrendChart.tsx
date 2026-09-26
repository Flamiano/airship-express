"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

interface TrendData {
  labels: string[];
  actual: number[];
  planned: number[];
  trendLine: number[];
}

interface TrendChartProps {
  trendData: TrendData;
}

export default function TrendChart({ trendData }: TrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const yMax = Math.max(...trendData.actual, ...trendData.planned, 60);

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: trendData.labels,
        datasets: [
          {
            label: "Planned",
            data: trendData.planned,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.18)",
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Actual",
            data: trendData.actual,
            borderColor: "#ef489d",
            backgroundColor: "rgba(239, 72, 157, 0.18)",
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 250,
        },
        scales: {
          y: {
            beginAtZero: true,
            max: yMax,
            ticks: {
              callback: (value) => `${value}k`,
              stepSize: Math.max(10, Math.round(yMax / 5)),
              color: "#6b7280",
            },
            grid: {
              color: "#dfe3e8",
            },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#6b7280", maxTicksLimit: 10 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y}k`,
            },
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
      },
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      chartRef.current?.destroy();
    };
  }, [trendData]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
