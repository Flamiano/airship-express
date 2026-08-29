// app/(supplyChain)/inventory/components/tabs/DashboardTab.tsx

'use client';

import { InventoryItem } from '../../types';
import { StatsCards } from '../common/StatsCards';
import { LowStockAlert } from '../common/LowStockAlert';
import { CategoryChart } from '../charts/CategoryChart';
import { StatusChart } from '../charts/StatusChart';
import { CardsSkeleton, ChartsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';

interface DashboardTabProps {
    inventoryItems: InventoryItem[];
    stats?: {
        totalItems: number;
        lowStock: number;
        outOfStock: number;
        categoryCounts: Record<string, number>;
        lowStockItems: any[];
    };
    isLoading?: boolean;
    onStockIn: (itemName: string) => void;
    onCategoryClick: (category: string) => void;
    onStatusClick: (status: string) => void;
}

export function DashboardTab({
    inventoryItems,
    stats,
    isLoading = false,
    onStockIn,
    onCategoryClick,
    onStatusClick
}: DashboardTabProps) {
    if (isLoading) {
        return (
            <div className="space-y-6 text-slate-900 dark:text-slate-100">
                <CardsSkeleton count={4} />
                <ChartsSkeleton layout="dual-bar-doughnut" />
            </div>
        );
    }
    const totalItems = stats?.totalItems ?? inventoryItems.length;
    const lowStockItems = stats?.lowStock ?? inventoryItems.filter(i => i.status === 'low-stock').length;
    const outOfStockItems = stats?.outOfStock ?? inventoryItems.filter(i => i.status === 'out-of-stock').length;
    const availableItems = Math.max(0, totalItems - lowStockItems - outOfStockItems);
    const criticalItems = stats?.lowStockItems ?? inventoryItems.filter(i => i.status === 'low-stock' || i.status === 'out-of-stock');

    return (
        <div className="space-y-6 text-slate-900 dark:text-slate-100">
            <StatsCards
                totalItems={totalItems}
                availableItems={availableItems}
                lowStockItems={lowStockItems}
                outOfStockItems={outOfStockItems}
            />

            <LowStockAlert
                items={criticalItems}
                onStockIn={onStockIn}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* Category Distribution Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl 
                        border border-slate-200/80 dark:border-slate-800 
                        shadow-xs p-4 sm:p-5 lg:col-span-2 
                        flex flex-col justify-between 
                        hover:border-slate-300/80 dark:hover:border-slate-700/80 
                        transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl 
                            bg-pink-50 dark:bg-pink-950/40 
                            border border-pink-100 dark:border-pink-900/30 
                            flex items-center justify-center text-pink-600 dark:text-pink-400 
                            text-xs shadow-2xs shrink-0">
                                <i className="fas fa-chart-simple"></i>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                                    Inventory by Category
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                                    Distribution of current stock across categories
                                </p>
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
                               bg-slate-100/80 dark:bg-slate-800/60 
                               text-slate-500 dark:text-slate-300 text-[11px] font-semibold 
                               border border-slate-200/60 dark:border-slate-700/60 shadow-2xs select-none">
                            <i className="fas fa-hand-pointer text-[10px] text-pink-500 dark:text-pink-400"></i>
                            <span>Click bar to filter</span>
                        </span>
                    </div>

                    <div className="h-[200px] sm:h-[220px] relative w-full pt-2">
                        {inventoryItems && inventoryItems.length > 0 ? (
                            <CategoryChart
                                items={inventoryItems}
                                onCategoryClick={onCategoryClick}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center 
                                  bg-slate-50/50 dark:bg-slate-800/30 
                                  rounded-xl border border-dashed border-slate-200 dark:border-slate-800 
                                  text-slate-400 dark:text-slate-400 text-xs gap-1">
                                <i className="fas fa-chart-column text-slate-300 dark:text-slate-600 text-lg mb-1"></i>
                                <span>No category data available</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stock Status Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl 
                        border border-slate-200/80 dark:border-slate-800 
                        shadow-xs p-4 sm:p-5 flex flex-col justify-between 
                        hover:border-slate-300/80 dark:hover:border-slate-700/80 
                        transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl 
                                  bg-amber-50 dark:bg-amber-950/40 
                                  border border-amber-100 dark:border-amber-900/30 
                                  flex items-center justify-center text-amber-600 dark:text-amber-400 
                                  text-xs shadow-2xs shrink-0">
                                <i className="fas fa-chart-pie"></i>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                                    Stock Status
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                                    Overview of availability levels
                                </p>
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
                               bg-slate-100/80 dark:bg-slate-800/60 
                               text-slate-500 dark:text-slate-300 text-[11px] font-semibold 
                               border border-slate-200/60 dark:border-slate-700/60 shadow-2xs select-none">
                            <i className="fas fa-filter text-[10px] text-amber-500 dark:text-amber-400"></i>
                            <span>Click segment</span>
                        </span>
                    </div>

                    <div className="h-[200px] sm:h-[220px] relative w-full pt-2">
                        {inventoryItems && inventoryItems.length > 0 ? (
                            <StatusChart
                                items={inventoryItems}
                                onStatusClick={onStatusClick}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center 
                                  bg-slate-50/50 dark:bg-slate-800/30 
                                  rounded-xl border border-dashed border-slate-200 dark:border-slate-800 
                                  text-slate-400 dark:text-slate-400 text-xs gap-1">
                                <i className="fas fa-chart-pie text-slate-300 dark:text-slate-600 text-lg mb-1"></i>
                                <span>No status data available</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}