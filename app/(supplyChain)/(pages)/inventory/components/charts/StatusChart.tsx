'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { InventoryItem } from '../../types';

// Guard against multiple registrations during hot-reloads
let isRegistered = false;

interface StatusChartProps {
    items: InventoryItem[];
    onStatusClick: (status: string) => void;
}

const STATUS_MAP: Record<string, string> = {
    'Available': 'available',
    'Low Stock': 'low-stock',
    'Out of Stock': 'out-of-stock',
};

// Using the same beautiful colors from the doughnut chart
const COLORS = {
    available: {
        main: '#10B981', // Emerald
        light: '#D1FAE5',
        hover: '#059669',
        text: '#065F46',
    },
    'low-stock': {
        main: '#F59E0B', // Amber
        light: '#FEF3C7',
        hover: '#D97706',
        text: '#92400E',
    },
    'out-of-stock': {
        main: '#EF4444', // Red
        light: '#FEE2E2',
        hover: '#DC2626',
        text: '#991B1B',
    },
};

// The full palette from the doughnut chart for the chart colors
const DOUGHNUT_COLORS = ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8', '#8B5CF6', '#A78BFA', '#C4B5FD', '#6366F1', '#818CF8', '#A5B4FC'];

export function StatusChart({ items, onStatusClick }: StatusChartProps) {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (!isRegistered) {
            Chart.register(DoughnutController, ArcElement, Tooltip, Legend);
            isRegistered = true;
        }
    }, []);

    useEffect(() => {
        if (!chartRef.current) return;

        // Destroy existing instance
        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }

        // Do not draw empty chart if no items exist
        if (items.length === 0) return;

        const statusData = {
            'Available': items.filter((i) => i.status === 'available').length,
            'Low Stock': items.filter((i) => i.status === 'low-stock').length,
            'Out of Stock': items.filter((i) => i.status === 'out-of-stock').length,
        };

        const labels = Object.keys(statusData);
        const values = Object.values(statusData);

        // Use the pink/purple/indigo palette for the chart
        const colors = DOUGHNUT_COLORS.slice(0, labels.length);

        // Hover colors - slightly darker versions
        const hoverColors = colors.map(color => {
            if (color === '#EC4899') return '#BE185D';
            if (color === '#F472B6') return '#DB2777';
            if (color === '#F9A8D4') return '#F472B6';
            if (color === '#FBCFE8') return '#F9A8D4';
            if (color === '#8B5CF6') return '#7C3AED';
            if (color === '#A78BFA') return '#8B5CF6';
            if (color === '#C4B5FD') return '#A78BFA';
            if (color === '#6366F1') return '#4F46E5';
            if (color === '#818CF8') return '#6366F1';
            if (color === '#A5B4FC') return '#818CF8';
            return color;
        });

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        chartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: colors,
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 10,
                        hoverBackgroundColor: hoverColors,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            padding: 14,
                            font: { size: 11, family: 'inherit', weight: 500 },
                            color: '#64748B',
                        },
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        titleColor: '#0F172A',
                        bodyColor: '#475569',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 14,
                        boxPadding: 6,
                        usePointStyle: true,
                        titleFont: { weight: 600 },
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = (context.parsed as number) || 0;
                                const total = values.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                return ` ${label}: ${value} (${percentage}%)`;
                            },
                            afterBody: function (tooltipItems) {
                                const status = STATUS_MAP[tooltipItems[0].label] || '';
                                return `\nClick to filter by "${status}"`;
                            },
                        },
                    },
                },
                onClick: function (_evt, elements) {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const label = labels[index];
                        const status = STATUS_MAP[label] || '';
                        onStatusClick(status);
                    }
                },
                onHover: function (evt, elements) {
                    const canvas = evt.native?.target as HTMLCanvasElement;
                    if (canvas) {
                        canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                    }
                },
            },
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [items, onStatusClick]);

    return (
        <div className="relative w-full h-full min-h-[220px]">
            {/* Information Overlay Toggle */}
            <button
                type="button"
                className="absolute top-1 right-1 z-10 p-1.5 rounded-lg 
                           text-slate-400 dark:text-slate-500 
                           hover:text-pink-600 dark:hover:text-pink-400 
                           hover:bg-slate-100 dark:hover:bg-slate-800/50 
                           transition-colors"
                onClick={() => setShowInfo(!showInfo)}
                aria-label="Chart Information"
            >
                <i className="fas fa-info-circle text-sm" />
            </button>

            {/* Canvas */}
            <div className="w-full h-full">
                <canvas ref={chartRef} />
            </div>

            {/* Empty State Overlay */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center 
                                text-slate-400 dark:text-slate-500 text-xs font-medium 
                                bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
                    <i className="fas fa-chart-pie text-2xl mb-1.5 opacity-40 dark:opacity-30" />
                    <span>No inventory data available</span>
                </div>
            )}

            {/* Info Popover */}
            {showInfo && (
                <div
                    className="absolute top-4 right-1 z-20 
                               bg-white dark:bg-[#2a2a2e] rounded-xl shadow-xl 
                               border border-slate-200/80 dark:border-slate-700/60 
                               p-4 w-64 animate-in fade-in zoom-in-95 duration-150"
                    onClick={() => setShowInfo(false)}
                >
                    <div className="flex items-center justify-between mb-2 pb-2 
                                    border-b border-slate-100 dark:border-slate-700/60">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                            <i className="fas fa-chart-pie text-pink-500 dark:text-pink-400" />
                            Status Breakdown
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowInfo(false)}
                            className="text-slate-400 dark:text-slate-500 
                                     hover:text-slate-600 dark:hover:text-slate-300 
                                     p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 
                                     transition-colors"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                        Displays item stock distribution. Hover over segments to see percentages, or click any segment to filter the list.
                    </p>

                    <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Available
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                                {items.filter((i) => i.status === 'available').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Low Stock
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                                {items.filter((i) => i.status === 'low-stock').length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Out of Stock
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                                {items.filter((i) => i.status === 'out-of-stock').length}
                            </span>
                        </div>
                    </div>

                    {/* Legend with counts */}
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                            <span>Total Items</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{items.length}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}