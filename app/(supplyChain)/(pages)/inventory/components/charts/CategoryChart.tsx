'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { InventoryItem } from '../../types';

// Guard against duplicate registrations during Next.js Hot Reloads
let isRegistered = false;

interface CategoryChartProps {
    items: InventoryItem[];
    onCategoryClick: (category: string) => void;
}

type CategoryStats = {
    count: number;
    totalStock: number;
    items: InventoryItem[];
    statusCounts: { available: number; 'low-stock': number; 'out-of-stock': number };
    totalValue: number;
};

// Updated colors matching the doughnut chart
const COLORS = [
    '#EC4899', // Pink
    '#F472B6', // Light Pink
    '#F9A8D4', // Lighter Pink
    '#FBCFE8', // Lightest Pink
    '#8B5CF6', // Purple
    '#A78BFA', // Light Purple
    '#C4B5FD', // Lighter Purple
    '#6366F1', // Indigo
    '#818CF8', // Light Indigo
    '#A5B4FC', // Lighter Indigo
    '#3B82F6', // Blue
    '#60A5FA', // Light Blue
    '#10B981', // Emerald
    '#34D399', // Light Emerald
    '#F59E0B', // Amber
    '#FBBF24', // Light Amber
];

function buildCategoryData(items: InventoryItem[]): Record<string, CategoryStats> {
    const data: Record<string, CategoryStats> = {};

    for (const item of items) {
        if (!data[item.category]) {
            data[item.category] = {
                count: 0,
                totalStock: 0,
                items: [],
                statusCounts: { available: 0, 'low-stock': 0, 'out-of-stock': 0 },
                totalValue: 0,
            };
        }
        const bucket = data[item.category];
        bucket.count += 1;
        bucket.totalStock += item.current_stock;
        bucket.items.push(item);

        if (item.purchase_price) {
            bucket.totalValue += item.current_stock * item.purchase_price;
        }

        if (item.status === 'available' || item.status === 'low-stock' || item.status === 'out-of-stock') {
            bucket.statusCounts[item.status] += 1;
        }
    }

    return data;
}

export function CategoryChart({ items, onCategoryClick }: CategoryChartProps) {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const onCategoryClickRef = useRef(onCategoryClick);
    onCategoryClickRef.current = onCategoryClick;

    const [tooltip, setTooltip] = useState<{
        show: boolean;
        x: number;
        y: number;
        category: string | null;
    }>({ show: false, x: 0, y: 0, category: null });

    const [showInfo, setShowInfo] = useState(false);

    // Register components safely
    useEffect(() => {
        if (!isRegistered) {
            Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
            isRegistered = true;
        }
    }, []);

    const categoryData = useMemo(() => buildCategoryData(items), [items]);
    const labels = useMemo(() => Object.keys(categoryData), [categoryData]);
    const total = useMemo(
        () => Object.values(categoryData).reduce((sum, d) => sum + d.count, 0),
        [categoryData]
    );

    useEffect(() => {
        if (!chartRef.current) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }

        if (labels.length === 0) return;

        const values = labels.map((label) => categoryData[label].count);

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Items',
                        data: values,
                        backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
                        barThickness: 28,
                        borderRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            const tooltipModel = context.tooltip;
                            if (!tooltipModel || tooltipModel.opacity === 0) {
                                setTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
                                return;
                            }

                            const dataPoint = tooltipModel.dataPoints?.[0];
                            const category = dataPoint ? String(dataPoint.label) : null;

                            if (!chartRef.current) return;

                            const canvasRect = chartRef.current.getBoundingClientRect();
                            const x = canvasRect.left + tooltipModel.caretX;
                            const y = canvasRect.top + tooltipModel.caretY;

                            setTooltip({
                                show: true,
                                x,
                                y,
                                category,
                            });
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10, family: 'inherit' },
                            color: '#64748B',
                        },
                    },
                    y: {
                        grid: { display: false },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 10, family: 'inherit' },
                            color: '#64748B',
                            precision: 0,
                        },
                    },
                },
                onClick: (_evt, elements) => {
                    if (elements.length > 0) {
                        onCategoryClickRef.current(labels[elements[0].index]);
                    }
                },
                onHover: (evt, elements) => {
                    const canvas = evt.native?.target as HTMLCanvasElement | undefined;
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
    }, [labels, categoryData]);

    const handleMouseLeave = () => {
        setTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
    };

    return (
        <div ref={containerRef} className="relative w-full h-full min-h-[220px]" onMouseLeave={handleMouseLeave}>
            {/* Information Toggle */}
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

            {/* Empty State */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center 
                                text-slate-400 dark:text-slate-500 text-xs font-medium 
                                bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
                    <i className="fas fa-chart-bar text-2xl mb-1.5 opacity-40 dark:opacity-30" />
                    <span>No category data available</span>
                </div>
            )}

            {/* Info Popover */}
            {showInfo && (
                <div
                    className="absolute top-4 right-1 z-20 
                               bg-white dark:bg-ink rounded-xl shadow-xl 
                               border border-slate-200/80 dark:border-ink/20 
                               p-4 w-72 animate-in fade-in zoom-in-95 duration-150"
                    onClick={() => setShowInfo(false)}
                >
                    <div className="flex items-center justify-between mb-2 pb-2 
                                    border-b border-slate-100 dark:border-ink/20">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                            <i className="fas fa-chart-bar text-pink-500 dark:text-pink-400" />
                            Category Breakdown
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowInfo(false)}
                            className="text-slate-400 dark:text-slate-500 
                                     hover:text-slate-600 dark:hover:text-slate-300 
                                     p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 
                                     transition-colors"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <p className="leading-relaxed">
                            Shows inventory distribution across categories.
                            <span className="font-medium text-pink-600 dark:text-pink-400 ml-1">Hover</span> bars for full stats,
                            <span className="font-medium text-pink-600 dark:text-pink-400 ml-1">click</span> to filter items.
                        </p>

                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-ink/20 text-[11px]">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Available
                            </div>
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Low Stock
                            </div>
                            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Out of Stock
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Tooltip Floating Card */}
            {tooltip.show && tooltip.category && categoryData[tooltip.category] && (
                <TooltipPortal
                    x={tooltip.x}
                    y={tooltip.y}
                    category={tooltip.category}
                    data={categoryData[tooltip.category]}
                    total={total}
                    onCategoryClick={() => onCategoryClickRef.current(tooltip.category!)}
                />
            )}
        </div>
    );
}

function TooltipPortal({
    x,
    y,
    category,
    data,
    total,
    onCategoryClick,
}: {
    x: number;
    y: number;
    category: string;
    data: CategoryStats;
    total: number;
    onCategoryClick: () => void;
}) {
    const [viewport, setViewport] = useState<{ w: number; h: number }>({
        w: typeof window !== 'undefined' ? window.innerWidth : 0,
        h: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    useEffect(() => {
        const handleResize = () => {
            setViewport({ w: window.innerWidth, h: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const calculatePosition = () => {
        const tooltipWidth = 300;
        const tooltipHeight = 360;
        const padding = 16;
        const offset = 12;

        let left = x + offset;
        let top = y + offset;

        if (left + tooltipWidth + padding > viewport.w) {
            left = x - tooltipWidth - offset;
        }

        if (left < padding) {
            left = padding;
        }

        if (top + tooltipHeight + padding > viewport.h) {
            top = viewport.h - tooltipHeight - padding;
        }

        if (top < padding) {
            top = padding;
        }

        return { left, top };
    };

    const position = calculatePosition();

    return (
        <div
            className="fixed pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-100"
            style={{
                left: position.left,
                top: position.top,
                maxWidth: 300,
                maxHeight: 380,
            }}
        >
            <CategoryTooltipContent
                category={category}
                data={data}
                total={total}
                onCategoryClick={onCategoryClick}
            />
        </div>
    );
}

function CategoryTooltipContent({
    category,
    data,
    total,
}: {
    category: string;
    data: CategoryStats;
    total: number;
    onCategoryClick: () => void;
}) {
    const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0';
    const topItems = [...data.items].sort((a, b) => b.current_stock - a.current_stock).slice(0, 5);

    return (
        <div className="bg-white dark:bg-white rounded-2xl border border-slate-200/90 dark:border-slate-200/90 shadow-2xl p-4 space-y-3 max-w-xs text-xs max-h-[360px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-50 border border-pink-100 dark:border-pink-100 flex items-center justify-center text-pink-600 dark:text-pink-600 shrink-0">
                        <i className="fas fa-boxes-stacked text-xs" />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-900 text-sm truncate" title={category}>
                        {category}
                    </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-50 text-pink-700 dark:text-pink-700 text-[11px] font-bold border border-pink-100 dark:border-pink-100 shrink-0">
                    {percentage}%
                </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-50 border border-slate-100 dark:border-slate-100 rounded-xl p-2.5">
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Items</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-900 mt-0.5">{data.count}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-50 border border-slate-100 dark:border-slate-100 rounded-xl p-2.5">
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total Stock</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-900 mt-0.5">{data.totalStock}</div>
                </div>
            </div>

            {/* Status Badges */}
            <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-emerald-50/60 dark:bg-emerald-50/60 border border-emerald-100 dark:border-emerald-100 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-100 text-emerald-600 dark:text-emerald-600 flex items-center justify-center text-[10px] mb-0.5">
                        <i className="fas fa-check" />
                    </div>
                    <div className="font-bold text-emerald-800 dark:text-emerald-800 text-xs">{data.statusCounts.available}</div>
                    <div className="text-[9px] font-medium text-emerald-600 dark:text-emerald-600 uppercase tracking-tight">Available</div>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-50/60 border border-amber-100 dark:border-amber-100 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-100 text-amber-600 dark:text-amber-600 flex items-center justify-center text-[10px] mb-0.5">
                        <i className="fas fa-exclamation" />
                    </div>
                    <div className="font-bold text-amber-800 dark:text-amber-800 text-xs">{data.statusCounts['low-stock']}</div>
                    <div className="text-[9px] font-medium text-amber-600 dark:text-amber-600 uppercase tracking-tight">Low Stock</div>
                </div>

                <div className="bg-rose-50/60 dark:bg-rose-50/60 border border-rose-100 dark:border-rose-100 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-100 text-rose-600 dark:text-rose-600 flex items-center justify-center text-[10px] mb-0.5">
                        <i className="fas fa-times" />
                    </div>
                    <div className="font-bold text-rose-800 dark:text-rose-800 text-xs">{data.statusCounts['out-of-stock']}</div>
                    <div className="text-[9px] font-medium text-rose-600 dark:text-rose-600 uppercase tracking-tight">Out of Stock</div>
                </div>
            </div>

            {/* Total Value */}
            {data.totalValue > 0 && (
                <div className="bg-pink-50/40 dark:bg-pink-50/40 border border-pink-100/80 dark:border-pink-100/80 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-600 text-[11px] font-medium">
                        <i className="fas fa-coins text-xs" />
                        <span>Total Value</span>
                    </div>
                    <div className="font-bold text-pink-900 dark:text-pink-900 text-xs">
                        ₱{data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            )}

            {/* Top Items - No Scrollbar */}
            {topItems.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1 mb-1.5">
                        <i className="fas fa-list-ul text-[9px]" />
                        <span>Top Stock Items</span>
                    </div>
                    <div className="space-y-1 max-h-[110px] overflow-y-auto scrollbar-hide">
                        {topItems.map((item) => {
                            const statusDot =
                                item.status === 'available'
                                    ? 'bg-emerald-500'
                                    : item.status === 'low-stock'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500';

                            return (
                                <div key={item.id} className="flex items-center justify-between text-[11px] py-0.5">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                                        <span className="text-slate-700 dark:text-slate-700 font-medium truncate" title={item.item_name}>
                                            {item.item_name}
                                        </span>
                                    </div>
                                    <span className="text-slate-400 dark:text-slate-400 font-mono text-[10px] shrink-0">
                                        {item.current_stock} {item.unit}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {data.items.length > 5 && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-400 italic pt-0.5">
                            +{data.items.length - 5} more items in this category
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="text-[10px] text-slate-400 dark:text-slate-400 text-center pt-1 border-t border-slate-100 dark:border-slate-100 font-medium">
                Click bar to filter by <span className="text-pink-600 dark:text-pink-600 font-semibold">{category}</span>
            </div>
        </div>
    );
}