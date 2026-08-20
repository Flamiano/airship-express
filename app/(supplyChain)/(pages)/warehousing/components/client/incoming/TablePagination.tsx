"use client";

import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { useMemo } from "react";

interface TablePaginationProps {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize?: number;
    onPageChange?: (page: number) => void;
    isLoading?: boolean;
}

export function TablePagination({
    page,
    totalPages,
    totalItems,
    pageSize = 15,
    onPageChange,
    isLoading = false,
}: TablePaginationProps) {
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    const pages = useMemo(() => {
        const result: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                result.push(i);
            }
            return result;
        }

        result.push(1);

        if (page > 3) {
            result.push("...");
        }

        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);

        for (let i = start; i <= end; i++) {
            result.push(i);
        }

        if (page < totalPages - 2) {
            result.push("...");
        }

        result.push(totalPages);

        return result;
    }, [page, totalPages]);

    const handlePageChange = (newPage: number) => {
        if (isLoading) return;
        if (newPage >= 1 && newPage <= totalPages) {
            onPageChange?.(newPage);
        }
    };

    if (totalItems === 0) {
        return null;
    }

    return (
        <div className="pagination-container-class">
            <span className="text-xs font-medium text-slate-500">
                Showing{" "}
                <span className="font-bold text-slate-900">{startItem}</span> to{" "}
                <span className="font-bold text-slate-900">{endItem}</span> of{" "}
                <span className="font-bold text-slate-900">{totalItems}</span> parcels
            </span>

            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
        </div>
    );
}