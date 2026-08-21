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

export interface CostDriver {
  rank: number;
  label: string;
  percent: string;
}

interface TopCostDriversPieChartProps {
  drivers: CostDriver[];
}

export default function TopCostDriversPieChart({ drivers }: TopCostDriversPieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const driverValues = drivers.map((driver) => Number.parseFloat(driver.percent));
    const config: ChartConfiguration<"pie"> = {
      type: "pie",
      data: {
        labels: drivers.map((driver) => driver.label),
        datasets: [
          {
            label: "Top Cost Driver Share",
            data: driverValues,
            backgroundColor: [
              "#b80049",
              "#4f8dff",
              "#23a47f",
              "#f39c12",
              "#7367f0",
            ],
            borderColor: "#ffffff",
            borderWidth: 2,
            hoverOffset: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      chartRef.current?.destroy();
    };
  }, [drivers]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
