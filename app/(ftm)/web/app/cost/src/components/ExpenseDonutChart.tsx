"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  ArcElement,
  DoughnutController,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

Chart.register(ArcElement, DoughnutController, Tooltip);

export interface ExpenseSlice {
  label: string;
  percent: number;
  color: string;
}

interface ExpenseDonutChartProps {
  breakdown: ExpenseSlice[];
  onClick?: () => void;
  title?: string;
}

export default function ExpenseDonutChart({ breakdown, onClick, title }: ExpenseDonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config = {
      type: "doughnut",
      data: {
        labels: breakdown.map((s) => s.label),
        datasets: [
          {
            data: breakdown.map((s) => s.percent),
            backgroundColor: breakdown.map((s) => s.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed}%`,
            },
          },
        },
      },
    } as ChartConfiguration;

    chartRef.current = new Chart(ctx, config);

    return () => {
      chartRef.current?.destroy();
    };
  }, [breakdown]);

  return <canvas ref={canvasRef} onClick={onClick} className="cursor-pointer" title={title} />;
}
