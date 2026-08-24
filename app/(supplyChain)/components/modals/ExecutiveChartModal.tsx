// app/(supplyChain)/components/modals/ExecutiveChartModal.tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import ItemDetailModal, { ItemDetailRecord } from "@/app/(supplyChain)/(pages)/executive/components/modals/ItemDetailModal";

export interface MetricItem {
    label: string;
    value: string | number;
    sublabel?: string;
    color?: string;
}

export interface ListItem {
    title: string;
    subtitle?: string;
    value?: string | number;
    badge?: string;
    badgeColor?: string;
    icon?: string;
    category?: string;
    tags?: string[];
}

export interface FilterOption {
    label: string;
    value: string;
    count?: number;
}

export interface ExecutiveChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: string;
    iconColor?: string;
    iconBg?: string;
    description?: string;
    metrics?: MetricItem[];
    items?: ListItem[];
    listHeader?: string;
    emptyText?: string;
    viewAllLink?: string;
    viewAllLabel?: string;
    onDownload?: () => void;
    downloadLabel?: string;
    filters?: FilterOption[];
    maxDisplayCount?: number;
}

// sanitize search query input
function sanitizeSearchQuery(input: string): string {
    if (!input) return "";
    return input
        .replace(/[<>{}[\]\\]/g, "")
        .trim()
        .slice(0, 100);
}

export default function ExecutiveChartModal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon = "fa-chart-line",
    iconColor = "text-pink-500 dark:text-pink-400",
    iconBg = "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
    description,
    metrics = [],
    items = [],
    listHeader = "Key Records",
    emptyText = "No records available for this chart.",
    viewAllLink,
    viewAllLabel = "Go to Module",
    onDownload,
    downloadLabel = "Download Report (CSV)",
    filters = [],
    maxDisplayCount = 15,
}: ExecutiveChartModalProps) {
    const [rawSearchTerm, setRawSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedFilter, setSelectedFilter] = useState("all");
    const [showAllItems, setShowAllItems] = useState(false);
    const [selectedItemDetail, setSelectedItemDetail] = useState<ItemDetailRecord | null>(null);

    // debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            const sanitized = sanitizeSearchQuery(rawSearchTerm);
            setDebouncedSearch(sanitized);
        }, 300);

        return () => clearTimeout(timer);
    }, [rawSearchTerm]);

    // reset filters when modal opens
    useEffect(() => {
        if (isOpen) {
            setRawSearchTerm("");
            setDebouncedSearch("");
            setSelectedFilter("all");
            setShowAllItems(false);
        }
    }, [isOpen]);

    // close modal on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // extract unique filter options
    const activeFilterOptions = useMemo(() => {
        if (filters.length > 0) return filters;

        const tagsMap = new Map<string, number>();
        items.forEach(item => {
            if (item.category) {
                tagsMap.set(item.category, (tagsMap.get(item.category) || 0) + 1);
            }
            if (item.badge) {
                tagsMap.set(item.badge, (tagsMap.get(item.badge) || 0) + 1);
            }
            if (item.tags) {
                item.tags.forEach(t => tagsMap.set(t, (tagsMap.get(t) || 0) + 1));
            }
        });

        const list: FilterOption[] = [{ label: "All Records", value: "all", count: items.length }];
        tagsMap.forEach((count, key) => {
            list.push({ label: key, value: key.toLowerCase(), count });
        });
        return list;
    }, [filters, items]);

    // filter items by search and category
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const query = debouncedSearch.toLowerCase();
            const matchesSearch = !query ||
                item.title.toLowerCase().includes(query) ||
                (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
                (item.badge && item.badge.toLowerCase().includes(query));

            if (!matchesSearch) return false;

            if (selectedFilter === "all") return true;

            const target = selectedFilter.toLowerCase();
            const matchesCategory = item.category && item.category.toLowerCase() === target;
            const matchesBadge = item.badge && item.badge.toLowerCase() === target;
            const matchesTags = item.tags && item.tags.some(t => t.toLowerCase() === target);

            return matchesCategory || matchesBadge || matchesTags;
        });
    }, [items, debouncedSearch, selectedFilter]);

    // limit displayed items (Render strictly what is in view)
    const displayedItems = useMemo(() => {
        if (showAllItems || filteredItems.length <= maxDisplayCount) {
            return filteredItems;
        }
        return filteredItems.slice(0, maxDisplayCount);
    }, [filteredItems, showAllItems, maxDisplayCount]);

    const handleInspectItem = (item: ListItem) => {
        setSelectedItemDetail({
            title: item.title,
            referenceId: item.badge ? `${item.badge.toUpperCase()}-REF` : "MODAL-ITEM-ID",
            status: item.badge || "Recorded",
            amount: item.value,
            description: item.subtitle || `Detailed record from ${title}`,
            isParcel: item.title.toLowerCase().includes("parcel") || item.title.toLowerCase().includes("tracking") || title.toLowerCase().includes("parcel"),
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
            data-lenis-prevent
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl dark:shadow-black/90 w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                data-lenis-prevent
            >
                {/* Modal Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${iconBg} ${iconColor}`}>
                            <i className={`fas ${icon} text-base`} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {title}
                            </h2>
                            {subtitle && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    <AppButton
                        type="button"
                        variant="neutral"
                        size="icon-sm"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </AppButton>
                </div>

                {/* Modal Scrollable Body */}
                <div
                    className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain"
                    data-lenis-prevent
                    style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
                >
                    {description && (
                        <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {description}
                        </div>
                    )}

                    {/* High-level Summary Metrics */}
                    {metrics.length > 0 && (
                        <div className={`grid grid-cols-2 ${metrics.length >= 3 ? "sm:grid-cols-3" : ""} gap-3`}>
                            {metrics.map((m, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center transition-all"
                                >
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {m.label}
                                    </p>
                                    <p className={`text-xl font-bold mt-0.5 ${m.color || "text-slate-900 dark:text-white"}`}>
                                        {m.value}
                                    </p>
                                    {m.sublabel && (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            {m.sublabel}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Interactive Filter & Debounced Search Bar */}
                    <div className="space-y-2.5 pt-1">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                                <span>{listHeader}</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold">
                                    Showing {displayedItems.length} of {filteredItems.length} records {items.length !== filteredItems.length && `(filtered from ${items.length})`}
                                </span>
                            </p>

                            {/* Search input with Debouncing and Sanitization */}
                            <div className="relative w-full sm:w-56">
                                <input
                                    type="text"
                                    placeholder="Search records..."
                                    value={rawSearchTerm}
                                    onChange={(e) => setRawSearchTerm(e.target.value)}
                                    maxLength={100}
                                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                                />
                                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                                {rawSearchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRawSearchTerm("");
                                            setDebouncedSearch("");
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    >
                                        <i className="fas fa-times" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Badges Carousel / Row */}
                        {activeFilterOptions.length > 1 && (
                            <div
                                className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar"
                                data-lenis-prevent
                            >
                                {activeFilterOptions.map((opt) => {
                                    const isSelected = selectedFilter === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSelectedFilter(opt.value)}
                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-pink-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_3px_rgba(236,72,153,0.3)]"
                                                    : "bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-400 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] hover:border-pink-300 dark:hover:border-pink-500/40"
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {opt.count !== undefined && (
                                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                                                    isSelected ? "bg-white/20 text-white" : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                }`}>
                                                    {opt.count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Detailed Records List (15 items preview) */}
                        {filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <i className="fas fa-filter-circle-xmark text-2xl mb-2 opacity-40" />
                                <p className="text-xs font-medium">
                                    {debouncedSearch || selectedFilter !== "all" ? "No records match your filters." : emptyText}
                                </p>
                                {(debouncedSearch || selectedFilter !== "all") && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRawSearchTerm("");
                                            setDebouncedSearch("");
                                            setSelectedFilter("all");
                                        }}
                                        className="mt-2 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div
                                className="space-y-2 max-h-[340px] overflow-y-auto pr-1 overscroll-contain"
                                data-lenis-prevent
                                style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
                            >
                                {displayedItems.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Hover detail effect (! badge with popover tooltip) */}
                                            <div className="relative group/tooltip inline-block">
                                                <button
                                                    type="button"
                                                    onClick={() => handleInspectItem(item)}
                                                    className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 text-[10px] font-bold flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                                                    title="Hover/Click for info (!)"
                                                >
                                                    !
                                                </button>
                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-30 pointer-events-none border border-slate-700">
                                                    <p className="font-bold text-pink-400">{item.title}</p>
                                                    <p className="text-slate-300 mt-0.5">{item.subtitle || 'No extra notes'}</p>
                                                </div>
                                            </div>

                                            {item.icon && (
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs shrink-0 shadow-2xs">
                                                    <i className={`fas ${item.icon}`} />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                        {item.title}
                                                    </span>
                                                    {item.badge && (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.badgeColor || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.subtitle && (
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                        {item.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {item.value !== undefined && (
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-3">
                                                    {item.value}
                                                </span>
                                            )}
                                            <CrudActionButton
                                                action="view"
                                                ariaLabel={`View details for ${item.title}`}
                                                onClick={() => handleInspectItem(item)}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {/* Toggle button to view all items or download prompt */}
                                {filteredItems.length > maxDisplayCount && (
                                    <div className="pt-2 pb-1 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllItems(!showAllItems)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
                                        >
                                            <span>
                                                {showAllItems
                                                    ? `Collapse to top ${maxDisplayCount} records`
                                                    : `View all ${filteredItems.length} records in modal (+${filteredItems.length - maxDisplayCount} more)`}
                                            </span>
                                            <i className={`fas ${showAllItems ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer with Actions */}
                <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onClose}
                        >
                            Close
                        </AppButton>

                        {onDownload && (
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={onDownload}
                            >
                                <i className="fas fa-file-csv text-[12px] text-pink-500" />
                                <span>{downloadLabel}</span>
                            </AppButton>
                        )}
                    </div>

                    {viewAllLink && (
                        <Link href={viewAllLink}>
                            <AppButton
                                type="button"
                                variant="primary"
                                size="sm"
                            >
                                <span>{viewAllLabel}</span>
                                <i className="fas fa-arrow-right text-[10px]" />
                            </AppButton>
                        </Link>
                    )}
                </div>
            </div>

            {/* Modal Detail on demand */}
            {selectedItemDetail && (
                <ItemDetailModal
                    item={selectedItemDetail}
                    onClose={() => setSelectedItemDetail(null)}
                />
            )}
        </div>
    );
}
