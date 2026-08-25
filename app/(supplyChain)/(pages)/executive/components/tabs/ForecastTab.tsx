"use client";

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface ForecastTabProps {
    data: ExecutiveDataPayload;
    onOpenModal: (reportType: string, extraData?: any) => void;
}

const CHART_COLORS = {
    primary: '#EC4899',
    secondary: '#6366F1',
    success: '#10B981',
};

export default function ForecastTab({ data, onOpenModal }: ForecastTabProps) {
    const forecastCanvasRef = useRef<HTMLCanvasElement>(null);
    const forecastInstance = useRef<Chart | null>(null);
    const [forecastApiData, setForecastApiData] = useState<any>(null);
    const [loadingForecast, setLoadingForecast] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function loadWasmForecast() {
            try {
                const res = await fetch('/forecast/api');
                if (res.ok) {
                    const json = await res.json();
                    if (isMounted && json.success) {
                        setForecastApiData(json);
                    }
                }
            } catch (err) {
                console.warn("Forecast API fetch error in executive tab:", err);
            } finally {
                if (isMounted) setLoadingForecast(false);
            }
        }
        loadWasmForecast();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#fcfbf9' : '#1c1b1f';
        const mutedColor = '#6b6b76';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        if (forecastCanvasRef.current) {
            if (forecastInstance.current) forecastInstance.current.destroy();
            const ctx = forecastCanvasRef.current.getContext('2d');
            if (ctx) {
                let labels: string[] = [];
                let actualSeries: (number | null)[] = [];
                let forecastSeries: (number | null)[] = [];

                if (forecastApiData?.parcel_7_day) {
                    const p7 = forecastApiData.parcel_7_day;
                    const histLabels = p7.historical?.display_dates || data.dailyTrend.map(t => t.dayLabel);
                    const histCounts = p7.historical?.display_counts || data.dailyTrend.map(t => t.receivedCount);
                    const fcDates = p7.dates || [];
                    const fcValues = p7.predictions || [];

                    labels = [...histLabels, ...fcDates.map((d: string) => `Fcst ${d.slice(5)}`)];
                    actualSeries = [...histCounts, ...fcValues.map(() => null)];
                    
                    const connectVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : null;
                    forecastSeries = [...histCounts.map(() => null), ...fcValues];
                    if (actualSeries.length > histCounts.length && connectVal !== null) {
                        forecastSeries[histCounts.length - 1] = connectVal;
                    }
                } else {
                    labels = data.dailyTrend.map(t => t.dayLabel);
                    actualSeries = data.dailyTrend.map(t => t.receivedCount);
                    forecastSeries = data.dailyTrend.map(t => t.receivedCount);
                }

                forecastInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Actual Supabase Parcel Data',
                                data: actualSeries,
                                borderColor: CHART_COLORS.primary,
                                backgroundColor: `${CHART_COLORS.primary}20`,
                                fill: true,
                                tension: 0.3,
                            },
                            {
                                label: '7-Day WASM Forecast Prediction',
                                data: forecastSeries,
                                borderColor: CHART_COLORS.secondary,
                                borderDash: [6, 6],
                                backgroundColor: 'transparent',
                                tension: 0.3,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: textColor, font: { size: 11 } } }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: mutedColor } },
                            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: mutedColor, stepSize: 1 } }
                        }
                    }
                });
            }
        }

        return () => {
            if (forecastInstance.current) forecastInstance.current.destroy();
        };
    }, [data, forecastApiData]);

    const p7 = forecastApiData?.parcel_7_day;
    const nextWeekTotal = p7?.total_next_week ?? 0;
    const confidenceLevel = p7?.confidence ?? "N/A";
    const modelUsed = p7?.model_used ?? "Time Series Statistical Model";

    return (
        <div className="space-y-6">
            <div
                onClick={() => onOpenModal('forecast', forecastApiData)}
                className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-pink-300 dark:hover:border-pink-800 transition-all cursor-pointer group"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-chart-line text-pink-500"></i>
                        <span>Parcel Volume: Actual Supabase Data → 7-Day WASM Prediction</span>
                        {/* Hover info badge ! with details about chart */}
                        <div className="relative group/tooltip inline-block" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                aria-label="Chart information"
                            >
                                !
                            </button>
                            <div className="absolute left-0 top-full mt-2 hidden group-hover/tooltip:block group-focus-within/tooltip:block w-64 p-3 bg-slate-900 text-white dark:bg-slate-950 dark:text-slate-100 text-[11px] rounded-xl shadow-2xl z-50 pointer-events-none border border-slate-700/90 dark:border-slate-700 leading-snug">
                                <p className="font-bold text-pink-400">Chart Details</p>
                                <p className="text-slate-200 dark:text-slate-300 mt-1">Executes Holt-Winters additive time-series forecasting via @sipemu/anofox-forecast Rust/WASM engine over real historical parcel dates.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {loadingForecast && (
                            <span className="text-xs text-slate-400 font-mono animate-pulse">Running Rust/WASM Engine...</span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('forecast', forecastApiData); }}
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            Inspect WASM Modal
                        </button>
                    </div>
                </div>
                <div className="h-72 relative">
                    <canvas ref={forecastCanvasRef} />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projected Next 7 Days Volume</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {nextWeekTotal.toLocaleString()} parcels
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sum of predicted daily intake</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statistical Confidence Level</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {confidenceLevel}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Engine: @sipemu/anofox-forecast</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forecasting Model Applied</p>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 line-clamp-1">
                        {modelUsed}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Calculated from historical parcels table</p>
                </div>
            </div>
        </div>
    );
}
