import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';
import { Button } from './Button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
    showFirstLast?: boolean;
    showPageNumbers?: boolean;
    itemsPerPage?: number;
    totalItems?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className,
    showFirstLast = false,
    showPageNumbers = true,
    itemsPerPage,
    totalItems,
}) => {
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 3;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return pages;
    };

    if (totalPages <= 1) return null;

    const pageNumbers = getPageNumbers();
    const showEllipsisStart = pageNumbers[0] > 1;
    const showEllipsisEnd = pageNumbers[pageNumbers.length - 1] < totalPages;

    const startItem = totalItems ? (currentPage - 1) * (itemsPerPage || 1) + 1 : 0;
    const endItem = totalItems ? Math.min(currentPage * (itemsPerPage || 1), totalItems) : 0;

    return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
            <div className="flex items-center justify-center gap-0.5">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="min-w-[28px] h-7 px-1.5 text-xs"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-3 w-3" />
                </Button>

                {showPageNumbers && (
                    <div className="flex items-center gap-0.5">
                        {showEllipsisStart && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onPageChange(1)}
                                    className="hidden sm:inline-flex min-w-[28px] h-7 px-1.5 text-xs"
                                >
                                    1
                                </Button>
                                <span className="text-muted text-[10px] px-0.5">…</span>
                            </>
                        )}

                        {pageNumbers.map((page) => (
                            <Button
                                key={page}
                                variant={page === currentPage ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => onPageChange(page)}
                                className={cn(
                                    'min-w-[28px] h-7 px-1.5 text-xs',
                                    page === currentPage && 'shadow-sm'
                                )}
                                aria-label={`Page ${page}`}
                                aria-current={page === currentPage ? 'page' : undefined}
                            >
                                {page}
                            </Button>
                        ))}

                        {showEllipsisEnd && (
                            <>
                                <span className="text-muted text-[10px] px-0.5">…</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onPageChange(totalPages)}
                                    className="hidden sm:inline-flex min-w-[28px] h-7 px-1.5 text-xs"
                                >
                                    {totalPages}
                                </Button>
                            </>
                        )}
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="min-w-[28px] h-7 px-1.5 text-xs"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-3 w-3" />
                </Button>
            </div>

            <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
                {totalItems && (
                    <span>
                        Showing <span className="font-medium text-ink">{startItem}</span> to{' '}
                        <span className="font-medium text-ink">{endItem}</span> of{' '}
                        <span className="font-medium text-ink">{totalItems}</span> results
                    </span>
                )}
                <span>
                    Page <span className="font-medium text-ink">{currentPage}</span> of{' '}
                    <span className="font-medium text-ink">{totalPages}</span>
                </span>
            </div>
        </div>
    );
};

export default Pagination;