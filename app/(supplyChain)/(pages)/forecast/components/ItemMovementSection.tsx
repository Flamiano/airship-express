"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { AppButton } from "../../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";

export interface MovementItem {
    id: string | number;
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
    total_quantity_issued: number;
    issuance_transactions_count: number;
    average_daily_issued: number;
    usable_stock: number;
    current_stock: number;
    minimum_stock: number;
    last_issuance_date: string | null;
    days_since_last_issuance: number | null;
    days_since_created?: number;
    created_at?: string | null;
    is_zero_issue?: boolean;
    stock_status: "Out of Stock" | "Low Stock" | "Adequate Stock";
    movement_classification: string;
}

export interface ItemMovementAnalyticsData {
    period_days: number;
    start_date: string;
    end_date: string;
    total_catalog_items: number;
    active_moving_items_count: number;
    zero_issuance_items_count: number;
    low_consumption_items_count: number;
    fast_moving_items: MovementItem[];
    slow_moving_items: MovementItem[];
    zero_issue_items: MovementItem[];
    low_consumption_items: MovementItem[];
    ranking_method_explanation: string;
}

interface ItemMovementSectionProps {
    movementData?: ItemMovementAnalyticsData | null;
    periodDays: number;
    onPeriodChange: (days: number) => void;
    onCustomRangeApply: (startDate: string, endDate: string) => void;
    currentStartDate?: string;
    currentEndDate?: string;
    isLoading?: boolean;
    onOpenChartModal?: (domain: string) => void;
}

export default function ItemMovementSection({
    movementData,
    periodDays,
    onPeriodChange,
    onCustomRangeApply,
    currentStartDate,
    currentEndDate,
    isLoading = false,
    onOpenChartModal
}: ItemMovementSectionProps) {
    // Chart Controls & Metrics
    const [chartMetric, setChartMetric] = useState<"issued_qty" | "daily_rate" | "usable_stock" | "transactions">("issued_qty");
    const [chartLimit, setChartLimit] = useState<number>(10);
    const [showFastLine, setShowFastLine] = useState<boolean>(true);
    const [showSlowLine, setShowSlowLine] = useState<boolean>(true);
    const [isChartVisible, setIsChartVisible] = useState<boolean>(true);

    // View Options (View Scope & Layout Density)
    const [viewScope, setViewScope] = useState<"both" | "fast_only" | "slow_only" | "chart_only">("both");
    const [layoutStyle, setLayoutStyle] = useState<"table" | "cards">("table");

    const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    // Fast-Moving Controls
    const [fastViewLimit, setFastViewLimit] = useState<"top10" | "all">("top10");
    const [fastSearchQuery, setFastSearchQuery] = useState<string>("");
    const [fastCategoryFilter, setFastCategoryFilter] = useState<string>("all");

    // Slowest-Moving Controls
    const [slowViewLimit, setSlowViewLimit] = useState<"bottom10" | "all">("bottom10");
    const [slowMovementFilter, setSlowMovementFilter] = useState<"all" | "zero" | "low">("all");
    const [slowSearchQuery, setSlowSearchQuery] = useState<string>("");
    const [slowCategoryFilter, setSlowCategoryFilter] = useState<string>("all");

    // Custom date inputs
    const [customFrom, setCustomFrom] = useState<string>(currentStartDate || "");
    const [customTo, setCustomTo] = useState<string>(currentEndDate || "");
    const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(false);

    // Extract categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        movementData?.fast_moving_items?.forEach((i) => i.category && set.add(i.category));
        movementData?.slow_moving_items?.forEach((i) => i.category && set.add(i.category));
        return Array.from(set).sort();
    }, [movementData]);

    // Filtered Fast-Moving Items
    const displayedFastMoving = useMemo(() => {
        if (!movementData?.fast_moving_items) return [];
        let items = [...movementData.fast_moving_items];

        if (fastCategoryFilter !== "all") {
            items = items.filter((i) => i.category.toLowerCase() === fastCategoryFilter.toLowerCase());
        }

        if (fastSearchQuery.trim()) {
            const q = fastSearchQuery.toLowerCase().trim();
            items = items.filter(
                (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
            );
        }

        if (fastViewLimit === "top10") {
            return items.slice(0, 10);
        }
        return items;
    }, [movementData?.fast_moving_items, fastCategoryFilter, fastSearchQuery, fastViewLimit]);

    // Filtered Slowest-Moving Items
    const displayedSlowMoving = useMemo(() => {
        if (!movementData?.slow_moving_items) return [];
        let items = [...movementData.slow_moving_items];

        if (slowMovementFilter === "zero") {
            items = items.filter((i) => i.total_quantity_issued === 0);
        } else if (slowMovementFilter === "low") {
            items = items.filter((i) => i.total_quantity_issued > 0);
        }

        if (slowCategoryFilter !== "all") {
            items = items.filter((i) => i.category.toLowerCase() === slowCategoryFilter.toLowerCase());
        }

        if (slowSearchQuery.trim()) {
            const q = slowSearchQuery.toLowerCase().trim();
            items = items.filter(
                (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
            );
        }

        if (slowViewLimit === "bottom10") {
            return items.slice(0, 10);
        }
        return items;
    }, [
        movementData?.slow_moving_items,
        slowMovementFilter,
        slowCategoryFilter,
        slowSearchQuery,
        slowViewLimit
    ]);

    const handleApplyCustomDate = (e: React.FormEvent) => {
        e.preventDefault();
        if (customFrom && customTo) {
            onCustomRangeApply(customFrom, customTo);
        }
    };

    const getClassificationTone = (classification: string): BadgeTone => {
        switch (classification) {
            case "Newly Added":
                return "emerald";
            case "Fast Mover":
                return "pink";
            case "Slow Mover":
                return "blue";
            case "Dormant Stock":
                return "amber";
            case "Dead Stock Candidate":
            case "Excess Stock Risk":
                return "rose";
            default:
                return "neutral";
        }
    };

    const getStockStatusTone = (status: string): BadgeTone => {
        switch (status) {
            case "Out of Stock":
                return "rose";
            case "Low Stock":
                return "amber";
            default:
                return "emerald";
        }
    };

    const getMetricValue = (item: MovementItem, metric: typeof chartMetric): number => {
        switch (metric) {
            case "issued_qty":
                return Number(item.total_quantity_issued || 0);
            case "daily_rate":
                return Number(item.average_daily_issued || 0);
            case "usable_stock":
                return Number(item.usable_stock || 0);
            case "transactions":
                return Number(item.issuance_transactions_count || 0);
            default:
                return 0;
        }
    };

    const getMetricLabel = (metric: typeof chartMetric): string => {
        switch (metric) {
            case "issued_qty":
                return "Total Issued Quantity (Units)";
            case "daily_rate":
                return "Average Daily Run-Rate (Units/Day)";
            case "usable_stock":
                return "Usable Stock on Hand";
            case "transactions":
                return "Warehouse Issuance Transactions Count";
            default:
                return "";
        }
    };

    const getMetricShortUnit = (metric: typeof chartMetric): string => {
        switch (metric) {
            case "issued_qty":
                return "units";
            case "daily_rate":
                return "u/day";
            case "usable_stock":
                return "units";
            case "transactions":
                return "tx";
            default:
                return "";
        }
    };

    // Chart.js lifecycle management
    useEffect(() => {
        if (!isChartVisible && viewScope !== "chart_only") return;

        const timer = setTimeout(() => {
            if (!chartCanvasRef.current) return;

            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }

            const existing = Chart.getChart(chartCanvasRef.current);
            if (existing) {
                existing.destroy();
            }

            const ctx = chartCanvasRef.current.getContext("2d");
            if (!ctx) return;

            const fastList = movementData?.fast_moving_items?.slice(0, chartLimit) || [];
            const slowList = movementData?.slow_moving_items?.slice(0, chartLimit) || [];
            const maxLen = Math.max(fastList.length, slowList.length);
            if (maxLen === 0) return;

            const labels = Array.from({ length: maxLen }, (_, i) => `Rank #${i + 1}`);

            const fastData = labels.map((_, i) => (fastList[i] ? getMetricValue(fastList[i], chartMetric) : null));
            const slowData = labels.map((_, i) => (slowList[i] ? getMetricValue(slowList[i], chartMetric) : null));

            const datasets: any[] = [];

            if (showFastLine) {
                datasets.push({
                    label: `Fast-Moving Items`,
                    data: fastData,
                    borderColor: "#ec4899",
                    backgroundColor: "rgba(236, 72, 153, 0.08)",
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: "#ec4899",
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                });
            }

            if (showSlowLine) {
                datasets.push({
                    label: `Slowest-Moving & Dormant Items`,
                    data: slowData,
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245, 158, 11, 0.08)",
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0.35,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: "#f59e0b",
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                });
            }

            chartInstanceRef.current = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: "index",
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: "top",
                            labels: {
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true,
                                pointStyle: "circle",
                                font: { size: 11, weight: "bold" },
                                color: "#64748b"
                            }
                        },
                        tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.95)",
                            titleColor: "#ffffff",
                            bodyColor: "#cbd5e1",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            borderWidth: 1,
                            padding: 12,
                            boxPadding: 6,
                            callbacks: {
                                title: (items) => {
                                    if (!items.length) return "";
                                    const idx = items[0].dataIndex;
                                    return `Velocity Comparison — Rank #${idx + 1}`;
                                },
                                afterTitle: (items) => {
                                    const idx = items[0].dataIndex;
                                    const f = fastList[idx];
                                    const s = slowList[idx];
                                    const lines: string[] = [];
                                    if (f && showFastLine) {
                                        lines.push(`⚡ Fast: [${f.item_code}] ${f.item_name}`);
                                    }
                                    if (s && showSlowLine) {
                                        const extra = s.is_zero_issue ? " (Zero Demand)" : s.days_since_last_issuance ? ` (${s.days_since_last_issuance}d inactive)` : "";
                                        lines.push(`⏳ Slow: [${s.item_code}] ${s.item_name}${extra}`);
                                    }
                                    return lines.join("\n");
                                },
                                label: (context) => {
                                    const idx = context.dataIndex;
                                    const isFast = context.datasetIndex === 0 && showFastLine;
                                    const item = isFast ? fastList[idx] : slowList[idx];
                                    const rawVal = context.parsed.y !== null ? context.parsed.y : 0;
                                    const formattedVal = chartMetric === "daily_rate" ? rawVal.toFixed(2) : rawVal.toLocaleString();
                                    const unit = item?.unit ? ` ${item.unit}` : ` ${getMetricShortUnit(chartMetric)}`;
                                    return ` ${context.dataset.label}: ${formattedVal}${unit}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: "rgba(148, 163, 184, 0.1)"
                            },
                            ticks: {
                                font: { size: 11, weight: "bold" },
                                color: "#64748b"
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: "rgba(148, 163, 184, 0.1)"
                            },
                            ticks: {
                                font: { size: 11 },
                                color: "#64748b",
                                callback: (value) => Number(value).toLocaleString()
                            }
                        }
                    }
                }
            });
        }, 80);

        return () => {
            clearTimeout(timer);
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [
        movementData,
        chartMetric,
        chartLimit,
        showFastLine,
        showSlowLine,
        isChartVisible,
        viewScope
    ]);

    // Summary calculations for chart header & widgets
    const topFastItem = movementData?.fast_moving_items?.[0];
    const topSlowItem = movementData?.slow_moving_items?.[0];
    const fastSumMetric = useMemo(() => {
        return (movementData?.fast_moving_items?.slice(0, chartLimit) || []).reduce(
            (acc, i) => acc + getMetricValue(i, chartMetric),
            0
        );
    }, [movementData?.fast_moving_items, chartLimit, chartMetric]);
    const slowSumMetric = useMemo(() => {
        return (movementData?.slow_moving_items?.slice(0, chartLimit) || []).reduce(
            (acc, i) => acc + getMetricValue(i, chartMetric),
            0
        );
    }, [movementData?.slow_moving_items, chartLimit, chartMetric]);

    return (
        <div className="space-y-6">
            {/* 1. Header Toolbar & Period Controls */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                                <i className="fas fa-arrows-up-down text-base" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                    Supply Chain Movement Velocity & Item Turnover
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Audited strictly against completed warehouse stock-out issuances with zero-consumption differentiation
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Period Selector Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            { label: "Last 30 Days", days: 30 },
                            { label: "Last 90 Days", days: 90 },
                            { label: "Last 365 Days", days: 365 }
                        ].map((btn) => (
                            <button
                                key={btn.days}
                                type="button"
                                onClick={() => onPeriodChange(btn.days)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    periodDays === btn.days && !isCustomExpanded
                                        ? "bg-pink-500 text-white shadow-[0_2px_8px_rgba(236,72,153,0.4)]"
                                        : "bg-[#ebf0f7] dark:bg-[#1b1c28] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] hover:text-pink-500"
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isCustomExpanded
                                    ? "bg-pink-500 text-white shadow-[0_2px_8px_rgba(236,72,153,0.4)]"
                                    : "bg-[#ebf0f7] dark:bg-[#1b1c28] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] hover:text-pink-500"
                            }`}
                        >
                            <i className="fas fa-calendar-range text-[10px]" />
                            <span>Custom Range</span>
                        </button>
                    </div>
                </div>

                {/* Custom Range Drawer */}
                {isCustomExpanded && (
                    <form
                        onSubmit={handleApplyCustomDate}
                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex flex-wrap items-center gap-3 pt-3"
                    >
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">From:</label>
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                required
                                className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#181926] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">To:</label>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                required
                                className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#181926] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                            />
                        </div>
                        <AppButton type="submit" variant="primary" size="sm">
                            <i className="fas fa-check text-xs mr-1" />
                            Apply Date Range
                        </AppButton>
                    </form>
                )}

                {/* Scope Information Strip */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-circle-info text-pink-500 text-[11px]" />
                        <span>
                            Analysis Period: <strong className="text-slate-700 dark:text-slate-200">{movementData?.period_days || periodDays} Calendar Days</strong> ({movementData?.start_date || "—"} to {movementData?.end_date || "—"})
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span>Active Issuances: <strong className="text-pink-600 font-bold">{movementData?.active_moving_items_count || 0} SKUs</strong></span>
                        <span>•</span>
                        <span>Zero-Issue Items: <strong className="text-slate-700 dark:text-slate-300 font-bold">{movementData?.zero_issuance_items_count || 0} SKUs</strong></span>
                    </div>
                </div>
            </div>

            {/* AI Tab Summary: Item Movement Velocity */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 text-xs">
                    <i className="fas fa-wand-magic-sparkles" />
                </div>
                <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>AI Tab Summary: Item Movement Velocity & Stock Aging Intelligence</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                            Velocity Analytics
                        </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Across <strong>{movementData?.period_days || periodDays} calendar days</strong>, <strong>{movementData?.active_moving_items_count || 0} catalog SKUs</strong> recorded completed warehouse issuances.
                        <strong>{movementData?.zero_issuance_items_count || 0} items</strong> logged zero consumption during this window, with dormant items (&gt;90 days inactive) isolated from newly added items (&le;30 days old) to protect commercial accuracy.
                    </p>
                </div>
            </div>

            {/* COMBINED LINE CHART: Fast-Moving vs Slowest-Moving & Dormant */}
            {(isChartVisible || viewScope === "chart_only") && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[10px_10px_24px_rgba(166,175,195,0.25),-10px_-10px_24px_rgba(255,255,255,0.85)] dark:shadow-[10px_10px_24px_rgba(0,0,0,0.6)] space-y-4">
                    {/* Header: Title & Controls */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-sm border border-pink-200/50 dark:border-pink-800/40">
                                <i className="fas fa-chart-line" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Combined Inventory Movement Velocity & Turnover Line Chart
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                        Dual-Series Trajectory
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Comparative rank-by-rank line trajectory contrasting Fast-Moving inventory vs Slowest-Moving & Dormant items
                                </p>
                            </div>
                        </div>

                        {/* Controls Toolbar: Metric, Limit, and Line Toggles */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Metric Selector Pills */}
                            <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                                <button
                                    type="button"
                                    onClick={() => setChartMetric("issued_qty")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        chartMetric === "issued_qty"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="Total quantity issued in period"
                                >
                                    Issued Qty
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartMetric("daily_rate")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        chartMetric === "daily_rate"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="Average daily run-rate"
                                >
                                    Daily Run-Rate
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartMetric("usable_stock")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        chartMetric === "usable_stock"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="Current usable warehouse stock on hand"
                                >
                                    Usable Stock
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartMetric("transactions")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        chartMetric === "transactions"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="Issuance transaction orders"
                                >
                                    Transactions
                                </button>
                            </div>

                            {/* Sample Size Limit Toggle */}
                            <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                                {[5, 10, 15].map((lim) => (
                                    <button
                                        key={lim}
                                        type="button"
                                        onClick={() => setChartLimit(lim)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            chartLimit === lim
                                                ? "bg-slate-800 dark:bg-slate-700 text-white shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        Rank 1-{lim}
                                    </button>
                                ))}
                            </div>

                            {/* Series Visibility Toggles */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setShowFastLine(!showFastLine)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        showFastLine
                                            ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-800"
                                            : "bg-slate-200/50 dark:bg-slate-800 text-slate-400 border-transparent opacity-60"
                                    }`}
                                    title="Toggle Fast-Moving line"
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
                                    Fast Line
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSlowLine(!showSlowLine)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        showSlowLine
                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                                            : "bg-slate-200/50 dark:bg-slate-800 text-slate-400 border-transparent opacity-60"
                                    }`}
                                    title="Toggle Slowest-Moving & Dormant line"
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                                    Slow/Dormant Line
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Chart Canvas in Neumorphic Debossed Well */}
                    <div
                        onClick={() => onOpenChartModal?.("movement")}
                        className="relative h-72 sm:h-80 w-full p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] cursor-pointer group"
                    >
                        {/* Hover Inspector Hint */}
                        <div className="absolute top-3 right-3 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-white/80 dark:bg-black/60 backdrop-blur-xs border border-pink-500/30 shadow-xs flex items-center gap-1.5">
                                <i className="fas fa-expand text-[9px]" />
                                <span>Inspect Velocity Methodology &amp; Data</span>
                            </span>
                        </div>
                        <canvas ref={chartCanvasRef} />
                    </div>

                    {/* Quick Metric Divergence Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="p-3 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/50 dark:border-pink-900/30 flex items-center justify-between">
                            <div className="text-[11px] min-w-0 pr-2">
                                <span className="text-slate-500 dark:text-slate-400 block font-medium">Fast-Moving Velocity Leader</span>
                                <strong className="text-slate-900 dark:text-white font-bold block truncate">
                                    {topFastItem ? `[${topFastItem.item_code}] ${topFastItem.item_name}` : "None"}
                                </strong>
                            </div>
                            <span className="text-xs font-black font-mono text-pink-600 dark:text-pink-400 shrink-0">
                                {topFastItem ? `${topFastItem.total_quantity_issued.toLocaleString()} ${topFastItem.unit}` : "0"}
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between">
                            <div className="text-[11px] min-w-0 pr-2">
                                <span className="text-slate-500 dark:text-slate-400 block font-medium">Zero-Demand & Dormant Stock</span>
                                <strong className="text-slate-900 dark:text-white font-bold block">
                                    {movementData?.zero_issuance_items_count || 0} SKUs Logged 0 Demand
                                </strong>
                            </div>
                            <span className="text-xs font-black font-mono text-amber-600 dark:text-amber-400 shrink-0">
                                {movementData?.zero_issue_items?.length || 0} Dormant
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                            <div className="text-[11px] min-w-0 pr-2">
                                <span className="text-slate-500 dark:text-slate-400 block font-medium">
                                    Sample ({chartLimit} items) Velocity Spread
                                </span>
                                <strong className="text-slate-900 dark:text-white font-bold block">
                                    {slowSumMetric > 0
                                        ? `${(fastSumMetric / slowSumMetric).toFixed(1)}x Divergence`
                                        : "Inf. (Zero Slow Consumption)"}
                                </strong>
                            </div>
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                {fastSumMetric.toLocaleString()} vs {slowSumMetric.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW OPTIONS TOOLBAR (View Opt) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs">
                        <i className="fas fa-sliders" />
                    </div>
                    <div>
                        <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                            <span>View Options & Presentation Controls</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {viewScope === "both"
                                    ? "Both Tables Visible"
                                    : viewScope === "fast_only"
                                    ? "Fast-Moving Table Only"
                                    : viewScope === "slow_only"
                                    ? "Slowest-Moving Table Only"
                                    : "Chart Visualizer Only"}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Separate inventory table sections with granular display density controls
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* View Scope Switcher */}
                    <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                        <button
                            type="button"
                            onClick={() => setViewScope("both")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewScope === "both"
                                    ? "bg-pink-500 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <i className="fas fa-table-cells text-[10px]" />
                            Both Tables
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewScope("fast_only")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewScope === "fast_only"
                                    ? "bg-pink-500 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <i className="fas fa-bolt text-[10px]" />
                            Fast-Moving Only
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewScope("slow_only")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewScope === "slow_only"
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <i className="fas fa-hourglass-half text-[10px]" />
                            Slow/Dormant Only
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewScope("chart_only")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewScope === "chart_only"
                                    ? "bg-slate-700 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <i className="fas fa-chart-line text-[10px]" />
                            Chart Only
                        </button>
                    </div>

                    {/* Layout Style (Table vs Cards) */}
                    {viewScope !== "chart_only" && (
                        <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                            <button
                                type="button"
                                onClick={() => setLayoutStyle("table")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    layoutStyle === "table"
                                        ? "bg-pink-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                                title="Detailed tabular view"
                            >
                                <i className="fas fa-table-list text-[10px]" />
                                Table View
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayoutStyle("cards")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    layoutStyle === "cards"
                                        ? "bg-pink-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                                title="Executive compact cards view"
                            >
                                <i className="fas fa-grip text-[10px]" />
                                Cards View
                            </button>
                        </div>
                    )}

                    {/* Chart Collapse / Expand */}
                    <button
                        type="button"
                        onClick={() => setIsChartVisible(!isChartVisible)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            isChartVisible
                                ? "bg-white/80 dark:bg-[#161722] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-xs"
                                : "bg-pink-100 dark:bg-pink-950/50 text-pink-600 border-pink-300 dark:border-pink-800"
                        }`}
                    >
                        <i className={`fas ${isChartVisible ? "fa-eye-slash" : "fa-chart-line"} text-[10px]`} />
                        {isChartVisible ? "Hide Chart" : "Show Chart"}
                    </button>
                </div>
            </div>

            {/* Informative placeholder if user chose Chart Only */}
            {viewScope === "chart_only" && (
                <div className="p-6 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto text-sm">
                        <i className="fas fa-chart-line" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                        Inventory Tables are Hidden in Chart Only View
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        To inspect detailed line items for Fast-Moving or Slowest-Moving stock, select <strong>Both Tables</strong> or switch to an individual table option in the view controls above.
                    </p>
                    <button
                        type="button"
                        onClick={() => setViewScope("both")}
                        className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-xs font-bold shadow-xs hover:bg-pink-600 transition-colors cursor-pointer"
                    >
                        Show Both Tables
                    </button>
                </div>
            )}

            {/* 2. FAST-MOVING ITEMS SECTION (Separate Table/Cards) */}
            {viewScope !== "slow_only" && viewScope !== "chart_only" && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[10px_10px_24px_rgba(166,175,195,0.25),-10px_-10px_24px_rgba(255,255,255,0.85)] dark:shadow-[10px_10px_24px_rgba(0,0,0,0.6)] space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-sm">
                                    <i className="fas fa-bolt" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Fast-Moving Inventory Items
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                            Highest Consumption Velocity
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Ranked from highest to lowest consumption based strictly on completed warehouse issuances
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Filter and Top 10 Toggle Controls */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="relative">
                                <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="Search item code/name..."
                                    value={fastSearchQuery}
                                    onChange={(e) => setFastSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] text-slate-800 dark:text-white w-44 sm:w-52"
                                />
                            </div>

                            {categories.length > 0 && (
                                <select
                                    value={fastCategoryFilter}
                                    onChange={(e) => setFastCategoryFilter(e.target.value)}
                                    className="px-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] text-slate-800 dark:text-white font-medium"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            )}

                            <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                                <button
                                    type="button"
                                    onClick={() => setFastViewLimit("top10")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        fastViewLimit === "top10"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    Top 10
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFastViewLimit("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        fastViewLimit === "all"
                                            ? "bg-pink-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    View All ({movementData?.fast_moving_items?.length || 0})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table View or Cards View */}
                    {layoutStyle === "cards" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            {displayedFastMoving.length === 0 ? (
                                <div className="col-span-full py-8 text-center text-slate-400 italic">
                                    <i className="fas fa-boxes-packing text-2xl mb-2 block opacity-40" />
                                    No warehouse stock issuance records found for the selected {periodDays}-day window.
                                </div>
                            ) : (
                                displayedFastMoving.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold">
                                                    #{index + 1} • {item.item_code}
                                                </span>
                                                <StatusBadge tone={getStockStatusTone(item.stock_status)} dot>
                                                    {item.stock_status}
                                                </StatusBadge>
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                                                {item.item_name}
                                            </h4>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Category: {item.category}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Total Issued</span>
                                                <strong className="text-slate-900 dark:text-white font-mono">{item.total_quantity_issued.toLocaleString()} {item.unit}</strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Daily Run-Rate</span>
                                                <strong className="text-pink-600 dark:text-pink-400 font-mono">{item.average_daily_issued.toFixed(2)}/day</strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Usable Stock</span>
                                                <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{item.usable_stock.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Orders</span>
                                                <span className="font-mono text-slate-600 dark:text-slate-400">{item.issuance_transactions_count} logs</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-slate-800">
                                        <th className="py-3 px-3.5 text-center w-12">#</th>
                                        <th className="py-3 px-3.5">Item Code & Description</th>
                                        <th className="py-3 px-3.5">Category</th>
                                        <th className="py-3 px-3.5 text-right">Total Issued Qty</th>
                                        <th className="py-3 px-3.5 text-center">Transactions</th>
                                        <th className="py-3 px-3.5 text-right">Avg Daily Issued</th>
                                        <th className="py-3 px-3.5 text-right">Usable Stock</th>
                                        <th className="py-3 px-3.5 text-right">Safety Min</th>
                                        <th className="py-3 px-3.5 text-center">Last Issuance</th>
                                        <th className="py-3 px-3.5 text-center">Stock Posture</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                                    {displayedFastMoving.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                                                <i className="fas fa-boxes-packing text-2xl mb-2 block opacity-40" />
                                                No warehouse stock issuance records found for the selected {periodDays}-day window.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedFastMoving.map((item, index) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-pink-50/50 dark:hover:bg-pink-950/15 transition-colors"
                                            >
                                                <td className="py-3 px-3.5 text-center font-bold text-pink-600 dark:text-pink-400">
                                                    #{index + 1}
                                                </td>
                                                <td className="py-3 px-3.5">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        {item.item_name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        {item.item_code}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3.5">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-black text-slate-900 dark:text-white">
                                                    {item.total_quantity_issued.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                </td>
                                                <td className="py-3 px-3.5 text-center font-semibold">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                                        {item.issuance_transactions_count} orders
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-mono font-bold text-pink-600 dark:text-pink-400">
                                                    {item.average_daily_issued.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">/day</span>
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                                                    {item.usable_stock.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3.5 text-right text-slate-500 font-mono">
                                                    {item.minimum_stock.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3.5 text-center text-[11px] text-slate-500">
                                                    {item.last_issuance_date || "N/A"}
                                                </td>
                                                <td className="py-3 px-3.5 text-center">
                                                    <StatusBadge
                                                        tone={getStockStatusTone(item.stock_status)}
                                                        dot
                                                    >
                                                        {item.stock_status}
                                                    </StatusBadge>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="p-3 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/50 dark:border-pink-900/30 text-[11px] text-pink-900 dark:text-pink-300 flex items-center gap-2">
                        <i className="fas fa-calculator text-pink-500" />
                        <span>
                            <strong>Daily Run-Rate Calculation:</strong> Average daily quantity issued = (Net completed issuance quantity) ÷ ({movementData?.period_days || periodDays} calendar days in period), counting zero-demand calendar days in the denominator to avoid demand overestimation.
                        </span>
                    </div>
                </div>
            )}

            {/* 3. SLOWEST-MOVING ITEMS SECTION (Separate Table/Cards) */}
            {viewScope !== "fast_only" && viewScope !== "chart_only" && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[10px_10px_24px_rgba(166,175,195,0.25),-10px_-10px_24px_rgba(255,255,255,0.85)] dark:shadow-[10px_10px_24px_rgba(0,0,0,0.6)] space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                                    <i className="fas fa-hourglass-half" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Slowest-Moving & Dormant Inventory Items
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            Low-Turnover & Zero-Demand
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Low-consumption inventory. Zero-issuance items are separated from active low-turnover items with defensible classification.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Sub-view filter: All, Zero only, Low only */}
                            <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                                <button
                                    type="button"
                                    onClick={() => setSlowMovementFilter("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slowMovementFilter === "all"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    All Slow/Zero
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSlowMovementFilter("zero")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slowMovementFilter === "zero"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    Zero Issues ({movementData?.zero_issuance_items_count || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSlowMovementFilter("low")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slowMovementFilter === "low"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    Low Issues (&gt;0)
                                </button>
                            </div>

                            <div className="relative">
                                <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="Search slow items..."
                                    value={slowSearchQuery}
                                    onChange={(e) => setSlowSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] text-slate-800 dark:text-white w-40 sm:w-48"
                                />
                            </div>

                            <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)]">
                                <button
                                    type="button"
                                    onClick={() => setSlowViewLimit("bottom10")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slowViewLimit === "bottom10"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    Bottom 10
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSlowViewLimit("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slowViewLimit === "all"
                                            ? "bg-amber-500 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    }`}
                                >
                                    View All ({movementData?.slow_moving_items?.length || 0})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table View or Cards View */}
                    {layoutStyle === "cards" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            {displayedSlowMoving.length === 0 ? (
                                <div className="col-span-full py-8 text-center text-slate-400 italic">
                                    <i className="fas fa-cubes text-2xl mb-2 block opacity-40" />
                                    No inventory records match the selected slow movement filters.
                                </div>
                            ) : (
                                displayedSlowMoving.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                                                    #{idx + 1} • {item.item_code}
                                                </span>
                                                <StatusBadge tone={getClassificationTone(item.movement_classification)} dot>
                                                    {item.movement_classification}
                                                </StatusBadge>
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                                                {item.item_name}
                                            </h4>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Category: {item.category}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Period Issued</span>
                                                <strong className="text-slate-900 dark:text-white font-mono">
                                                    {item.total_quantity_issued === 0 ? "0 units" : `${item.total_quantity_issued.toLocaleString()} ${item.unit}`}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Inactivity</span>
                                                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                                                    {item.days_since_last_issuance !== null ? `${item.days_since_last_issuance}d` : "Never"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Usable Stock</span>
                                                <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{item.usable_stock.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Safety Min</span>
                                                <span className="font-mono text-slate-500">{item.minimum_stock.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-slate-800">
                                        <th className="py-3 px-3.5">Item Code & Name</th>
                                        <th className="py-3 px-3.5">Category</th>
                                        <th className="py-3 px-3.5 text-right">Period Issued Qty</th>
                                        <th className="py-3 px-3.5 text-center">Transactions</th>
                                        <th className="py-3 px-3.5 text-right">Usable Stock</th>
                                        <th className="py-3 px-3.5 text-right">Safety Min</th>
                                        <th className="py-3 px-3.5 text-center">Last Issuance</th>
                                        <th className="py-3 px-3.5 text-center">Inactivity (Days)</th>
                                        <th className="py-3 px-3.5 text-center">Classification & Rule</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                                    {displayedSlowMoving.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                                                <i className="fas fa-cubes text-2xl mb-2 block opacity-40" />
                                                No inventory records match the selected slow movement filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedSlowMoving.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-amber-50/50 dark:hover:bg-amber-950/15 transition-colors"
                                            >
                                                <td className="py-3 px-3.5">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        {item.item_name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        {item.item_code}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3.5">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-black">
                                                    {item.total_quantity_issued === 0 ? (
                                                        <span className="text-slate-400 font-mono">0 {item.unit}</span>
                                                    ) : (
                                                        <span className="text-slate-900 dark:text-white font-mono">
                                                            {item.total_quantity_issued.toLocaleString()} {item.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3.5 text-center">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {item.issuance_transactions_count}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                                                    {item.usable_stock.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3.5 text-right text-slate-500 font-mono">
                                                    {item.minimum_stock.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3.5 text-center text-[11px]">
                                                    {item.last_issuance_date ? (
                                                        <span className="text-slate-600 dark:text-slate-400 font-mono">{item.last_issuance_date}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Never Issued</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3.5 text-center">
                                                    {item.days_since_last_issuance !== null ? (
                                                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                            {item.days_since_last_issuance} days
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-[10px] italic">No historic issues</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3.5 text-center">
                                                    <StatusBadge
                                                        tone={getClassificationTone(item.movement_classification)}
                                                        dot
                                                    >
                                                        {item.movement_classification}
                                                    </StatusBadge>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Explanatory Rule Footer */}
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
                        <i className="fas fa-shield-halved text-amber-500 mt-0.5" />
                        <div className="space-y-0.5">
                            <strong className="block font-bold">Defensible Movement Classification Rules:</strong>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Newly added catalog items (created &le; 30 days ago) with 0 consumption are designated as <strong className="text-emerald-600 dark:text-emerald-400">Newly Added</strong> rather than dead stock. Items with zero consumption older than 90 days are flagged as <strong className="text-amber-600 dark:text-amber-400">Dormant Stock</strong>, and items with excess usable units &gt; 3x safety minimum with negligible run-rate are tagged as <strong className="text-rose-600 dark:text-rose-400">Excess Stock Risk</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
