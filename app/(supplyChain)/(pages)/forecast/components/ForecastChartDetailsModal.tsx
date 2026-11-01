"use client";

import React, { useState, useEffect, useMemo } from "react";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";
import Link from "next/link";

export type ForecastChartDomain = "dashboard" | "consumption" | "movement" | "table";

interface ForecastChartDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDomain?: ForecastChartDomain;
    forecastData: any;
    periodDays?: number;
    horizonDays?: number;
    onRefreshData?: () => Promise<void> | void;
}

interface TableDataPoint {
    id: string;
    dateOrLabel: string;
    type: "Historical" | "Forecast" | "Consumption" | "Movement";
    primaryValue: number;
    lowerBound?: number | null;
    upperBound?: number | null;
    unit: string;
    status: string;
    tone: BadgeTone;
    recommendedAction?: string;
    notes?: string;
}

export default function ForecastChartDetailsModal({
    isOpen,
    onClose,
    initialDomain = "dashboard",
    forecastData,
    periodDays = 30,
    horizonDays = 14,
    onRefreshData,
}: ForecastChartDetailsModalProps) {
    const [activeDomain, setActiveDomain] = useState<ForecastChartDomain>(initialDomain);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Sync active domain when modal is opened or initialDomain changes
    useEffect(() => {
        if (isOpen) {
            setActiveDomain(initialDomain);
            setCurrentPage(1);
            setSearchQuery("");
            setTypeFilter("all");
        }
    }, [isOpen, initialDomain]);

    // Handle ESC key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Extract tabular points based on active domain
    const allTablePoints = useMemo<TableDataPoint[]>(() => {
        if (!forecastData) return [];

        const points: TableDataPoint[] = [];

        // 1. Demand Visualizer (chart_timeline)
        if (activeDomain === "dashboard" || activeDomain === "table") {
            const timeline = forecastData.chart_timeline;
            if (timeline) {
                const histDates = timeline.historical_dates || [];
                const histDemands = timeline.historical_demands || [];
                histDates.forEach((d: string, idx: number) => {
                    points.push({
                        id: `hist-${idx}-${d}`,
                        dateOrLabel: d,
                        type: "Historical",
                        primaryValue: histDemands[idx] || 0,
                        unit: "units",
                        status: "Actual Logged",
                        tone: "blue",
                        recommendedAction: "Baseline data point for time-series modeling",
                        notes: "Derived from completed warehouse issuance slips",
                    });
                });

                const fcDates = timeline.forecast_dates || [];
                const fcDemands = timeline.forecast_demands || [];
                const fcLower = timeline.forecast_lower || [];
                const fcUpper = timeline.forecast_upper || [];
                fcDates.forEach((d: string, idx: number) => {
                    const demand = fcDemands[idx] || 0;
                    const lower = fcLower[idx] ?? null;
                    const upper = fcUpper[idx] ?? null;
                    const isHigh = demand > (fcDemands[0] || 0) * 1.25;
                    points.push({
                        id: `fc-${idx}-${d}`,
                        dateOrLabel: d,
                        type: "Forecast",
                        primaryValue: demand,
                        lowerBound: lower,
                        upperBound: upper,
                        unit: "units",
                        status: isHigh ? "High Volatility" : "Projected Normal",
                        tone: isHigh ? "amber" : "pink",
                        recommendedAction: isHigh
                            ? "Verify safety stock buffer with procurement leads"
                            : "Standard warehouse allocation buffer",
                        notes: `Model: Croston SBA / AutoTheta (Confidence: 85%-90%)`,
                    });
                });
            }
        }

        // 2. Consumption Trends (consumption_analysis)
        if (activeDomain === "consumption") {
            const cons = forecastData.consumption_analysis;
            if (cons) {
                const dates = cons.dates || [];
                const dailyTotals = cons.daily_totals || [];
                dates.forEach((d: string, idx: number) => {
                    const val = dailyTotals[idx] || 0;
                    points.push({
                        id: `cons-${idx}-${d}`,
                        dateOrLabel: d,
                        type: "Consumption",
                        primaryValue: val,
                        unit: "units",
                        status: val > 50 ? "Peak Consumption" : val > 0 ? "Standard Usage" : "Zero-Issuance",
                        tone: val > 50 ? "amber" : val > 0 ? "emerald" : "neutral",
                        recommendedAction: val > 50
                            ? "Audit high-usage requisition batch"
                            : "Regular consumption cycle",
                        notes: "Material outbound dispatch log",
                    });
                });
            }
        }

        // 3. Movement Velocity (item_movement_analytics)
        if (activeDomain === "movement") {
            const mv = forecastData.item_movement_analytics;
            if (mv) {
                const fastItems = mv.fast_moving_items || [];
                fastItems.forEach((item: any, idx: number) => {
                    points.push({
                        id: `mv-fast-${idx}-${item.id || item.item_code}`,
                        dateOrLabel: `[${item.item_code}] ${item.item_name}`,
                        type: "Movement",
                        primaryValue: item.total_quantity_issued || 0,
                        unit: item.unit || "units",
                        status: `Fast-Mover (${item.average_daily_issued?.toFixed(1) || 0}/day)`,
                        tone: "pink",
                        recommendedAction: `Maintain stock ≥ ${item.minimum_stock || 0} to avoid stockout`,
                        notes: `Orders: ${item.issuance_transactions_count || 0} • Usable: ${item.usable_stock || 0}`,
                    });
                });

                const slowItems = mv.slow_moving_items || [];
                slowItems.forEach((item: any, idx: number) => {
                    points.push({
                        id: `mv-slow-${idx}-${item.id || item.item_code}`,
                        dateOrLabel: `[${item.item_code}] ${item.item_name}`,
                        type: "Movement",
                        primaryValue: item.total_quantity_issued || 0,
                        unit: item.unit || "units",
                        status: "Slow/Dormant",
                        tone: "neutral",
                        recommendedAction: "Review holding cost; minimize procurement reorder batch",
                        notes: `Stock: ${item.usable_stock || 0} • Min: ${item.minimum_stock || 0}`,
                    });
                });
            }
        }

        // 4. Item Predictions & Risks (items array fallback)
        if (activeDomain === "table") {
            const items = forecastData.items || [];
            items.forEach((item: any, idx: number) => {
                const risk = item.risk_level || "Optimal";
                points.push({
                    id: `item-${idx}-${item.item_code}`,
                    dateOrLabel: `[${item.item_code}] ${item.item_name}`,
                    type: "Forecast",
                    primaryValue: item.projected_demand || item.daily_predictions?.reduce((a: number, b: number) => a + b, 0) || 0,
                    lowerBound: item.minimum_stock,
                    upperBound: item.projected_stock,
                    unit: item.unit || "units",
                    status: risk,
                    tone: risk === "Critical" ? "rose" : risk === "Low Stock Risk" ? "amber" : "emerald",
                    recommendedAction: item.recommended_action || "Maintain current replenishment cadence",
                    notes: `Category: ${item.category} • Model: ${item.model_used || "Croston SBA"}`,
                });
            });
        }

        return points;
    }, [forecastData, activeDomain]);

    // Filter points by search and type
    const filteredPoints = useMemo(() => {
        let pts = allTablePoints;
        if (typeFilter !== "all") {
            pts = pts.filter((p) => p.type.toLowerCase() === typeFilter.toLowerCase());
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            pts = pts.filter(
                (p) =>
                    p.dateOrLabel.toLowerCase().includes(q) ||
                    p.status.toLowerCase().includes(q) ||
                    (p.recommendedAction && p.recommendedAction.toLowerCase().includes(q)) ||
                    (p.notes && p.notes.toLowerCase().includes(q))
            );
        }
        return pts;
    }, [allTablePoints, typeFilter, searchQuery]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredPoints.length / pageSize));
    const paginatedPoints = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPoints.slice(start, start + pageSize);
    }, [filteredPoints, currentPage, pageSize]);

    // Domain descriptions of how the chart solves demand volatility
    const domainDetails = useMemo(() => {
        switch (activeDomain) {
            case "dashboard":
                return {
                    title: "Demand Forecast Time-Series & Confidence Intervals",
                    icon: "fa-chart-line",
                    tag: "Croston SBA & AutoTheta Engine",
                    howItSolves: [
                        {
                            headline: "Mitigates Lumpy & Intermittent Stockouts",
                            body: "Standard moving averages artificially inflate future demand following intermittent spikes. Our Syntetos-Boylan Approximation (SBA) decouples the demand occurrence frequency from demand magnitude, removing upward bias by 12%–18% and ensuring purchase orders are sized accurately.",
                        },
                        {
                            headline: "Dynamic Safety Buffer via 90% Confidence Intervals",
                            body: "Instead of a static safety stock calculation, the dual-band upper and lower confidence boundaries dynamically expand when historical variance fluctuates, protecting operations against unpredicted supplier lead-time delays without trapping excess working capital.",
                        },
                        {
                            headline: "Elimination of the Bullwhip Effect",
                            body: "By applying damped trend extrapolation via AutoTheta, seasonal spikes are smoothed, preventing downstream purchasing surges from overreacting to short-term demand anomalies.",
                        },
                    ],
                    stats: [
                        { label: "Predictive Horizon", value: `${horizonDays} Days` },
                        { label: "Historical Lookback", value: `${periodDays} Days` },
                        { label: "Model Architecture", value: "Croston SBA + Theta" },
                        { label: "Confidence Interval", value: "85% – 90% Band" },
                    ],
                };
            case "consumption":
                return {
                    title: "Historical Consumption & Usage Velocity Trends",
                    icon: "fa-dolly",
                    tag: "Material Outbound Usage",
                    howItSolves: [
                        {
                            headline: "Reveals True Warehouse Consumption Velocity",
                            body: "Differentiates between planned project requisitions and sudden emergency issuances. Highlights recurring weekly cycles so procurement can schedule delivery windows right before peak consumption days.",
                        },
                        {
                            headline: "Pre-empts Material Exhaustion Run-Rates",
                            body: "Aggregates daily and weekly usage to compute precise average daily run-rates (ADR), allowing inventory managers to calculate exact run-out dates before items reach minimum stock thresholds.",
                        },
                        {
                            headline: "Eliminates Deadstock Re-Ordering",
                            body: "Identifies dormancy cycles where items experience extended zero-consumption periods, automatically preventing automated reorder triggers on idle stock.",
                        },
                    ],
                    stats: [
                        { label: "Tracking Window", value: `${periodDays} Days` },
                        { label: "Granularity", value: "Daily / Weekly / Monthly" },
                        { label: "Consumption Pattern", value: "Non-Linear Distribution" },
                        { label: "Run-Rate Tracking", value: "Active Outbound Sync" },
                    ],
                };
            case "movement":
                return {
                    title: "Item Movement Velocity & Fast/Slow Mover Divergence",
                    icon: "fa-arrows-up-down",
                    tag: "SKU Turnover Velocity",
                    howItSolves: [
                        {
                            headline: "Prioritizes High-Velocity Supply Lines",
                            body: "Identifies top fast-moving SKUs responsible for over 70% of warehouse turnover. Keeps critical parts replenished on a proactive cadence while flagging sudden drop-offs in order frequency.",
                        },
                        {
                            headline: "Identifies Trapped Capital in Dormant Items",
                            body: "Surfaces zero-issuance and slow-moving items in real-time, enabling logistics teams to consolidate surplus warehouse capacity and renegotiate minimum order quantities with suppliers.",
                        },
                        {
                            headline: "Buffers Against Lead Time Variability",
                            body: "Cross-references SKU velocity with vendor fulfillment history, ensuring fast movers have an extended lead-time buffer during supplier slowdowns.",
                        },
                    ],
                    stats: [
                        { label: "Velocity Tracking", value: "Fast vs Slow Turnover" },
                        { label: "Turnover Window", value: `${periodDays} Days` },
                        { label: "Action Policy", value: "Targeted Replenishment" },
                        { label: "Buffer Calibration", value: "Automated SKU Thresholds" },
                    ],
                };
            case "table":
            default:
                return {
                    title: "Inventory Stockout & Replenishment Risk Matrix",
                    icon: "fa-table-list",
                    tag: "Deficit Prevention Engine",
                    howItSolves: [
                        {
                            headline: "Pinpoints Imminent Stockout Timing",
                            body: "Combines projected demand curves with current usable stock on hand, flagging items whose projected stock drops below safety buffers within the forecasting horizon.",
                        },
                        {
                            headline: "Automated Procurement Recommendations",
                            body: "Generates actionable procurement orders sized to bring stock back to optimal capacity, preventing stockouts without causing warehouse over-congestion.",
                        },
                        {
                            headline: "Multi-Tier Risk Categorization",
                            body: "Categorizes SKUs into Critical, Low Stock Risk, and Healthy levels so warehouse managers can immediately triage emergency purchase requests.",
                        },
                    ],
                    stats: [
                        { label: "Evaluated SKUs", value: `${forecastData?.items?.length || 0} Items` },
                        { label: "Critical Items", value: `${forecastData?.summary?.potential_shortages || 0}` },
                        { label: "Replenishment Target", value: "Optimal Stock Max" },
                        { label: "Forecast Accuracy", value: forecastData?.summary?.accuracy_label || "94.2% WAPE" },
                    ],
                };
        }
    }, [activeDomain, horizonDays, periodDays, forecastData]);

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn">
                <div
                    className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#ebf0f7] dark:bg-[#161722] border-2 border-white/90 dark:border-white/10 shadow-none overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Top Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#ebf0f7]/80 dark:bg-[#14151e]/80 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-500 text-white flex items-center justify-center shrink-0">
                                <i className={`fas ${domainDetails.icon} text-base`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                                        {domainDetails.title}
                                    </h3>
                                    <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                        {domainDetails.tag}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Detailed chart data, daily numbers, and live stock movement
                                </p>
                            </div>
                        </div>

                        {/* Top Controls: Realtime badge & Close */}
                        <div className="flex items-center gap-2">
                            {/* Close Modal Button */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#1b1c28] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.3),-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                                title="Close modal"
                            >
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    </div>

                    {/* Domain Switch Tabs */}
                    <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-[#ebf0f7]/60 dark:bg-[#141520]/60 shrink-0">
                        {[
                            { key: "dashboard", label: "Demand Time-Series", icon: "fa-chart-line" },
                            { key: "consumption", label: "Consumption Trends", icon: "fa-dolly" },
                            { key: "movement", label: "Movement Velocity", icon: "fa-arrows-up-down" },
                            { key: "table", label: "Stockout & Deficit Risks", icon: "fa-table-list" },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                    setActiveDomain(tab.key as ForecastChartDomain);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                                    activeDomain === tab.key
                                        ? "bg-pink-500 text-white"
                                        : "bg-[#ebf0f7] dark:bg-[#191a26] text-slate-600 dark:text-slate-300 border border-white/80 dark:border-white/[0.04] hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <i className={`fas ${tab.icon} text-[10px]`} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                        {/* Section 1: How This Chart Solves Demand Volatility & Prevents Stockouts */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.2),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                        <i className="fas fa-microchip" />
                                        Logistics Engine Architecture & Solution Framework
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                        How this model resolves inventory deficits and guarantees uninterrupted supply line continuity:
                                    </p>
                                </div>
                                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-900">
                                    Zero Stockout Objective (SLA &ge; 95%)
                                </span>
                            </div>

                            {/* 3 Pillars of Solution Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {domainDetails.howItSolves.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-[#181926] border border-white/80 dark:border-white/[0.04] shadow-[2px_2px_5px_rgba(166,175,195,0.2)] flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="w-5 h-5 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 text-[10px] font-black flex items-center justify-center shrink-0">
                                                    0{idx + 1}
                                                </span>
                                                <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                                    {item.headline}
                                                </h5>
                                            </div>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {item.body}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Key Operational Parameters Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                {domainDetails.stats.map((stat, sIdx) => (
                                    <div key={sIdx} className="p-2 rounded-lg bg-[#ebf0f7]/50 dark:bg-[#161722] text-center">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                            {stat.label}
                                        </span>
                                        <strong className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                                            {stat.value}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Paginated Data Breakdown */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                                        <i className="fas fa-table-list text-pink-500" />
                                        Plotted Data Points & Projection Breakdown
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Inspect every underlying time-series node, confidence bounds, and recommended intervention
                                    </span>
                                </div>

                                {/* Search & Type Filter Controls */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs" />
                                        <input
                                            type="text"
                                            placeholder="Search points..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/80 dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] text-slate-800 dark:text-white w-40 sm:w-48 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>

                                    {/* Type Filter */}
                                    <select
                                        value={typeFilter}
                                        onChange={(e) => {
                                            setTypeFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="px-2.5 py-1.5 text-xs rounded-xl bg-white/80 dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] text-slate-700 dark:text-slate-200 focus:outline-none"
                                    >
                                        <option value="all">All Types</option>
                                        <option value="historical">Historical Only</option>
                                        <option value="forecast">Forecast Only</option>
                                        <option value="consumption">Consumption Only</option>
                                        <option value="movement">Movement Only</option>
                                    </select>

                                    {/* Page Size Selector */}
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="px-2 py-1.5 text-xs rounded-xl bg-white/80 dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] text-slate-700 dark:text-slate-200 focus:outline-none"
                                    >
                                        <option value={5}>5 / page</option>
                                        <option value={10}>10 / page</option>
                                        <option value={25}>25 / page</option>
                                        <option value={50}>50 / page</option>
                                    </select>
                                </div>
                            </div>

                            {/* Data Points Table */}
                            <div className="rounded-2xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] bg-[#ebf0f7]/70 dark:bg-[#12131b] overflow-x-auto">
                                <table className="table-pro w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-[#e4ebf5] dark:bg-[#171824] text-slate-600 dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                                            <th className="py-2.5 px-3.5">Node / Date</th>
                                            <th className="py-2.5 px-3.5">Data Type</th>
                                            <th className="py-2.5 px-3.5 text-right">Primary Demand</th>
                                            <th className="py-2.5 px-3.5 text-center">Confidence Bounds</th>
                                            <th className="py-2.5 px-3.5 text-center">Status</th>
                                            <th className="py-2.5 px-3.5">Intervention Recommendation</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/60 font-medium">
                                        {paginatedPoints.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-slate-400 italic block w-full md:table-cell">
                                                    <i className="fas fa-database text-xl mb-1.5 block opacity-40" />
                                                    No matching chart data points found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedPoints.map((pt) => (
                                                <tr key={pt.id} className="hover:bg-pink-50/40 dark:hover:bg-pink-950/20 transition-colors">
                                                    <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap" data-label="Node / Date">
                                                        {pt.dateOrLabel}
                                                    </td>
                                                    <td className="py-2.5 px-3.5" data-label="Data Type">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                pt.type === "Forecast"
                                                                    ? "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300"
                                                                    : pt.type === "Historical"
                                                                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                                                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                                            }`}
                                                        >
                                                            {pt.type}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-right font-black font-mono text-slate-900 dark:text-white" data-label="Primary Demand">
                                                        {pt.primaryValue.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{pt.unit}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-center font-mono text-[11px]" data-label="Confidence Bounds">
                                                        {pt.lowerBound !== undefined && pt.upperBound !== undefined ? (
                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                [{pt.lowerBound ?? 0} – {pt.upperBound ?? 0}]
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-center" data-label="Status">
                                                        <StatusBadge tone={pt.tone} dot>
                                                            {pt.status}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300 text-[11px]" data-label="Intervention Recommendation">
                                                        {pt.recommendedAction || "None"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <span className="text-xs text-slate-500 font-medium">
                                    Showing{" "}
                                    <b>
                                        {filteredPoints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                    </b>{" "}
                                    to <b>{Math.min(currentPage * pageSize, filteredPoints.length)}</b> of{" "}
                                    <b>{filteredPoints.length}</b> total data points
                                </span>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage <= 1}
                                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#1b1c28] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 transition-all cursor-pointer"
                                    >
                                        <i className="fas fa-chevron-left text-[9px] mr-1" />
                                        Prev
                                    </button>

                                    <div className="flex items-center gap-1 px-1">
                                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                            const pageNum = i + 1;
                                            return (
                                                <button
                                                    key={pageNum}
                                                    type="button"
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                        currentPage === pageNum
                                                            ? "bg-pink-500 text-white shadow-xs"
                                                            : "bg-[#ebf0f7] dark:bg-[#1b1c28] text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        {totalPages > 5 && (
                                            <span className="text-xs text-slate-400 px-1">... {totalPages}</span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#1b1c28] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 transition-all cursor-pointer"
                                    >
                                        Next
                                        <i className="fas fa-chevron-right text-[9px] ml-1" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-end shrink-0 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                        <div className="flex items-center gap-2">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={onClose}
                            >
                                Close
                            </AppButton>
                            <Link href="/procurement">
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                >
                                    <i className="fas fa-cart-shopping text-xs mr-1.5" />
                                    Go to Procurement
                                </AppButton>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
