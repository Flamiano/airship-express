"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppButton } from "../../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";
import { type ExecutiveDataPayload } from "../hooks/useExecutiveData";

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

interface ExecutiveAiSummaryPanelProps {
    data: ExecutiveDataPayload;
    activeDashboardTab?: string;
    onSelectTab?: (tabKey: string) => void;
}

const TAB_OPTIONS = [
    { key: "all", label: "All Tabs Matrix", icon: "fa-table-cells" },
    { key: "overview", label: "Overview", icon: "fa-chart-pie" },
    { key: "issued-pos", label: "Issued POs", icon: "fa-file-invoice-dollar" },
    { key: "defects-replacements", label: "Defects & Replacements", icon: "fa-shield-halved" },
    { key: "operations", label: "Operations", icon: "fa-boxes-stacked" },
    { key: "kpis", label: "KPI Deep Dive", icon: "fa-tachometer-alt" },
];

export default function ExecutiveAiSummaryPanel({
    data,
    activeDashboardTab = "overview",
    onSelectTab
}: ExecutiveAiSummaryPanelProps) {
    const router = useRouter();
    const [analyzing, setAnalyzing] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [rawSummary, setRawSummary] = useState<string>("");
    const [sections, setSections] = useState<SummarySection[]>([]);
    const [tableRows, setTableRows] = useState<TabSummaryTableRow[]>([]);
    const [selectedTabFilter, setSelectedTabFilter] = useState<string>("all");
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Run AI analysis
    const runAnalysis = useCallback(async (tabToAnalyze: string = "all") => {
        try {
            setAnalyzing(true);
            const res = await fetch("/executive/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    executiveData: data,
                    activeTab: tabToAnalyze,
                }),
            });

            const resJson = await res.json();
            if (resJson.success) {
                setRawSummary(resJson.summary);
                setSections(resJson.sections || []);
                setTableRows(resJson.tableRows || []);
                setHasGenerated(true);
                setIsMinimized(false);
                toast.success("Executive AI summary matrix generated successfully");
            } else {
                throw new Error(resJson.error || "Failed to generate AI summary");
            }
        } catch (err: any) {
            console.error("Executive AI summary error:", err);
            toast.error(err.message || "Failed to generate AI executive summary");
        } finally {
            setAnalyzing(false);
        }
    }, [data]);

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

    // Copy full briefing to clipboard
    const handleCopy = () => {
        if (!rawSummary) return;
        navigator.clipboard.writeText(rawSummary);
        toast.success("Executive AI summary copied to clipboard.");
    };

    const handleJumpToTab = (tabKey: string) => {
        if (onSelectTab) {
            onSelectTab(tabKey);
        } else {
            router.replace(`?tab=${tabKey}`, { scroll: false });
        }
    };

    // MINIMIZED STATE VIEW
    if (isMinimized) {
        return (
            <div id="executive-ai-summary-panel" className="p-3.5 sm:p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_12px_rgba(166,175,195,0.25),-4px_-4px_12px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.5)] flex flex-wrap items-center justify-between gap-3 transition-all">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] flex items-center justify-center text-pink-500 shrink-0 text-xs">
                        <i className="fas fa-wand-magic-sparkles" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                Executive AI Summary Matrix
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                                {hasGenerated ? `${tableRows.length} Tabs Audited` : "Ready"}
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                            Synthesizing Overview, Issued POs, Defects, Replacements, and Operations
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <AppButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => runAnalysis("all")}
                        disabled={analyzing}
                    >
                        <i className={`fas fa-wand-magic-sparkles text-xs mr-1.5 ${analyzing ? "fa-spin" : ""}`} />
                        <span>{analyzing ? "Analyzing..." : "Summarize Everything with AI"}</span>
                    </AppButton>

                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25)] hover:text-pink-600 transition-colors cursor-pointer"
                        title="Expand AI Summary Matrix"
                    >
                        <i className="fas fa-expand text-[10px]" />
                        <span>View Tables</span>
                    </button>
                </div>
            </div>
        );
    }

    // INITIAL STATE: Prompt to Summarize Everything
    if (!hasGenerated && !analyzing) {
        return (
            <div id="executive-ai-summary-panel" className="p-6 sm:p-7 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4 text-center sm:text-left transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0 text-lg">
                            <i className="fas fa-wand-magic-sparkles" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                Executive AI Intelligence & Cross-Tab Summary
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                    Gemini Grounded
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Automatically audit and summarize each dashboard tab (Overview, Issued POs, Defects, Replacements, and Operations) and display the findings through structured comparison tables.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-center sm:self-auto">
                        <AppButton
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => runAnalysis("all")}
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

    // FULL EXPANDED VIEW WITH TABLES
    return (
        <div id="executive-ai-summary-panel" className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4 transition-all">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                        <i className="fas fa-table-list text-sm" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            Executive AI Cross-Tab Summary Matrix
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                Tabular AI Intelligence
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Comprehensive tabular synthesis analyzing live database records across all dashboard tabs.
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
                        onClick={() => runAnalysis(selectedTabFilter)}
                        disabled={analyzing}
                    >
                        <i className={`fas fa-wand-magic-sparkles text-xs mr-1.5 ${analyzing ? "fa-spin" : ""}`} />
                        <span>{analyzing ? "Analyzing Data..." : "Summarize Everything with AI"}</span>
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
                        Analyzing All Tabs & Building AI Matrix Table...
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Synthesizing purchase orders, warehouse damage reports, replacement shipments, and storage units into structured executive tables.
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
                                    <th className="py-3 px-4 min-w-[170px]">Dashboard Tab</th>
                                    <th className="py-3 px-4 min-w-[190px]">Audited Metrics</th>
                                    <th className="py-3 px-4 text-center min-w-[120px]">AI Status</th>
                                    <th className="py-3 px-4 min-w-[280px]">AI Key Findings</th>
                                    <th className="py-3 px-4 min-w-[250px]">Strategic Recommendation</th>
                                    <th className="py-3 px-4 text-right min-w-[100px]">Navigation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                                {filteredTableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400">
                                            No tab summaries match your search query.
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
                                                    onClick={() => handleJumpToTab(row.tabKey)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] hover:text-pink-700 transition-colors cursor-pointer"
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

                    {/* 2. Specific Tab Detailed Table when a single domain is selected */}
                    {selectedTabFilter === "issued-pos" && (
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-file-invoice text-pink-500" />
                                Issued Purchase Orders Audit Breakdown
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-[#f0f3f8] dark:bg-[#161722] text-slate-500 text-[10px] font-bold uppercase border-b border-slate-200/60 dark:border-slate-800">
                                            <th className="p-2.5">PO Number</th>
                                            <th className="p-2.5">Supplier</th>
                                            <th className="p-2.5 text-right">Total Outlay</th>
                                            <th className="p-2.5 text-center">Fulfillment</th>
                                            <th className="p-2.5 text-center">Financial Sign-Off</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800">
                                        {(data?.issuedPOsAnalytics?.issuedOrdersList || []).slice(0, 5).map((po) => (
                                            <tr key={po.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20">
                                                <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{po.po_number}</td>
                                                <td className="p-2.5">{po.supplier_name}</td>
                                                <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">₱{po.total_amount.toLocaleString()}</td>
                                                <td className="p-2.5 text-center"><StatusBadge tone={po.delivery_status === "Fully Received" ? "emerald" : "amber"} size="xs">{po.delivery_status}</StatusBadge></td>
                                                <td className="p-2.5 text-center"><StatusBadge tone="neutral" size="xs">{po.financial_approval || "Approved"}</StatusBadge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {selectedTabFilter === "defects-replacements" && (
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-boxes-packing text-rose-500" />
                                Defective Incidents & Replacement Delivery Tracking
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-800">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-[#f0f3f8] dark:bg-[#161722] text-slate-500 text-[10px] font-bold uppercase border-b border-slate-200/60 dark:border-slate-800">
                                            <th className="p-2.5">Reference #</th>
                                            <th className="p-2.5">Item Name</th>
                                            <th className="p-2.5 text-center">Defective Qty</th>
                                            <th className="p-2.5 text-center">Received Replacement</th>
                                            <th className="p-2.5 text-center">Outstanding</th>
                                            <th className="p-2.5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800">
                                        {(data?.replacementAnalytics?.replacementCases || []).slice(0, 5).map((rep) => (
                                            <tr key={rep.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20">
                                                <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{rep.return_request_number}</td>
                                                <td className="p-2.5 font-semibold">{rep.item_name}</td>
                                                <td className="p-2.5 text-center font-bold text-rose-600">{rep.defective_quantity}</td>
                                                <td className="p-2.5 text-center font-bold text-emerald-600">{rep.replacement_quantity_received}</td>
                                                <td className="p-2.5 text-center font-bold">{rep.outstanding_quantity}</td>
                                                <td className="p-2.5 text-center"><StatusBadge tone={rep.outstanding_quantity === 0 ? "emerald" : "amber"} size="xs">{rep.outstanding_quantity === 0 ? "Fulfilled" : "Pending"}</StatusBadge></td>
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
