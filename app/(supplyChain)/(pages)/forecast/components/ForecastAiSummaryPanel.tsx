"use client";

import React, { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { AppButton } from "../../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";

export interface TabSummaryTableRow {
    tabKey: string;
    tabName: string;
    icon: string;
    metricsDisplay: string;
    healthStatus: string;
    statusTone: BadgeTone;
    findings: string[];
    recommendation: string;
}

interface SummarySection {
    title: string;
    content: string;
    tabKey: string;
}

interface ForecastAiSummaryPanelProps {
    forecastData: any;
    activeTab?: string;
    onSelectTab?: (tabKey: "dashboard" | "table" | "consumption" | "movement" | "history") => void;
    onOpenChartModal?: (domain: string) => void;
}

const TAB_OPTIONS = [
    { key: "all", label: "All Forecast Domains", icon: "fa-table-cells" },
    { key: "dashboard", label: "Demand Visualizer", icon: "fa-chart-line" },
    { key: "table", label: "Item Predictions & Risks", icon: "fa-table-list" },
    { key: "consumption", label: "Consumption Trends", icon: "fa-dolly" },
    { key: "movement", label: "Movement Velocity", icon: "fa-arrows-up-down" },
    { key: "history", label: "Validation & Accuracy", icon: "fa-bullseye" },
];

export default function ForecastAiSummaryPanel({
    forecastData,
    activeTab = "dashboard",
    onSelectTab,
    onOpenChartModal
}: ForecastAiSummaryPanelProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [rawSummary, setRawSummary] = useState<string>("");
    const [sections, setSections] = useState<SummarySection[]>([]);
    const [tableRows, setTableRows] = useState<TabSummaryTableRow[]>([]);
    const [selectedTabFilter, setSelectedTabFilter] = useState<string>("all");
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Run AI analysis
    const runAnalysis = useCallback(async () => {
        if (!forecastData) {
            toast.error("Forecast data is not available yet.");
            return;
        }

        try {
            setAnalyzing(true);
            const res = await fetch("/forecast/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    forecastData,
                }),
            });

            const resJson = await res.json();
            if (resJson.success) {
                setRawSummary(resJson.summary);
                setSections(resJson.sections || []);
                setTableRows(resJson.tableRows || []);
                setHasGenerated(true);
                setIsMinimized(false);
                toast.success("AI Forecast summary matrix generated successfully");
            } else {
                throw new Error(resJson.error || "Failed to generate AI summary");
            }
        } catch (err: any) {
            console.error("Forecast AI summary error:", err);
            toast.error(err.message || "Failed to generate AI forecast summary");
        } finally {
            setAnalyzing(false);
        }
    }, [forecastData]);

    // Filter table rows based on user tab filter and search query
    const filteredTableRows = useMemo(() => {
        let rows = [...tableRows];
        if (selectedTabFilter !== "all") {
            rows = rows.filter((r) => r.tabKey === selectedTabFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            rows = rows.filter(
                (r) =>
                    r.tabName.toLowerCase().includes(q) ||
                    r.metricsDisplay.toLowerCase().includes(q) ||
                    r.recommendation.toLowerCase().includes(q) ||
                    r.findings.some((f) => f.toLowerCase().includes(q))
            );
        }
        return rows;
    }, [tableRows, selectedTabFilter, searchQuery]);

    // Critical shortage items for deep-dive table
    const criticalItems = useMemo(() => {
        const items = forecastData?.items || [];
        return items.filter((i: any) => i.risk_level === "Critical" || i.risk_level === "Low Stock Risk").slice(0, 5);
    }, [forecastData]);

    // Copy full briefing
    const handleCopy = () => {
        if (!rawSummary) return;
        navigator.clipboard.writeText(rawSummary);
        toast.success("Forecast AI summary copied to clipboard.");
    };

    const handleJumpToTab = (tabKey: string) => {
        if (onSelectTab) {
            onSelectTab(tabKey as any);
        }
    };

    // 1. MINIMIZED STATE VIEW
    if (isMinimized) {
        return (
            <div
                id="forecast-ai-summary-panel"
                className="p-3.5 sm:p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_12px_rgba(166,175,195,0.25),-4px_-4px_12px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.5)] flex flex-wrap items-center justify-between gap-3 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] flex items-center justify-center text-pink-500 shrink-0 text-xs">
                        <i className="fas fa-wand-magic-sparkles" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                Forecast AI Summary Matrix
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                                {hasGenerated ? `${tableRows.length} Domains Audited` : "Ready"}
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                            Synthesizing Demand Curves, Stockout Risks, Consumption, and Inventory Velocity
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <AppButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={runAnalysis}
                        disabled={analyzing}
                    >
                        <i className={`fas fa-wand-magic-sparkles text-xs mr-1.5 ${analyzing ? "fa-spin" : ""}`} />
                        <span>{analyzing ? "Analyzing..." : "Summarize Everything with AI"}</span>
                    </AppButton>

                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25)] hover:text-pink-600 transition-colors cursor-pointer"
                        title="Expand Forecast Summary Matrix"
                    >
                        <i className="fas fa-expand text-[10px]" />
                        <span>View Tables</span>
                    </button>
                </div>
            </div>
        );
    }

    // 2. INITIAL UN-GENERATED HERO CARD
    if (!hasGenerated && !analyzing) {
        return (
            <div
                id="forecast-ai-summary-panel"
                className="p-6 sm:p-7 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4 text-center sm:text-left transition-all"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0 text-lg">
                            <i className="fas fa-wand-magic-sparkles" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                Forecast AI Intelligence & Multi-Tab Summary
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                    Gemini Grounded
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Automatically audit and summarize each forecast tab (Demand Visualizer, Stockout Risks, Consumption Trends, and Movement Velocity) and display findings through structured comparison tables.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-center sm:self-auto">
                        <AppButton
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={runAnalysis}
                            disabled={analyzing}
                        >
                            <i className="fas fa-wand-magic-sparkles text-xs mr-2" />
                            <span>Summarize Everything with AI</span>
                        </AppButton>

                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="w-9 h-9 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25)] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            title="Minimize"
                        >
                            <i className="fas fa-minus text-xs" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. FULL EXPANDED VIEW WITH TABLES
    return (
        <div
            id="forecast-ai-summary-panel"
            className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4 transition-all"
        >
            {/* 3-Year Historical Data Safeguard Notice */}
            {forecastData?.summary?.has_three_years_history === false && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] flex items-start gap-3">
                    <i className="fas fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0 text-sm" />
                    <div className="text-xs leading-relaxed">
                        <span className="font-bold uppercase tracking-wider block text-amber-700 dark:text-amber-300">
                            Data Is Not Enough For Prediction — 0% AI Confidence
                        </span>
                        Historical inventory movements span only <b>{forecastData.summary.history_span_days || 0} days</b>, which does not satisfy the mandatory 3-year (1,095-day) threshold. Predictive extrapolation is suppressed. The audit matrix below reflects actual recorded issuances and current warehouse stock counts.
                    </div>
                </div>
            )}

            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                        <i className="fas fa-table-list text-sm" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            Forecast AI Summary Matrix
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                Tabular AI Intelligence
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Comprehensive tabular synthesis analyzing live time-series demand models, safety stocks, and stockout risks.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {rawSummary && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] hover:text-pink-600 transition-colors cursor-pointer"
                            title="Copy full briefing to clipboard"
                        >
                            <i className="fa-regular fa-copy text-[11px]" />
                            <span className="hidden sm:inline">Copy Briefing</span>
                        </button>
                    )}

                    <AppButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={runAnalysis}
                        disabled={analyzing}
                    >
                        <i className={`fas fa-wand-magic-sparkles text-xs mr-1.5 ${analyzing ? "fa-spin" : ""}`} />
                        <span>{analyzing ? "Analyzing..." : "Summarize Everything with AI"}</span>
                    </AppButton>

                    {/* Minimize Button */}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25)] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Minimize AI Summary to single row"
                    >
                        <i className="fas fa-minus text-[10px]" />
                        <span className="text-[11px]">Minimize</span>
                    </button>
                </div>
            </div>

            {/* Filter Pills & Table Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {TAB_OPTIONS.map((tab) => {
                        const isSelected = selectedTabFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSelectedTabFilter(tab.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    isSelected
                                        ? "bg-pink-600 text-white shadow-[0_3px_10px_rgba(236,72,153,0.35)]"
                                        : "bg-[#ebf0f7] dark:bg-[#12131b] text-slate-600 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25)] hover:text-pink-600"
                                }`}
                            >
                                <i className={`fas ${tab.icon} text-[10px]`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative min-w-[200px]">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                        type="text"
                        placeholder="Search matrix table..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
            </div>

            {/* Loading Indicator */}
            {analyzing && (
                <div className="p-8 text-center space-y-3 bg-[#ebf0f7] dark:bg-[#12131b] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                    <div className="w-10 h-10 mx-auto rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[3px_3px_8px_rgba(166,175,195,0.4),-3px_-3px_8px_rgba(255,255,255,0.95)] text-pink-500 flex items-center justify-center animate-spin">
                        <i className="fa-solid fa-circle-notch text-base" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Analyzing Forecast Data & Building AI Matrix Table...
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Synthesizing time-series predictions, safety buffer breaches, consumption trends, and movement velocity into structured tables.
                    </p>
                </div>
            )}

            {/* MAIN AI SUMMARY TABLES */}
            {!analyzing && (
                <div className="space-y-4">
                    {/* 1. Cross-Tab AI Summary Matrix Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#ebf0f7] dark:bg-[#12131b] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                                    <th className="py-3 px-4 min-w-[170px]">Forecast Domain / Tab</th>
                                    <th className="py-3 px-4 min-w-[190px]">Audited Metrics</th>
                                    <th className="py-3 px-4 text-center min-w-[120px]">AI Status</th>
                                    <th className="py-3 px-4 min-w-[280px]">AI Key Findings</th>
                                    <th className="py-3 px-4 min-w-[250px]">Strategic Logistics Action</th>
                                    <th className="py-3 px-4 text-right min-w-[100px]">Navigation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                                {filteredTableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400">
                                            No forecast domains match your search query.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTableRows.map((row) => (
                                        <tr
                                            key={row.tabKey}
                                            className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            {/* Tab & Icon */}
                                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[1px_1px_3px_rgba(166,175,195,0.25)] flex items-center justify-center text-pink-500 shrink-0 text-xs">
                                                        <i className={`fas ${row.icon}`} />
                                                    </div>
                                                    <div>
                                                        <span>{row.tabName}</span>
                                                        <span className="block text-[10px] text-slate-400 font-normal">
                                                            /{row.tabKey}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Audited Metrics */}
                                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                {row.metricsDisplay}
                                            </td>

                                            {/* AI Health Status */}
                                            <td className="py-3.5 px-4 text-center">
                                                <StatusBadge tone={row.statusTone} size="xs">
                                                    {row.healthStatus}
                                                </StatusBadge>
                                            </td>

                                            {/* AI Key Findings (Bulleted List in Cell) */}
                                            <td className="py-3.5 px-4">
                                                <ul className="space-y-1 text-[11px] list-disc pl-4 text-slate-600 dark:text-slate-300">
                                                    {row.findings.map((finding, fIdx) => (
                                                        <li key={fIdx} className="leading-snug">{finding}</li>
                                                    ))}
                                                </ul>
                                            </td>

                                            {/* Strategic Recommendation */}
                                            <td className="py-3.5 px-4 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed pl-3 border-l-2 border-pink-500/20">
                                                {row.recommendation}
                                            </td>

                                            {/* Action Link to Jump to Tab */}
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onOpenChartModal) {
                                                            onOpenChartModal(row.tabKey);
                                                        } else {
                                                            handleJumpToTab(row.tabKey);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] hover:text-pink-700 transition-colors cursor-pointer"
                                                    title="Open chart modal and view methodology"
                                                >
                                                    <span>Open</span>
                                                    <i className="fas fa-chevron-right text-[9px]" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 2. Detailed Critical Deficit Table Breakdown */}
                    {(selectedTabFilter === "all" || selectedTabFilter === "table") && criticalItems.length > 0 && (
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-triangle-exclamation text-rose-500" />
                                Priority Inventory Shortages & Reorder Requirements
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-[#f0f3f8] dark:bg-[#161722] text-slate-500 text-[10px] font-bold uppercase border-b border-slate-200/60 dark:border-slate-800">
                                            <th className="p-2.5">Item Name & SKU</th>
                                            <th className="p-2.5 text-center">Current Stock</th>
                                            <th className="p-2.5 text-center">Forecast Demand</th>
                                            <th className="p-2.5 text-center">Incoming POs</th>
                                            <th className="p-2.5 text-center">Projected Stock</th>
                                            <th className="p-2.5 text-center">Risk Level</th>
                                            <th className="p-2.5">Recommended Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800">
                                        {criticalItems.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20">
                                                <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                                                    <div>{item.item_name}</div>
                                                    <span className="text-[10px] text-slate-400 font-mono font-normal">{item.item_code}</span>
                                                </td>
                                                <td className="p-2.5 text-center font-mono">{item.current_stock}</td>
                                                <td className="p-2.5 text-center font-mono font-bold text-pink-600">{item.forecast_demand}</td>
                                                <td className="p-2.5 text-center font-mono text-emerald-600">{item.expected_incoming || 0}</td>
                                                <td className={`p-2.5 text-center font-mono font-bold ${item.projected_stock < 0 ? "text-rose-600" : "text-amber-600"}`}>
                                                    {item.projected_stock}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <StatusBadge tone={item.risk_level === "Critical" ? "rose" : "amber"} size="xs">
                                                        {item.risk_level}
                                                    </StatusBadge>
                                                </td>
                                                <td className="p-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                                                    {item.recommended_action || "Issue PO replenishment to maintain safety stock"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
