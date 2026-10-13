"use client";

import React from "react";

export type ProcurementStageId = 1 | 2 | 3 | 4;

interface ProcurementLifecycleNavProps {
    currentStage: ProcurementStageId;
    onSelectStage: (stage: ProcurementStageId) => void;
    counts: {
        stockShortages: number;
        totalSuppliers: number;
        quotationsCount: number;
        activePurchaseOrders?: number;
        supplierReturnsCount?: number;
    };
}

export function ProcurementLifecycleNav({
    currentStage,
    onSelectStage,
    counts,
}: ProcurementLifecycleNavProps) {
    const stages = [
        {
            id: 1 as ProcurementStageId,
            label: "Stock Shortages",
            icon: "fa-solid fa-boxes-stacked",
            count: counts.stockShortages,
        },
        {
            id: 2 as ProcurementStageId,
            label: "Find Potential Suppliers",
            icon: "fa-solid fa-compass",
            count: undefined,
        },
        {
            id: 3 as ProcurementStageId,
            label: "Collect & Compare Quotations",
            icon: "fa-solid fa-scale-balanced",
            count: counts.quotationsCount,
        },
        {
            id: 4 as ProcurementStageId,
            label: "Supplier Returns",
            icon: "fa-solid fa-arrow-rotate-left",
            count: counts.supplierReturnsCount,
        },
    ];

    return (
        <div className="w-full">
            <div className="flex items-center justify-start overflow-x-auto no-scrollbar py-2">
                <div className="inline-flex p-1.5 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_8px_rgba(0,0,0,0.6)] border border-white/80 dark:border-white/[0.06] max-w-full gap-1.5">
                    {stages.map((stage) => {
                        const isActive = currentStage === stage.id;
                        return (
                            <button
                                key={stage.id}
                                type="button"
                                onClick={() => onSelectStage(stage.id)}
                                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? "bg-pink-600 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(219,39,119,0.45)] border border-pink-400/40"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent hover:bg-white/40 dark:hover:bg-white/[0.03]"
                                }`}
                            >
                                <i className={`${stage.icon} text-xs`} />
                                <span>{stage.label}</span>
                                {stage.count !== undefined && (
                                    <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                            isActive
                                                ? "bg-white/20 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]"
                                                : "bg-[#e2e8f0] dark:bg-[#1a1c2d] text-slate-600 dark:text-slate-300 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35),_inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/[0.03]"
                                        }`}
                                    >
                                        {stage.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
