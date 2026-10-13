"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
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
    const supplierCanvasRef = useRef<HTMLCanvasElement>(null);
    const inventoryCanvasRef = useRef<HTMLCanvasElement>(null);
    const procurementCanvasRef = useRef<HTMLCanvasElement>(null);

    const supplierChartInstance = useRef<Chart | null>(null);
    const inventoryChartInstance = useRef<Chart | null>(null);
    const procurementChartInstance = useRef<Chart | null>(null);

    const hasSupplierData = Object.values(data.supplierCategoryBreakdown || {}).some(v => typeof v === 'number' && v > 0);
    const hasInventoryData = Object.values(data.inventoryCategoryBreakdown || {}).some(v => typeof v === 'number' && v > 0);
    const hasProcurementData = Object.values(data.procurementStatusBreakdown || {}).some(v => typeof v === 'number' && v > 0);

    const renderCharts = useCallback(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#f8fafc' : '#0f172a';
        const mutedColor = isDark ? '#94a3b8' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const cardBgColor = isDark ? '#191a24' : '#f0f3f8';

        // 1. Supplier Category Breakdown
        if (supplierChartInstance.current) {
            supplierChartInstance.current.destroy();
            supplierChartInstance.current = null;
        }

        if (supplierCanvasRef.current && hasSupplierData) {
            const ctx = supplierCanvasRef.current.getContext('2d');
            if (ctx) {
                const categories = Object.keys(data.supplierCategoryBreakdown || {});
                const values = Object.values(data.supplierCategoryBreakdown || {});

                supplierChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categories,
                        datasets: [{
                            data: values,
                            backgroundColor: [CHART_COLORS.secondary, CHART_COLORS.purple, CHART_COLORS.primary, CHART_COLORS.cyan, CHART_COLORS.warning, CHART_COLORS.success],
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

        // 2. Inventory SKU categories Breakdown
        if (inventoryChartInstance.current) {
            inventoryChartInstance.current.destroy();
            inventoryChartInstance.current = null;
        }

        if (inventoryCanvasRef.current && hasInventoryData) {
            const ctx = inventoryCanvasRef.current.getContext('2d');
            if (ctx) {
                const categories = Object.keys(data.inventoryCategoryBreakdown || {});
                const values = Object.values(data.inventoryCategoryBreakdown || {});

                inventoryChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categories,
                        datasets: [{
                            data: values,
                            backgroundColor: [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.purple, CHART_COLORS.cyan],
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
        if (procurementChartInstance.current) {
            procurementChartInstance.current.destroy();
            procurementChartInstance.current = null;
        }

        if (procurementCanvasRef.current && hasProcurementData) {
            const ctx = procurementCanvasRef.current.getContext('2d');
            if (ctx) {
                const statuses = Object.keys(data.procurementStatusBreakdown || {});
                const values = Object.values(data.procurementStatusBreakdown || {});

                const statusColorMap: Record<string, string> = {
                    approved: CHART_COLORS.success,
                    completed: CHART_COLORS.success,
                    pending: CHART_COLORS.warning,
                    rejected: CHART_COLORS.danger,
                    cancelled: CHART_COLORS.danger,
                };
                const bgColors = statuses.length > 0
                    ? statuses.map(s => statusColorMap[s.toLowerCase()] || CHART_COLORS.secondary)
                    : [CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.secondary];

                procurementChartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: statuses.length > 0 ? statuses : ['Pending', 'Approved', 'Rejected', 'Completed'],
                        datasets: [{
                            label: 'Requests',
                            data: values.length > 0 ? values : [0, 0, 0, 0],
                            backgroundColor: bgColors,
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
    }, [data, hasSupplierData, hasInventoryData, hasProcurementData]);

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
            if (supplierChartInstance.current) {
                supplierChartInstance.current.destroy();
                supplierChartInstance.current = null;
            }
            if (inventoryChartInstance.current) {
                inventoryChartInstance.current.destroy();
                inventoryChartInstance.current = null;
            }
            if (procurementChartInstance.current) {
                procurementChartInstance.current.destroy();
                procurementChartInstance.current = null;
            }
        };
    }, [renderCharts]);

    return (
        <div className="space-y-6">
            {/* charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* supplier partner categories */}
                <div
                    onClick={() => onOpenModal('suppliers')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-handshake text-purple-500"></i>
                            <span>Supplier Network Breakdown</span>
                            {/* info badge */}
                            <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                    aria-label="Chart information"
                                >
                                    !
                                </button>
                                <div className="tooltip-popover">
                                    <p className="font-bold text-purple-400">Chart Details</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Distribution of approved vendor partners grouped by supply category. Sourced from suppliers table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('suppliers'); }}
                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                            View Partners
                        </button>
                    </div>
                    <div className="h-56 relative">
                        {hasSupplierData ? (
                            <canvas ref={supplierCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/50 flex items-center justify-center text-purple-500 dark:text-purple-400 mb-2.5">
                                    <i className="fas fa-handshake text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Suppliers Registered</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No approved vendor partners found in network</span>
                            </div>
                        )}
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
                        {hasInventoryData ? (
                            <canvas ref={inventoryCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-2.5">
                                    <i className="fas fa-boxes text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Inventory SKUs</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No catalogued inventory SKUs found in database</span>
                            </div>
                        )}
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
                        {hasProcurementData ? (
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

            {/* Executive Highlights: Issued POs, Defects & Replacements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Issued POs Card */}
                <Link
                    href="?tab=issued-pos"
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-pink-300 dark:hover:border-pink-800 transition-all group block"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-file-invoice-dollar text-pink-500" />
                            <span>Issued Purchase Orders</span>
                        </div>
                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400 group-hover:translate-x-0.5 transition-transform">
                            View Intelligence &rarr;
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {data.issuedPOsAnalytics?.issuedOrdersCount ?? 0}
                            </span>
                            <span className="text-xs text-slate-500 ml-1.5 font-bold">issued orders</span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 block">Approved Spend</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                ₱{(data.issuedPOsAnalytics?.totalApprovedValue ?? 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{data.issuedPOsAnalytics?.distinctItemsOrderedCount ?? 0} distinct items</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {data.issuedPOsAnalytics?.fullyReceivedCount ?? 0} fulfilled / {data.issuedPOsAnalytics?.awaitingDeliveryCount ?? 0} awaiting
                        </span>
                    </div>
                </Link>

                {/* Defective Received Units Card */}
                <Link
                    href="?tab=defects-replacements"
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-rose-300 dark:hover:border-rose-800 transition-all group block"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-triangle-exclamation text-rose-500" />
                            <span>Defective Items Received</span>
                        </div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-0.5 transition-transform">
                            View Incidents &rarr;
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                {data.defectiveItemsAnalytics?.totalDefectiveUnits ?? 0}
                            </span>
                            <span className="text-xs text-slate-500 ml-1.5 font-bold">defective units</span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 block">In Quarantine</span>
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                {data.defectiveItemsAnalytics?.quarantinedUnits ?? 0} units
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{data.defectiveItemsAnalytics?.affectedItemsCount ?? 0} items affected</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {data.defectiveItemsAnalytics?.approvedForReturnUnits ?? 0} approved for RMA
                        </span>
                    </div>
                </Link>

                {/* Replacement Received Card */}
                <Link
                    href="?tab=defects-replacements"
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group block"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                            <i className="fas fa-arrows-rotate text-emerald-500" />
                            <span>Replacement Items Received</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                            View Replacements &rarr;
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {data.replacementAnalytics?.totalReplacementsReceived ?? 0}
                            </span>
                            <span className="text-xs text-slate-500 ml-1.5 font-bold">restocked units</span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 block">Awaiting Fulfillment</span>
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                {data.replacementAnalytics?.awaitingFulfillmentCount ?? 0} cases
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{data.replacementAnalytics?.replacementDeliveriesCount ?? 0} deliveries verified</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {data.replacementAnalytics?.acceptedAfterInspectionUnits ?? 0} units passed QC
                        </span>
                    </div>
                </Link>
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
