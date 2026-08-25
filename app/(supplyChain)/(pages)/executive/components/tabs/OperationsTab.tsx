"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface OperationsTabProps {
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

export default function OperationsTab({ data, onOpenModal }: OperationsTabProps) {
    const courierCanvasRef = useRef<HTMLCanvasElement>(null);
    const statusCanvasRef = useRef<HTMLCanvasElement>(null);
    const documentCanvasRef = useRef<HTMLCanvasElement>(null);
    const supplierCanvasRef = useRef<HTMLCanvasElement>(null);

    const courierInstance = useRef<Chart | null>(null);
    const statusInstance = useRef<Chart | null>(null);
    const documentInstance = useRef<Chart | null>(null);
    const supplierInstance = useRef<Chart | null>(null);

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#fcfbf9' : '#1c1b1f';
        const mutedColor = '#6b6b76';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        // 1. Courier Volume Breakdown (from parcels table)
        if (courierCanvasRef.current) {
            if (courierInstance.current) courierInstance.current.destroy();
            const ctx = courierCanvasRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(data.courierBreakdown);
                const values = Object.values(data.courierBreakdown);

                courierInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels.length > 0 ? labels : ['No Couriers'],
                        datasets: [{
                            label: 'Parcels Handled',
                            data: values.length > 0 ? values : [0],
                            backgroundColor: CHART_COLORS.secondary,
                            borderRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: mutedColor } },
                            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: mutedColor, stepSize: 1 } }
                        }
                    }
                });
            }
        }

        // 2. Parcel Fulfillment Status (from parcels table)
        if (statusCanvasRef.current) {
            if (statusInstance.current) statusInstance.current.destroy();
            const ctx = statusCanvasRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(data.statusBreakdown);
                const values = Object.values(data.statusBreakdown);

                statusInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels.length > 0 ? labels : ['No Status Data'],
                        datasets: [{
                            data: values.length > 0 ? values : [0],
                            backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.primary, CHART_COLORS.cyan, CHART_COLORS.purple, CHART_COLORS.danger],
                            borderWidth: 2,
                            borderColor: isDark ? '#2a2a2e' : '#ffffff',
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
                        }
                    }
                });
            }
        }

        // 3. Document Category Distribution (from documents table)
        if (documentCanvasRef.current) {
            if (documentInstance.current) documentInstance.current.destroy();
            const ctx = documentCanvasRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(data.documentTypeBreakdown);
                const values = Object.values(data.documentTypeBreakdown);

                documentInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels.length > 0 ? labels : ['No Documents'],
                        datasets: [{
                            label: 'Documents Count',
                            data: values.length > 0 ? values : [0],
                            backgroundColor: CHART_COLORS.cyan,
                            borderRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: mutedColor } },
                            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: mutedColor, stepSize: 1 } }
                        }
                    }
                });
            }
        }

        // 4. Supplier Categories (from suppliers table)
        if (supplierCanvasRef.current) {
            if (supplierInstance.current) supplierInstance.current.destroy();
            const ctx = supplierCanvasRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(data.supplierCategoryBreakdown);
                const values = Object.values(data.supplierCategoryBreakdown);

                supplierInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels.length > 0 ? labels : ['No Suppliers'],
                        datasets: [{
                            data: values.length > 0 ? values : [0],
                            backgroundColor: [CHART_COLORS.purple, CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.secondary],
                            borderWidth: 2,
                            borderColor: isDark ? '#2a2a2e' : '#ffffff',
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
                        }
                    }
                });
            }
        }

        return () => {
            if (courierInstance.current) courierInstance.current.destroy();
            if (statusInstance.current) statusInstance.current.destroy();
            if (documentInstance.current) documentInstance.current.destroy();
            if (supplierInstance.current) supplierInstance.current.destroy();
        };
    }, [data]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Courier Parcel Volume Breakdown */}
                <div
                    onClick={() => onOpenModal('couriers')}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-truck text-indigo-500"></i>
                            <span>Courier Parcel Volume Breakdown</span>
                            {/* Hover info badge ! with popover details about the chart */}
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Measures parcel volume distributed across active courier linehaul partners. Sourced from parcels table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('couriers'); }}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        <canvas ref={courierCanvasRef} />
                    </div>
                </div>

                {/* 2. Parcel Fulfillment Status */}
                <div
                    onClick={() => onOpenModal('parcels')}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-tasks text-emerald-500"></i>
                            <span>Parcel Fulfillment Status</span>
                            {/* Hover info badge ! with popover details about the chart */}
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Shows status distribution (received, sorting, ready, delivered). Sourced directly from parcels table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('parcels'); }}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        <canvas ref={statusCanvasRef} />
                    </div>
                </div>

                {/* 3. Document Category Distribution */}
                <div
                    onClick={() => onOpenModal('documents')}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-cyan-300 dark:hover:border-cyan-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-folder-open text-cyan-500"></i>
                            <span>Document Category Distribution</span>
                            {/* Hover info badge ! with popover details about the chart */}
                            <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 dark:hover:bg-cyan-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                    aria-label="Chart information"
                                >
                                    !
                                </button>
                                <div className="tooltip-popover">
                                    <p className="font-bold text-cyan-400">Chart Details</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Categorizes archived compliance documents and invoices from the documents table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('documents'); }}
                            className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        <canvas ref={documentCanvasRef} />
                    </div>
                </div>

                {/* 4. Supplier Classification */}
                <div
                    onClick={() => onOpenModal('suppliers')}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-building text-purple-500"></i>
                            <span>Supplier Classification</span>
                            {/* Hover info badge ! with popover details about the chart */}
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Displays vendor categories and active supplier partners from the suppliers table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('suppliers'); }}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        <canvas ref={supplierCanvasRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
