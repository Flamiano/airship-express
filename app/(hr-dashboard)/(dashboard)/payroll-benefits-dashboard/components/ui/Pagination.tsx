'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
    /** How many page numbers to show on each side of the current page */
    siblingCount?: number;
    /** Optional row-count controls, e.g. "Showing 1-10 of 42" + a page-size select */
    totalItems?: number;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
}

const DOTS = 'DOTS' as const;

function getPageRange(currentPage: number, totalPages: number, siblingCount: number) {
    const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2 dots
    if (totalPages <= totalNumbers) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);

    const showLeftDots = leftSibling > 2;
    const showRightDots = rightSibling < totalPages - 1;

    if (!showLeftDots && showRightDots) {
        const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
        return [...leftRange, DOTS, totalPages];
    }

    if (showLeftDots && !showRightDots) {
        const rightRange = Array.from(
            { length: 3 + siblingCount * 2 },
            (_, i) => totalPages - (3 + siblingCount * 2) + i + 1
        );
        return [1, DOTS, ...rightRange];
    }

    const middleRange = Array.from(
        { length: rightSibling - leftSibling + 1 },
        (_, i) => leftSibling + i
    );
    return [1, DOTS, ...middleRange, DOTS, totalPages];
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className,
    siblingCount = 1,
    totalItems,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
}) => {
    const pages = useMemo(
        () => getPageRange(currentPage, Math.max(totalPages, 1), siblingCount),
        [currentPage, totalPages, siblingCount]
    );

    if (totalPages <= 0) return null;

    const canPrev = currentPage > 1;
    const canNext = currentPage < totalPages;

    const goTo = (page: number) => {
        const clamped = Math.min(Math.max(page, 1), totalPages);
        if (clamped !== currentPage) onPageChange(clamped);
    };

    const rangeStart = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
    const rangeEnd =
        totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

    const navButtonClasses =
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted ' +
        'transition-all duration-150 hover:border-ink/20 hover:bg-ink/[0.04] hover:text-ink active:scale-90 ' +
        'disabled:pointer-events-none disabled:opacity-40';

    return (
        <div
            className={cn(
                'flex flex-col-reverse items-center justify-between gap-3 sm:flex-row',
                className
            )}
        >
            {/* Left: item-range summary + optional page-size selector */}
            <div className="flex items-center gap-3 text-sm text-muted">
                {rangeStart !== null && rangeEnd !== null && totalItems !== undefined && (
                    <span>
                        Showing <span className="font-medium text-ink">{rangeStart}</span>–
                        <span className="font-medium text-ink">{rangeEnd}</span> of{' '}
                        <span className="font-medium text-ink">{totalItems}</span>
                    </span>
                )}
                {onPageSizeChange && pageSize && (
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none transition-colors hover:border-ink/20 focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        {pageSizeOptions.map((size) => (
                            <option key={size} value={size}>
                                {size} / page
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Right: page controls */}
            <nav className="flex items-center gap-1" aria-label="Pagination">
                <button
                    type="button"
                    onClick={() => goTo(currentPage - 1)}
                    disabled={!canPrev}
                    aria-label="Previous page"
                    className={navButtonClasses}
                >
                    <ChevronLeft size={16} strokeWidth={2} />
                </button>

                {pages.map((page, idx) =>
                    page === DOTS ? (
                        <span
                            key={`dots-${idx}`}
                            className="inline-flex h-9 w-9 items-center justify-center text-muted"
                        >
                            <MoreHorizontal size={16} />
                        </span>
                    ) : (
                        <button
                            key={page}
                            type="button"
                            onClick={() => goTo(page as number)}
                            aria-current={page === currentPage ? 'page' : undefined}
                            className={cn(
                                'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium',
                                'transition-all duration-150 active:scale-90',
                                page === currentPage
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                                    : 'text-ink hover:bg-ink/[0.06] border border-transparent hover:border-line'
                            )}
                        >
                            {page}
                        </button>
                    )
                )}

                <button
                    type="button"
                    onClick={() => goTo(currentPage + 1)}
                    disabled={!canNext}
                    aria-label="Next page"
                    className={navButtonClasses}
                >
                    <ChevronRight size={16} strokeWidth={2} />
                </button>
            </nav>
        </div>
    );
};