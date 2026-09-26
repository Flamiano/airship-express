"use client";

import { ReactNode } from "react";

interface BulkAction {
    label: string;
    icon: string;
    onClick: () => void;
    variant: 'primary' | 'danger' | 'success' | 'warning' | 'info';
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
    show?: boolean;
    mobileLabel?: string;
}

interface BulkActionsToolbarProps {
    selectedCount: number;
    itemLabel?: string;
    singleItemLabel?: string;
    additionalInfo?: ReactNode;
    actions: BulkAction[];
    onClear: () => void;
    className?: string;
    floating?: boolean;
}

export function BulkActionsToolbar({
    selectedCount,
    itemLabel = 'items',
    singleItemLabel = 'item',
    additionalInfo,
    actions,
    onClear,
    className = '',
    floating = true,
}: BulkActionsToolbarProps) {
    if (selectedCount === 0) return null;

    const visibleActions = actions.filter(action => action.show !== false);

    const getVariantStyles = (variant: BulkAction['variant']) => {
        switch (variant) {
            case 'primary':
                return 'bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border border-pink-300/90 shadow-[0_2px_8px_rgba(244,63,94,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
            case 'danger':
                return 'bg-[#ffe8ec] hover:bg-[#ffdbdf] text-rose-700 border border-rose-300/90 shadow-[0_2px_8px_rgba(225,29,72,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#38141b] dark:hover:bg-[#461922] dark:text-rose-200 dark:border-[#6d202d] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
            case 'success':
                return 'bg-[#e6f8ef] hover:bg-[#d5f3e4] text-emerald-800 border border-emerald-300/90 shadow-[0_2px_8px_rgba(16,185,129,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:hover:bg-[#153a29] dark:text-emerald-200 dark:border-[#1d573c] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
            case 'warning':
                return 'bg-[#fff8e6] hover:bg-[#ffeed0] text-amber-800 border border-amber-300/90 shadow-[0_2px_8px_rgba(245,158,11,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#332210] dark:hover:bg-[#422c15] dark:text-amber-200 dark:border-[#664319] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
            case 'info':
                return 'bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300/90 shadow-[0_2px_8px_rgba(14,165,233,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#0c2a3a] dark:hover:bg-[#13374b] dark:text-sky-200 dark:border-[#1b4e68] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
            default:
                return 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_#ffffff] dark:bg-[#1c1d25] dark:hover:bg-[#252630] dark:text-slate-100 dark:border-[#353746] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]';
        }
    };

    const renderContent = () => (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <span
                        aria-hidden="true"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pink-50 text-pink-600 border border-pink-200/80 dark:bg-slate-800 dark:text-pink-400 dark:border-slate-700/80 text-[11px] font-bold tracking-tight shadow-xs dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                    >
                        {selectedCount}
                    </span>
                    <span>
                        {selectedCount === 1
                            ? `1 ${singleItemLabel} selected`
                            : `${selectedCount} ${itemLabel} selected`
                        }
                        {additionalInfo && (
                            <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                                {additionalInfo}
                            </span>
                        )}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClear}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold 
                               bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80
                               dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700/80
                               shadow-2xs dark:shadow-[0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]
                               transition-all duration-200 active:scale-96 focus:outline-none focus:ring-2 focus:ring-slate-400/40 cursor-pointer"
                >
                    Clear
                </button>
            </div>

            <div className="flex items-center gap-2">
                {visibleActions.map((action, index) => {
                    const isLoading = action.isLoading || false;
                    const disabled = action.disabled || isLoading;

                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={action.onClick}
                            disabled={disabled}
                            aria-label={action.label}
                            className={`
                                inline-flex items-center gap-1.5
                                rounded-full px-3.5 py-1.5
                                text-xs font-semibold
                                transition-all duration-200 ease-in-out active:scale-96
                                focus:outline-none focus:ring-2 focus:ring-pink-500/40
                                disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer
                                ${getVariantStyles(action.variant)}
                                ${action.className || ''}
                            `}
                        >
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                                    <span className="hidden sm:inline">{action.label}...</span>
                                    <span className="sm:hidden">...</span>
                                </>
                            ) : (
                                <>
                                    <i className={`fas ${action.icon}`} aria-hidden="true"></i>
                                    <span className="hidden sm:inline">{action.label}</span>
                                    <span className="sm:hidden">{action.mobileLabel || action.label}</span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    if (!floating) {
        return (
            <div
                role="region"
                aria-label="Bulk actions toolbar"
                className={`
                    w-full rounded-xl
                    bg-white/95 dark:bg-slate-900
                    border border-slate-200/90 dark:border-slate-800/90
                    px-3.5 py-2.5 text-slate-900 dark:text-white
                    shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/40
                    backdrop-blur-md
                    transition-all duration-200
                    animate-in fade-in slide-in-from-top-2
                    sm:px-4 sm:py-3
                    ${className}
                `}
            >
                {renderContent()}
            </div>
        );
    }

    return (
        <div
            role="region"
            aria-label="Bulk actions toolbar"
            className={`
                fixed inset-x-3 top-18 z-30 mx-auto my-0
                rounded-xl
                bg-white/95 dark:bg-slate-900
                border border-slate-200/90 dark:border-slate-800/90
                px-3.5 py-2.5 text-slate-900 dark:text-white
                shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/50
                backdrop-blur-md
                transition-all duration-200
                animate-in fade-in slide-in-from-top-2
                sm:px-4 sm:py-3
                lg:sticky lg:top-4 lg:mx-auto
                ${className}
            `}
        >
            {renderContent()}
        </div>
    );
}

export type { BulkAction, BulkActionsToolbarProps };