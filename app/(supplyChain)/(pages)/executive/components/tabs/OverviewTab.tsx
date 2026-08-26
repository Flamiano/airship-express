"use client";

import { useEffect, useRef } from "react";
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

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#fcfbf9' : '#1c1b1f';
        const mutedColor = '#6b6b76';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        // parcel trend 7d
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
                            legend: { labels: { color: textColor, font: { size: 11 } } },
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: mutedColor } },
                            y: { grid: { color: gridColor }, ticks: { color: mutedColor, stepSize: 1 } }
                        }
                    }
                });
            }
        }

        // inventory categories
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
                            borderColor: isDark ? '#2a2a2e' : '#ffffff',
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                            legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
                        }
                    }
                });
            }
        }

        // procurement status
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
                            legend: { display: false }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: mutedColor } },
                            y: { grid: { color: gridColor }, ticks: { color: mutedColor, stepSize: 1 } }
                        }
                    }
                });
            }
        }

        return () => {
            if (parcelsChartInstance.current) parcelsChartInstance.current.destroy();
            if (inventoryChartInstance.current) inventoryChartInstance.current.destroy();
            if (procurementChartInstance.current) procurementChartInstance.current.destroy();
        };
    }, [data]);

    return (
        <div className="space-y-6">
            {/* charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* parcel trend */}
                <div
                    onClick={() => onOpenModal('parcels')}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-pink-300 dark:hover:border-pink-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
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
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
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
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-boxes text-emerald-500"></i>
                            <span>Inventory SKU Breakdown</span>
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
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
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
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
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
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            View All
                        </button>
                    </div>
                    <div className="h-56 relative">
                        <canvas ref={procurementCanvasRef} />
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
