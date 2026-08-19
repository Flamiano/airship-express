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
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className,
    showFirstLast = false,
    showPageNumbers = true,
}) => {
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
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

    return (
        <div className={cn('flex items-center justify-between', className)}>
            <div className="flex items-center gap-1">
                {showFirstLast && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                    >
                        First
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {showPageNumbers && (
                    <>
                        {getPageNumbers().map((page) => (
                            <Button
                                key={page}
                                variant={page === currentPage ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </Button>
                        ))}
                    </>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>

                {showFirstLast && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        Last
                    </Button>
                )}
            </div>

            <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
            </span>
        </div>
    );
};