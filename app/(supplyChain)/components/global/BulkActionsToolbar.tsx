// app/(supplyChain)/components/global/BulkActionsToolbar.tsx

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
    /** If true, the toolbar will be fixed/sticky. If false, it will be inline */
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
                return 'border border-white/20 bg-white/10 hover:bg-white/20 text-white';
            case 'danger':
                return 'border border-rose-300/30 bg-rose-950/40 hover:bg-rose-950/60 text-white';
            case 'success':
                return 'border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-white';
            case 'warning':
                return 'border border-amber-300/30 bg-amber-500/20 hover:bg-amber-500/30 text-white';
            case 'info':
                return 'border border-blue-300/30 bg-blue-500/20 hover:bg-blue-500/30 text-white';
            default:
                return 'border border-white/20 bg-white/10 hover:bg-white/20 text-white';
        }
    };

    // Shared content renderer
    const renderContent = () => (
        <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Selected Counter & Deselect */}
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
                    className="rounded-lg px-2 py-1 text-xs font-medium 
                               text-white/80 hover:bg-white/10 hover:text-white 
                               transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                    Clear
                </button>
            </div>

            {/* Action Buttons */}
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
                                rounded-lg px-3 py-1.5
                                text-xs font-semibold
                                backdrop-blur-xs
                                transition-all
                                focus:outline-none focus:ring-2 focus:ring-white/40
                                disabled:cursor-not-allowed disabled:opacity-50
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

    // If not floating, use inline positioning
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

    // Floating version (fixed/sticky)
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