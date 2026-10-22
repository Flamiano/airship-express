// header component for supplier and vendor management

"use client";

import React from "react";
import { AppButton } from "../../../../components/ui/AppButton";

interface SuppliersHeaderProps {
    totalSuppliers: number;
    activeSuppliers: number;
    selectedCount: number;
    totalUnreadMessages?: number;
    onBulkDelete: () => void;
    onNewSupplier?: () => void;
}

export function SuppliersHeader({
    totalSuppliers,
    activeSuppliers,
    selectedCount,
    totalUnreadMessages = 0,
    onBulkDelete,
}: SuppliersHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 transition-colors">
            <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5 transition-colors">
                    <i className="fa-solid fa-truck-ramp-box"></i>
                </div>

                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                        Supplier & Vendor Management
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Track supplier purchases, order frequency, and spending patterns.
                    </p>    
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 mt-2 sm:mt-0">
                {selectedCount > 0 && (
                    <AppButton type="button" variant="danger" size="md" onClick={onBulkDelete}>
                        <i className="fas fa-trash-alt text-xs" />
                        <span>Delete Selected ({selectedCount})</span>
                    </AppButton>
                )}
            </div>
        </div>
    );
}
