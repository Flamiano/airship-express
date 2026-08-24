"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip
);

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

    const config: ChartConfiguration = {
      type: "bar",
      data: {
        labels: trendData.labels,
        datasets: [
          {
            type: "line",
            label: "Trend",
            data: trendData.trendLine,
            borderColor: "#b80049",
            backgroundColor: "#b80049",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            order: 1,
          },
          {
            type: "bar",
            label: "Planned",
            data: trendData.planned,
            backgroundColor: "#2563eb",
            barPercentage: 0.8,
            categoryPercentage: 0.4,
            order: 2,
          },
          {
            type: "bar",
            label: "Actual",
            data: trendData.actual,
            backgroundColor: "#fb923c",
            barPercentage: 0.8,
            categoryPercentage: 0.4,
            order: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: Math.max(...trendData.actual, ...trendData.planned, 60),
            ticks: {
              callback: (value) => `${value}k`,
              stepSize: Math.max(10, Math.round(Math.max(...trendData.actual, ...trendData.planned) / 3)),
            },
            grid: { color: "#e5e2e1" },
          },
          x: {
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
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

  return <canvas ref={canvasRef} />;
}
