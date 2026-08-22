"use client";

import React from "react";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showPageNumbers?: boolean;
}

export const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) => {
    if (totalPages <= 0) return null;

    return (
        <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-2xs select-none">
            <AppButton
                type="button"
                variant="neutral"
                size="xs"
                pill
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="px-2.5 h-6 text-xs font-semibold"
            >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Previous</span>
            </AppButton>

            <div className="px-3 py-0.5 rounded-full bg-white dark:bg-[#1c1d25] border border-slate-200/90 dark:border-[#353746] font-semibold text-slate-800 dark:text-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] min-w-[64px] text-center text-xs flex items-center justify-center gap-1">
                <span className="text-pink-600 dark:text-pink-400 font-bold">{currentPage}</span>
                <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                <span className="text-slate-600 dark:text-slate-400">{totalPages}</span>
            </div>

            <AppButton
                type="button"
                variant="neutral"
                size="xs"
                pill
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="px-2.5 h-6 text-xs font-semibold"
            >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
            </AppButton>
        </div>
    );
};