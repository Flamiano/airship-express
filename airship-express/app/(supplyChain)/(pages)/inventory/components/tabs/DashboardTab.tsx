// app/(supplyChain)/inventory/components/tabs/DashboardTab.tsx

'use client';

import { memo } from 'react';
import { InventoryItem } from '../../types';
import { StatsCards } from '../common/StatsCards';
import { LowStockAlert } from '../common/LowStockAlert';
import { CategoryChart } from '../charts/CategoryChart';
import { StatusChart } from '../charts/StatusChart';
import { CardsSkeleton, ChartsSkeleton } from '../../../../components/ui/SkeletonLoader';

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

export const DashboardTab = memo(function DashboardTab({
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
                <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl 
                        border border-white/80 dark:border-[#2c2d3c] 
                        shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] 
                        dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] 
                        p-5 sm:p-6 lg:col-span-2 
                        flex flex-col justify-between 
                        transition-all">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl 
                            bg-gradient-to-tr from-pink-500 to-rose-400 text-white 
                            flex items-center justify-center 
                            text-sm shadow-[0_2px_8px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                                <i className="fas fa-chart-simple"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                                    Inventory by Category
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    Distribution of current stock across categories
                                </p>
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full 
                               bg-[#ebf0f7] dark:bg-[#14151c] 
                               text-slate-700 dark:text-slate-300 text-[11px] font-bold 
                               border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] select-none">
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
                                  bg-[#ebf0f7] dark:bg-[#14151c] 
                                  rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 
                                  text-slate-400 dark:text-slate-400 text-xs gap-1">
                                <i className="fas fa-chart-column text-slate-300 dark:text-slate-600 text-lg mb-1"></i>
                                <span>No category data available</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stock Status Card */}
                <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl 
                        border border-white/80 dark:border-[#2c2d3c] 
                        shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] 
                        dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] 
                        p-5 sm:p-6 flex flex-col justify-between 
                        transition-all">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl 
                                  bg-gradient-to-tr from-amber-500 to-orange-400 text-white 
                                  flex items-center justify-center 
                                  text-sm shadow-[0_2px_8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                                <i className="fas fa-chart-pie"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                                    Stock Status
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    Overview of availability levels
                                </p>
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full 
                               bg-[#ebf0f7] dark:bg-[#14151c] 
                               text-slate-700 dark:text-slate-300 text-[11px] font-bold 
                               border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] select-none">
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
                                  bg-[#ebf0f7] dark:bg-[#14151c] 
                                  rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 
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
});