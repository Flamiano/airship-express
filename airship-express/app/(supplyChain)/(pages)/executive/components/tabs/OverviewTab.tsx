"use client";

import { useEffect, useRef, useCallback } from "react";
import Chart from "chart.js/auto";
import OperationsSummary from "../OperationsSummary";
import ProcurementCard from "../ProcurementCard";
import RecentTransactions from "../RecentTransactions";
import QuickActions from "../QuickActions";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface OverviewTabProps {
    data: ExecutiveDataPayload;
    onOpenModal: (reportType: string) => void;
}

const CHART_COLORS = {
    primary: '#EC4899',
    secondary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
};

export default function OverviewTab({ data, onOpenModal }: OverviewTabProps) {
    const parcelsCanvasRef = useRef<HTMLCanvasElement>(null);
    const inventoryCanvasRef = useRef<HTMLCanvasElement>(null);
    const procurementCanvasRef = useRef<HTMLCanvasElement>(null);

    const parcelsChartInstance = useRef<Chart | null>(null);
    const inventoryChartInstance = useRef<Chart | null>(null);
    const procurementChartInstance = useRef<Chart | null>(null);

    const renderCharts = useCallback(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#f8fafc' : '#0f172a';
        const mutedColor = isDark ? '#94a3b8' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const cardBgColor = isDark ? '#191a24' : '#f0f3f8';

        // 1. Parcel trend 7d
        if (parcelsCanvasRef.current) {
            if (parcelsChartInstance.current) parcelsChartInstance.current.destroy();

            const ctx = parcelsCanvasRef.current.getContext('2d');
            if (ctx) {
                const labels = data.dailyTrend.map(t => t.dayLabel);
                const receivedSeries = data.dailyTrend.map(t => t.receivedCount);
                const deliveredSeries = data.dailyTrend.map(t => t.deliveredCount);

                parcelsChartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Ingested Parcels',
                                data: receivedSeries,
                                borderColor: CHART_COLORS.secondary,
                                backgroundColor: `${CHART_COLORS.secondary}20`,
                                fill: true,
                                tension: 0.3,
                            },
                            {
                                label: 'Delivered',
                                data: deliveredSeries,
                                borderColor: CHART_COLORS.primary,
                                backgroundColor: `${CHART_COLORS.primary}20`,
                                fill: true,
                                tension: 0.3,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: textColor,
                                    font: { size: 11, weight: 'bold' }
                                }
                            },
                            tooltip: {
                                backgroundColor: isDark ? '#1e293b' : '#0f172a',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                cornerRadius: 8,
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: mutedColor, font: { weight: 'bold', size: 10 } }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: mutedColor, font: { weight: 'bold', size: 10 }, stepSize: 1 }
                            }
                        }
                    }
                });
            }
        }

        // 2. Inventory SKU categories Breakdown
        if (inventoryCanvasRef.current) {
            if (inventoryChartInstance.current) inventoryChartInstance.current.destroy();

            const ctx = inventoryCanvasRef.current.getContext('2d');
            if (ctx) {
                const categories = Object.keys(data.inventoryCategoryBreakdown);
                const values = Object.values(data.inventoryCategoryBreakdown);

                inventoryChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categories.length > 0 ? categories : ['No Inventory SKUs'],
                        datasets: [{
                            data: values.length > 0 ? values : [1],
                            backgroundColor: values.length > 0
                                ? [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.purple, CHART_COLORS.cyan]
                                : ['#94a3b8'],
                            borderWidth: 2,
                            borderColor: cardBgColor,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: textColor,
                                    font: { size: 11, weight: 'bold' },
                                    padding: 10,
                                    usePointStyle: true,
                                    boxWidth: 8,
                                }
                            },
                            tooltip: {
                                backgroundColor: isDark ? '#1e293b' : '#0f172a',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                cornerRadius: 8,
                            }
                        }
                    }
                });
            }
        }

        // 3. Procurement requests status
        if (procurementCanvasRef.current) {
            if (procurementChartInstance.current) procurementChartInstance.current.destroy();

            const ctx = procurementCanvasRef.current.getContext('2d');
            if (ctx) {
                const statuses = Object.keys(data.procurementStatusBreakdown);
                const values = Object.values(data.procurementStatusBreakdown);

                procurementChartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: statuses.length > 0 ? statuses : ['Pending', 'Approved', 'Rejected', 'Completed'],
                        datasets: [{
                            label: 'Requests',
                            data: values.length > 0 ? values : [0, 0, 0, 0],
                            backgroundColor: [CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.secondary],
                            borderRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: isDark ? '#1e293b' : '#0f172a',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                cornerRadius: 8,
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: mutedColor, font: { weight: 'bold', size: 10 } }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { color: mutedColor, font: { weight: 'bold', size: 10 }, stepSize: 1 }
                            }
                        }
                    }
                });
            }
        }
    }, [data]);

    useEffect(() => {
        renderCharts();

        // Listen for dark/light mode toggle only
        let lastIsDark = document.documentElement.classList.contains('dark');
        const observer = new MutationObserver(() => {
            const currentIsDark = document.documentElement.classList.contains('dark');
            if (currentIsDark !== lastIsDark) {
                lastIsDark = currentIsDark;
                renderCharts();
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => {
            observer.disconnect();
            if (parcelsChartInstance.current) parcelsChartInstance.current.destroy();
            if (inventoryChartInstance.current) inventoryChartInstance.current.destroy();
            if (procurementChartInstance.current) procurementChartInstance.current.destroy();
        };
    }, [renderCharts]);

    return (
        <div className="space-y-6">
            {/* charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* parcel trend */}
                <div
                    onClick={() => onOpenModal('parcels')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-pink-300 dark:hover:border-pink-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-chart-line text-pink-500"></i>
                            <span>Parcel Volume Trend</span>
                            {/* info badge */}
                            <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                    aria-label="Chart information"
                                >
                                    !
                                </button>
                                <div className="tooltip-popover">
                                    <p className="font-bold text-pink-400">Chart Details</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Tracks daily parcel intake vs delivered volumes for the past 7 days. Sourced from parcels table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('parcels'); }}
                            className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            Deep Dive
                        </button>
                    </div>
                    <div className="h-56 relative">
                        <canvas ref={parcelsCanvasRef} />
                    </div>
                </div>

                {/* inventory categories */}
                <div
                    onClick={() => onOpenModal('inventory')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-boxes text-emerald-500"></i>
                            <span className="text-slate-900 dark:text-white">Inventory SKU Breakdown</span>
                            {/* info badge */}
                            <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                    aria-label="Chart information"
                                >
                                    !
                                </button>
                                <div className="tooltip-popover">
                                    <p className="font-bold text-emerald-400">Chart Details</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Distribution of unique catalogued inventory SKUs by category. Sourced from inventory_items table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('inventory'); }}
                            className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            Details
                        </button>
                    </div>
                    <div className="h-56 relative">
                        <canvas ref={inventoryCanvasRef} />
                    </div>
                </div>

                {/* procurement pipeline */}
                <div
                    onClick={() => onOpenModal('procurement')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-shopping-bag text-indigo-500"></i>
                            <span>Procurement Requests</span>
                            {/* info badge */}
                            <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                    aria-label="Chart information"
                                >
                                    !
                                </button>
                                <div className="tooltip-popover">
                                    <p className="font-bold text-indigo-400">Chart Details</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Status pipeline of purchase requisitions (Pending, Approved, Rejected, Completed). Sourced from purchase_requests table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('procurement'); }}
                            className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            View All
                        </button>
                    </div>
                    <div className="h-56 relative">
                        {Object.values(data.procurementStatusBreakdown).some(v => v > 0) ? (
                            <canvas ref={procurementCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-2.5">
                                    <i className="fas fa-shopping-bag text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Procurement Requests</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No purchase requisitions found in the current pipeline</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* middle section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <OperationsSummary data={data.operationsSummary} />
                <ProcurementCard data={data.procurementSummary} />
                <QuickActions />
            </div>

            {/* bottom section */}
            <RecentTransactions transactions={data.recentTransactions} />
        </div>
    );
}
