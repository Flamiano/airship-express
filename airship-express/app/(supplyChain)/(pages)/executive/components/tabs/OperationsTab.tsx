"use client";

import { useEffect, useRef, useCallback } from "react";
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

    const renderCharts = useCallback(() => {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#f8fafc' : '#0f172a';
        const mutedColor = isDark ? '#94a3b8' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const cardBgColor = isDark ? '#191a24' : '#f0f3f8';

        // 1. courier volume
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
                                beginAtZero: true,
                                grid: { color: gridColor },
                                ticks: { color: mutedColor, font: { weight: 'bold', size: 10 }, stepSize: 1 }
                            }
                        }
                    }
                });
            }
        }

        // 2. parcel fulfillment
        if (statusCanvasRef.current) {
            if (statusInstance.current) statusInstance.current.destroy();
            const labels = Object.keys(data.statusBreakdown);
            const values = Object.values(data.statusBreakdown);
            const hasData = values.some(v => (typeof v === 'number' && v > 0));

            if (hasData) {
                const ctx = statusCanvasRef.current.getContext('2d');
                if (ctx) {
                    statusInstance.current = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: values,
                                backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.primary, CHART_COLORS.cyan, CHART_COLORS.purple, CHART_COLORS.danger],
                                borderWidth: 2,
                                borderColor: cardBgColor,
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '70%',
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        color: textColor,
                                        font: { size: 10, weight: 'bold' },
                                        padding: 8,
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
        }

        // 3. document categories
        if (documentCanvasRef.current) {
            if (documentInstance.current) documentInstance.current.destroy();
            const labels = Object.keys(data.documentTypeBreakdown);
            const values = Object.values(data.documentTypeBreakdown);
            const hasData = values.some(v => (typeof v === 'number' && v > 0));

            if (hasData) {
                const ctx = documentCanvasRef.current.getContext('2d');
                if (ctx) {
                    documentInstance.current = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Documents Count',
                                data: values,
                                backgroundColor: CHART_COLORS.cyan,
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
                                    beginAtZero: true,
                                    grid: { color: gridColor },
                                    ticks: { color: mutedColor, font: { weight: 'bold', size: 10 }, stepSize: 1 }
                                }
                            }
                        }
                    });
                }
            }
        }

        // 4. supplier categories
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
                            borderColor: cardBgColor,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: textColor,
                                    font: { size: 10, weight: 'bold' },
                                    padding: 8,
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
            if (courierInstance.current) courierInstance.current.destroy();
            if (statusInstance.current) statusInstance.current.destroy();
            if (documentInstance.current) documentInstance.current.destroy();
            if (supplierInstance.current) supplierInstance.current.destroy();
        };
    }, [renderCharts]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. courier volume */}
                <div
                    onClick={() => onOpenModal('couriers')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-truck text-indigo-500"></i>
                            <span>Courier Parcel Volume Breakdown</span>
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Measures parcel volume distributed across active courier linehaul partners. Sourced from parcels table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('couriers'); }}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        {Object.values(data.courierBreakdown).some(v => (typeof v === 'number' && v > 0)) ? (
                            <canvas ref={courierCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-2.5">
                                    <i className="fas fa-truck text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Courier Volume Data</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No parcel volume logged for active couriers</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. parcel fulfillment */}
                <div
                    onClick={() => onOpenModal('parcels')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-tasks text-emerald-500"></i>
                            <span>Parcel Fulfillment Status</span>
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Shows status distribution (received, sorting, ready, delivered). Sourced directly from parcels table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('parcels'); }}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        {Object.values(data.statusBreakdown).some(v => (typeof v === 'number' && v > 0)) ? (
                            <canvas ref={statusCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-2.5">
                                    <i className="fas fa-tasks text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Fulfillment Status Data</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No parcel fulfillment statuses recorded in the database</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. document categories */}
                <div
                    onClick={() => onOpenModal('documents')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-cyan-300 dark:hover:border-cyan-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-folder-open text-cyan-500"></i>
                            <span>Document Category Distribution</span>
                            {/* info badge */}
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
                            className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        {Object.values(data.documentTypeBreakdown).some(v => (typeof v === 'number' && v > 0)) ? (
                            <canvas ref={documentCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-800/50 flex items-center justify-center text-cyan-500 dark:text-cyan-400 mb-2.5">
                                    <i className="fas fa-folder-open text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Document Data</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No compliance documents archived or categorized in the system</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. supplier classification */}
                <div
                    onClick={() => onOpenModal('suppliers')}
                    className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fas fa-building text-purple-500"></i>
                            <span>Supplier Classification</span>
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
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">Displays vendor categories and active supplier partners from the suppliers table.</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenModal('suppliers'); }}
                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                            Inspect Modal
                        </button>
                    </div>
                    <div className="h-60 relative">
                        {Object.values(data.supplierCategoryBreakdown).some(v => v > 0) ? (
                            <canvas ref={supplierCanvasRef} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/50 flex items-center justify-center text-purple-500 dark:text-purple-400 mb-2.5">
                                    <i className="fas fa-building text-base"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No Supplier Categories</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mt-0.5 leading-tight">No active suppliers categorized in the registry</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
