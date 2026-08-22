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
                return 'bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 shadow-[0_2px_6px_rgba(0,0,0,0.12),inset_0_1px_0_#ffffff]';
            case 'danger':
                return 'bg-[#ffe8ec] hover:bg-[#ffdbdf] text-rose-700 border border-rose-300 shadow-[0_2px_6px_rgba(225,29,72,0.18),inset_0_1px_0_#ffffff]';
            case 'success':
                return 'bg-[#e6f8ef] hover:bg-[#d5f3e4] text-emerald-800 border border-emerald-300 shadow-[0_2px_6px_rgba(16,185,129,0.18),inset_0_1px_0_#ffffff]';
            case 'warning':
                return 'bg-[#fef3c7] hover:bg-[#fde68a] text-amber-900 border border-amber-300 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_#ffffff]';
            case 'info':
                return 'bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_#ffffff]';
            default:
                return 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_#ffffff]';
        }
    };

    const renderContent = () => (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <span
                        aria-hidden="true"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold tracking-tight shadow-inner"
                    >
                        {selectedCount}
                    </span>
                    <span>
                        {selectedCount === 1
                            ? `1 ${singleItemLabel} selected`
                            : `${selectedCount} ${itemLabel} selected`
                        }
                        {additionalInfo && (
                            <span className="ml-1 font-normal opacity-90">
                                {additionalInfo}
                            </span>
                        )}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClear}
                    className="rounded-full px-2.5 py-1 text-xs font-medium 
                               bg-white/20 hover:bg-white/30 text-white 
                               transition-all duration-200 active:scale-96 focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
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
                                rounded-full px-3 py-1.5
                                text-xs font-semibold
                                transition-all duration-200 ease-in-out active:scale-96
                                focus:outline-none focus:ring-2 focus:ring-white/40
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
                    bg-gradient-to-r from-pink-500 via-rose-500 to-rose-600
                    dark:from-pink-600 dark:via-rose-600 dark:to-rose-700
                    px-3.5 py-2.5 text-white
                    shadow-xl shadow-pink-500/25
                    dark:shadow-pink-900/40
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
                bg-gradient-to-r from-pink-500 via-rose-500 to-rose-600
                dark:from-pink-600 dark:via-rose-600 dark:to-rose-700
                px-3.5 py-2.5 text-white
                shadow-xl shadow-pink-500/25
                dark:shadow-pink-900/40
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