"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Chart from "chart.js/auto";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { toast } from "sonner";

interface ForecastData {
    raw_db_stats: {
        total_parcels_in_db: number;
        total_pos_in_db: number;
        courier_breakdown: Record<string, number>;
        status_breakdown: Record<string, number>;
    };
    parcel_7_day: {
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        confidence: string;
        dates: string[];
        historical: {
            dates: string[];
            counts: number[];
            total_actual: number;
        };
    };
    expense_next_month: {
        prediction: number;
        confidence_interval: {
            lower: number;
            upper: number;
        };
        confidence: string;
        historical: {
            months: string[];
            amounts: number[];
            total_actual: number;
        };
    };
    timestamp: string;
}

export default function Forecast() {
    const [loading, setLoading] = useState(true);
    const [retraining, setRetraining] = useState(false);
    const [forecastData, setForecastData] = useState<ForecastData | null>(null);

    const parcelChartRef = useRef<HTMLCanvasElement>(null);
    const expenseChartRef = useRef<HTMLCanvasElement>(null);
    const courierPieRef = useRef<HTMLCanvasElement>(null);

    const parcelChartInstance = useRef<Chart | null>(null);
    const expenseChartInstance = useRef<Chart | null>(null);
    const courierPieInstance = useRef<Chart | null>(null);

    const fetchForecast = useCallback(async (showNotification: boolean = false) => {
        try {
            if (showNotification) setRetraining(true);
            const res = await fetch("/api/supplyChain/forecast", { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                setForecastData(data);
                if (showNotification) {
                    toast.success("Forecast models synced with Supabase database!");
                }
            } else {
                throw new Error(data.error || "Failed to load forecast data");
            }
        } catch (err: any) {
            console.error("Forecast fetch error:", err);
            toast.error(err.message || "Failed to fetch forecasts");
        } finally {
            setLoading(false);
            setRetraining(false);
        }
    }, []);

    useEffect(() => {
        fetchForecast();
    }, [fetchForecast]);

    useEffect(() => {
        if (typeof window === "undefined" || !forecastData || loading) return;

        const timer = setTimeout(() => {
            const isDark = document.documentElement.classList.contains("dark");
            const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
            const textColor = isDark ? "#8a8a8e" : "#64748B";

            // 1. Next 7 Days Parcel Volume Chart
            if (parcelChartRef.current && forecastData?.parcel_7_day?.historical?.counts?.length) {
                if (parcelChartInstance.current) {
                    parcelChartInstance.current.destroy();
                    parcelChartInstance.current = null;
                }

                const ctx = parcelChartRef.current.getContext("2d");
                if (ctx) {
                    const histDates = forecastData.parcel_7_day.historical.dates || [];
                    const histCounts = forecastData.parcel_7_day.historical.counts || [];
                    const fcDates = forecastData.parcel_7_day.dates || [];
                    const fcValues = forecastData.parcel_7_day.predictions || [];
                    const fcUpper = forecastData.parcel_7_day.confidence_interval.upper || [];
                    const fcLower = forecastData.parcel_7_day.confidence_interval.lower || [];

                    const histLabels = histDates.map(d => {
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[1]}/${parts[2]} (Actual)` : d;
                    });
                    const fcLabels = fcDates.map((d, i) => {
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[1]}/${parts[2]} (Fcst D+${i+1})` : `D+${i+1}`;
                    });

                    const allLabels = [...histLabels, ...fcLabels];

                    const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
                    const lastHistValue = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
                    const forecastSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcValues];
                    const upperSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcUpper];
                    const lowerSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcLower];

                    parcelChartInstance.current = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: allLabels,
                            datasets: [
                                {
                                    label: "Upper 95% Confidence Bound",
                                    data: upperSeries,
                                    borderColor: "transparent",
                                    backgroundColor: isDark ? "rgba(229,22,126,0.15)" : "rgba(236,72,153,0.12)",
                                    fill: "+1",
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: "Lower 95% Confidence Bound",
                                    data: lowerSeries,
                                    borderColor: "transparent",
                                    backgroundColor: "transparent",
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: "Actual Data",
                                    data: actualSeries,
                                    borderColor: isDark ? "#38bdf8" : "#0284C7",
                                    backgroundColor: isDark ? "#38bdf8" : "#0284C7",
                                    borderWidth: 3,
                                    pointRadius: 5,
                                    pointHoverRadius: 7,
                                    tension: 0.25,
                                },
                                {
                                    label: "Predicted (Next 7 Days)",
                                    data: forecastSeries,
                                    borderColor: isDark ? "#e5167e" : "#EC4899",
                                    borderWidth: 2.5,
                                    borderDash: [6, 4],
                                    pointBackgroundColor: isDark ? "#e5167e" : "#EC4899",
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: "index", intersect: false },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: {
                                        boxWidth: 12,
                                        boxHeight: 12,
                                        usePointStyle: true,
                                        color: textColor,
                                        filter: (item: any) => !/Bound/i.test(item.text),
                                    },
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context: any) {
                                            if (context.raw === null || context.raw === undefined) return '';
                                            return ` ${context.dataset.label}: ${context.raw} parcels`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Parcel Count", color: textColor }
                                },
                            },
                        },
                    });
                }
            }

            // 2. Next Month Expense Forecast Chart
            if (expenseChartRef.current && (forecastData?.expense_next_month?.historical?.amounts?.length || forecastData?.expense_next_month?.prediction)) {
                if (expenseChartInstance.current) {
                    expenseChartInstance.current.destroy();
                    expenseChartInstance.current = null;
                }

                const ctx = expenseChartRef.current.getContext("2d");
                if (ctx) {
                    const histMonths = forecastData.expense_next_month.historical.months || [];
                    const histAmounts = forecastData.expense_next_month.historical.amounts || [];
                    const nextExpense = forecastData.expense_next_month.prediction || 0;
                    const nextLower = forecastData.expense_next_month.confidence_interval.lower || 0;
                    const nextUpper = forecastData.expense_next_month.confidence_interval.upper || 0;

                    const lastMonthStr = histMonths[histMonths.length - 1] || new Date().toISOString().slice(0, 7);
                    const [y, m] = lastMonthStr.split('-');
                    const nextDate = new Date(parseInt(y), parseInt(m), 1);
                    const nextMonthLabel = `${nextDate.toLocaleString('default', { month: 'short' })} ${nextDate.getFullYear()} (Predicted)`;

                    const allMonths = [
                        ...histMonths.map(mo => {
                            const [yr, mon] = mo.split('-');
                            const d = new Date(parseInt(yr), parseInt(mon) - 1, 1);
                            return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()} (Actual)`;
                        }),
                        nextMonthLabel
                    ];

                    const actualExpenseData = [...histAmounts, null];
                    const fcExpenseData = [...Array(histAmounts.length).fill(null), nextExpense];

                    expenseChartInstance.current = new Chart(ctx, {
                        type: "bar",
                        data: {
                            labels: allMonths,
                            datasets: [
                                {
                                    label: "Actual Paid PO Expenses (₱)",
                                    data: actualExpenseData,
                                    backgroundColor: isDark ? "rgba(56, 189, 248, 0.85)" : "rgba(2, 132, 199, 0.85)",
                                    borderRadius: 6,
                                },
                                {
                                    label: "Predicted Next Month (₱)",
                                    data: fcExpenseData,
                                    backgroundColor: isDark ? "rgba(229, 22, 126, 0.85)" : "rgba(236, 72, 153, 0.85)",
                                    borderRadius: 6,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, color: textColor },
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context: any) {
                                            if (context.raw === null) return '';
                                            if (context.dataIndex === allMonths.length - 1) {
                                                return [
                                                    ` Predicted: ₱${Number(context.raw).toLocaleString()}`,
                                                    ` 90% Range: ₱${nextLower.toLocaleString()} - ₱${nextUpper.toLocaleString()}`
                                                ];
                                            }
                                            return ` Actual: ₱${Number(context.raw).toLocaleString()}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor, callback: (val: any) => `₱${Number(val).toLocaleString()}` },
                                },
                            },
                        },
                    });
                }
            }

            // 3. Pie Chart: Courier Share
            if (courierPieRef.current && forecastData?.raw_db_stats?.courier_breakdown && Object.keys(forecastData.raw_db_stats.courier_breakdown).length > 0) {
                if (courierPieInstance.current) {
                    courierPieInstance.current.destroy();
                    courierPieInstance.current = null;
                }

                const ctx = courierPieRef.current.getContext("2d");
                if (ctx) {
                    const courierMap = forecastData.raw_db_stats.courier_breakdown;
                    const labels = Object.keys(courierMap);
                    const values = Object.values(courierMap);

                    const palette = [
                        '#e5167e', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6',
                        '#ec4899', '#06b6d4', '#84cc16', '#ef4444', '#6366f1',
                        '#14b8a6', '#f97316', '#a855f7', '#64748b'
                    ];

                    courierPieInstance.current = new Chart(ctx, {
                        type: "doughnut",
                        data: {
                            labels: labels,
                            datasets: [{
                                data: values,
                                backgroundColor: palette.slice(0, labels.length),
                                borderWidth: 2,
                                borderColor: isDark ? "#1e293b" : "#ffffff",
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: "right",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor, font: { size: 11 } }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context: any) {
                                            const total = values.reduce((a, b) => a + b, 0);
                                            const current = context.raw || 0;
                                            const pct = total > 0 ? ((current / total) * 100).toFixed(1) : "0.0";
                                            return ` ${context.label}: ${current} parcels (${pct}%)`;
                                        }
                                    }
                                }
                            },
                            cutout: "60%"
                        }
                    });
                }
            }
        }, 120);

        return () => {
            clearTimeout(timer);
            if (parcelChartInstance.current) {
                parcelChartInstance.current.destroy();
                parcelChartInstance.current = null;
            }
            if (expenseChartInstance.current) {
                expenseChartInstance.current.destroy();
                expenseChartInstance.current = null;
            }
            if (courierPieInstance.current) {
                courierPieInstance.current.destroy();
                courierPieInstance.current = null;
            }
        };
    }, [forecastData, loading]);

    const handleExport = () => {
        if (!forecastData) {
            toast.error("No forecast data available to export.");
            return;
        }

        const exportObj = {
            title: "Supply Chain Operational Forecast Report",
            generated_at: new Date().toISOString(),
            data_source: "Supabase Database (public.parcels & public.purchase_orders)",
            wasm_engine: "@sipemu/anofox-forecast (Rust/WASM)",
            total_db_parcels: forecastData.raw_db_stats.total_parcels_in_db,
            total_db_purchase_orders: forecastData.raw_db_stats.total_pos_in_db,
            next_7_day_parcel_forecast: {
                predictions: forecastData.parcel_7_day.predictions,
                confidence_interval_95_pct: forecastData.parcel_7_day.confidence_interval,
                total_projected_volume: forecastData.parcel_7_day.total_next_week,
                dates: forecastData.parcel_7_day.dates,
                historical_counts: forecastData.parcel_7_day.historical.counts
            },
            next_month_expense_forecast: {
                predicted_amount_php: forecastData.expense_next_month.prediction,
                confidence_interval_90_pct: forecastData.expense_next_month.confidence_interval,
                historical_monthly_totals: forecastData.expense_next_month.historical.amounts
            },
            courier_volume_breakdown: forecastData.raw_db_stats.courier_breakdown
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `operational-forecast-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Forecast report downloaded as JSON!");
    };

    const totalDbParcels = forecastData?.raw_db_stats?.total_parcels_in_db || 0;
    const weeklyTotal = forecastData?.parcel_7_day?.total_next_week || 0;
    const expensePrediction = forecastData?.expense_next_month?.prediction || 0;
    const expenseLower = forecastData?.expense_next_month?.confidence_interval?.lower || 0;
    const expenseUpper = forecastData?.expense_next_month?.confidence_interval?.upper || 0;

    const courierMap = forecastData?.raw_db_stats?.courier_breakdown || {};
    const sortedCouriers = useMemo(() => {
        return Object.entries(courierMap).sort((a, b) => b[1] - a[1]);
    }, [courierMap]);

    const hasParcelData = (forecastData?.parcel_7_day?.historical?.counts?.length || 0) > 0 || (forecastData?.parcel_7_day?.predictions?.length || 0) > 0;
    const hasExpenseData = (forecastData?.expense_next_month?.historical?.amounts?.length || 0) > 0 || (forecastData?.expense_next_month?.prediction || 0) > 0;
    const hasCourierData = Object.keys(courierMap).length > 0;

    return (
        <SessionGuard requiredRole={['Admin', 'Employee', 'Executive']}>
            <div className="p-6 space-y-6 fade-in bgCard pb-16">
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 transition-colors">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-800/40 flex items-center justify-center text-pink-600 dark:text-pink-400 text-xl shadow-2xs shrink-0 mt-0.5 transition-colors">
                            <i className="fas fa-chart-line" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
                                Predictive Analytics &amp; Forecasting
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                                7-day parcel volume forecasts and monthly expenditure projections powered by <code>@sipemu/anofox-forecast</code> WASM.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            className="px-3.5 py-2 bg-white dark:bg-ink/60 border border-slate-200/80 dark:border-ink/20 hover:bg-slate-50 dark:hover:bg-ink text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                            onClick={() => fetchForecast(true)}
                            disabled={retraining || loading}
                        >
                            <i className={`fas fa-rotate ${retraining ? "fa-spin text-pink-500" : "text-slate-400"}`} />
                            <span>{retraining ? "Recalculating..." : "Sync Database"}</span>
                        </button>

                        <button
                            className="px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-xs hover:shadow-pink-500/25 active:scale-95 cursor-pointer"
                            onClick={handleExport}
                            disabled={loading || !forecastData}
                        >
                            <i className="fas fa-download text-xs" />
                            <span>Export Forecast Report</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20 shadow-xs">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl brand-gradient text-white flex items-center justify-center text-xl shrink-0">
                            ✨
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white">Actual Data &amp; Forecast Status</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {loading ? (
                                    "Querying Supabase database tables..."
                                ) : (
                                    <>
                                        Loaded <b className="text-blue-600 dark:text-blue-400">{totalDbParcels} actual parcels</b> from the <code>parcels</code> table and <b className="text-blue-600 dark:text-blue-400">{forecastData?.raw_db_stats?.total_pos_in_db || 0} purchase orders</b>. 
                                        Next 7-day predicted parcel volume is <b className="text-pink-600 dark:text-pink-400">{weeklyTotal.toLocaleString()} units</b> (95% CI). Next month&apos;s procurement expense is projected at <b className="text-blue-600 dark:text-blue-400">₱{expensePrediction.toLocaleString()}</b> (90% CI: ₱{expenseLower.toLocaleString()} – ₱{expenseUpper.toLocaleString()}).
                                    </>
                                )}
                            </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border dark:border-emerald-800/30 shrink-0">
                            100% DB Synced
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-boxes-stacked"
                        header="Actual Parcels in DB"
                        data={loading ? "..." : String(totalDbParcels)}
                        arrow="fa-solid fa-database"
                        description="From parcels table"
                        backBg="bg-ink dark:bg-slate-900"
                        backHeader="Parcels Breakdown"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total registered parcels: ${totalDbParcels}\nTop Courier: ${sortedCouriers[0]?.[0] || 'None'} (${sortedCouriers[0]?.[1] || 0})\nHistorical dates active: ${forecastData?.parcel_7_day?.historical?.dates?.length || 0} days`}
                        tooltip="View parcel records in Supabase"
                        tooltipLink="/parcels"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-chart-line-up"
                        header="7-Day Predicted Volume"
                        data={loading ? "..." : String(weeklyTotal)}
                        arrow="fa-solid fa-arrow-trend-up"
                        description="95% Confidence Interval"
                        backBg="bg-ink dark:bg-slate-900"
                        backHeader="Forecast Algorithm"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Algorithm: Holt-Winters Additive & AutoTheta\nPrediction Horizon: 7 Days\nConfidence Interval: 95%\nProjected Weekly Total: ${weeklyTotal} parcels`}
                        tooltip="Model details: Holt-Winters (period 7) with AutoTheta fallback"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-money-bill-wave"
                        header="Next Month PO Expense"
                        data={loading ? "..." : `₱${expensePrediction.toLocaleString()}`}
                        arrow="fa-solid fa-receipt"
                        description={`90% CI: ₱${expenseLower.toLocaleString()} - ₱${expenseUpper.toLocaleString()}`}
                        backBg="bg-ink dark:bg-slate-900"
                        backHeader="Expense Projections"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Projected next month expense: ₱${expensePrediction.toLocaleString()}\nEstimated Lower Bound: ₱${expenseLower.toLocaleString()}\nEstimated Upper Bound: ₱${expenseUpper.toLocaleString()}\nCalculated from paid purchase orders`}
                        tooltip="View purchase orders"
                        tooltipLink="/procurement?tab=all"
                        frontTextColor="text-emerald-500 dark:text-emerald-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-truck-fast"
                        header="Top Courier Partner"
                        data={loading ? "..." : (sortedCouriers[0]?.[0] || "None")}
                        arrow="fa-solid fa-trophy"
                        description={`${sortedCouriers[0]?.[1] || 0} parcels dispatched`}
                        backBg="bg-ink dark:bg-slate-900"
                        backHeader="Courier Leaderboard"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={sortedCouriers.slice(0, 4).map(([name, count], i) => `${i + 1}. ${name}: ${count} parcels`).join('\n') || "No courier data"}
                        tooltip="Courier volume share"
                        frontTextColor="text-amber-500 dark:text-amber-400"
                        descriptionTextColor="text-pink-600 dark:text-pink-400"
                    />
                </div>

                <div className="card p-5 bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-base">
                                Parcel Volume: Actual Data from Supabase &rarr; Next 7 Days Prediction
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Showing exact historical timestamps from <code>parcels</code> table followed by the Holt-Winters / AutoTheta forecast with 95% Confidence Interval
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                                Actual Data ({totalDbParcels} total)
                            </span>
                            <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 font-medium">
                                <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span>
                                7-Day Forecast (95% CI)
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 relative h-[320px] w-full">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                            </div>
                        )}

                        {!loading && !hasParcelData && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-ink/30 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                                    <i className="fas fa-box-open text-xl"></i>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Parcel Data Found</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                    Add parcels into the system to generate daily historical patterns and 7-day predictive models.
                                </p>
                            </div>
                        )}

                        <canvas ref={parcelChartRef} className={!hasParcelData ? "hidden" : "block"}></canvas>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="card p-5 bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                    Purchase Order Expenses: Actual &rarr; Next Month Prediction
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Source: <code>purchase_orders</code> table (AutoTheta 90% CI)
                                </div>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium">
                                90% Confidence
                            </span>
                        </div>
                        <div className="mt-4 relative h-[280px] w-full">
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                    <i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
                                </div>
                            )}

                            {!loading && !hasExpenseData && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-ink/30 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                                        <i className="fas fa-file-invoice-dollar text-xl"></i>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Purchase Order Records</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                        Mark purchase orders as paid in Procurement to project next month&apos;s expenditures.
                                    </p>
                                </div>
                            )}

                            <canvas ref={expenseChartRef} className={!hasExpenseData ? "hidden" : "block"}></canvas>
                        </div>
                    </div>

                    <div className="card p-5 bg-white dark:bg-ink/60 border border-slate-200/60 dark:border-ink/20 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                    Management Recommendations: Courier Volume Share
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Distribution breakdown across couriers from {totalDbParcels} actual parcels
                                </div>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 font-medium">
                                Live Share
                            </span>
                        </div>
                        <div className="mt-4 relative h-[280px] w-full">
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                    <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                </div>
                            )}

                            {!loading && !hasCourierData && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-ink/30 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                                        <i className="fas fa-chart-pie text-xl"></i>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Courier Share Data</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                        Courier distribution will populate once parcels with assigned courier partners exist in the database.
                                    </p>
                                </div>
                            )}

                            <canvas ref={courierPieRef} className={!hasCourierData ? "hidden" : "block"}></canvas>
                        </div>
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-ink/40 border border-slate-100 dark:border-ink/30 text-xs text-slate-600 dark:text-slate-300">
                            <i className="fas fa-lightbulb text-amber-500 mr-1.5"></i>
                            <b>Recommendation:</b> {sortedCouriers.length > 0 ? (
                                <>Focus dispatch sorting and dedicated staging areas for top couriers ({sortedCouriers.slice(0, 2).map(([name, count]) => `${name}: ${count}`).join(', ')}) to optimize throughput during upcoming volume surges.</>
                            ) : (
                                <>No active courier data. Once dispatch volume starts flowing, optimization recommendations will appear here.</>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SessionGuard>
    );
}