'use client';

import { useMemo, useState } from 'react';
import { InventoryItem } from '../../types';

interface LowStockAlertProps {
    items: InventoryItem[];
    onStockIn: (itemName: string) => void;
}

export function LowStockAlert({ items, onStockIn }: LowStockAlertProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Sort out-of-stock items first, then lowest stock percentage relative to minimum requirement
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            if (a.status === 'out-of-stock' && b.status !== 'out-of-stock') return -1;
            if (a.status !== 'out-of-stock' && b.status === 'out-of-stock') return 1;

            const pctA = a.minimum_stock > 0 ? a.current_stock / a.minimum_stock : 0;
            const pctB = b.minimum_stock > 0 ? b.current_stock / b.minimum_stock : 0;
            return pctA - pctB;
        });
    }, [items]);

    const visibleItems = isExpanded ? sortedItems : sortedItems.slice(0, 6);
    const outOfStockCount = useMemo(
        () => items.filter((item) => item.status === 'out-of-stock').length,
        [items]
    );

    // Healthy State (No Low Stock Items)
    if (items.length === 0) {
        return (
            <div className="bg-white dark:bg-[#2a2a2e] rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/20 dark:hover:shadow-black/60 hover:-translate-y-1 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 transition-transform duration-300 hover:scale-110">
                            <i className="fas fa-check-circle text-lg" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                                    All Stock Levels Healthy
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/30">
                                    Optimal
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                No items are currently below their minimum required threshold.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/20 dark:hover:shadow-black/60 overflow-hidden">
            {/* Header Banner */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/80 dark:from-amber-950/20 via-amber-50/30 dark:via-transparent to-transparent border-b border-amber-100/80 dark:border-amber-900/30 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-amber-700 dark:text-amber-400 shadow-2xs shrink-0 transition-transform duration-300 hover:scale-110">
                        <i className="fas fa-exclamation-triangle text-base" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                                Low Stock Alert
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-200/60 dark:border-amber-800/40">
                                {items.length} {items.length === 1 ? 'item' : 'items'}
                            </span>
                            {outOfStockCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200/60 dark:border-rose-900/40">
                                    {outOfStockCount} critical
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Items currently at or below minimum threshold requiring restocking
                        </p>
                    </div>
                </div>
            </div>

            {/* Item Cards Grid */}
            <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {visibleItems.map((item) => {
                        const isOutOfStock = item.status === 'out-of-stock';
                        const rawPercentage =
                            item.minimum_stock > 0
                                ? (item.current_stock / item.minimum_stock) * 100
                                : 0;
                        const percentage = Math.min(100, Math.max(0, Math.round(rawPercentage)));

                        const handleCardClick = () => {
                            onStockIn(item.item_name);
                        };

                        return (
                            <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                onClick={handleCardClick}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleCardClick();
                                    }
                                }}
                                aria-label={`Restock ${item.item_name}`}
                                className={`group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl dark:hover:shadow-black/50 hover:-translate-y-0.5 ${isOutOfStock
                                    ? 'bg-white dark:bg-slate-800/80 border-rose-200/80 dark:border-rose-900/50'
                                    : 'bg-white dark:bg-slate-800/80 border-amber-200/80 dark:border-amber-900/40'
                                    }`}
                            >
                                <div>
                                    {/* Item Title & Status Badge */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4
                                            className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors duration-300"
                                            title={item.item_name}
                                        >
                                            {item.item_name}
                                        </h4>
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border transition-all duration-300 ${isOutOfStock
                                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
                                                }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${isOutOfStock
                                                    ? 'bg-rose-500 animate-pulse'
                                                    : 'bg-amber-500'
                                                    }`}
                                            />
                                            {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                                        </span>
                                    </div>

                                    {/* Stock Metrics */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        <span>
                                            Current: <strong className="text-slate-900 dark:text-slate-200 font-semibold">{item.current_stock}</strong> <span className="text-slate-400 dark:text-slate-400">{item.unit}</span>
                                        </span>
                                        <span>
                                            Min: <strong className="text-slate-700 dark:text-slate-300 font-medium">{item.minimum_stock}</strong> <span className="text-slate-400 dark:text-slate-400">{item.unit}</span>
                                        </span>
                                    </div>

                                    {/* Progress Indicator */}
                                    <div className="space-y-1 mb-3">
                                        <div
                                            className="w-full h-1.5 bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden transition-all duration-300 group-hover:h-2"
                                            role="progressbar"
                                            aria-valuenow={percentage}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={`${percentage}% of minimum threshold`}
                                        >
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isOutOfStock
                                                    ? 'bg-rose-500 group-hover:bg-rose-600'
                                                    : 'bg-amber-500 group-hover:bg-amber-600'
                                                    }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-end text-[10px] font-semibold text-slate-400 dark:text-slate-400">
                                            {percentage}% of min threshold
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Action Footer */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs transition-colors duration-300">
                                    <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                                        <i className="fas fa-clock text-[9px] mr-1"></i>
                                        Quick Action
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={`Add stock to ${item.item_name}`}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold text-[11px] transition-all duration-300 border border-emerald-200/80 dark:border-emerald-800/50 hover:shadow-xs cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onStockIn(item.item_name);
                                        }}
                                    >
                                        <i className="fas fa-plus text-[9px]" />
                                        Add Stock
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Show More / Show Less Toggle */}
                {sortedItems.length > 6 && (
                    <div className="flex justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            aria-expanded={isExpanded}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl 
                        bg-slate-100 dark:bg-slate-800 
                        hover:bg-slate-200/80 dark:hover:bg-slate-700/70 
                        text-slate-700 dark:text-slate-200 text-xs font-semibold 
                        transition-all duration-300 cursor-pointer
                        hover:shadow-sm dark:hover:shadow-black/30
                        active:scale-95"
                        >
                            <span>
                                {isExpanded ? 'Show Less' : `Show All Low Stock (${sortedItems.length})`}
                            </span>
                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] transition-transform duration-300`} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}