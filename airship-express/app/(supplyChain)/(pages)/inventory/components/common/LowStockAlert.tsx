'use client';

import { useMemo, useState } from 'react';
import { InventoryItem } from '../../types';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';

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
                                <StatusBadge tone="emerald" size="xs">
                                    Optimal
                                </StatusBadge>
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
        <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] overflow-hidden">
            {/* Header Banner */}
            <div className="p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                        <i className="fas fa-exclamation-triangle text-base" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                                Low Stock Alert
                            </h3>
                            <StatusBadge tone="amber" size="xs">
                                {items.length} {items.length === 1 ? 'item' : 'items'}
                            </StatusBadge>
                            {outOfStockCount > 0 && (
                                <StatusBadge tone="rose" dot size="xs">
                                    {outOfStockCount} critical
                                </StatusBadge>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
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
                                className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] hover:-translate-y-0.5 ${isOutOfStock
                                    ? 'bg-[#f0f3f8] dark:bg-[#1d1e28] border-rose-300/80 dark:border-rose-900/50'
                                    : 'bg-[#f0f3f8] dark:bg-[#1d1e28] border-white/70 dark:border-[#2a2b38]'
                                    }`}
                            >
                                <div>
                                    {/* Item Title & Status Badge */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4
                                            className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors duration-300"
                                            title={item.item_name}
                                        >
                                            {item.item_name}
                                        </h4>
                                        <StatusBadge
                                            tone={isOutOfStock ? 'rose' : 'amber'}
                                            dot
                                            size="xs"
                                        >
                                            {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                                        </StatusBadge>
                                    </div>

                                    {/* Stock Metrics */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        <span>
                                            Current: <strong className="text-slate-900 dark:text-slate-200 font-bold">{item.current_stock}</strong> <span className="text-slate-400 dark:text-slate-400">{item.unit}</span>
                                        </span>
                                        <span>
                                            Min: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{item.minimum_stock}</strong> <span className="text-slate-400 dark:text-slate-400">{item.unit}</span>
                                        </span>
                                    </div>

                                    {/* Progress Indicator */}
                                    <div className="space-y-1 mb-3">
                                        <div
                                            className="w-full h-2 bg-[#ebf0f7] dark:bg-[#14151c] rounded-full overflow-hidden p-0.5 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]"
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
                                <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                                        <i className="fas fa-clock text-[9px] mr-1"></i>
                                        Quick Action
                                    </span>
                                    <button
                                        type="button"
                                        className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
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
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            <span>
                                {isExpanded ? 'Show Less' : `Show All Low Stock (${sortedItems.length})`}
                            </span>
                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px]`} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}