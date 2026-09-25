// app/(supplyChain)/components/modals/ExecutiveChartModal.tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import Portal from "../client/Portal";
import { AppButton } from "../ui/AppButton";
import { CrudActionButton } from "../ui/CrudActionButton";
import ItemDetailModal, { ItemDetailRecord } from "../../(pages)/executive/components/modals/ItemDetailModal";

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

function sanitizeSearchQuery(query: string): string {
    return query
        .replace(/<[^>]*>/g, "")
        .replace(/[&<>"']/g, "")
        .trim()
        .toLowerCase();
}

export default function ExecutiveChartModal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon = "fa-chart-pie",
    iconColor,
    iconBg,
    description,
    metrics = [],
    items = [],
    listHeader = "Detailed Records",
    emptyText = "No records found for this category.",
    viewAllLink,
    viewAllLabel = "View Complete Table",
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

    // search and filter processing
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (debouncedSearch) {
                const titleMatch = item.title?.toLowerCase().includes(debouncedSearch);
                const subtitleMatch = item.subtitle?.toLowerCase().includes(debouncedSearch);
                const badgeMatch = item.badge?.toLowerCase().includes(debouncedSearch);
                const valueMatch = String(item.value || "").toLowerCase().includes(debouncedSearch);
                if (!titleMatch && !subtitleMatch && !badgeMatch && !valueMatch) {
                    return false;
                }
            }

            if (selectedFilter === "all") return true;

            const matchesCategory = item.category?.toLowerCase() === selectedFilter;
            const matchesBadge = item.badge?.toLowerCase() === selectedFilter;
            const matchesTags = item.tags?.some(t => t.toLowerCase() === selectedFilter);

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
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
                data-lenis-prevent
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] overflow-hidden transform transition-all duration-300 animate-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-white/80 dark:border-white/[0.06] shrink-0 bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] ${iconColor || "text-pink-500 dark:text-pink-400"}`}>
                                <i className={`fas ${icon} text-sm`} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                    {title}
                                </h2>
                                {subtitle && (
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
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
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    {/* Modal Scrollable Body */}
                    <div
                        className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain bg-[#f0f3f8] dark:bg-[#161722]"
                        data-lenis-prevent
                        style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
                    >
                        {description && (
                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                {description}
                            </div>
                        )}

                        {/* High-level Summary Metrics */}
                        {metrics.length > 0 && (
                            <div className={`grid grid-cols-2 ${metrics.length >= 3 ? "sm:grid-cols-3" : ""} gap-3`}>
                                {metrics.map((m, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] text-center transition-all shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]"
                                    >
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            {m.label}
                                        </p>
                                        <p className={`text-xl font-extrabold mt-0.5 ${m.color || "text-slate-900 dark:text-white"}`}>
                                            {m.value}
                                        </p>
                                        {m.sublabel && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
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
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                                    <span>{listHeader}</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] text-slate-700 dark:text-slate-300 text-[9px] font-bold">
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
                                        className="w-full pl-8 pr-7 py-2 text-xs bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 font-medium transition-all"
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

                            {/* Filter Badges Row */}
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
                                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-[0_2px_8px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                                        : "bg-[#ebf0f7] dark:bg-[#14151e] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] hover:text-pink-500"
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {opt.count !== undefined && (
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                                                        isSelected ? "bg-white/20 text-white" : "bg-[#f0f3f8] dark:bg-[#191a24] text-slate-600 dark:text-slate-400"
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
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                    <i className="fas fa-filter-circle-xmark text-2xl mb-2 text-pink-500 opacity-60" />
                                    <p className="text-xs font-semibold">
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
                                            className="mt-2 text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
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
                                            className="flex items-center justify-between p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {/* Hover detail effect (! badge with popover tooltip) */}
                                                <div className="info-badge-container">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleInspectItem(item)}
                                                        className="w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                                                        title="Hover/Click for info (!)"
                                                    >
                                                        !
                                                    </button>
                                                    <div className="tooltip-popover">
                                                        <p className="font-bold text-pink-400">{item.title}</p>
                                                        <p className="text-slate-200 dark:text-slate-300 mt-1">{item.subtitle || 'No extra notes'}</p>
                                                    </div>
                                                </div>

                                                {item.icon && (
                                                    <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs shrink-0 shadow-[1px_1px_2px_rgba(166,175,195,0.2)]">
                                                        <i className={`fas ${item.icon}`} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                            {item.title}
                                                        </span>
                                                        {item.badge && (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${item.badgeColor || "bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06]"}`}>
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.subtitle && (
                                                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
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
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
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
                    <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
        </Portal>
    );
}
