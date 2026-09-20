"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { useUserRole } from "@/app/(supplyChain)/components/global/UnauthorizedEmptyState";

interface MonthOption {
    value: string;
    label: string;
    year: number;
    monthIndex: number;
    monthName: string;
    parcelCount: number;
    poCount: number;
}

interface MonthlyMetrics {
    month: string;
    monthName: string;
    parcels: {
        total: number;
        peakDay: { date: string; count: number };
        busiestDayOfWeek: { day: string; count: number };
        busiestHourWindow: { timeRange: string; count: number };
        courierCounts: Record<string, number>;
        statusCounts: Record<string, number>;
        projectedNextMonthVolume: number;
    };
    purchaseOrders: {
        totalPOs: number;
        totalSpend: number;
        paidCount: number;
        unpaidCount: number;
        poStatusCounts: Record<string, number>;
        topSuppliers: { name: string; total: number; count: number }[];
        largestPO: { po_number: string; supplier_name: string; total_amount: number };
        projectedNextMonthSpend: number;
    };
    inventoryVelocity: {
        totalInventoryItems: number;
        fastDepletingCount: number;
        fastDepleting: {
            id: string | number;
            item_code: string;
            item_name: string;
            category: string;
            current_stock: number;
            minimum_stock: number;
            unit: string;
            status: string;
            storage_location: string;
            supplier: string;
            riskLevel: "Critical" | "High" | "Moderate";
        }[];
        untouchedCount: number;
        untouched: {
            id: string | number;
            item_code: string;
            item_name: string;
            category: string;
            current_stock: number;
            minimum_stock: number;
            unit: string;
            holdingValue: number;
            storage_location: string;
        }[];
        longTermCount: number;
        longTerm: {
            id: string | number;
            item_code: string;
            item_name: string;
            category: string;
            current_stock: number;
            storage_location: string;
        }[];
        categoryCounts: Record<string, number>;
    };
    documents: {
        total: number;
        categoryCounts: Record<string, number>;
    };
    trashArchival: {
        parcels: number;
        purchase_orders: number;
        documents: number;
        total: number;
    };
    userActivity: {
        totalLogs: number;
        topActiveUsers: { name: string; count: number }[];
        actionTypes: Record<string, number>;
    };
}

const SCOPE_OPTIONS = [
    { value: "all", label: "All Modules (Comprehensive System)" },
    { value: "parcels", label: "Parcels & Logistics Velocity" },
    { value: "procurement", label: "Procurement & PO Spend" },
    { value: "equipment", label: "Equipment & Stock Velocity" },
    { value: "documents", label: "Documents Flow & Filing" },
    { value: "trash", label: "Trash & Archival Deletions" },
    { value: "users", label: "User Operations & Scans" },
];

const QUICK_PROMPTS = [
    { label: "Complete System Forecast", query: "Provide a complete monthly operational intelligence audit and predictive forecast.", scope: "all" },
    { label: "Parcels Peak & Busiest Hours", query: "What was our peak parcel day, busiest day of week, peak hours, and courier breakdown?", scope: "parcels" },
    { label: "Fast-Depleting Equipment Stocks", query: "Which equipment stocks became low much faster and are at risk of stockout?", scope: "equipment" },
    { label: "Untouched & Stagnant Goods", query: "Which items have almost not been touched or are held in long-term storage?", scope: "equipment" },
    { label: "Procurement & PO Spend Outlay", query: "Summarize purchase orders made, total spend, suppliers, and next-month budget outlook.", scope: "procurement" },
    { label: "Documents & Trash Deletions", query: "How many documents were filed and what items were deleted into trash/archival?", scope: "trash" },
    { label: "User Operations & Workload", query: "What was the scanner workload, user activity logs, and page operations?", scope: "users" },
];

export default function MonthlyIntelligencePanel() {
    const { role: userRole, isPrivileged, isLoaded } = useUserRole();
    const canPrompt = isPrivileged; // Only Executive, Admin, and Manager roles can prompt

    const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedScope, setSelectedScope] = useState<string>("all");
    const [userQuery, setUserQuery] = useState<string>("");
    const [activeQueryTitle, setActiveQueryTitle] = useState<string>("");
    const [loadingMonths, setLoadingMonths] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [metrics, setMetrics] = useState<MonthlyMetrics | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"ai-report" | "equipment-velocity" | "metrics-grid">("ai-report");
    const [isMinimized, setIsMinimized] = useState(false);

    // Fetch available months from DB on mount
    useEffect(() => {
        async function fetchMonths() {
            try {
                setLoadingMonths(true);
                const res = await fetch("/forecast/api/monthly-intelligence");
                const data = await res.json();
                if (data.success && data.months?.length) {
                    setAvailableMonths(data.months);
                    setSelectedMonth(data.months[0].value);
                }
            } catch (err) {
                console.error("Failed to load available forecast months:", err);
            } finally {
                setLoadingMonths(false);
            }
        }
        fetchMonths();
    }, []);

    // Run Monthly AI Forecasting
    const runAnalysis = useCallback(async (customQuery?: string, customScope?: string) => {
        if (!selectedMonth) {
            toast.error("Please select a month to analyze.");
            return;
        }

        const queryToSend = customQuery !== undefined ? customQuery : userQuery;
        const scopeToSend = customScope !== undefined ? customScope : selectedScope;

        setActiveQueryTitle(queryToSend ? queryToSend : "Comprehensive Monthly Audit");

        try {
            setAnalyzing(true);
            const res = await fetch("/forecast/api/monthly-intelligence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: selectedMonth,
                    userQuery: queryToSend || undefined,
                    scope: scopeToSend,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setMetrics(data.metrics);
                setAiSummary(data.aiSummary);
                setIsMinimized(false);
                toast.success(`Operational forecast generated for ${data.monthName}`);
            } else {
                throw new Error(data.error || "Failed to generate monthly intelligence");
            }
        } catch (err: any) {
            console.error("Monthly Intelligence error:", err);
            toast.error(err.message || "Failed to generate AI forecast.");
        } finally {
            setAnalyzing(false);
        }
    }, [selectedMonth, userQuery, selectedScope]);

    // Handle Quick Prompt click
    const handleQuickPrompt = (prompt: { label: string; query: string; scope: string }) => {
        if (!canPrompt) {
            toast.error("AI custom prompting is restricted to Executive, Admin, and Manager roles.");
            return;
        }
        setUserQuery(prompt.query);
        setSelectedScope(prompt.scope);
        runAnalysis(prompt.query, prompt.scope);
    };

    // Copy AI Summary to clipboard
    const handleCopySummary = () => {
        if (!aiSummary) return;
        navigator.clipboard.writeText(aiSummary);
        toast.success("AI Forecast summary copied to clipboard.");
    };

    // Formatted sections from AI text
    const parsedSections = useMemo(() => {
        if (!aiSummary) return [];
        return aiSummary
            .split("\n\n")
            .filter((block) => block.trim().length > 0)
            .map((block) => {
                const lines = block.trim().split("\n");
                const firstLine = lines[0].trim();
                const isTitle = /^[A-Z\s,:&–-]+$/.test(firstLine) && firstLine.length < 80;
                if (isTitle) {
                    return {
                        title: firstLine,
                        content: lines.slice(1).join("\n").trim(),
                    };
                }
                return {
                    title: null,
                    content: block.trim(),
                };
            });
    }, [aiSummary]);

    const selectedMonthObj = availableMonths.find((m) => m.value === selectedMonth);

    // Render Minimized Banner State
    if (isMinimized && aiSummary) {
        return (
            <div
                id="monthly-intelligence-section"
                className="p-3.5 px-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.7)] flex items-center justify-between gap-3 flex-wrap transition-all"
            >
                <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setIsMinimized(false)}
                >
                    <div className="w-8 h-8 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-wand-magic-sparkles" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span>AI Operational Insights (Minimized)</span>
                            <StatusBadge tone="pink" size="xs">
                                {selectedMonthObj?.label || "Monthly Audit"}
                            </StatusBadge>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-md">
                            Scope: {activeQueryTitle || "Full System Operational Audit"}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <AppButton
                        type="button"
                        variant="pink"
                        size="xs"
                        onClick={() => setIsMinimized(false)}
                    >
                        <i className="fas fa-chevron-down text-[10px]" />
                        <span>Restore Summary</span>
                    </AppButton>
                    <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                        onClick={() => {
                            setAiSummary(null);
                            setIsMinimized(false);
                        }}
                        title="Dismiss"
                    >
                        <i className="fas fa-times" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <section
            id="monthly-intelligence-section"
            className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] space-y-6 transition-all"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 text-[11px] font-bold border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                            <i className="fa-solid fa-wand-magic-sparkles text-pink-500 text-[10px]" />
                            <span>Monthly Intelligence</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-pink-600 dark:text-pink-400">Cross-Page Predictive Audit</span>
                        </div>
                        {canPrompt ? (
                            <StatusBadge tone="pink" size="xs">
                                Executive &amp; Manager AI Prompting Active
                            </StatusBadge>
                        ) : (
                            <StatusBadge tone="neutral" size="xs">
                                View Mode ({userRole || "User"})
                            </StatusBadge>
                        )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Monthly Operational Intelligence &amp; Predictive Engine
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                        Audit past monthly trends and forecast future demand across parcels, procurement spend, equipment stock velocity, document flows, and user activity.
                    </p>
                </div>

                {/* Month Picker & Main Actions */}
                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    <div className="relative">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={loadingMonths || analyzing}
                            className="appearance-none bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-2xl pl-4 pr-9 py-2.5 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] focus:outline-none cursor-pointer disabled:opacity-60"
                        >
                            {availableMonths.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label} ({m.parcelCount} parcels, {m.poCount} POs)
                                </option>
                            ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>

                    <AppButton
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => runAnalysis()}
                        disabled={analyzing || loadingMonths || !selectedMonth}
                    >
                        <i className={`fa-solid ${analyzing ? "fa-spinner fa-spin" : "fa-magnifying-glass-chart"} text-xs`} />
                        <span>{analyzing ? "Auditing..." : "Run AI Forecast"}</span>
                    </AppButton>

                    {aiSummary && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={() => setIsMinimized(true)}
                            title="Minimize to compact top bar"
                        >
                            <i className="fas fa-minus text-xs text-slate-400" />
                            <span>Minimize</span>
                        </AppButton>
                    )}
                </div>
            </div>

            {/* Scope Selection & Natural Language Prompt Input */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Scope Selector */}
                    <div className="relative sm:w-56 shrink-0">
                        <select
                            value={selectedScope}
                            onChange={(e) => setSelectedScope(e.target.value)}
                            disabled={analyzing || !canPrompt}
                            className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-2xl pl-3.5 pr-8 py-2.5 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] focus:outline-none cursor-pointer disabled:opacity-60"
                        >
                            {SCOPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    Scope: {opt.label}
                                </option>
                            ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>

                    {/* Search Bar */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!canPrompt) {
                                toast.error("AI custom prompting is restricted to Executive, Admin, and Manager roles.");
                                return;
                            }
                            runAnalysis();
                        }}
                        className="flex-1 flex items-center gap-2 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl p-1.5 transition-all"
                    >
                        <div className="pl-3 text-pink-500 text-sm">
                            <i className="fa-solid fa-comment-dots" />
                        </div>
                        <input
                            type="text"
                            value={userQuery}
                            onChange={(e) => setUserQuery(e.target.value)}
                            placeholder={
                                canPrompt
                                    ? `Ask AI about ${selectedMonthObj?.label || "this month"} (e.g., What happened in July? Which equipment stock depleted fastest?)...`
                                    : "Custom AI prompting is reserved for Executive, Admin, and Manager roles (Click 'Run AI Forecast' to view audit)."
                            }
                            className="w-full bg-transparent border-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-1.5 px-2 disabled:cursor-not-allowed"
                            disabled={analyzing || !canPrompt}
                        />
                        {userQuery && (
                            <button
                                type="button"
                                onClick={() => setUserQuery("")}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 text-xs cursor-pointer"
                                title="Clear query"
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        )}
                        <AppButton
                            type="submit"
                            variant="pink"
                            size="sm"
                            disabled={analyzing || !selectedMonth || !canPrompt}
                        >
                            <i className="fa-solid fa-arrow-right text-xs" />
                            <span className="hidden sm:inline">Ask AI</span>
                        </AppButton>
                    </form>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[11px] font-medium flex items-center gap-1">
                        <i className="fa-solid fa-lightbulb text-pink-500 text-[10px]" />
                        <span>Quick Queries:</span>
                    </span>
                    {QUICK_PROMPTS.map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickPrompt(p)}
                            disabled={analyzing || !canPrompt}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 text-[11px] font-medium border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] hover:text-pink-600 dark:hover:text-pink-400 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metrics Overview Cards (Unified Neumorphic Styling) */}
            {metrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Parcels & Peak */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                Parcels &amp; Peak Velocity
                            </span>
                            <div className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] text-pink-500 flex items-center justify-center text-xs">
                                <i className="fa-solid fa-boxes-stacked" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {metrics.parcels.total.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">total parcels</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Peak Day:</span>
                                <span className="font-bold text-pink-600 dark:text-pink-400">
                                    {metrics.parcels.peakDay.date} ({metrics.parcels.peakDay.count})
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Busiest Day:</span>
                                <span className="font-semibold">{metrics.parcels.busiestDayOfWeek.day}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Peak Hour:</span>
                                <span className="font-semibold">{metrics.parcels.busiestHourWindow.timeRange}</span>
                            </div>
                        </div>
                    </div>

                    {/* Procurement & Spend */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                Procurement Spend
                            </span>
                            <div className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] text-pink-500 flex items-center justify-center text-xs">
                                <i className="fa-solid fa-receipt" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                ₱{metrics.purchaseOrders.totalSpend.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                ({metrics.purchaseOrders.totalPOs} POs)
                            </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Paid Ratio:</span>
                                <span className="font-semibold">
                                    {metrics.purchaseOrders.paidCount} Paid / {metrics.purchaseOrders.unpaidCount} Unpaid
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Top Supplier:</span>
                                <span className="font-semibold truncate max-w-[130px]">
                                    {metrics.purchaseOrders.topSuppliers[0]?.name || "N/A"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Next Forecast:</span>
                                <span className="font-bold text-pink-600 dark:text-pink-400">
                                    ₱{metrics.purchaseOrders.projectedNextMonthSpend.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Equipment & Stock Velocity */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                Equipment Velocity
                            </span>
                            <div className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] text-pink-500 flex items-center justify-center text-xs">
                                <i className="fa-solid fa-boxes-stacked" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {metrics.inventoryVelocity.fastDepletingCount}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">low / fast-depleting</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Untouched Stagnant:</span>
                                <span className="font-semibold">{metrics.inventoryVelocity.untouchedCount} items</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Long-Term Stored:</span>
                                <span className="font-semibold">{metrics.inventoryVelocity.longTermCount} items</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Monitored Items:</span>
                                <span className="font-semibold">{metrics.inventoryVelocity.totalInventoryItems} items</span>
                            </div>
                        </div>
                    </div>

                    {/* System Operations & Archival */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                Operations &amp; Archival
                            </span>
                            <div className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] text-pink-500 flex items-center justify-center text-xs">
                                <i className="fa-solid fa-clock-rotate-left" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {metrics.documents.total}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">documents filed</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Trash / Archival:</span>
                                <span className="font-semibold text-pink-600 dark:text-pink-400">
                                    {metrics.trashArchival.total} deleted
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">User Activity:</span>
                                <span className="font-semibold">{metrics.userActivity.totalLogs} logs</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Top Operator:</span>
                                <span className="font-semibold truncate max-w-[130px]">
                                    {metrics.userActivity.topActiveUsers[0]?.name || "N/A"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            {metrics && (
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("ai-report")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "ai-report"
                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-xs"
                                    : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                            }`}
                        >
                            <i className="fa-solid fa-wand-magic-sparkles mr-1.5 text-[10px]" />
                            <span>AI Predictive Report</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("equipment-velocity")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "equipment-velocity"
                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-xs"
                                    : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                            }`}
                        >
                            <i className="fa-solid fa-boxes-stacked mr-1.5 text-[10px]" />
                            <span>Equipment Velocity ({metrics.inventoryVelocity.fastDepletingCount})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("metrics-grid")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "metrics-grid"
                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-xs"
                                    : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                            }`}
                        >
                            <i className="fa-solid fa-table-cells mr-1.5 text-[10px]" />
                            <span>System Stats</span>
                        </button>
                    </div>

                    {aiSummary && activeTab === "ai-report" && (
                        <AppButton type="button" variant="neutral" size="xs" onClick={handleCopySummary}>
                            <i className="fa-regular fa-copy text-[10px]" />
                            <span>Copy Report</span>
                        </AppButton>
                    )}
                </div>
            )}

            {/* Content Display: Tab 1 - AI Predictive Report */}
            {activeTab === "ai-report" && (
                <div className="space-y-4">
                    {analyzing ? (
                        <div className="p-12 text-center space-y-3 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                            <div className="w-11 h-11 mx-auto rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[3px_3px_8px_rgba(166,175,195,0.4),-3px_-3px_8px_rgba(255,255,255,0.95)] text-pink-500 flex items-center justify-center animate-spin">
                                <i className="fa-solid fa-circle-notch text-lg" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Generating Predictive Operational Report...
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                Aggregating parcels, procurement spend, equipment depletion velocity, documents, and user activity for {selectedMonthObj?.label}...
                            </p>
                        </div>
                    ) : aiSummary ? (
                        <div className="space-y-3.5">
                            {activeQueryTitle && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Audited Scope:</span>
                                    <span className="italic">"{activeQueryTitle}"</span>
                                    {selectedScope !== "all" && (
                                        <StatusBadge tone="neutral" size="xs">
                                            {SCOPE_OPTIONS.find((s) => s.value === selectedScope)?.label}
                                        </StatusBadge>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {parsedSections.map((sec, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2 text-xs"
                                    >
                                        {sec.title && (
                                            <div className="font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800/80 pb-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                                <span>{sec.title}</span>
                                            </div>
                                        )}
                                        <div className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-2.5 border-l-2 border-pink-500/30">
                                            {sec.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 text-center space-y-2.5 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                            <div className="w-10 h-10 mx-auto rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[3px_3px_8px_rgba(166,175,195,0.4),-3px_-3px_8px_rgba(255,255,255,0.95)] text-pink-500 flex items-center justify-center">
                                <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Ready for Monthly AI Predictive Audit
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                Click <span className="font-bold text-pink-600 dark:text-pink-400">Run AI Forecast</span> above or select a quick query to audit {selectedMonthObj?.label || "the selected month"}.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Content Display: Tab 2 - Equipment Stock Velocity */}
            {activeTab === "equipment-velocity" && metrics && (
                <div className="space-y-4">
                    {/* Fast Depleting Items */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                                <span>Fast-Depleting Equipment &amp; Stockout Risks</span>
                            </h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {metrics.inventoryVelocity.fastDepletingCount} critical items
                            </span>
                        </div>

                        {metrics.inventoryVelocity.fastDepleting.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                No equipment stocks are currently in critical low-stock condition.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-200/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/60 dark:border-slate-800">
                                        <tr>
                                            <th className="p-3 pl-4">Item Code &amp; Name</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3">Current Stock</th>
                                            <th className="p-3">Min Stock</th>
                                            <th className="p-3">Location</th>
                                            <th className="p-3 pr-4">Depletion Risk</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                                        {metrics.inventoryVelocity.fastDepleting.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="p-3 pl-4 font-semibold text-slate-900 dark:text-white">
                                                    <div>{item.item_name}</div>
                                                    <div className="text-[10px] text-slate-400">{item.item_code}</div>
                                                </td>
                                                <td className="p-3 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                <td className="p-3 font-bold text-pink-600 dark:text-pink-400">
                                                    {item.current_stock} {item.unit}
                                                </td>
                                                <td className="p-3 text-slate-500">{item.minimum_stock} {item.unit}</td>
                                                <td className="p-3 text-slate-500">{item.storage_location}</td>
                                                <td className="p-3 pr-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                                        item.riskLevel === "Critical"
                                                            ? "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30"
                                                            : "bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/60 dark:border-slate-700"
                                                    }`}>
                                                        {item.riskLevel} Risk
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Untouched / Stagnant Goods */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span>Untouched &amp; Stagnant Excess Inventory</span>
                            </h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {metrics.inventoryVelocity.untouchedCount} stagnant items
                            </span>
                        </div>

                        {metrics.inventoryVelocity.untouched.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                No excess stagnant goods detected.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-200/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/60 dark:border-slate-800">
                                        <tr>
                                            <th className="p-3 pl-4">Item Code &amp; Name</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3">Current Stock</th>
                                            <th className="p-3">Holding Value</th>
                                            <th className="p-3 pr-4">Storage Location</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                                        {metrics.inventoryVelocity.untouched.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="p-3 pl-4 font-semibold text-slate-900 dark:text-white">
                                                    <div>{item.item_name}</div>
                                                    <div className="text-[10px] text-slate-400">{item.item_code}</div>
                                                </td>
                                                <td className="p-3 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                                                    {item.current_stock} {item.unit}
                                                </td>
                                                <td className="p-3 text-slate-600 dark:text-slate-400">
                                                    ₱{item.holdingValue.toLocaleString()}
                                                </td>
                                                <td className="p-3 pr-4 text-slate-500">{item.storage_location}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Content Display: Tab 3 - System Stats Breakdown */}
            {activeTab === "metrics-grid" && metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    {/* Courier Distribution */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                            <span>Courier Share in {metrics.monthName}</span>
                            <i className="fa-solid fa-truck-fast text-pink-500" />
                        </div>
                        <div className="space-y-2 pt-1">
                            {Object.entries(metrics.parcels.courierCounts).length === 0 ? (
                                <div className="text-slate-400">No parcel records for this month.</div>
                            ) : (
                                Object.entries(metrics.parcels.courierCounts).map(([courier, cnt]) => {
                                    const pct = metrics.parcels.total > 0 ? Math.round((cnt / metrics.parcels.total) * 100) : 0;
                                    return (
                                        <div key={courier} className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">{courier}</span>
                                                <span className="text-slate-500">{cnt} ({pct}%)</span>
                                            </div>
                                            <div className="w-full bg-[#f0f3f8] dark:bg-[#191a24] border border-slate-200/60 dark:border-slate-800 h-2 rounded-full overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]">
                                                <div className="bg-pink-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Top Suppliers */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                            <span>Top Suppliers by Outlay</span>
                            <i className="fa-solid fa-building text-pink-500" />
                        </div>
                        <div className="space-y-1.5 pt-1">
                            {metrics.purchaseOrders.topSuppliers.length === 0 ? (
                                <div className="text-slate-400">No purchase orders for this month.</div>
                            ) : (
                                metrics.purchaseOrders.topSuppliers.map((sup, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/40 dark:border-slate-800/40 last:border-none text-[11px]">
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{sup.name}</div>
                                            <div className="text-[10px] text-slate-400">{sup.count} purchase orders</div>
                                        </div>
                                        <span className="font-bold text-pink-600 dark:text-pink-400">
                                            ₱{sup.total.toLocaleString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Documents & Trash Summary */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                        <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                            <span>Documents &amp; Trash Deletions</span>
                            <i className="fa-solid fa-trash-can text-pink-500" />
                        </div>
                        <div className="space-y-2 pt-1">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500">Documents Filed:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.documents.total}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500">Parcels Deleted:</span>
                                <span className="font-semibold text-pink-600 dark:text-pink-400">{metrics.trashArchival.parcels}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500">POs Deleted:</span>
                                <span className="font-semibold text-pink-600 dark:text-pink-400">{metrics.trashArchival.purchase_orders}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500">Documents Deleted:</span>
                                <span className="font-semibold text-pink-600 dark:text-pink-400">{metrics.trashArchival.documents}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Total Deletions:</span>
                                <span className="font-bold text-pink-600 dark:text-pink-400">{metrics.trashArchival.total}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
