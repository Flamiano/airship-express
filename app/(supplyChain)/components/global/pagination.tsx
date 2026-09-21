"use client";
import { AppButton } from "../ui/AppButton";
import { ChevronLeft, ChevronRight } from "lucide-react";
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showPageNumbers?: boolean;
}
export const Pagination = ({ currentPage, totalPages, onPageChange, }: PaginationProps) => {
    if (totalPages <= 0)
        return null;
    return (<div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] select-none">
            <AppButton type="button" variant="neutral" size="xs" pill onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} aria-label="Previous page" className="px-2.5 h-6 text-xs font-semibold">
                <ChevronLeft className="w-3.5 h-3.5"/>
                <span className="hidden sm:inline">Previous</span>
            </AppButton>

            <div className="px-3 py-0.5 rounded-full bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/80 dark:border-[#2a2b38] font-semibold text-slate-800 dark:text-slate-200 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.03)] min-w-[64px] text-center text-xs flex items-center justify-center gap-1">
                <span className="text-pink-600 dark:text-pink-400 font-bold">{currentPage}</span>
                <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                <span className="text-slate-600 dark:text-slate-400">{totalPages}</span>
            </div>

            <AppButton type="button" variant="neutral" size="xs" pill onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} aria-label="Next page" className="px-2.5 h-6 text-xs font-semibold">
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5"/>
            </AppButton>
        </div>);
};
