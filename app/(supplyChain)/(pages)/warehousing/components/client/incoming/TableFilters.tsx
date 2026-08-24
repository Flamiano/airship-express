"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import AddManualButton from "./AddManualButton";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { sanitizeSearch } from "@/app/(supplyChain)/components/global/sanitize"

interface TableFiltersProps {
    onFilterChange?: (courier: string) => void;
    onSearch?: (search: string) => void;
    onAddManual?: () => void;
}

export default function TableFilters({
    onSearch,
    onAddManual
}: TableFiltersProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const debouncedSearch = useDebounce(searchTerm, 300);

    useEffect(() => {
        onSearch?.(debouncedSearch);
    }, [debouncedSearch, onSearch]);


    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = sanitizeSearch(e.target.value);
        setSearchTerm(sanitized);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="w-48 bg-white border border-slate-300 rounded-xl px-3 py-2 pl-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                        placeholder="Search barcode..."
                        maxLength={100}
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                </div>
            </div>

            <AddManualButton onAdd={onAddManual} />
        </div>
    );
}