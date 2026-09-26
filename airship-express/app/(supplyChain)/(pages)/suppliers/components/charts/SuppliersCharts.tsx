// visual charts component for purchase activity and category distribution

"use client";

import React from "react";
import { SupplierChartsSkeleton } from "../../../../components/ui/SkeletonLoader";

interface SuppliersChartsProps {
    isLoading: boolean;
    suppliersCount: number;
    purchaseOrdersCount: number;
    activityChartRef: React.RefObject<HTMLCanvasElement | null>;
    categoryChartRef: React.RefObject<HTMLCanvasElement | null>;
    onAddSupplier: () => void;
}

export function SuppliersCharts({
    isLoading,
    suppliersCount,
    purchaseOrdersCount,
    activityChartRef,
    categoryChartRef,
    onAddSupplier,
}: SuppliersChartsProps) {
    if (isLoading) {
        return <SupplierChartsSkeleton />;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* purchase activity card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] xl:col-span-3 flex flex-col justify-between transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Purchase Activity by Supplier</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total orders and paid amount per supplier</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                        <i className="fas fa-chart-bar text-xs"></i>
                    </div>
                </div>
                <div className="h-60 relative w-full flex items-center justify-center">
                    {suppliersCount === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-3">
                                <i className="fas fa-building text-base"></i>
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No suppliers registered yet</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Add a supplier to start tracking purchases</span>
                        </div>
                    ) : purchaseOrdersCount === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-3">
                                <i className="fas fa-shopping-cart text-base"></i>
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No purchase orders yet</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Create a purchase order to see activity data</span>
                        </div>
                    ) : (
                        <canvas ref={activityChartRef} className="w-full h-full max-h-60"></canvas>
                    )}
                </div>
            </div>

            {/* supplier categories card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] xl:col-span-2 flex flex-col justify-between transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Supplier Categories</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribution by category</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                        <i className="fas fa-chart-pie text-xs"></i>
                    </div>
                </div>
                <div className="h-60 relative w-full flex items-center justify-center">
                    {suppliersCount === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-2.5">
                                <i className="fas fa-chart-pie text-base"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">No Supplier Categories</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mt-0.5 mb-3 leading-tight">
                                Category breakdown will display once suppliers are registered
                            </span>
                            <button
                                type="button"
                                onClick={onAddSupplier}
                                className="px-3.5 py-1.5 bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <i className="fas fa-plus text-[10px]" />
                                <span>Add Supplier</span>
                            </button>
                        </div>
                    ) : (
                        <canvas ref={categoryChartRef} className="w-full h-full max-h-60"></canvas>
                    )}
                </div>
            </div>
        </div>
    );
}
