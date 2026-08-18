"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";

declare global {
    interface Window {

    }
}

export default function Forecast() {
    const fcChartRef = useRef<HTMLCanvasElement>(null);
    const peakChartRef = useRef<HTMLCanvasElement>(null);
    const seasonChartRef = useRef<HTMLCanvasElement>(null);

    const fcChartInstance = useRef<Chart | null>(null);
    const peakChartInstance = useRef<Chart | null>(null);
    const seasonChartInstance = useRef<Chart | null>(null);

    const showToast = (message: string, type: string = "info") => {
        alert(message);
    };

    useEffect(() => {
        if (typeof window === "undefined") return;

        function getElement<T extends HTMLElement>(id: string): T | null {
            return document.getElementById(id) as T | null;
        }

        function createCharts() {
            if (fcChartInstance.current) {
                fcChartInstance.current.destroy();
                fcChartInstance.current = null;
            }
            if (peakChartInstance.current) {
                peakChartInstance.current.destroy();
                peakChartInstance.current = null;
            }
            if (seasonChartInstance.current) {
                seasonChartInstance.current.destroy();
                seasonChartInstance.current = null;
            }

            const isDark = document.documentElement.classList.contains('dark');
            const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
            const textColor = isDark ? '#8a8a8e' : '#64748B';

            if (fcChartRef.current && Chart) {
                const days = Array.from({ length: 14 }, (_, i) => `D+${i + 1}`);
                const actual = [1284, null, null, null, null, null, null, null, null, null, null, null, null, null];
                const forecast = [1300, 1516, 1420, 1380, 1400, 1490, 1620, 1580, 1440, 1360, 1410, 1500, 1610, 1670];
                const upper = forecast.map((v) => Math.round(v * 1.08));
                const lower = forecast.map((v) => Math.round(v * 0.92));

                fcChartInstance.current = new Chart(fcChartRef.current, {
                    type: "line",
                    data: {
                        labels: days,
                        datasets: [
                            {
                                label: "Upper bound",
                                data: upper,
                                borderColor: "transparent",
                                backgroundColor: isDark ? "rgba(229,22,126,0.12)" : "rgba(236,72,153,.08)",
                                fill: "+1",
                                pointRadius: 0,
                                tension: 0.35,
                            },
                            {
                                label: "Lower bound",
                                data: lower,
                                borderColor: "transparent",
                                backgroundColor: "transparent",
                                fill: false,
                                pointRadius: 0,
                                tension: 0.35,
                            },
                            {
                                label: "Forecast",
                                data: forecast,
                                borderColor: isDark ? "#e5167e" : "#EC4899",
                                borderWidth: 2,
                                tension: 0.35,
                                pointRadius: 0,
                            },
                            {
                                label: "Actual",
                                data: actual,
                                borderColor: isDark ? "#f1f1f1" : "#0F172A",
                                borderWidth: 2,
                                tension: 0.35,
                                pointRadius: 3,
                            },
                        ],
                    },
                    options: {
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    usePointStyle: true,
                                    color: textColor,
                                    filter: (i: any) => !/bound/i.test(i.text),
                                },
                            },
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: textColor }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: textColor }
                            },
                        },
                    },
                });
            }

            if (peakChartRef.current && Chart) {
                peakChartInstance.current = new Chart(peakChartRef.current, {
                    type: "bar",
                    data: {
                        labels: ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"],
                        datasets: [
                            {
                                label: "Predicted",
                                data: [40, 90, 150, 220, 205, 170, 140, 180, 210, 170, 130, 90],
                                backgroundColor: isDark ? "#e5167e" : "#EC4899",
                                borderRadius: 6,
                                barThickness: 14,
                            },
                        ],
                    },
                    options: {
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: textColor }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: textColor }
                            },
                        },
                    },
                });
            }

            if (seasonChartRef.current && Chart) {
                seasonChartInstance.current = new Chart(seasonChartRef.current, {
                    type: "line",
                    data: {
                        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                        datasets: [
                            {
                                label: "2025",
                                data: [22, 24, 26, 25, 27, 29, 31, 30, 32, 36, 42, 48],
                                borderColor: isDark ? "#6a6a6e" : "#94A3B8",
                                borderWidth: 2,
                                tension: 0.35,
                                pointRadius: 0,
                            },
                            {
                                label: "2026 (fcst)",
                                data: [24, 26, 29, 28, 30, 33, 35, 34, 37, 42, 48, 55],
                                borderColor: isDark ? "#e5167e" : "#EC4899",
                                borderWidth: 2,
                                tension: 0.35,
                                pointRadius: 0,
                                borderDash: [6, 4],
                            },
                        ],
                    },
                    options: {
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    usePointStyle: true,
                                    color: textColor,
                                },
                            },
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: textColor }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: textColor }
                            },
                        },
                    },
                });
            }
        }

        createCharts();

        const observer = new MutationObserver(() => {
            createCharts();
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        const retrainBtn = document.querySelector(
            'button[onclick*="Retrain model"]'
        ) as HTMLElement | null;
        if (retrainBtn) {
            retrainBtn.addEventListener("click", () => {
                showToast("Model retraining queued", "info");
            });
        }

        const exportBtn = document.querySelector(
            'button[onclick*="Export report"]'
        ) as HTMLElement | null;
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                showToast("Forecast report exported", "info");
            });
        }

        return () => {
            observer.disconnect();
            if (fcChartInstance.current) {
                fcChartInstance.current.destroy();
                fcChartInstance.current = null;
            }
            if (peakChartInstance.current) {
                peakChartInstance.current.destroy();
                peakChartInstance.current = null;
            }
            if (seasonChartInstance.current) {
                seasonChartInstance.current.destroy();
                seasonChartInstance.current = null;
            }
        };
    }, []);

    return (
        <SessionGuard requiredRole={['Admin', 'Executive']}>
            <div className="p-4 sm:p-6 space-y-6 fade-in 
                            bg-white dark:bg-ink 
                            rounded-xl mx-4 sm:mx-6 my-4
                            shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] 
                            dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4),0_8px_10px_-6px_rgba(0,0,0,0.3)]
                            border border-transparent dark:border-ink/20">

                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl 
                                      bg-pink-50 dark:bg-pink-950/30 
                                      border border-pink-100 dark:border-pink-800/30 
                                      flex items-center justify-center 
                                      text-pink-600 dark:text-pink-400 
                                      text-xl shadow-2xs shrink-0">
                            <i className="fas fa-chart-line"></i>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Forecast Analytics
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Prophet-powered predictions for parcel volume, peak hours and seasonality.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            className="px-3.5 py-2 
                                      bg-white dark:bg-ink/60 
                                      hover:bg-slate-50 dark:hover:bg-ink/80 
                                      text-slate-700 dark:text-slate-300 
                                      border border-slate-200/80 dark:border-ink/30 
                                      rounded-xl text-xs sm:text-sm font-semibold 
                                      transition-all flex items-center gap-2 
                                      shadow-2xs active:scale-[0.98]"
                            onClick={() => showToast("Model retraining queued", "info")}
                        >
                            <i className="fas fa-rotate text-xs text-slate-400 dark:text-slate-500"></i>
                            <span>Retrain Model</span>
                        </button>

                        <button
                            type="button"
                            className="px-4 py-2 
                                      bg-pink-500 dark:bg-accent 
                                      hover:bg-pink-600 dark:hover:bg-accent-dark 
                                      text-white rounded-xl text-xs sm:text-sm font-semibold 
                                      transition-all flex items-center gap-2 
                                      shadow-2xs hover:shadow-pink-500/20 
                                      active:scale-[0.98]"
                            onClick={() => showToast("Forecast report exported", "info")}
                        >
                            <i className="fas fa-download text-xs"></i>
                            <span>Export Report</span>
                        </button>
                    </div>
                </div>

                <div className="card p-5 border-l-4 border-l-pink-500! 
                               bg-white dark:bg-ink/60 
                               border border-slate-200/60 dark:border-ink/20">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl brand-gradient text-white flex items-center justify-center text-xl">
                            ✨
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white">AI insight</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                Tomorrow's parcel volume is predicted to increase by <b>18%</b>.
                                Prepare additional staff between <b>9:00 AM and 12:00 PM</b> and pre-stage Area B for Shopee Express
                                overflow.
                            </p>
                        </div>
                        <span className="chip status-approved dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30">
                            Confidence 92%
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card kpi bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20">
                        <div className="label text-slate-500 dark:text-slate-400">Tomorrow forecast</div>
                        <div className="value text-slate-900 dark:text-white">1,516</div>
                        <div className="delta delta-up text-emerald-600 dark:text-emerald-400">▲ 18%</div>
                    </div>
                    <div className="card kpi bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20">
                        <div className="label text-slate-500 dark:text-slate-400">Weekly forecast</div>
                        <div className="value text-slate-900 dark:text-white">9,240</div>
                        <div className="delta delta-up text-emerald-600 dark:text-emerald-400">▲ 6.4%</div>
                    </div>
                    <div className="card kpi bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20">
                        <div className="label text-slate-500 dark:text-slate-400">Monthly forecast</div>
                        <div className="value text-slate-900 dark:text-white">38,800</div>
                        <div className="delta delta-up text-emerald-600 dark:text-emerald-400">▲ 4.1%</div>
                    </div>
                    <div className="card kpi bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20">
                        <div className="label text-slate-500 dark:text-slate-400">Forecast accuracy</div>
                        <div className="value text-slate-900 dark:text-white">94.6%</div>
                        <div className="delta delta-up text-emerald-600 dark:text-emerald-400">MAPE 5.4%</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="card p-5 xl:col-span-2 
                                   bg-white dark:bg-ink/60 
                                   border border-slate-200/60 dark:border-ink/20">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-900 dark:text-white">
                                Forecast vs actual — next 14 days
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Prophet · daily granularity</div>
                        </div>
                        <canvas ref={fcChartRef} className="mt-3" height="120"></canvas>
                    </div>
                    <div className="card p-5 
                                   bg-white dark:bg-ink/60 
                                   border border-slate-200/60 dark:border-ink/20">
                        <div className="font-semibold text-slate-900 dark:text-white">Peak hour prediction</div>
                        <canvas ref={peakChartRef} className="mt-3" height="200"></canvas>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Peak intake at <b>10:00 AM</b>. Dispatch window peaks between <b>1:00 – 3:00 PM</b>.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="card p-5 
                                   bg-white dark:bg-ink/60 
                                   border border-slate-200/60 dark:border-ink/20">
                        <div className="font-semibold text-slate-900 dark:text-white">Seasonal trend</div>
                        <canvas ref={seasonChartRef} className="mt-3" height="180"></canvas>
                    </div>
                    <div className="card p-5 
                                   bg-white dark:bg-ink/60 
                                   border border-slate-200/60 dark:border-ink/20">
                        <div className="font-semibold text-slate-900 dark:text-white">Management recommendations</div>
                        <ul className="mt-3 space-y-3 text-sm">
                            <li className="p-3 rounded-xl 
                                          bg-pink-50/60 dark:bg-pink-950/20 
                                          border border-pink-100 dark:border-pink-800/30">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                    Add 2 sorting staff between 9–12 tomorrow
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Predicted 18% volume spike vs today.
                                </div>
                            </li>
                            <li className="p-3 rounded-xl 
                                          border border-slate-100 dark:border-ink/20">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                    Pre-stage Area B for Shopee Express
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Shopee share is trending +6% this week.
                                </div>
                            </li>
                            <li className="p-3 rounded-xl 
                                          border border-slate-100 dark:border-ink/20">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                    Order thermal rolls this week
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Consumption forecast exceeds inventory in 9 days.
                                </div>
                            </li>
                            <li className="p-3 rounded-xl 
                                          border border-slate-100 dark:border-ink/20">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                    Book VH-004 for maintenance Friday
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Predicted downtime avoided by preventive service.
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </SessionGuard>
    );
}