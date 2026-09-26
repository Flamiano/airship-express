"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Chart from "chart.js/auto";
import { toast } from "sonner";
import { downloadCSV } from "../../lib/exportUtils";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";
import { AIChartResult } from "../../../../api/supplyChain/executive/ai-query/route";
import Portal from "../../../../components/client/Portal";

interface AiChartGeneratorTabProps {
    data: ExecutiveDataPayload;
    onOpenModal?: (reportType: string, extraData?: any) => void;
}

const STORAGE_KEY = "AIRSHIP_EXECUTIVE_AI_CHARTS_CACHE_V1";

const QUICK_SUGGESTIONS = [
    { label: "Cross-Table Record Synthesis", prompt: "Show data in different tables in 1 chart or summary: compare inventory_items, suppliers, couriers, user_activity, and documents.", mode: "both" as const, domain: "all" },
    { label: "Inventory Stock by Category", prompt: "Show inventory stock unit distribution and low stock items across categories.", mode: "both" as const, domain: "inventory" },
    { label: "User Activity & Security Logs", prompt: "Analyze recent user activity logs and system security events.", mode: "both" as const, domain: "user-activity" },
    { label: "Compliance Documents Audit", prompt: "Audit all archived compliance documents by type and supplier.", mode: "both" as const, domain: "documents" },
    { label: "Registered Courier Partners", prompt: "Compare registered courier partners and carrier allocation capacity.", mode: "chart" as const, domain: "parcels" },
    { label: "Trash & Archives Inspection", prompt: "Check trash and archived records across all modules.", mode: "text" as const, domain: "trash" },
    { label: "Suppliers & Vendor Network", prompt: "Analyze approved suppliers by business category and location.", mode: "both" as const, domain: "suppliers" },
];

export default function AiChartGeneratorTab({ data: executiveData }: AiChartGeneratorTabProps) {
    const [prompt, setPrompt] = useState("");
    const [displayMode, setDisplayMode] = useState<'chart' | 'text' | 'both'>('both');
    const [domainFilter, setDomainFilter] = useState<'all' | 'parcels' | 'inventory' | 'procurement' | 'suppliers' | 'documents' | 'user-activity' | 'trash'>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>("");
    const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);

    // Persistent Cached Queries in localStorage
    const [savedQueries, setSavedQueries] = useState<AIChartResult[]>([]);
    const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
    const [chartTypeOverride, setChartTypeOverride] = useState<'bar' | 'line' | 'doughnut' | 'pie' | null>(null);
    const [isInlineEditing, setIsInlineEditing] = useState(false);
    const [inlinePromptText, setInlinePromptText] = useState("");
    const [showScopeDetails, setShowScopeDetails] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const modalCanvasRef = useRef<HTMLCanvasElement>(null);
    const modalChartInstanceRef = useRef<Chart | null>(null);

    // 1. Load cached queries from localStorage on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed: AIChartResult[] = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const limited = parsed.length > 4 ? parsed.slice(parsed.length - 4) : parsed;
                    setSavedQueries(limited);
                    setActiveQueryId(limited[limited.length - 1]?.id || limited[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load cached AI executive charts:", e);
        }
    }, []);

    // 2. Save queries to localStorage
    const persistQueries = useCallback((queries: AIChartResult[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
        } catch (e) {
            console.error("Failed to save AI executive charts cache:", e);
        }
    }, []);

    // Active chart result object
    const activeResult = savedQueries.find(q => q.id === activeQueryId) || (savedQueries.length > 0 ? savedQueries[savedQueries.length - 1] : null);

    // 2b. Recalculate scroll boundaries when active result or mode changes
    useEffect(() => {
        const timer = setTimeout(() => {
            (window as any).__lenis?.resize();
        }, 150);
        return () => clearTimeout(timer);
    }, [activeResult, displayMode, isInlineEditing]);

    // 3. Render Chart.js when activeResult or theme changes
    useEffect(() => {
        if (!activeResult || activeResult.displayMode === 'text' || !canvasRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
            return;
        }

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const mutedColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null;
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const effectiveType = chartTypeOverride || activeResult.chart.type || 'bar';
        const isCartesian = ['bar', 'line'].includes(effectiveType);

        // Solid translucent line fill (no gradients)
        const lineFillColor = 'rgba(236, 72, 153, 0.08)';

        const modernPalette = [
            '#ec4899', '#6366f1', '#10b981', '#f59e0b',
            '#8b5cf6', '#06b6d4', '#f43f5e', '#3b82f6',
            '#14b8a6', '#f97316'
        ];

        const datasetTotal = activeResult.chart.datasets?.[0]?.data?.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || 0;

        const centerDoughnutPlugin = {
            id: 'centerDoughnutText',
            beforeDraw(chart: any) {
                if (effectiveType !== 'doughnut') return;
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || meta.data.length === 0) return;
                const firstArc = meta.data[0];
                const x = firstArc.x;
                const y = firstArc.y;

                const { ctx } = chart;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Number
                ctx.font = 'bold 16px sans-serif';
                ctx.fillStyle = textColor;
                const displayVal = datasetTotal >= 1000 ? `${(datasetTotal / 1000).toFixed(1)}k` : `${datasetTotal}`;
                ctx.fillText(displayVal, x, y - 6);

                // Label
                ctx.font = 'bold 8px sans-serif';
                ctx.fillStyle = mutedColor;
                ctx.fillText('TOTAL', x, y + 9);

                ctx.restore();
            }
        };

        chartInstanceRef.current = new Chart(ctx, {
            type: effectiveType,
            data: {
                labels: activeResult.chart.labels,
                datasets: activeResult.chart.datasets.map((ds, dsIndex) => {
                    const isMultiDataset = activeResult.chart.datasets.length > 1;
                    const dsColor = modernPalette[dsIndex % modernPalette.length];
                    const hasSingleColor = typeof ds.backgroundColor === 'string';

                    let effectiveBg = ds.backgroundColor;
                    let effectiveBorder = ds.borderColor;

                    if (effectiveType === 'line') {
                        effectiveBg = isDark ? `${dsColor}25` : `${dsColor}15`;
                        effectiveBorder = dsColor;
                    } else if (effectiveType === 'bar' && isMultiDataset) {
                        effectiveBg = hasSingleColor ? ds.backgroundColor : dsColor;
                        effectiveBorder = dsColor;
                    } else {
                        effectiveBg = hasSingleColor
                            ? ds.backgroundColor
                            : (ds.backgroundColor || modernPalette.slice(0, activeResult.chart.labels.length));
                        effectiveBorder = effectiveType === 'bar' ? undefined : (isDark ? '#1a1a1e' : '#ffffff');
                    }

                    return {
                        ...ds,
                        backgroundColor: effectiveBg,
                        borderColor: effectiveBorder,
                        borderWidth: effectiveType === 'line' ? 2.5 : (effectiveType === 'bar' ? (isMultiDataset ? 1.5 : 0) : 2),
                        borderRadius: effectiveType === 'bar' ? 6 : (effectiveType === 'doughnut' ? 6 : 0),
                        borderSkipped: false,
                        spacing: effectiveType === 'doughnut' ? 4 : 0,
                        tension: 0.4,
                        fill: effectiveType === 'line' ? 'origin' : false,
                        pointRadius: effectiveType === 'line' ? 4 : 0,
                        pointHoverRadius: effectiveType === 'line' ? 7 : 0,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: dsColor,
                        pointBorderWidth: 2,
                        barPercentage: isMultiDataset ? 0.75 : 0.65,
                        categoryPercentage: isMultiDataset ? 0.8 : 0.7,
                    };
                }),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: effectiveType === 'doughnut' ? '70%' : undefined,
                plugins: {
                    legend: {
                        display: true,
                        position: isCartesian ? 'top' : 'bottom',
                        align: 'center',
                        labels: {
                            color: textColor,
                            font: { family: 'inherit', size: 10, weight: 'bold' },
                            padding: isCartesian ? 12 : 8,
                            boxWidth: 8,
                            usePointStyle: true,
                            pointStyle: 'circle',
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#141418' : '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4,
                        usePointStyle: true,
                        cornerRadius: 10,
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 11 },
                    }
                },
                scales: isCartesian ? {
                    x: {
                        border: { display: false },
                        ticks: { color: mutedColor, font: { size: 10, weight: 500 } },
                        grid: { display: false },
                    },
                    y: {
                        border: { display: false },
                        beginAtZero: true,
                        ticks: {
                            color: mutedColor,
                            font: { size: 10, weight: 500 },
                            padding: 8,
                        },
                        grid: {
                            color: gridColor,
                            tickBorderDash: [3, 3],
                        }
                    }
                } : undefined,
            },
            plugins: [centerDoughnutPlugin],
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [activeResult, chartTypeOverride]);

    // 4. Render Chart inside Expanded Chart Modal
    useEffect(() => {
        if (!isChartModalOpen || !activeResult) {
            if (modalChartInstanceRef.current) {
                modalChartInstanceRef.current.destroy();
                modalChartInstanceRef.current = null;
            }
            return;
        }

        let isCancelled = false;
        let animationFrameId: number;

        const renderModalChart = () => {
            if (isCancelled) return;
            const canvas = modalCanvasRef.current;
            if (!canvas) {
                // Retry in next animation frame until Portal attaches canvas to DOM
                animationFrameId = requestAnimationFrame(renderModalChart);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (modalChartInstanceRef.current) {
                modalChartInstanceRef.current.destroy();
                modalChartInstanceRef.current = null;
            }

            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#e2e8f0' : '#1e293b';
            const mutedColor = isDark ? '#94a3b8' : '#64748b';
            const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

            const effectiveType = chartTypeOverride || activeResult.chart.type || 'bar';
            const isCartesian = ['bar', 'line'].includes(effectiveType);

        // Solid translucent line fill (no gradients)
        const lineFillColor = 'rgba(236, 72, 153, 0.08)';

        const modernPalette = [
            '#ec4899', '#6366f1', '#10b981', '#f59e0b',
            '#8b5cf6', '#06b6d4', '#f43f5e', '#3b82f6',
            '#14b8a6', '#f97316'
        ];

        const datasetTotal = activeResult.chart.datasets?.[0]?.data?.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || 0;

        const modalCenterDoughnutPlugin = {
            id: 'modalCenterDoughnutText',
            beforeDraw(chart: any) {
                if (effectiveType !== 'doughnut') return;
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || meta.data.length === 0) return;
                const firstArc = meta.data[0];
                const x = firstArc.x;
                const y = firstArc.y;

                const { ctx: c } = chart;
                c.save();
                c.textAlign = 'center';
                c.textBaseline = 'middle';

                c.font = 'bold 22px sans-serif';
                c.fillStyle = textColor;
                const displayVal = datasetTotal >= 1000 ? `${(datasetTotal / 1000).toFixed(1)}k` : `${datasetTotal}`;
                c.fillText(displayVal, x, y - 8);

                c.font = 'bold 10px sans-serif';
                c.fillStyle = mutedColor;
                c.fillText('TOTAL', x, y + 14);

                c.restore();
            }
        };

        modalChartInstanceRef.current = new Chart(ctx, {
            type: effectiveType,
            data: {
                labels: activeResult.chart.labels,
                datasets: activeResult.chart.datasets.map((ds, dsIndex) => {
                    const isMultiDataset = activeResult.chart.datasets.length > 1;
                    const dsColor = modernPalette[dsIndex % modernPalette.length];
                    const hasSingleColor = typeof ds.backgroundColor === 'string';

                    let effectiveBg = ds.backgroundColor;
                    let effectiveBorder = ds.borderColor;

                    if (effectiveType === 'line') {
                        effectiveBg = isDark ? `${dsColor}25` : `${dsColor}15`;
                        effectiveBorder = dsColor;
                    } else if (effectiveType === 'bar' && isMultiDataset) {
                        effectiveBg = hasSingleColor ? ds.backgroundColor : dsColor;
                        effectiveBorder = dsColor;
                    } else {
                        effectiveBg = hasSingleColor
                            ? ds.backgroundColor
                            : (ds.backgroundColor || modernPalette.slice(0, activeResult.chart.labels.length));
                        effectiveBorder = effectiveType === 'bar' ? undefined : (isDark ? '#1a1a1e' : '#ffffff');
                    }

                    return {
                        ...ds,
                        backgroundColor: effectiveBg,
                        borderColor: effectiveBorder,
                        borderWidth: effectiveType === 'line' ? 2.5 : (effectiveType === 'bar' ? (isMultiDataset ? 1.5 : 0) : 2),
                        borderRadius: effectiveType === 'bar' ? 8 : (effectiveType === 'doughnut' ? 8 : 0),
                        borderSkipped: false,
                        spacing: effectiveType === 'doughnut' ? 5 : 0,
                        tension: 0.4,
                        fill: effectiveType === 'line' ? 'origin' : false,
                        pointRadius: effectiveType === 'line' ? 5 : 0,
                        pointHoverRadius: effectiveType === 'line' ? 8 : 0,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: dsColor,
                        pointBorderWidth: 2,
                        barPercentage: isMultiDataset ? 0.75 : 0.6,
                        categoryPercentage: isMultiDataset ? 0.8 : 0.7,
                    };
                }),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: effectiveType === 'doughnut' ? '70%' : undefined,
                plugins: {
                    legend: {
                        display: true,
                        position: isCartesian ? 'top' : 'bottom',
                        align: 'center',
                        labels: {
                            color: textColor,
                            font: { family: 'inherit', size: 11, weight: 'bold' },
                            padding: isCartesian ? 14 : 10,
                            boxWidth: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#141418' : '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true,
                        cornerRadius: 12,
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 12 },
                    }
                },
                scales: isCartesian ? {
                    x: {
                        border: { display: false },
                        ticks: { color: mutedColor, font: { size: 11, weight: 500 } },
                        grid: { display: false },
                    },
                    y: {
                        border: { display: false },
                        beginAtZero: true,
                        ticks: {
                            color: mutedColor,
                            font: { size: 11, weight: 500 },
                            padding: 8,
                        },
                        grid: {
                            color: gridColor,
                            tickBorderDash: [3, 3],
                        }
                    }
                } : undefined,
            },
            plugins: [modalCenterDoughnutPlugin],
        });
        };

        // Allow microtick for Portal mounting transition
        const timerId = setTimeout(() => {
            animationFrameId = requestAnimationFrame(renderModalChart);
        }, 30);

        return () => {
            isCancelled = true;
            clearTimeout(timerId);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (modalChartInstanceRef.current) {
                modalChartInstanceRef.current.destroy();
                modalChartInstanceRef.current = null;
            }
        };
    }, [isChartModalOpen, activeResult, chartTypeOverride]);

    // Handle Query Submission
    const handleGenerate = async (
        queryText?: string,
        explicitMode?: 'chart' | 'text' | 'both',
        explicitDomain?: string,
        isUpdateMode?: boolean
    ) => {
        const targetPrompt = queryText || prompt;
        const targetMode = explicitMode || displayMode;
        const targetDomain = explicitDomain || domainFilter;

        if (!targetPrompt.trim()) {
            toast.error("Please enter a question or query prompt.");
            return;
        }

        setIsLoading(true);
        setLoadingStep("Accessing supply chain database snapshot...");

        const stepTimer1 = setTimeout(() => {
            setLoadingStep("Executing AI analytics & pattern evaluation...");
        }, 800);

        const stepTimer2 = setTimeout(() => {
            setLoadingStep("Generating custom visualization & executive findings...");
        }, 1600);

        try {
            const res = await fetch("/api/supplyChain/executive/ai-query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: targetPrompt,
                    displayMode: targetMode,
                    domain: targetDomain,
                    clientSummary: executiveData ? {
                        pageKpis: executiveData.pageKpis,
                        courierBreakdown: executiveData.courierBreakdown,
                        statusBreakdown: executiveData.statusBreakdown,
                        inventoryCategoryBreakdown: executiveData.inventoryCategoryBreakdown,
                        procurementStatusBreakdown: executiveData.procurementStatusBreakdown,
                    } : null,
                }),
            });

            clearTimeout(stepTimer1);
            clearTimeout(stepTimer2);

            if (!res.ok) {
                throw new Error(`Server returned error ${res.status}`);
            }

            const data = await res.json();
            if (data.success && data.result) {
                const newResult: AIChartResult = data.result;

                // Check if user is editing their prompt to update active chart without creating another saved query in cache
                if (isUpdateMode && activeQueryId && savedQueries.some(q => q.id === activeQueryId)) {
                    const updatedResult: AIChartResult = {
                        ...newResult,
                        id: activeQueryId, // Retain existing id to prevent creating another entry in cache
                        prompt: targetPrompt,
                    };
                    const updated = savedQueries.map(q => q.id === activeQueryId ? updatedResult : q);

                    setSavedQueries(updated);
                    setActiveQueryId(activeQueryId);
                    setChartTypeOverride(null);
                    persistQueries(updated);
                    setPrompt(targetPrompt);
                    setIsInlineEditing(false);

                    if (newResult.isOutOfScope) {
                        toast.warning("Notice: This prompt is outside the database scope. Showing available database modules.", { duration: 5000 });
                    } else {
                        toast.success("Updated chart and summary in-place (saved cache preserved).");
                    }
                } else {
                    // Save as a new query (FIFO: if exceed 4 remove the first prompt and insert the new one)
                    const filtered = savedQueries.filter(q => q.id !== newResult.id && q.prompt !== newResult.prompt);
                    const combined = [...filtered, newResult];
                    const updated = combined.length > 4 ? combined.slice(combined.length - 4) : combined;

                    setSavedQueries(updated);
                    setActiveQueryId(newResult.id);
                    setChartTypeOverride(null);
                    persistQueries(updated);
                    setPrompt(targetPrompt);
                    setIsInlineEditing(false);

                    if (newResult.isOutOfScope) {
                        toast.warning("Notice: This prompt is outside the database scope. Showing available database modules.", { duration: 5000 });
                    } else {
                        toast.success("AI chart and summary generated & saved to your executive dashboard.");
                    }
                }
            } else {
                throw new Error(data.error || "Failed to generate AI chart.");
            }
        } catch (err) {
            console.error("AI query execution error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to run AI query.");
        } finally {
            setIsLoading(false);
            setLoadingStep("");
        }
    };

    // Remove single query from cache
    const handleRemoveQuery = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = savedQueries.filter(q => q.id !== id);
        setSavedQueries(updated);
        persistQueries(updated);

        if (activeQueryId === id) {
            setActiveQueryId(updated.length > 0 ? updated[0].id : null);
        }
        toast.info("Removed chart from your saved list.");
    };

    // Clear all queries
    const handleClearAll = () => {
        setSavedQueries([]);
        setActiveQueryId(null);
        localStorage.removeItem(STORAGE_KEY);
        toast.info("Cleared all cached custom charts.");
    };

    // Download CSV
    const handleExportCSV = () => {
        if (!activeResult || !activeResult.tableData) return;
        downloadCSV(
            `Executive_AI_${activeResult.title.replace(/\s+/g, '_')}`,
            [],
            [`Analysis Prompt: "${activeResult.prompt}"`, `Generated: ${activeResult.timestamp}`],
            activeResult.tableData.headers,
            activeResult.tableData.rows
        );
        toast.success("Exported data to CSV.");
    };

    return (
        <div className="space-y-6">
            {/* Top Header & Context Description (Raindrop Banner) */}
            {/* Header Neumorphic Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    {/* Icon Pill */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-lg shadow-[0_4px_16px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                        <i className="fa-solid fa-wand-magic-sparkles" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Executive AI Query &amp; Custom Charts Engine
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Ask any business question in plain English. The AI synthesizes live database records into tailored charts, summaries, or both.
                        </p>
                    </div>
                </div>

                {savedQueries.length > 0 && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-pink-700 dark:text-pink-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                            {savedQueries.length} {savedQueries.length === 1 ? 'chart' : 'charts'} cached
                        </span>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="px-3 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-all cursor-pointer border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] active:scale-95"
                        >
                            <i className="fas fa-trash-alt mr-1 text-[10px]" /> Clear All
                        </button>
                    </div>
                )}
            </div>

            {/* Prompt Formulation Card (Neumorphic Styling) */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            1. What would you like to query or visualize?
                        </span>
                    </div>

                    {/* Domain Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[11px] text-slate-400 mr-1 font-medium">Domain:</span>
                        {(['all', 'inventory', 'user-activity', 'documents', 'suppliers', 'parcels', 'procurement', 'trash'] as const).map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDomainFilter(d)}
                                className={`px-3 py-1 text-[11px] font-bold rounded-2xl capitalize transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                    domainFilter === d
                                        ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                        : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]'
                                }`}
                            >
                                {d === 'user-activity' ? 'Activity Logs' : d === 'documents' ? 'Documents' : d === 'trash' ? 'Trash' : d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Textarea Input */}
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="E.g., Show inventory stock breakdown by category... or Analyze recent user activity logs... or Audit compliance documents by type..."
                        rows={3}
                        className="w-full p-4 text-xs sm:text-sm bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all resize-none shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleGenerate();
                            }
                        }}
                    />
                </div>

                {/* Database Scope Hint */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <i className="fas fa-shield-halved text-pink-500 text-[10px]" />
                    <span>Database Scope: Inventory SKUs, Logistics Parcels, Courier Partners, Suppliers, User Activity Logs, Compliance Documents.</span>
                </div>

                {/* Starter Query Templates */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5 mb-2">
                        <i className="fa-solid fa-lightbulb text-pink-500 text-xs" />
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Starter Query Templates:
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_SUGGESTIONS.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    setPrompt(item.prompt);
                                    setDisplayMode(item.mode);
                                    setDomainFilter(item.domain as any);
                                    handleGenerate(item.prompt, item.mode, item.domain);
                                }}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 hover:text-pink-700 dark:text-slate-200 dark:hover:text-pink-300 border border-white/70 dark:border-[#2a2b38] hover:border-pink-300 dark:hover:border-pink-500/50 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.04)] transition-all cursor-pointer active:scale-95"
                            >
                                <i className="fas fa-sparkles text-[10px] text-pink-500" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bottom Bar: Presentation Mode Selector & Action Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                    {/* Presentation Mode Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Presentation:
                        </span>
                        <div className="inline-flex rounded-2xl p-1 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] overflow-x-auto max-w-full">
                            <button
                                type="button"
                                onClick={() => setDisplayMode('chart')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                    displayMode === 'chart'
                                        ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <i className="fas fa-chart-pie text-[11px]" />
                                <span>Chart Only</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisplayMode('text')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                    displayMode === 'text'
                                        ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <i className="fas fa-align-left text-[11px]" />
                                <span>Text Only</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisplayMode('both')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                    displayMode === 'both'
                                        ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <i className="fas fa-bolt text-[11px]" />
                                <span>Both (Chart &amp; Text)</span>
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {activeResult ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleGenerate(undefined, undefined, undefined, true)}
                                    disabled={isLoading || !prompt.trim()}
                                    title="Update the currently displayed chart and summary with this prompt without adding another saved entry"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold text-xs rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                >
                                    {isLoading ? (
                                        <>
                                            <i className="fas fa-circle-notch animate-spin text-xs" />
                                            <span>Updating Chart...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-arrows-rotate text-xs text-white" />
                                            <span>Update Chart &amp; Summary</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleGenerate(undefined, undefined, undefined, false)}
                                    disabled={isLoading || !prompt.trim()}
                                    title="Generate as a separate saved chart in cache (max 4 FIFO)"
                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 dark:text-slate-100 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] font-bold text-xs rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                >
                                    <i className="fa-solid fa-plus text-[10px] text-pink-500" />
                                    <span>Save as New</span>
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleGenerate()}
                                disabled={isLoading || !prompt.trim()}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold text-xs rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                            >
                                {isLoading ? (
                                    <>
                                        <i className="fas fa-circle-notch animate-spin text-xs" />
                                        <span>Analyzing Database...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-wand-magic-sparkles text-xs text-white" />
                                        <span>Generate Analysis</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Loading Indicator with Stage Progression (Neumorphic Card) */}
            {isLoading && (
                <div className="p-8 sm:p-10 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] text-center space-y-4 animate-in fade-in duration-300">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                        <div className="absolute inset-1 rounded-xl border-2 border-pink-500/20 border-t-pink-500 animate-spin" />
                        <i className="fa-solid fa-wand-magic-sparkles text-pink-500 text-xl animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Synthesizing Executive Intelligence
                        </h3>
                        <p className="text-xs text-pink-600 dark:text-pink-400 mt-1 font-semibold">
                            {loadingStep || "Analyzing query requirements..."}
                        </p>
                    </div>
                </div>
            )}

            {/* Cached / Saved Charts Switcher Bar */}
            {savedQueries.length > 0 && !isLoading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Saved Executive Charts (Kept in Cache)
                        </span>
                        <span className="text-[11px] text-slate-400">
                            {savedQueries.length} of 4 saved • Oldest prompt removed when limit exceeded
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {savedQueries.map(q => {
                            const isSelected = q.id === activeResult?.id;
                            return (
                                <div
                                    key={q.id}
                                    onClick={() => {
                                        setActiveQueryId(q.id);
                                        setPrompt(q.prompt);
                                        setChartTypeOverride(null);
                                    }}
                                    className={`group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                                        isSelected
                                            ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                            : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]'
                                    }`}
                                >
                                    <i className={`fas ${
                                        q.displayMode === 'chart' ? (isSelected ? 'fa-chart-pie text-white' : 'fa-chart-pie text-pink-500') :
                                        q.displayMode === 'text' ? (isSelected ? 'fa-align-left text-white' : 'fa-align-left text-indigo-500') : (isSelected ? 'fa-bolt text-white' : 'fa-bolt text-emerald-500')
                                    } text-[11px]`} />
                                    <span className="max-w-[200px] truncate">{q.title}</span>
                                    <span className={`text-[10px] font-mono ${isSelected ? 'text-pink-100' : 'opacity-60'}`}>({q.timestamp})</span>
                                    <button
                                        type="button"
                                        title="Remove this chart from cache"
                                        onClick={(e) => handleRemoveQuery(q.id, e)}
                                        className={`ml-1 transition-colors cursor-pointer p-0.5 ${isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-500'}`}
                                    >
                                        <i className="fas fa-times text-[10px]" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* EMPTY STATE: Shown when no queries have been generated yet (Neumorphic Card) */}
            {!activeResult && !isLoading && (
                <div className="p-8 sm:p-12 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] text-center space-y-4 animate-in fade-in duration-300">
                    {/* Neumorphic Inset Icon Pill */}
                    <div className="w-16 h-16 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] mx-auto flex items-center justify-center text-pink-600 dark:text-pink-400 text-2xl">
                        <i className="fa-solid fa-chart-line" />
                    </div>

                    <div className="max-w-md mx-auto space-y-2">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Ready for Executive Intelligence
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            No custom charts have been generated yet. Type any question above or choose a suggested template to generate your first custom visualization.
                        </p>
                    </div>
                </div>
            )}

            {/* Active Analysis Results View */}
            {activeResult && !isLoading && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {activeResult.isOutOfScope ? (
                        /* Premium Out of Scope Card: Neumorphic Soft UI 3D Container */
                        <div className="p-6 sm:p-7 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] space-y-5">
                            {/* Top Bar: Alert Pill, Timestamp, and Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/80">
                                <div className="flex items-center gap-3.5">
                                    {/* Alert Icon Pill (Debossed Inset Well) */}
                                    <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] text-amber-500 dark:text-amber-400 flex items-center justify-center text-lg shrink-0">
                                        <i className="fas fa-triangle-exclamation" />
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Out of Scope Pill Badge with Hover/Click Tooltip */}
                                            <div className="relative inline-block">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowScopeDetails(!showScopeDetails)}
                                                    onMouseEnter={() => setShowScopeDetails(true)}
                                                    onMouseLeave={() => setShowScopeDetails(false)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-b from-amber-500 to-amber-600 text-white text-xs font-bold border border-amber-400/80 shadow-[0_3px_10px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-105 transition-all cursor-pointer active:scale-95"
                                                >
                                                    <span className="w-3.5 h-3.5 rounded-full bg-white text-amber-600 flex items-center justify-center text-[10px] font-black leading-none">
                                                        !
                                                    </span>
                                                    <span>out of scope(!)</span>
                                                </button>

                                                {/* Detail Tooltip on Hover / Click */}
                                                <div
                                                    className={`absolute left-0 top-full mt-2.5 w-80 sm:w-96 p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] text-slate-800 dark:text-white text-xs shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95)] dark:shadow-[12px_12px_36px_rgba(0,0,0,0.85)] border border-white/80 dark:border-[#2c2d3c] z-50 transition-all duration-150 ${
                                                        showScopeDetails
                                                            ? 'opacity-100 pointer-events-auto translate-y-0'
                                                            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto translate-y-1'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 mb-1.5">
                                                        <i className="fas fa-circle-info text-xs" />
                                                        <span>Database Scope Details</span>
                                                    </div>
                                                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium mb-2.5">
                                                        {activeResult.warningMessage || `The prompt "${activeResult.prompt}" references an unknown database table or entity outside the Airship Express schema.`}
                                                    </p>
                                                    <div className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                                                        <div className="font-bold text-amber-700 dark:text-amber-300 mb-1">Available Schema Tables (tables.sql):</div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {(['parcels', 'inventory_items', 'purchase_orders', 'purchase_requests', 'suppliers', 'couriers', 'documents', 'user_activity', 'receiving_queue', 'trash'] as const).map(t => (
                                                                <span key={t} className="px-2 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 font-mono text-[9px] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <span className="text-xs text-slate-400 font-mono">• Generated at {activeResult.timestamp}</span>
                                        </div>

                                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                                            {activeResult.title}
                                        </h3>
                                    </div>
                                </div>

                                {!isInlineEditing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInlinePromptText(activeResult.prompt);
                                            setIsInlineEditing(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 hover:text-pink-600 dark:text-slate-200 dark:hover:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] transition-all cursor-pointer active:scale-95 self-start sm:self-center"
                                    >
                                        <i className="fas fa-pen text-[10px]" />
                                        <span>Edit Prompt</span>
                                    </button>
                                )}
                            </div>

                            {/* Prompt Banner or Inline Editor */}
                            {isInlineEditing ? (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-400/60 dark:border-pink-600/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] animate-in fade-in duration-200">
                                    <div className="flex items-center gap-1.5 pl-2 text-pink-600 dark:text-pink-400 text-xs font-bold shrink-0">
                                        <i className="fas fa-terminal text-[10px]" />
                                        <span>Edit Query:</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={inlinePromptText}
                                        onChange={(e) => setInlinePromptText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleGenerate(inlinePromptText, undefined, undefined, true);
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#20212b] border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)]"
                                        placeholder="Enter a prompt referencing valid database tables (e.g. inventory, parcels, suppliers)..."
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            disabled={isLoading || !inlinePromptText.trim()}
                                            onClick={() => handleGenerate(inlinePromptText, undefined, undefined, true)}
                                            className="px-4 py-2 bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold text-xs rounded-xl border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer disabled:opacity-50 transition-all inline-flex items-center gap-1.5 active:scale-95"
                                        >
                                            <i className="fas fa-arrows-rotate text-[10px]" />
                                            <span>Run Query</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsInlineEditing(false)}
                                            className="px-3.5 py-2 bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] cursor-pointer transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]">
                                    <div className="flex items-center gap-2 text-xs min-w-0">
                                        <span className="font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5 shrink-0">
                                            <i className="fas fa-terminal text-[10px]" />
                                            Prompt:
                                        </span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200 italic truncate">
                                            &quot;{activeResult.prompt}&quot;
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                                        <i className="fas fa-info-circle text-xs" />
                                        <span>Charts &amp; summaries are disabled for out of scope queries</span>
                                    </div>
                                </div>
                            )}

                            {/* Schema Tables Helper Chips */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <i className="fas fa-table text-[10px] text-slate-400" />
                                    <span>Available Database Tables:</span>
                                </span>
                                {[
                                    { name: 'inventory_items', prompt: 'Inventory Stock by Category' },
                                    { name: 'parcels', prompt: 'Parcels Logistics Status' },
                                    { name: 'purchase_orders', prompt: 'Purchase Orders & Spend' },
                                    { name: 'suppliers', prompt: 'Suppliers & Vendor Network' },
                                    { name: 'couriers', prompt: 'Registered Courier Partners' },
                                    { name: 'documents', prompt: 'Compliance Documents Audit' },
                                    { name: 'user_activity', prompt: 'User Activity & Audit Logs' }
                                ].map((tbl, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setPrompt(tbl.prompt);
                                            handleGenerate(tbl.prompt, 'both', 'all');
                                        }}
                                        title={`Query ${tbl.name} table`}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl text-[11px] font-mono font-medium bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 hover:text-pink-600 dark:text-slate-300 dark:hover:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55),-1px_-1px_4px_rgba(255,255,255,0.04)] transition-all cursor-pointer active:scale-95"
                                    >
                                        <span>{tbl.name}</span>
                                        <i className="fas fa-arrow-turn-down text-[8px] text-pink-500 opacity-70" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Normal Results View: Shows Charts, Summary, and Metrics */
                        <>
                            {/* Header Banner (Neumorphic Card) */}
                            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            {/* Neumorphic Inset Icon Pill */}
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                <i className="fa-solid fa-chart-column" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                        {activeResult.displayMode.toUpperCase()} VIEW
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">• Generated at {activeResult.timestamp}</span>
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                                    {activeResult.title}
                                </h3>
                                {isInlineEditing ? (
                                    <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-400/60 dark:border-pink-600/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] animate-in fade-in duration-200">
                                        <div className="flex items-center gap-1.5 pl-2 text-pink-600 dark:text-pink-400 text-xs font-bold shrink-0">
                                            <i className="fas fa-pen text-[10px]" />
                                            <span>Edit Prompt:</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={inlinePromptText}
                                            onChange={(e) => setInlinePromptText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleGenerate(inlinePromptText, undefined, undefined, true);
                                                }
                                            }}
                                            className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#20212b] border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)]"
                                            placeholder="Edit your prompt..."
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                disabled={isLoading || !inlinePromptText.trim()}
                                                onClick={() => handleGenerate(inlinePromptText, undefined, undefined, true)}
                                                className="px-3.5 py-1.5 bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all inline-flex items-center gap-1.5 active:scale-95"
                                            >
                                                <i className="fas fa-arrows-rotate text-[10px]" />
                                                <span>Update Chart</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsInlineEditing(false)}
                                                className="px-3 py-1.5 bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] font-semibold text-xs rounded-xl cursor-pointer transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] text-xs">
                                        <span className="font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                            <i className="fas fa-terminal text-[10px]" />
                                            Prompt:
                                        </span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200 italic">
                                            &quot;{activeResult.prompt}&quot;
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInlinePromptText(activeResult.prompt);
                                                setIsInlineEditing(true);
                                            }}
                                            title="Edit this prompt and update the chart & summary in-place"
                                            className="ml-1 text-[11px] font-bold text-pink-700 dark:text-pink-300 bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] px-2.5 py-0.5 rounded-xl inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                        >
                                            <i className="fas fa-pen text-[9px]" />
                                            <span>Edit Prompt</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Chart Type Switcher (if chart or both) */}
                            {activeResult.displayMode !== 'text' && (
                                <div className="inline-flex rounded-2xl p-1 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                    {(['bar', 'line', 'doughnut', 'pie'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setChartTypeOverride(t)}
                                            title={`Switch to ${t} chart`}
                                            className={`px-3 py-1 text-[11px] font-bold rounded-xl capitalize transition-all cursor-pointer active:scale-95 ${
                                                (chartTypeOverride || activeResult.chart.type) === t
                                                    ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Export CSV Button */}
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 hover:text-pink-600 dark:text-slate-200 dark:hover:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] transition-all cursor-pointer active:scale-95"
                            >
                                <i className="fas fa-file-csv text-emerald-500 text-xs" />
                                <span>Export CSV</span>
                            </button>
                        </div>
                    </div>

                    {/* Metric Cards Grid (Neumorphic Raised Cards) */}
                    {activeResult.metrics && activeResult.metrics.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeResult.metrics.map((m, idx) => (
                                <div
                                    key={idx}
                                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_18px_rgba(0,0,0,0.6),-4px_-4px_14px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            {m.label}
                                        </p>
                                        <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                                            {m.value}
                                        </p>
                                    </div>
                                    {m.change && (
                                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                                            m.changeType === 'up' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40 shadow-[inset_1px_1px_2px_rgba(16,185,129,0.2)]' :
                                            m.changeType === 'down' ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40 shadow-[inset_1px_1px_2px_rgba(244,63,94,0.2)]' :
                                            'bg-[#ebf0f7] text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]'
                                        }`}>
                                            {m.change}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Dynamic Chart & Narrative Content Layout */}
                    <div className={`grid gap-6 ${activeResult.displayMode === 'both' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
                        {/* Interactive Chart Canvas (If Chart or Both) */}
                        {activeResult.displayMode !== 'text' && (() => {
                            const activeChartType = chartTypeOverride || activeResult.chart.type || 'bar';
                            const datasetTotal = activeResult.chart.datasets?.reduce((tot: number, ds: any) =>
                                tot + (ds.data?.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || 0), 0) || 0;

                            return (
                                <div className={`${activeResult.displayMode === 'both' ? 'lg:col-span-7' : 'max-w-2xl mx-auto w-full'} p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                                <i className={`fas ${
                                                    activeChartType === 'line' ? 'fa-chart-line' :
                                                    activeChartType === 'doughnut' ? 'fa-circle-notch' :
                                                    activeChartType === 'pie' ? 'fa-chart-pie' : 'fa-chart-column'
                                                } text-sm`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                        Data Visualization
                                                    </h4>
                                                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40">
                                                        Sum: {datasetTotal.toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {activeResult.chart.datasets.length > 1 ? `${activeResult.chart.datasets.length} Tables/Series • ` : ''}
                                                    {activeResult.chart.labels.length} segments analyzed
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Direct Chart Switcher Buttons */}
                                            <div className="inline-flex rounded-2xl p-1 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                                {(['bar', 'line', 'doughnut', 'pie'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setChartTypeOverride(t)}
                                                        title={`Switch to ${t} chart`}
                                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-xl capitalize transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                                                            activeChartType === t
                                                                ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        <i className={`fas ${
                                                            t === 'bar' ? 'fa-chart-column' :
                                                            t === 'line' ? 'fa-chart-line' :
                                                            t === 'doughnut' ? 'fa-circle-notch' : 'fa-chart-pie'
                                                        } text-[9px]`} />
                                                        <span className="capitalize">{t}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Deep Dive Modal Trigger */}
                                            <button
                                                type="button"
                                                onClick={() => setIsChartModalOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-pink-700 dark:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                                title="Open expanded interactive chart modal"
                                            >
                                                <span>Modal View</span>
                                                <i className="fas fa-expand text-[10px]" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Clickable Chart Canvas Wrapper */}
                                    <div
                                        onClick={() => setIsChartModalOpen(true)}
                                        title="Click to expand chart in modal"
                                        className={`relative w-full ${['doughnut', 'pie'].includes(activeChartType) ? 'h-64 sm:h-72 max-w-[340px] mx-auto' : 'h-56 sm:h-64'} flex items-center justify-center cursor-pointer group transition-transform active:scale-[0.99]`}
                                    >
                                        <canvas ref={canvasRef} />
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2.5 py-1 rounded-full text-[9px] font-bold bg-[#f0f3f8] dark:bg-[#191a24] text-pink-600 dark:text-pink-400 border border-white/80 dark:border-[#2c2d3c] shadow-[2px_2px_6px_rgba(166,175,195,0.4),-2px_-2px_6px_rgba(255,255,255,0.9)] flex items-center gap-1">
                                            <i className="fas fa-expand-alt text-[8px]" />
                                            <span>Click to expand</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Executive Summary Overview (Neumorphic Card) */}
                        {activeResult.displayMode !== 'chart' && (
                            <div className={`${activeResult.displayMode === 'both' ? 'lg:col-span-5' : 'max-w-2xl mx-auto w-full'} p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between space-y-3`}>
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                                <i className="fas fa-align-left text-xs" />
                                            </div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Executive Summary Overview
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsBriefModalOpen(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-pink-700 dark:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                        >
                                            <span>Full Brief</span>
                                            <i className="fas fa-expand text-[10px]" />
                                        </button>
                                    </div>

                                    {/* Small concise overview in debossed well */}
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                                            {activeResult.summary}
                                        </p>
                                    </div>

                                    {/* Primary strategic takeaway preview */}
                                    {activeResult.insights && activeResult.insights.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
                                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] text-[11px] text-slate-700 dark:text-slate-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1 shrink-0" />
                                                <span className="line-clamp-2">{activeResult.insights[0]}</span>
                                            </div>
                                            {activeResult.insights.length > 1 && (
                                                <p className="text-[10px] text-slate-400 pl-1 font-medium">
                                                    +{activeResult.insights.length - 1} more strategic takeaways in full brief
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Open Modal Action Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsBriefModalOpen(true)}
                                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    <i className="fas fa-file-lines text-white text-xs" />
                                    <span>Open Complete Executive Brief</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Follow-up Prompts */}
                    {activeResult.suggestedFollowUps && activeResult.suggestedFollowUps.length > 0 && (
                        <div className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-lightbulb text-pink-500 text-xs" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Suggested Follow-ups:
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {activeResult.suggestedFollowUps.map((q, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setPrompt(q);
                                            handleGenerate(q, activeResult.displayMode);
                                        }}
                                        className="text-xs px-3.5 py-1.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 hover:text-pink-600 dark:text-slate-200 dark:hover:text-pink-300 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] transition-all cursor-pointer active:scale-95 font-semibold"
                                    >
                                        &quot;{q}&quot; &rarr;
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FULL EXECUTIVE BRIEF MODAL (Neumorphic Design) */}
                    {isBriefModalOpen && (
                        <Portal>
                            <div
                                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                                onClick={() => setIsBriefModalOpen(false)}
                                data-lenis-prevent
                            >
                                <div
                                    className="relative bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                    data-lenis-prevent
                                >
                                    {/* Modal Header */}
                                    <div className="flex items-start justify-between gap-3 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                                        <div className="flex items-center gap-3">
                                            {/* Icon Pill (Debossed Inset Well) */}
                                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                                <i className="fas fa-file-lines" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                        EXECUTIVE BRIEF
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-mono">• {activeResult.timestamp}</span>
                                                </div>
                                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                                    {activeResult.title}
                                                </h3>
                                                <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] text-xs">
                                                    <span className="font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                                                        <i className="fas fa-terminal text-[10px]" />
                                                        Prompt:
                                                    </span>
                                                    <span className="font-medium text-slate-800 dark:text-slate-200 italic">&quot;{activeResult.prompt}&quot;</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setIsBriefModalOpen(false)}
                                            className="w-9 h-9 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] shrink-0 active:scale-95"
                                        >
                                            <i className="fas fa-times text-xs" />
                                        </button>
                                    </div>

                                    {/* Modal Scrollable Content */}
                                    <div className="overflow-y-auto space-y-6 pr-1">
                                        {/* Complete Executive Narrative */}
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                <i className="fas fa-align-left text-pink-500 text-xs" />
                                                <span>Complete Narrative Analysis</span>
                                            </h4>
                                            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-3 whitespace-pre-line bg-[#ebf0f7] dark:bg-[#14151c] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                                {activeResult.summary}
                                            </div>
                                        </div>

                                        {/* Strategic Takeaways & Action Items */}
                                        {activeResult.insights && activeResult.insights.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                    <i className="fas fa-lightbulb text-amber-500 text-xs" />
                                                    <span>Strategic Takeaways & Recommended Action Items</span>
                                                </h4>
                                                <div className="space-y-2">
                                                    {activeResult.insights.map((ins, i) => (
                                                        <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] text-xs text-slate-700 dark:text-slate-200">
                                                            <span className="w-2 h-2 rounded-full bg-pink-500 mt-1 shrink-0" />
                                                            <span className="leading-relaxed font-medium">{ins}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Key Metrics Snapshot */}
                                        {activeResult.metrics && activeResult.metrics.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                    <i className="fas fa-chart-line text-emerald-500 text-xs" />
                                                    <span>Key Metrics Snapshot</span>
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {activeResult.metrics.map((m, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                                    {m.label}
                                                                </p>
                                                                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                                                                    {m.value}
                                                                </p>
                                                            </div>
                                                            {m.change && (
                                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                                    m.changeType === 'up' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200' :
                                                                    m.changeType === 'down' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200' :
                                                                    'bg-[#f0f3f8] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                                                                }`}>
                                                                    {m.change}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Table Data Preview */}
                                        {activeResult.tableData && activeResult.tableData.rows.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                    <i className="fas fa-table text-indigo-500 text-xs" />
                                                    <span>Data Breakdown Table</span>
                                                </h4>
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)]">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-[#e4ebf5] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                                                            <tr>
                                                                {activeResult.tableData.headers.map((h, i) => (
                                                                    <th key={i} className="px-3.5 py-2.5 font-bold">{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 bg-[#ebf0f7] dark:bg-[#14151c]">
                                                            {activeResult.tableData.rows.map((row, rIdx) => (
                                                                <tr key={rIdx} className="hover:bg-white/50 dark:hover:bg-slate-800/40">
                                                                    {row.map((cell, cIdx) => (
                                                                        <td key={cIdx} className="px-3.5 py-2 text-slate-600 dark:text-slate-300">
                                                                            {cell}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="pt-4 mt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={handleExportCSV}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                        >
                                            <i className="fas fa-file-csv text-emerald-500 text-xs" />
                                            <span>Export CSV</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsBriefModalOpen(false)}
                                            className="px-5 py-2 text-xs font-bold rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all cursor-pointer active:scale-95"
                                        >
                                            Close Brief
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )}

                    {/* EXPANDED INTERACTIVE CHART MODAL (Neumorphic Design) */}
                    {isChartModalOpen && activeResult && (
                        <Portal>
                            <div
                                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                                onClick={() => setIsChartModalOpen(false)}
                                data-lenis-prevent
                            >
                                <div
                                    className="relative bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                    data-lenis-prevent
                                >
                                    {/* Modal Header */}
                                    <div className="flex items-start justify-between gap-4 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                                        <div className="flex items-center gap-3">
                                            {/* Icon Pill (Debossed Inset Well) */}
                                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                                <i className={`fas ${
                                                    (chartTypeOverride || activeResult.chart.type) === 'line' ? 'fa-chart-line' :
                                                    (chartTypeOverride || activeResult.chart.type) === 'doughnut' ? 'fa-circle-notch' :
                                                    (chartTypeOverride || activeResult.chart.type) === 'pie' ? 'fa-chart-pie' : 'fa-chart-column'
                                                }`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                        EXPANDED CHART DEEP DIVE
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-mono">• {activeResult.timestamp}</span>
                                                </div>
                                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                                    {activeResult.title}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                                    Prompt: &quot;{activeResult.prompt}&quot;
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setIsChartModalOpen(false)}
                                            className="w-9 h-9 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] shrink-0 active:scale-95"
                                        >
                                            <i className="fas fa-times text-xs" />
                                        </button>
                                    </div>

                                    {/* Modal Toolbar & Chart Controls */}
                                    {(() => {
                                        const currentType = chartTypeOverride || activeResult.chart.type || 'bar';
                                        const sumVal = activeResult.chart.datasets?.[0]?.data?.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) || 0;

                                        return (
                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
                                                <div className="inline-flex rounded-2xl p-1 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                                    {(['bar', 'line', 'doughnut', 'pie'] as const).map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => setChartTypeOverride(t)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                                                currentType === t
                                                                    ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            <i className={`fas ${
                                                                t === 'bar' ? 'fa-chart-column' :
                                                                t === 'line' ? 'fa-chart-line' :
                                                                t === 'doughnut' ? 'fa-circle-notch' : 'fa-chart-pie'
                                                            } text-[10px]`} />
                                                            <span>{t}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                        Total Sum: {sumVal.toLocaleString()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={handleExportCSV}
                                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-[#e8edf5] dark:hover:bg-[#232533] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                                    >
                                                        <i className="fas fa-file-csv text-emerald-500 text-xs" />
                                                        <span>Export CSV</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Expanded High-Resolution Chart Canvas */}
                                    <div className="relative w-full h-[360px] sm:h-[440px] p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                        <canvas ref={modalCanvasRef} className="w-full h-full block" />
                                    </div>
                                </div>
                            </div>
                        </Portal>
                    )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
