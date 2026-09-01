"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Chart from "chart.js/auto";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { CardsSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
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
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        previous_week_evaluation?: {
            has_evaluation: boolean;
            date_range: string;
            actual_volume: number;
            predicted_volume: number;
            met_percentage: number;
            accuracy_percentage: number;
            status: string;
            status_tone: 'emerald' | 'pink' | 'amber' | 'neutral';
            summary: string;
        };
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
        peak_insights?: {
            busiestMonth: {
                month: string;
                count: number;
            };
            busiestDay: {
                day: string;
                count: number;
            };
            busiestHour: {
                timeRange: string;
                count: number;
            };
        };
    };
    expense_next_month: {
        prediction: number;
        confidence_interval: {
            lower: number;
            upper: number;
        };
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
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
    // ai summary
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [summarizing, setSummarizing] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiMinimized, setIsAiMinimized] = useState(false);
    // modal state
    const [activeChartModal, setActiveChartModal] = useState<{
        isOpen: boolean;
        type: 'parcels' | 'expense' | 'couriers';
        title: string;
        dataPointIndex?: number;
    }>({
        isOpen: false,
        type: 'parcels',
        title: '',
    });
    const parcelChartRef = useRef<HTMLCanvasElement>(null);
    const expenseChartRef = useRef<HTMLCanvasElement>(null);
    const courierPieRef = useRef<HTMLCanvasElement>(null);
    const parcelChartInstance = useRef<Chart | null>(null);
    const expenseChartInstance = useRef<Chart | null>(null);
    const courierPieInstance = useRef<Chart | null>(null);
    const generateAiSummary = async () => {
        if (!forecastData) {
            toast.error("Forecast data is still loading.");
            return;
        }
        try {
            setSummarizing(true);
            setIsAiModalOpen(true);
            const res = await fetch("/forecast/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ forecastData })
            });
            const data = await res.json();
            if (data.success && data.summary) {
                setAiSummary(data.summary);
                setIsAiMinimized(false);
            }
            else {
                throw new Error(data.error || "Failed to generate AI summary");
            }
        }
        catch (err: any) {
            console.error("AI Summary error:", err);
            toast.error(err.message || "Failed to generate AI summary");
        }
        finally {
            setSummarizing(false);
        }
    };
    const fetchForecast = useCallback(async (showNotification: boolean = false) => {
        try {
            if (showNotification)
                setRetraining(true);
            const res = await fetch("/forecast/api", { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                setForecastData(data);
                if (showNotification) {
                    toast.success("Forecast models synced with Supabase database!");
                }
            }
            else {
                throw new Error(data.error || "Failed to load forecast data");
            }
        }
        catch (err: any) {
            console.error("Forecast fetch error:", err);
            toast.error(err.message || "Failed to fetch forecasts");
        }
        finally {
            setLoading(false);
            setRetraining(false);
        }
    }, []);
    useEffect(() => {
        fetchForecast();
    }, [fetchForecast]);
    useEffect(() => {
        if (typeof window === "undefined" || !forecastData || loading)
            return;
        const timer = setTimeout(() => {
            const isDark = document.documentElement.classList.contains("dark");
            const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
            const textColor = isDark ? "#8a8a8e" : "#64748B";
            // 7d parcel volume
            if (parcelChartRef.current && forecastData?.parcel_7_day?.historical?.counts?.length) {
                if (parcelChartInstance.current) {
                    parcelChartInstance.current.destroy();
                    parcelChartInstance.current = null;
                }
                const ctx = parcelChartRef.current.getContext("2d");
                if (ctx) {
                    const histData = forecastData.parcel_7_day.historical;
                    const histLabels = (histData.display_dates || histData.dates || []).map(d => {
                        if (d.includes('-') && !d.includes('/')) {
                            const parts = d.split('-');
                            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                        }
                        return d;
                    });
                    const histCounts = histData.display_counts || histData.counts || [];
                    const fcDates = forecastData.parcel_7_day.dates || [];
                    const fcValues = forecastData.parcel_7_day.predictions || [];
                    const fcUpper = forecastData.parcel_7_day.confidence_interval.upper || [];
                    const fcLower = forecastData.parcel_7_day.confidence_interval.lower || [];
                    const fcLabels = fcDates.map((d, i) => {
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[1]}/${parts[2]} (Fcst D+${i + 1})` : `D+${i + 1}`;
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
                                    label: `Actual History (${histData.aggregation_type || 'Daily'})`,
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
                            onClick: (event: any, elements: any) => {
                                const index = elements && elements.length > 0 ? elements[0].index : undefined;
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'parcels',
                                    title: '7-Day Parcel Volume Forecast Analysis',
                                    dataPointIndex: index,
                                });
                            },
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
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Parcel Volume", color: textColor }
                                },
                            },
                        },
                    });
                }
            }
            // expense forecast
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
                            onClick: (event: any, elements: any) => {
                                const index = elements && elements.length > 0 ? elements[0].index : undefined;
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'expense',
                                    title: 'Procurement Outlay & Budget Projections',
                                    dataPointIndex: index,
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, color: textColor },
                                },
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
            // courier share
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
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'couriers',
                                    title: 'Courier Partner Volume Breakdown & Dispatch Allocation',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "right",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor, font: { size: 11 } }
                                },
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
            peak_traffic_insights: forecastData.parcel_7_day.peak_insights,
            next_7_day_parcel_forecast: {
                predictions: forecastData.parcel_7_day.predictions,
                confidence_interval_95_pct: forecastData.parcel_7_day.confidence_interval,
                total_projected_volume: forecastData.parcel_7_day.total_next_week,
                dates: forecastData.parcel_7_day.dates,
                historical_counts: forecastData.parcel_7_day.historical.counts,
                display_aggregation: forecastData.parcel_7_day.historical.aggregation_type
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
    const prevEval = forecastData?.parcel_7_day?.previous_week_evaluation;
    const expensePrediction = forecastData?.expense_next_month?.prediction || 0;
    const expenseLower = forecastData?.expense_next_month?.confidence_interval?.lower || 0;
    const expenseUpper = forecastData?.expense_next_month?.confidence_interval?.upper || 0;
    const courierMap = forecastData?.raw_db_stats?.courier_breakdown || {};
    const sortedCouriers = useMemo(() => {
        return Object.entries(courierMap).sort((a, b) => b[1] - a[1]);
    }, [courierMap]);
    const peakInsights = forecastData?.parcel_7_day?.peak_insights;
    const aggregationType = forecastData?.parcel_7_day?.historical?.aggregation_type || 'Daily';
    const hasParcelData = (forecastData?.parcel_7_day?.historical?.counts?.length || 0) > 0 || (forecastData?.parcel_7_day?.predictions?.length || 0) > 0;
    const hasExpenseData = (forecastData?.expense_next_month?.historical?.amounts?.length || 0) > 0 || (forecastData?.expense_next_month?.prediction || 0) > 0;
    const hasCourierData = Object.keys(courierMap).length > 0;
    return (<SessionGuard requiredRole={['Admin', 'Employee', 'Executive']}>
            <div className="p-6 space-y-6 bgCard dark:bg-ink/90 pb-16">
                {/* header */}
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-ink/20 pb-5">
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5">
                            <i className="fa-solid fa-wand-magic-sparkles"/>
                        </div>

                        <div className="w-full min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-[11px] font-semibold border border-slate-200/60 dark:border-slate-700/60">
                                    <i className="fas fa-microchip text-pink-500 text-[10px]"/>
                                    <span>Airship Express</span>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <span className="text-pink-600 dark:text-pink-400">Holt-Winters & AutoTheta WASM</span>
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                    <span>Database Synced</span>
                                </div>
                            </div>
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                                Demand & Operational Forecasting Engine
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Automated time-series forecasting powered by high-performance in-memory WebAssembly. Analyzes 6 months of historical Supabase parcel traffic and procurement spending to predict future intake cycles.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                        <AppButton type="button" variant="primary" size="md" onClick={generateAiSummary} disabled={loading || summarizing || !forecastData}>
                            <i className={`fas ${summarizing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`}/>
                            <span>{summarizing ? "Analyzing Models..." : "Summarize with AI"}</span>
                        </AppButton>

                        <AppButton type="button" variant="neutral" size="md" onClick={() => fetchForecast(true)} disabled={retraining || loading} title="Recalculate models from Supabase">
                            <i className={`fas fa-rotate text-xs ${retraining ? "fa-spin text-pink-500" : "text-slate-400"}`}/>
                            <span>{retraining ? "Recalculating..." : "Sync DB"}</span>
                        </AppButton>

                        <AppButton type="button" variant="neutral" size="md" onClick={handleExport} disabled={loading || !forecastData} title="Export Forecast Report">
                            <i className="fas fa-download text-xs text-slate-400"/>
                            <span>Export</span>
                        </AppButton>
                    </div>
                </div>

                {/* ai insights banner - compact preview & minimized state */}
                {aiSummary && isAiMinimized && (
                    <div className="p-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-ink/30 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsAiMinimized(false)}>
                            <div className="w-6 h-6 rounded-lg bg-pink-500 text-white flex items-center justify-center text-[10px] shadow-2xs">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                AI Operational Insights (Minimized)
                            </span>
                            <StatusBadge tone="pink" size="xs">
                                Gemini Analyzed
                            </StatusBadge>
                        </div>
                        <div className="flex items-center gap-2">
                            <AppButton type="button" variant="neutral" size="xs" onClick={() => setIsAiMinimized(false)}>
                                <i className="fas fa-chevron-down text-[10px]"></i>
                                <span>Restore Summary</span>
                            </AppButton>
                            <AppButton type="button" variant="pink" size="xs" onClick={() => setIsAiModalOpen(true)}>
                                <i className="fas fa-expand text-[10px]"></i>
                                <span>Pop-out Modal</span>
                            </AppButton>
                            <button
                                type="button"
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                                onClick={() => setAiSummary(null)}
                                title="Dismiss"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                )}

                {aiSummary && !isAiMinimized && (
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-ink/30 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between gap-3 mb-3 border-b border-slate-100 dark:border-ink/20 pb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-pink-500 text-white flex items-center justify-center text-xs shadow-xs">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                    Airship AI Operational Insights
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge tone="pink" size="xs">
                                    Gemini Analyzed
                                </StatusBadge>
                                <AppButton type="button" variant="neutral" size="xs" onClick={() => setIsAiMinimized(true)} title="Minimize to top bar">
                                    <i className="fas fa-minus text-[10px]"></i>
                                    <span>Minimize</span>
                                </AppButton>
                                <AppButton type="button" variant="pink" size="xs" onClick={() => setIsAiModalOpen(true)} title="Expand into full-screen dialog">
                                    <i className="fas fa-expand text-[10px]"></i>
                                    <span>Pop-out Modal</span>
                                </AppButton>
                                <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                                    onClick={() => setAiSummary(null)}
                                    title="Dismiss AI Insights"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        {/* Full structured AI summary content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
                            {aiSummary.split('\n\n').filter(Boolean).map((section, idx) => {
                                const titleMatch = section.match(/^(\*\*.*?\*\*|\w+:)/);
                                if (titleMatch) {
                                    const title = titleMatch[0].replace(/\*\*/g, '').replace(':', '');
                                    const content = section.replace(titleMatch[0], '').trim();
                                    return (
                                        <div key={idx} className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-ink/30 text-xs shadow-2xs">
                                            <div className="font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-[11px]">
                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                                {title}
                                            </div>
                                            <div className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-3 border-l-2 border-pink-500/40">
                                                {content}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-ink/30 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {section}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loading && !forecastData ? (<CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4"/>) : (<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Cards frontIcon="fa-solid fa-boxes-stacked" header="Actual Parcels in DB" data={String(totalDbParcels)} arrow="fa-solid fa-database" description="Max 6-month window" backBg="bg-ink dark:bg-slate-900" backHeader="Parcels Breakdown" headerTextColor="text-muted dark:text-white/80" backDescription={`Total registered parcels: ${totalDbParcels}\nTop Courier: ${sortedCouriers[0]?.[0] || 'None'} (${sortedCouriers[0]?.[1] || 0})\nAggregation View: ${aggregationType}`} tooltip="View parcel records in Supabase" tooltipLink="/parcels" frontTextColor="text-blue-500 dark:text-blue-400" descriptionTextColor="text-blue-600 dark:text-blue-400"/>

                        <Cards frontIcon="fa-solid fa-chart-line-up" header="7-Day Predicted Volume" data={String(weeklyTotal)} arrow="fa-solid fa-arrow-trend-up" description={prevEval?.has_evaluation ? `${prevEval.met_percentage}% Target Met (Prev Wk) · ${forecastData?.parcel_7_day?.confidence || "0%"} CI` : `${forecastData?.parcel_7_day?.confidence || "0%"} Confidence Interval`} backBg="bg-ink dark:bg-slate-900" backHeader="Forecast Algorithm" headerTextColor="text-muted dark:text-white/80" backDescription={`Algorithm: ${forecastData?.parcel_7_day?.model_used || "Holt-Winters"}\nPrediction Horizon: Next 7 Days\nConfidence Interval: ${forecastData?.parcel_7_day?.confidence || "0%"}\nProjected 7-Day Total: ${weeklyTotal} units\n${prevEval?.summary ? `\n${prevEval.summary}` : ""}`} tooltip="Holt-Winters 7-day seasonality model" frontTextColor="text-pink-500 dark:text-pink-400" descriptionTextColor="text-emerald-600 dark:text-emerald-400"/>

                        <Cards frontIcon="fa-solid fa-money-bill-wave" header="Next Month PO Expense" data={`₱${expensePrediction.toLocaleString()}`} arrow="fa-solid fa-receipt" description={expensePrediction > 0 ? `${forecastData?.expense_next_month?.confidence || "0%"} CI: ₱${expenseLower.toLocaleString()} - ₱${expenseUpper.toLocaleString()}` : "No qualifying paid POs"} backBg="bg-ink dark:bg-slate-900" backHeader="Expense Projections" headerTextColor="text-muted dark:text-white/80" backDescription={`Projected expense: ₱${expensePrediction.toLocaleString()}\nEstimated Lower Bound: ₱${expenseLower.toLocaleString()}\nEstimated Upper Bound: ₱${expenseUpper.toLocaleString()}\nConfidence: ${forecastData?.expense_next_month?.confidence || "0%"}\nCalculated from Confirmed/Delivered paid purchase orders`} tooltip="View purchase orders" tooltipLink="/procurement?tab=all" frontTextColor="text-emerald-500 dark:text-emerald-400" descriptionTextColor="text-blue-600 dark:text-blue-400"/>

                        <Cards frontIcon="fa-solid fa-truck-fast" header="Top Courier Partner" data={sortedCouriers[0]?.[0] || "None"} arrow="fa-solid fa-trophy" description={`${sortedCouriers[0]?.[1] || 0} parcels dispatched`} backBg="bg-ink dark:bg-slate-900" backHeader="Courier Leaderboard" headerTextColor="text-muted dark:text-white/80" backDescription={sortedCouriers.slice(0, 4).map(([name, count], i) => `${i + 1}. ${name}: ${count} parcels`).join('\n') || "No courier data"} tooltip="Courier volume share" frontTextColor="text-amber-500 dark:text-amber-400" descriptionTextColor="text-pink-600 dark:text-pink-400"/>
                    </div>)}

               {/* insights banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                        <div className="w-11 h-11 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                            <i className="fa-solid fa-calendar-days"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Busiest Month</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {loading ? "..." : (peakInsights?.busiestMonth?.month || "N/A")}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {loading ? "" : `${peakInsights?.busiestMonth?.count || 0} parcels recorded`}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                        <div className="w-11 h-11 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                            <i className="fa-solid fa-calendar-day"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Peak Incoming Day</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {loading ? "..." : (peakInsights?.busiestDay?.day || "N/A")}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {loading ? "" : `${peakInsights?.busiestDay?.count || 0} parcels peak`}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                        <div className="w-11 h-11 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                            <i className="fa-solid fa-clock"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Busiest Time Window</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {loading ? "..." : (peakInsights?.busiestHour?.timeRange || "N/A")}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {loading ? "" : `${peakInsights?.busiestHour?.count || 0} parcels incoming`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 7d forecast */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-ink/20 shadow-2xs">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-ink/20 pb-3 flex-wrap">
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                                <span>Parcel Volume: Actual Supabase Data → 7-Day Prediction</span>
                                <StatusBadge tone="pink" icon="fas fa-hand-pointer" size="xs">
                                    Click chart to inspect
                                </StatusBadge>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {totalDbParcels} actual parcels recorded (Max 6 Months) · {forecastData?.parcel_7_day?.model_used || "Holt-Winters Seasonal"} WASM with {forecastData?.parcel_7_day?.confidence || "0%"} Confidence Interval
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {prevEval?.has_evaluation && (
                                <StatusBadge tone={prevEval.status_tone || 'emerald'} icon="fas fa-bullseye" size="xs">
                                    Prev Week: {prevEval.met_percentage}% Met ({prevEval.actual_volume}/{prevEval.predicted_volume})
                                </StatusBadge>
                            )}
                            <StatusBadge tone={(forecastData?.parcel_7_day?.confidence && forecastData.parcel_7_day.confidence !== '0%')
            ? 'pink'
            : 'neutral'} icon="fas fa-shield-halved" size="xs">
                                {forecastData?.parcel_7_day?.confidence || "0%"} Confidence
                            </StatusBadge>
                            <StatusBadge tone="neutral" size="xs">
                                {aggregationType} Resolution
                            </StatusBadge>
                            <AppButton type="button" variant="pink" size="xs" onClick={() => setActiveChartModal({
            isOpen: true,
            type: 'parcels',
            title: '7-Day Parcel Volume Forecast Analysis',
        })}>
                                <i className="fas fa-chart-line text-[10px]"/>
                                <span>Inspect Model</span>
                            </AppButton>
                        </div>
                    </div>
                    <div className="mt-4 relative h-80 w-full cursor-pointer">
                        {loading && (<div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                            </div>)}

                        {!loading && !hasParcelData && (<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60">
                                <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xl mb-2">
                                    <i className="fas fa-chart-line"></i>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Parcel Data</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                    Historical volume and predictions will render automatically once parcels are registered in Supabase.
                                </p>
                            </div>)}

                        <canvas ref={parcelChartRef} className={!hasParcelData ? "hidden" : "block"}></canvas>
                    </div>
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-ink/20 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <i className="fas fa-info-circle text-pink-500 mr-1.5"></i>
                            Adaptive resolution groups data up to 6 months to ensure clear, uncluttered visualizations while preserving WASM model accuracy.
                        </div>
                        <span className="text-[11px] text-pink-600 dark:text-pink-400 font-semibold cursor-pointer" onClick={() => setActiveChartModal({ isOpen: true, type: 'parcels', title: '7-Day Parcel Volume Forecast Analysis' })}>
                            Click chart or button to view math &amp; predictions →
                        </span>
                    </div>
                </div>

                {/* lower charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* po expenses */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-ink/20 shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-ink/20 pb-3 flex-wrap">
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                        <span>Procurement Spend: Monthly Paid POs → Next Month Forecast</span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Tracked across actual purchase orders in database
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge tone={(forecastData?.expense_next_month?.confidence && forecastData.expense_next_month.confidence !== '0%')
            ? 'emerald'
            : 'neutral'} size="xs">
                                        {forecastData?.expense_next_month?.confidence || "0%"} Confidence
                                    </StatusBadge>
                                    <AppButton type="button" variant="success" size="xs" onClick={() => setActiveChartModal({
            isOpen: true,
            type: 'expense',
            title: 'Procurement Outlay & Budget Projections',
        })}>
                                        <i className="fas fa-calculator text-[10px]"/>
                                        <span>Inspect</span>
                                    </AppButton>
                                </div>
                            </div>
                            <div className="mt-4 relative h-70 w-full cursor-pointer">
                                {loading && (<div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                        <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                    </div>)}

                                {!loading && !hasExpenseData && (<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl mb-2">
                                            <i className="fas fa-money-bill-trend-up"></i>
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Purchase Order Records</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                            Monthly financial outlay forecast will populate once purchase orders with valid costs exist.
                                        </p>
                                    </div>)}

                                <canvas ref={expenseChartRef} className={!hasExpenseData ? "hidden" : "block"}></canvas>
                            </div>
                        </div>
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-ink/20 text-xs text-slate-600 dark:text-slate-300">
                            <i className="fas fa-chart-line text-emerald-500 mr-1.5"></i>
                            Expense projections apply AutoTheta trend-fitting to paid purchase orders to assist procurement budgeting.
                        </div>
                    </div>

                    {/* courier share */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-ink/20 shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-ink/20 pb-3 flex-wrap">
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                                        Courier Volume Share Distribution
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Distribution breakdown across courier partners from {totalDbParcels} actual parcels
                                    </div>
                                </div>
                                <AppButton type="button" variant="pink" size="xs" onClick={() => setActiveChartModal({
            isOpen: true,
            type: 'couriers',
            title: 'Courier Partner Volume Breakdown & Dispatch Allocation',
        })}>
                                    <i className="fas fa-pie-chart text-[10px]"/>
                                    <span>Details</span>
                                </AppButton>
                            </div>
                            <div className="mt-4 relative h-70 w-full cursor-pointer">
                                {loading && (<div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-ink/70 z-10">
                                        <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                    </div>)}

                                {!loading && !hasCourierData && (<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60">
                                        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xl mb-2">
                                            <i className="fas fa-chart-pie"></i>
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Courier Share Data</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                            Courier distribution will populate once parcels with assigned courier partners exist in the database.
                                        </p>
                                    </div>)}

                                <canvas ref={courierPieRef} className={!hasCourierData ? "hidden" : "block"}></canvas>
                            </div>
                        </div>
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-ink/20 text-xs text-slate-600 dark:text-slate-300">
                            <i className="fas fa-lightbulb text-amber-500 mr-1.5"></i>
                            <b>Recommendation:</b> {sortedCouriers.length > 0 ? (<>Focus dispatch sorting and dedicated staging areas for top couriers ({sortedCouriers.slice(0, 2).map(([name, count]) => `${name}: ${count}`).join(', ')}) to optimize throughput during upcoming volume surges.</>) : (<>No active courier data. Once dispatch volume starts flowing, optimization recommendations will appear here.</>)}
                        </div>
                    </div>
                </div>

                {/* inspection modal */}
                {activeChartModal.isOpen && forecastData && (<div className="fixed inset-0 z-99990 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" onClick={(e) => {
                if (e.target === e.currentTarget)
                    setActiveChartModal(prev => ({ ...prev, isOpen: false }));
            }}>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-ink/30 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" data-lenis-prevent>
                            {/* header */}
                            <div className="p-5 border-b border-slate-200 dark:border-ink/20 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg text-white shadow-sm ${activeChartModal.type === 'expense' ? 'bg-emerald-600' : 'bg-pink-600'}`}>
                                        <i className={`fas ${activeChartModal.type === 'parcels' ? 'fa-boxes-stacked' :
                                                            activeChartModal.type === 'expense' ? 'fa-money-bill-wave' : 'fa-chart-pie'}`}></i>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeChartModal.title}</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Statistical breakdown, algorithmic explanation, and underlying database metrics</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="xs"
                                        onClick={() => {
                                            setActiveChartModal(prev => ({ ...prev, isOpen: false }));
                                            setIsAiMinimized(true);
                                        }}
                                        title="Minimize to compact bar"
                                    >
                                        <i className="fas fa-minus text-[10px]"></i>
                                        <span>Minimize</span>
                                    </AppButton>
                                    <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setActiveChartModal(prev => ({ ...prev, isOpen: false }))} aria-label="Close modal">
                                        <i className="fas fa-times text-xs"></i>
                                    </AppButton>
                                </div>
                            </div>

                            {/* body */}
                            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1 overscroll-contain" data-lenis-prevent>
                                {activeChartModal.type === 'parcels' && (<>
                                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-pink-50/50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/30">
                                                <div className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">7-Day Projected Total</div>
                                                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                    {forecastData.parcel_7_day.total_next_week.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">parcels</span>
                                                </div>
                                                <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                                                    {forecastData.parcel_7_day.confidence || "95%"} Confidence
                                                </div>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prev Week Target Met</div>
                                                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 mt-1">
                                                    {prevEval?.has_evaluation ? `${prevEval.met_percentage}%` : 'N/A'}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate" title={prevEval?.summary || ''}>
                                                    {prevEval?.has_evaluation ? `${prevEval.actual_volume} actual / ${prevEval.predicted_volume} pred` : 'No prior window'}
                                                </div>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Algorithm Used</div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                    {forecastData.parcel_7_day.model_used || "Holt-Winters Seasonal"}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {forecastData.parcel_7_day.engine || "Rust/WASM Core"}
                                                </div>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Sampling</div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                                    {forecastData.raw_db_stats.total_parcels_in_db.toLocaleString()} Parcels
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {forecastData.parcel_7_day.historical.dates.length} Days Sampled
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                                            <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                <i className="fas fa-lightbulb text-amber-500"></i>
                                                How Did the System Compute This?
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {forecastData.parcel_7_day.explanation || "The system collects all logged parcels from your Supabase database over the past 6 months. It feeds the daily intake volumes into an in-memory Rust/WASM Holt-Winters seasonality forecaster, which decomposes past trends into weekly recurring cycles (Monday to Sunday) and projects the next 7 days."}
                                            </p>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                                                <b>Confidence Level ({forecastData.parcel_7_day.confidence} CI):</b> The upper and lower bounds define where daily volume is statistically expected to fall, preparing warehouse operations for surge peaks or low volume days.
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                <i className="fas fa-calendar-week text-pink-500"></i>
                                                Next 7 Days Day-by-Day Forecast Breakdown
                                            </h4>
                                            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xs">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                                        <tr>
                                                            <th className="py-2.5 px-4">Forecast Horizon</th>
                                                            <th className="py-2.5 px-4">Projected Date</th>
                                                            <th className="py-2.5 px-4 text-center">Lower {forecastData.parcel_7_day.confidence} Bound</th>
                                                            <th className="py-2.5 px-4 text-right font-bold text-pink-600 dark:text-pink-400">Predicted Volume</th>
                                                            <th className="py-2.5 px-4 text-center">Upper {forecastData.parcel_7_day.confidence} Bound</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {forecastData.parcel_7_day.dates.map((dateStr, idx) => {
                    const pred = forecastData.parcel_7_day.predictions[idx] || 0;
                    const lower = forecastData.parcel_7_day.confidence_interval.lower[idx] || 0;
                    const upper = forecastData.parcel_7_day.confidence_interval.upper[idx] || 0;
                    const dateObj = new Date(dateStr);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    return (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                                        Day +{idx + 1}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                                                                        {dayName}, {dateStr}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">
                                                                        {lower}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white font-mono text-sm">
                                                                        {pred} <span className="text-[10px] font-normal text-slate-400">units</span>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">
                                                                        {upper}
                                                                    </td>
                                                                </tr>);
                })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>)}

                                {activeChartModal.type === 'expense' && (<>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30">
                                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Next Month Projected Outlay</div>
                                                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                    ₱{forecastData.expense_next_month.prediction.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                                    90% Confidence Boundary
                                                </div>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Algorithm Used</div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                    {forecastData.expense_next_month.model_used || "AutoTheta Forecaster"}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Rust/WASM Engine
                                                </div>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estimated Outlay Range</div>
                                                <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                                    ₱{forecastData.expense_next_month.confidence_interval.lower.toLocaleString()} - ₱{forecastData.expense_next_month.confidence_interval.upper.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Based on paid PO history
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                                <i className="fas fa-lightbulb text-amber-500"></i>
                                                How Did the System Compute This?
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {forecastData.expense_next_month.explanation || "The system aggregates total expenditures strictly from paid purchase orders with status 'Confirmed' or 'Delivered' in Supabase. It uses the AutoTheta time-series algorithm to isolate long-term trends and seasonality across procurement billing cycles, generating a recommended financial reserve."}
                                            </p>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                                                <b>Sampling Filter:</b> Only purchase orders where <code>status ∈ &#123;'Confirmed', 'Delivered'&#125;</code> and <code>paid = true</code> are included. Unpaid or pending draft orders are excluded from prediction math.
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                <i className="fas fa-history text-emerald-500"></i>
                                                Historical Outlay vs Forecasted Budget
                                            </h4>
                                            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xs">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                                        <tr>
                                                            <th className="py-2.5 px-4">Period</th>
                                                            <th className="py-2.5 px-4">Type</th>
                                                            <th className="py-2.5 px-4 text-right">Expenditure Amount (₱)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {forecastData.expense_next_month.historical.months.map((monthStr, idx) => {
                    const amt = forecastData.expense_next_month.historical.amounts[idx] || 0;
                    return (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                                        {monthStr}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                                                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                                                                            Actual Paid
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                                        ₱{amt.toLocaleString()}
                                                                    </td>
                                                                </tr>);
                })}
                                                        <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                                                            <td className="py-3 px-4 text-emerald-700 dark:text-emerald-300">
                                                                Next Month (Projected)
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-[10px]">
                                                                    WASM Forecast
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                                                                ₱{forecastData.expense_next_month.prediction.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>)}

                                {activeChartModal.type === 'couriers' && (<>
                                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                                            <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                <i className="fas fa-truck text-pink-500"></i>
                                                Carrier Network Distribution
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                Calculated from direct parcel records in the database. Courier share metrics indicate operational dependence on individual shipping partners and guide warehouse dispatch lane staging.
                                            </p>
                                        </div>

                                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xs">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                                    <tr>
                                                        <th className="py-2.5 px-4">Rank</th>
                                                        <th className="py-2.5 px-4">Courier Partner</th>
                                                        <th className="py-2.5 px-4 text-center">Dispatched Parcels</th>
                                                        <th className="py-2.5 px-4 text-right">Volume Share</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {sortedCouriers.map(([name, count], idx) => {
                    const pct = totalDbParcels > 0 ? ((count / totalDbParcels) * 100).toFixed(1) : '0';
                    return (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                                                <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                                                                    #{idx + 1}
                                                                </td>
                                                                <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                                                    <i className="fas fa-truck text-slate-400"></i>
                                                                    <span>{name}</span>
                                                                </td>
                                                                <td className="py-2.5 px-4 text-center font-mono font-semibold">
                                                                    {count.toLocaleString()}
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right font-mono font-bold text-pink-600 dark:text-pink-400">
                                                                    {pct}%
                                                                </td>
                                                            </tr>);
                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>)}
                            </div>

                            {/* footer */}
                            <div className="p-4 border-t border-slate-200 dark:border-ink/20 flex items-center justify-between bg-slate-50 dark:bg-ink/40 shrink-0">
                                <div className="text-xs text-slate-400">
                                    <i className="fas fa-microchip text-pink-500 mr-1"></i>
                                    Powered by @sipemu/anofox-forecast (Rust/WASM)
                                </div>
                                <AppButton type="button" variant="primary" size="sm" onClick={() => setActiveChartModal(prev => ({ ...prev, isOpen: false }))}>
                                    Close Inspection
                                </AppButton>
                            </div>
                        </div>
                    </div>)}

                {/* ai modal */}
                {isAiModalOpen && (<div className="fixed inset-0 z-99990 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" onClick={(e) => {
                if (e.target === e.currentTarget)
                    setIsAiModalOpen(false);
            }}>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-ink/30 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden" data-lenis-prevent>
                            {/* header */}
                            <div className="p-5 border-b border-slate-200 dark:border-ink/20 flex items-center justify-between bg-pink-50/60 dark:bg-pink-950/30 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center text-lg shadow-sm">
                                        <i className="fas fa-brain"></i>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900 dark:text-white">AI Forecasting &amp; Operational Interpretation</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Deep analysis of parcel volume trajectories, confidence envelopes, and expense projections</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="xs"
                                        onClick={() => {
                                            setIsAiModalOpen(false);
                                            setIsAiMinimized(true);
                                        }}
                                        title="Minimize to compact bar"
                                    >
                                        <i className="fas fa-minus text-[10px]"></i>
                                        <span>Minimize</span>
                                    </AppButton>
                                    <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setIsAiModalOpen(false)} aria-label="Close modal">
                                        <i className="fas fa-times text-xs"></i>
                                    </AppButton>
                                </div>
                            </div>

                            {/* body */}
                            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1 overscroll-contain" data-lenis-prevent>
                                {summarizing ? (<div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                                        <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xl">
                                            <i className="fas fa-wand-magic-sparkles fa-spin"></i>
                                        </div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Synthesizing Chart Data with Gemini AI...</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                                            Evaluating 6-month historical counts, 95% surge boundaries, and paid procurement expenditures.
                                        </p>
                                    </div>) : (<div className="space-y-4">
                                        {(aiSummary || '').split('\n\n').map((section, idx) => {
                    const lines = section.trim().split('\n');
                    const title = lines[0];
                    const content = lines.slice(1).join('\n');
                    const isHeader = /^[A-Z\s&/–-]+$/.test(title) && title.length < 50;
                    if (isHeader) {
                        return (<div key={idx} className="p-4 rounded-2xl bg-pink-50/40 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30 space-y-2">
                                                        <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-600"></span>
                                                            {title}
                                                        </div>
                                                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-3.5 border-l-2 border-pink-500">
                                                            {content}
                                                        </div>
                                                    </div>);
                    }
                    return (<div key={idx} className="whitespace-pre-line text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    {section}
                                                </div>);
                })}
                                    </div>)}
                            </div>

                            {/* footer */}
                            <div className="p-4 border-t border-slate-200 dark:border-ink/20 flex items-center justify-between bg-slate-50 dark:bg-ink/40 shrink-0">
                                <div className="text-xs text-slate-400">
                                    <i className="fas fa-shield-halved text-pink-500 mr-1"></i>
                                    Grounded strictly in active Supabase records
                                </div>
                                <div className="flex items-center gap-2">
                                    <AppButton type="button" variant="neutral" size="sm" onClick={generateAiSummary} disabled={summarizing}>
                                        <i className={`fas fa-rotate text-xs ${summarizing ? 'fa-spin' : ''}`}></i>
                                        <span>Regenerate</span>
                                    </AppButton>
                                    <AppButton type="button" variant="primary" size="sm" onClick={() => setIsAiModalOpen(false)}>
                                        Done
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </div>)}
            </div>
        </SessionGuard>);
}
