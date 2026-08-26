"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
    Search, Grid, List, Calendar, User, Tag, Eye, X, Download,
    Image as ImageIcon, HardDrive, Filter, XCircle, Loader2, Images,
    ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize2, ChevronLeft,
    ChevronRight, Check, RefreshCw
} from 'lucide-react';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { toast } from 'sonner';
import { PageSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';

interface MediaItem {
    id: string;
    title: string;
    imageUrl: string;
    uploader: {
        name: string;
        avatar: string;
        role: string;
        email?: string;
    };
    uploadDate: string;
    category: string;
    fileSize: string;
    fileSizeBytes?: number;
    file_type?: string;
    storage_path?: string;
    created_at?: string;
    supplier?: string | null;
    po_number?: string | null;
    parcel_batch?: string | null;
    notes?: string | null;
}

interface CacheEntry {
    url: string;
    loading: boolean;
    loaded: boolean;
    timestamp: number;
    retries: number;
    imageObj?: HTMLImageElement;
}

class LRUImageCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxSize: number = 300;
    private readonly cacheDuration: number = 60 * 60 * 1000;
    private readonly maxRetries: number = 3;

    get(id: string): CacheEntry | null {
        const entry = this.cache.get(id);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.cacheDuration) {
            this.cache.delete(id);
            return null;
        }

        // move recent
        this.cache.delete(id);
        this.cache.set(id, entry);
        return entry;
    }

    set(id: string, url: string): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(id, {
            url,
            loading: false,
            loaded: false,
            timestamp: Date.now(),
            retries: 0
        });
    }

    markLoading(id: string): void {
        const entry = this.cache.get(id);
        if (entry) {
            entry.loading = true;
            this.cache.set(id, entry);
        }
    }

    markLoaded(id: string, imageObj?: HTMLImageElement): void {
        const entry = this.cache.get(id);
        if (entry) {
            entry.loading = false;
            entry.loaded = true;
            entry.timestamp = Date.now();
            if (imageObj) entry.imageObj = imageObj;
            this.cache.set(id, entry);
        }
    }

    markError(id: string): void {
        const entry = this.cache.get(id);
        if (entry) {
            entry.loading = false;
            entry.retries += 1;
            this.cache.set(id, entry);
        }
    }

    canRetry(id: string): boolean {
        const entry = this.cache.get(id);
        return entry ? entry.retries < this.maxRetries : false;
    }

    invalidate(id: string): void {
        this.cache.delete(id);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

const imageCache = new LRUImageCache();

interface FilterState {
    searchTerm: string;
    searchType: 'all' | 'title' | 'uploader' | 'supplier' | 'po';
    selectedCategory: string;
    selectedSupplier: string;
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
}

const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// grid card
interface GalleryCardProps {
    item: MediaItem;
    hasError: boolean;
    onPreview: (item: MediaItem) => void;
    onDownload: (item: MediaItem, e: React.MouseEvent) => void;
    onRetry: (id: string, url: string, e: React.MouseEvent) => void;
    onImageError: (id: string) => void;
}

const GalleryCard = memo(function GalleryCard({
    item,
    hasError,
    onPreview,
    onDownload,
    onRetry,
    onImageError
}: GalleryCardProps) {
    const cached = imageCache.get(item.id);
    const [loaded, setLoaded] = useState<boolean>(cached?.loaded ?? false);

    return (
        <div
            className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-500/40 shadow-2xs hover:shadow-lg dark:hover:shadow-pink-500/10 hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer"
            onClick={() => onPreview(item)}
        >
            <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80">
                {!loaded && !hasError && (
                    <div className="absolute inset-0 animate-pulse bg-linear-to-r from-slate-200 dark:from-slate-800 via-slate-100 dark:via-slate-700 to-slate-200 dark:to-slate-800" />
                )}

                {!hasError ? (
                    <img
                        src={cached?.url || item.imageUrl}
                        alt={item.title}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ease-out ${loaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        loading="lazy"
                        onLoad={() => {
                            setLoaded(true);
                            imageCache.markLoaded(item.id);
                        }}
                        onError={() => onImageError(item.id)}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500 gap-2 p-4 text-center">
                        <ImageIcon className="w-9 h-9 opacity-50 text-slate-400" />
                        <span className="text-[11px] font-medium text-slate-400">Failed to load</span>
                        {imageCache.canRetry(item.id) && (
                            <AppButton
                                type="button"
                                variant="pink"
                                size="xs"
                                onClick={(e) => onRetry(item.id, item.imageUrl, e)}
                            >
                                <RefreshCw className="w-3 h-3" />
                                <span>Retry</span>
                            </AppButton>
                        )}
                    </div>
                )}

                <div className="absolute top-2.5 right-2.5">
                    <StatusBadge tone="pink" size="xs">
                        {item.category}
                    </StatusBadge>
                </div>

                {item.supplier && (
                    <div className="absolute bottom-2.5 left-2.5 max-w-[70%]">
                        <StatusBadge tone="neutral" dot size="xs">
                            <span className="truncate">{item.supplier}</span>
                        </StatusBadge>
                    </div>
                )}

                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <AppButton
                        type="button"
                        variant="pink"
                        size="sm"
                        className="group/btn overflow-hidden transition-all duration-300"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(item);
                        }}
                        title="Preview"
                    >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[70px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                            Preview
                        </span>
                    </AppButton>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="sm"
                        className="group/btn overflow-hidden transition-all duration-300"
                        onClick={(e) => onDownload(item, e)}
                        title="Download"
                    >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[80px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                            Download
                        </span>
                    </AppButton>
                </div>
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                <div>
                    <h3
                        className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1"
                        title={item.title}
                    >
                        {item.title}
                    </h3>
                    {item.po_number && (
                        <div className="mt-1">
                            <StatusBadge tone="pink" size="xs">
                                <span className="font-mono">PO: {item.po_number}</span>
                            </StatusBadge>
                        </div>
                    )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <img
                            src={item.uploader.avatar}
                            alt={item.uploader.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                        />
                        <p className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate leading-none">
                            {item.uploader.name}
                        </p>
                    </div>

                    <div className="flex items-center text-slate-400 dark:text-slate-500 shrink-0 gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.uploadDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

// list row
interface GalleryListItemProps {
    item: MediaItem;
    hasError: boolean;
    onPreview: (item: MediaItem) => void;
    onDownload: (item: MediaItem, e: React.MouseEvent) => void;
    onImageError: (id: string) => void;
}

const GalleryListItem = memo(function GalleryListItem({
    item,
    hasError,
    onPreview,
    onDownload,
    onImageError
}: GalleryListItemProps) {
    const cached = imageCache.get(item.id);

    return (
        <div
            className="p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-all cursor-pointer group"
            onClick={() => onPreview(item)}
        >
            <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-700/80 shrink-0 overflow-hidden shadow-2xs group-hover:border-pink-300 dark:group-hover:border-pink-500/50 transition-colors">
                    {!hasError ? (
                        <img
                            src={cached?.url || item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={() => onImageError(item.id)}
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                            {item.title}
                        </h3>
                        {item.po_number && (
                            <StatusBadge tone="pink" size="xs">
                                <span className="font-mono">PO: {item.po_number}</span>
                            </StatusBadge>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        <StatusBadge tone="pink" icon="fas fa-tag" size="xs">
                            {item.category}
                        </StatusBadge>

                        {item.supplier && (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                <User className="w-3 h-3 text-slate-400" />
                                {item.supplier}
                            </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                            <HardDrive className="w-3 h-3 text-slate-400" />
                            {item.fileSize}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                    <img
                        src={item.uploader.avatar}
                        alt={item.uploader.name}
                        className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200 hidden lg:inline">
                        {item.uploader.name}
                    </span>
                </div>

                <div className="hidden md:flex items-center text-slate-400 dark:text-slate-500 font-medium text-[11px]">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span>{item.uploadDate}</span>
                </div>

                <AppButton
                    type="button"
                    variant="pink"
                    size="xs"
                    className="group/btn overflow-hidden transition-all duration-300"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview(item);
                    }}
                    title="Preview image"
                >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[70px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                        Preview
                    </span>
                </AppButton>

                <AppButton
                    type="button"
                    variant="neutral"
                    size="xs"
                    className="group/btn overflow-hidden transition-all duration-300"
                    onClick={(e) => onDownload(item, e)}
                    title="Download file"
                >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[80px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                        Download
                    </span>
                </AppButton>
            </div>
        </div>
    );
});

// gallery state
export default function MediaGallery() {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [suppliers, setSuppliers] = useState<string[]>(['All']);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // viewer state
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const [filterState, setFilterState] = useState<FilterState>({
        searchTerm: '',
        searchType: 'all',
        selectedCategory: 'All',
        selectedSupplier: 'All',
        dateRange: 'all'
    });

    const debouncedSearch = useDebounce(filterState.searchTerm, 400);
    const debouncedFilters = useDebounce(filterState, 500);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const itemsPerPage = 12;
    const abortControllerRef = useRef<AbortController | null>(null);

    // find active index
    const selectedItemIndex = useMemo(() => {
        if (!selectedItem) return -1;
        return mediaItems.findIndex(item => item.id === selectedItem.id);
    }, [selectedItem, mediaItems]);

    // reset view
    const resetZoomAndPan = useCallback(() => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setIsDragging(false);
    }, []);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 0.25, 4));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(prev - 0.25, 0.5);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const handleRotateCw = useCallback(() => {
        setRotation(prev => (prev + 90) % 360);
    }, []);

    const handleRotateCcw = useCallback(() => {
        setRotation(prev => (prev - 90 + 360) % 360);
    }, []);

    // next image
    const handleNextImage = useCallback(() => {
        if (selectedItemIndex >= 0 && selectedItemIndex < mediaItems.length - 1) {
            const nextItem = mediaItems[selectedItemIndex + 1];
            setSelectedItem(nextItem);
            resetZoomAndPan();
        }
    }, [selectedItemIndex, mediaItems, resetZoomAndPan]);

    // prev image
    const handlePrevImage = useCallback(() => {
        if (selectedItemIndex > 0) {
            const prevItem = mediaItems[selectedItemIndex - 1];
            setSelectedItem(prevItem);
            resetZoomAndPan();
        }
    }, [selectedItemIndex, mediaItems, resetZoomAndPan]);

    // keyboard listeners
    useEffect(() => {
        if (!isPreviewOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closePreview();
            } else if (e.key === 'ArrowRight') {
                handleNextImage();
            } else if (e.key === 'ArrowLeft') {
                handlePrevImage();
            } else if (e.key === '+' || e.key === '=') {
                handleZoomIn();
            } else if (e.key === '-') {
                handleZoomOut();
            } else if (e.key === '0') {
                resetZoomAndPan();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPreviewOpen, handleNextImage, handlePrevImage, handleZoomIn, handleZoomOut, resetZoomAndPan]);

    // mouse zoom
    const handleWheelZoom = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            setZoom(prev => Math.min(prev + 0.15, 4));
        } else {
            setZoom(prev => {
                const next = Math.max(prev - 0.15, 0.5);
                if (next <= 1) setPan({ x: 0, y: 0 });
                return next;
            });
        }
    }, []);

    // mouse drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || zoom <= 1) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // toggle zoom
    const handleDoubleClick = () => {
        if (zoom > 1) {
            resetZoomAndPan();
        } else {
            setZoom(2);
        }
    };

    const getDateRangeFilter = useCallback((range: string) => {
        const now = new Date();
        switch (range) {
            case 'today':
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                return today.toISOString();
            case 'week':
                const week = new Date(now);
                week.setDate(week.getDate() - 7);
                return week.toISOString();
            case 'month':
                const month = new Date(now);
                month.setMonth(month.getMonth() - 1);
                return month.toISOString();
            case 'year':
                const year = new Date(now);
                year.setFullYear(year.getFullYear() - 1);
                return year.toISOString();
            default:
                return null;
        }
    }, []);

    const buildQuery = useCallback((pageNum: number, forCount: boolean = false) => {
        let query = supabase
            .from('documents')
            .select(forCount ? 'file_size' : '*', forCount ? undefined : { count: 'exact' })
            .in('category', ['photos', 'documents'])
            .order('created_at', { ascending: false });

        if (debouncedSearch) {
            const searchTerm = debouncedSearch;
            switch (filterState.searchType) {
                case 'title':
                    query = query.ilike('title', `%${searchTerm}%`);
                    break;
                case 'uploader':
                    query = query.ilike('uploaded_by', `%${searchTerm}%`);
                    break;
                case 'supplier':
                    query = query.ilike('supplier', `%${searchTerm}%`);
                    break;
                case 'po':
                    query = query.ilike('po_number', `%${searchTerm}%`);
                    break;
                default:
                    query = query.or(
                        `title.ilike.%${searchTerm}%,` +
                        `file_name.ilike.%${searchTerm}%,` +
                        `uploaded_by.ilike.%${searchTerm}%,` +
                        `supplier.ilike.%${searchTerm}%,` +
                        `po_number.ilike.%${searchTerm}%,` +
                        `document_type.ilike.%${searchTerm}%`
                    );
            }
        }

        if (filterState.selectedCategory !== 'All') {
            query = query.eq('document_type', filterState.selectedCategory);
        }

        if (filterState.selectedSupplier !== 'All') {
            query = query.eq('supplier', filterState.selectedSupplier);
        }

        const dateFilter = getDateRangeFilter(filterState.dateRange);
        if (dateFilter) {
            query = query.gte('created_at', dateFilter);
        }

        if (!forCount) {
            const from = (pageNum - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);
        }

        return query;
    }, [debouncedSearch, filterState, getDateRangeFilter, itemsPerPage]);

    const fetchImages = useCallback(async (pageNum: number, isLoadMore: boolean = false) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (fetching) return;
        setFetching(true);

        try {
            if (isLoadMore) {
                setLoadingMore(true);
            }

            const query = buildQuery(pageNum);
            const { data, error, count } = await query;

            if (error) {
                if (error.code === 'PGRST103') {
                    setHasMore(false);
                    setFetching(false);
                    if (isLoadMore) setLoadingMore(false);
                    return;
                }
                throw error;
            }

            const total = count || 0;
            setTotalCount(total);

            const totalLoaded = pageNum * itemsPerPage;
            setHasMore(total > totalLoaded);

            if (!isLoadMore || pageNum === 1) {
                const sizeQuery = buildQuery(1, true);
                const { data: sizeData, error: sizeError } = await sizeQuery.select('file_size');

                if (!sizeError && sizeData) {
                    const totalBytes = sizeData.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
                    setTotalSize(totalBytes);
                }
            }

            const transformedItems: MediaItem[] = (data || []).map((doc) => {
                const { data: { publicUrl } } = supabase.storage
                    .from('documents')
                    .getPublicUrl(doc.storage_path);

                const cached = imageCache.get(doc.id);
                if (!cached) {
                    imageCache.set(doc.id, publicUrl);
                }

                const fileSizeBytes = doc.file_size || 0;

                return {
                    id: doc.id,
                    title: doc.title || doc.file_name || 'Untitled',
                    imageUrl: publicUrl,
                    uploader: {
                        name: doc.uploaded_by || 'Unknown User',
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.uploaded_by || 'Unknown')}&background=random&size=64`,
                        role: 'Uploader',
                        email: doc.uploaded_by ? `${doc.uploaded_by.toLowerCase().replace(/\s/g, '.')}@company.com` : undefined,
                    },
                    uploadDate: doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }) : 'Unknown Date',
                    category: doc.document_type || 'Uncategorized',
                    fileSize: formatFileSize(fileSizeBytes),
                    fileSizeBytes: fileSizeBytes,
                    file_type: doc.file_type,
                    storage_path: doc.storage_path,
                    created_at: doc.created_at,
                    supplier: doc.supplier,
                    po_number: doc.po_number,
                    parcel_batch: doc.parcel_batch,
                    notes: doc.notes,
                };
            });

            if (isLoadMore) {
                const existingIds = new Set(mediaItems.map(item => item.id));
                const newItems = transformedItems.filter(item => !existingIds.has(item.id));
                if (newItems.length > 0) {
                    setMediaItems(prev => [...prev, ...newItems]);
                }
            } else {
                setMediaItems(transformedItems);
            }

            if (!isLoadMore) {
                const uniqueCategories = ['All', ...new Set((data || []).map(d => d.document_type).filter(Boolean))];
                setCategories(uniqueCategories);

                const uniqueSuppliers = ['All', ...new Set((data || []).map(d => d.supplier).filter(Boolean))];
                setSuppliers(uniqueSuppliers);
            }

        } catch (error: any) {
            if (error?.name === 'AbortError') {
                return;
            }
            if (error?.code !== 'PGRST103') {
                console.error('Error fetching images:', error);
                toast.error('Failed to load images');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setFetching(false);
            setIsInitialLoad(false);
            abortControllerRef.current = null;
        }
    }, [buildQuery, fetching, mediaItems, itemsPerPage]);

    useEffect(() => {
        setIsInitialLoad(true);
        setPage(1);
        fetchImages(1, false);
    }, []);

    useEffect(() => {
        if (isInitialLoad) return;
        setPage(1);
        fetchImages(1, false);
    }, [debouncedFilters]);

    const handleLoadMore = () => {
        if (loadingMore || fetching || !hasMore) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
    };

    // preload images
    useEffect(() => {
        if (mediaItems.length > 0 && !loading) {
            const preloadCount = Math.min(10, mediaItems.length);
            for (let i = 0; i < preloadCount; i++) {
                const item = mediaItems[i];
                if (!item) continue;

                const cached = imageCache.get(item.id);
                if (!cached || (!cached.loaded && !cached.loading)) {
                    const img = new Image();
                    img.src = item.imageUrl;
                    imageCache.markLoading(item.id);

                    img.onload = () => {
                        if (typeof img.decode === 'function') {
                            img.decode().catch(() => {}).finally(() => {
                                imageCache.markLoaded(item.id, img);
                            });
                        } else {
                            imageCache.markLoaded(item.id, img);
                        }
                    };

                    img.onerror = () => {
                        imageCache.markError(item.id);
                    };
                }
            }
        }
    }, [mediaItems, loading]);

    const handleFilterChange = (key: keyof FilterState, value: any) => {
        setFilterState(prev => ({
            ...prev,
            [key]: value
        }));
        setPage(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilterState(prev => ({
            ...prev,
            searchTerm: e.target.value
        }));
    };

    const handleImageClick = (item: MediaItem) => {
        setSelectedItem(item);
        resetZoomAndPan();
        setIsPreviewOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const closePreview = () => {
        setIsPreviewOpen(false);
        setSelectedItem(null);
        resetZoomAndPan();
        document.body.style.overflow = 'auto';
    };

    const handleImageError = (id: string) => {
        if (!imageCache.canRetry(id)) {
            setImageErrors(prev => new Set(prev).add(id));
        }
    };

    const handleRetry = (id: string, url: string, e: React.MouseEvent) => {
        e.stopPropagation();
        imageCache.invalidate(id);
        setImageErrors(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });

        const img = new Image();
        img.src = url;
        img.onload = () => {
            imageCache.markLoaded(id, img);
            setImageErrors(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        };
        img.onerror = () => {
            imageCache.markError(id);
            setImageErrors(prev => new Set(prev).add(id));
        };
    };

    const downloadImage = async (item: MediaItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            const toastId = toast.loading('Downloading image...');
            const response = await fetch(item.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${item.title}.${item.file_type?.split('/').pop() || 'jpg'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Image downloaded!', { id: toastId });
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download image');
        }
    };

    const clearFilters = () => {
        setFilterState({
            searchTerm: '',
            searchType: 'all',
            selectedCategory: 'All',
            selectedSupplier: 'All',
            dateRange: 'all'
        });
        setPage(1);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    };

    if (loading && mediaItems.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <SessionGuard requiredRole={['Admin', 'Manager', 'Employee', 'Executive']}>
            <div className="mx-auto p-6 bg-slate-50 dark:bg-ink/40 min-h-screen bgCard">
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0">
                                    <i className="fa-solid fa-photo-film"></i>
                                </div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        Media Gallery
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                        <StatusBadge tone="pink" size="xs">
                                            <span className="font-bold">{totalCount}</span> images
                                        </StatusBadge>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <StatusBadge tone="neutral" size="xs">
                                            <span>{formatFileSize(totalSize)}</span>
                                        </StatusBadge>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <StatusBadge tone="neutral" size="xs">
                                            <span>{Math.max(0, categories.length - 1)} categories</span>
                                        </StatusBadge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 self-end sm:self-auto">
                                <AppButton
                                    type="button"
                                    variant={showFilters ? "pink" : "neutral"}
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <Filter className="w-4 h-4 text-pink-500" />
                                    <span>Filters</span>
                                    {showFilters && (
                                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                                    )}
                                </AppButton>

                                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-full border border-slate-200/90 dark:border-slate-800 flex items-center gap-1 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        title="Grid View"
                                        className={`p-1.5 rounded-full transition-all cursor-pointer ${viewMode === 'grid'
                                            ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] font-semibold'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <Grid className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        title="List View"
                                        className={`p-1.5 rounded-full transition-all cursor-pointer ${viewMode === 'list'
                                            ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] font-semibold'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={`Search by ${filterState.searchType === 'all'
                                        ? 'title, uploader, supplier, or PO'
                                        : filterState.searchType === 'title'
                                            ? 'title'
                                            : filterState.searchType === 'uploader'
                                                ? 'uploader name'
                                                : filterState.searchType === 'supplier'
                                                    ? 'supplier name'
                                                    : 'PO number'
                                        }...`}
                                    value={filterState.searchTerm}
                                    onChange={handleSearchChange}
                                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-2xs"
                                />
                                {filterState.searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleFilterChange('searchTerm', '');
                                            setTimeout(() => searchInputRef.current?.focus(), 50);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 cursor-pointer"
                                        title="Clear search"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <select
                                value={filterState.searchType}
                                onChange={(e) => {
                                    handleFilterChange('searchType', e.target.value);
                                    setTimeout(() => searchInputRef.current?.focus(), 50);
                                }}
                                className="py-2.5 px-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-2xs"
                            >
                                <option value="all">All Fields</option>
                                <option value="title">Title</option>
                                <option value="uploader">Uploader</option>
                                <option value="supplier">Supplier</option>
                                <option value="po">PO Number</option>
                            </select>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-2xs space-y-4 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xs border border-pink-200/80 dark:border-pink-800/50">
                                        <Filter className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Filter Options
                                    </h3>
                                </div>

                                <AppButton
                                    type="button"
                                    variant="neutral"
                                    size="xs"
                                    onClick={clearFilters}
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Reset All</span>
                                </AppButton>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Category
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={filterState.selectedCategory}
                                            onChange={(e) => handleFilterChange('selectedCategory', e.target.value)}
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-2xs"
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Supplier
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={filterState.selectedSupplier}
                                            onChange={(e) => handleFilterChange('selectedSupplier', e.target.value)}
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-2xs"
                                        >
                                            {suppliers.map((sup) => (
                                                <option key={sup} value={sup}>
                                                    {sup}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Date Range
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={filterState.dateRange}
                                            onChange={(e) => handleFilterChange('dateRange', e.target.value as any)}
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-2xs"
                                        >
                                            <option value="all">All Time</option>
                                            <option value="today">Today</option>
                                            <option value="week">Last 7 Days</option>
                                            <option value="month">Last 30 Days</option>
                                            <option value="year">Last Year</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Active Filters
                                    </label>
                                    <div className="min-h-9.5 p-1 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5">
                                        {filterState.selectedCategory !== 'All' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                                <span>{filterState.selectedCategory}</span>
                                                <button
                                                    onClick={() => handleFilterChange('selectedCategory', 'All')}
                                                    className="p-0.5 hover:bg-pink-200/60 rounded transition-colors text-pink-700 dark:text-pink-300 cursor-pointer"
                                                    title="Remove filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.selectedSupplier !== 'All' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                                <span>{filterState.selectedSupplier}</span>
                                                <button
                                                    onClick={() => handleFilterChange('selectedSupplier', 'All')}
                                                    className="p-0.5 hover:bg-purple-200/60 rounded transition-colors text-purple-700 dark:text-purple-300 cursor-pointer"
                                                    title="Remove filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.dateRange !== 'all' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                                <span className="capitalize">{filterState.dateRange}</span>
                                                <button
                                                    onClick={() => handleFilterChange('dateRange', 'all')}
                                                    className="p-0.5 hover:bg-emerald-200/60 rounded transition-colors text-emerald-700 dark:text-emerald-300 cursor-pointer"
                                                    title="Remove filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.selectedCategory === 'All' &&
                                            filterState.selectedSupplier === 'All' &&
                                            filterState.dateRange === 'all' &&
                                            !filterState.searchTerm && (
                                                <span className="text-xs text-slate-400 dark:text-slate-500 italic px-2">
                                                    No active filters applied
                                                </span>
                                            )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {mediaItems.map((item) => (
                            <GalleryCard
                                key={item.id}
                                item={item}
                                hasError={imageErrors.has(item.id)}
                                onPreview={handleImageClick}
                                onDownload={downloadImage}
                                onRetry={handleRetry}
                                onImageError={handleImageError}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {mediaItems.map((item) => (
                            <GalleryListItem
                                key={item.id}
                                item={item}
                                hasError={imageErrors.has(item.id)}
                                onPreview={handleImageClick}
                                onDownload={downloadImage}
                                onImageError={handleImageError}
                            />
                        ))}
                    </div>
                )}

                {!loading && mediaItems.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        {hasMore ? (
                            <AppButton
                                type="button"
                                variant="pink"
                                size="lg"
                                onClick={handleLoadMore}
                                disabled={loadingMore || fetching}
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-pink-500 dark:text-pink-400" />
                                        <span className="tracking-wide">Loading more...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 opacity-80" />
                                        <span>
                                            Load More <span className="opacity-80 font-mono text-xs">({mediaItems.length} / {totalCount})</span>
                                        </span>
                                    </>
                                )}
                            </AppButton>
                        ) : (
                            <StatusBadge tone="emerald" size="md">
                                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mr-1" />
                                <span>All {totalCount} items loaded</span>
                            </StatusBadge>
                        )}

                        <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                            Showing <span className="font-mono text-slate-700 dark:text-slate-300">{mediaItems.length}</span> of <span className="font-mono text-slate-700 dark:text-slate-300">{totalCount}</span> items
                        </div>
                    </div>
                )}

                {!loading && mediaItems.length === 0 && (
                    <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs animate-in fade-in duration-200">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/50 flex items-center justify-center shadow-2xs">
                            <ImageIcon className="w-8 h-8 text-pink-500" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                            No images found
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                            We couldn't find anything matching your search or filters.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 transition-all duration-200 shadow-2xs cursor-pointer active:scale-95"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Clear all filters</span>
                        </button>
                    </div>
                )}

                {isPreviewOpen && selectedItem && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
                        onClick={closePreview}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="preview-modal-title"
                    >
                        <div
                            className="flex flex-col w-full max-w-5xl max-h-[94vh] overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-700/80">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="inline-flex items-center shrink-0 px-3 py-0.5 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs">
                                        <Tag className="w-3 h-3 mr-1 text-pink-500" />
                                        {selectedItem.category}
                                    </span>
                                    <h2
                                        id="preview-modal-title"
                                        className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight"
                                        title={selectedItem.title}
                                    >
                                        {selectedItem.title}
                                    </h2>
                                </div>

                                <div className="flex items-center gap-2">
                                    {selectedItemIndex >= 0 && (
                                        <span className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 mr-2 hidden sm:inline">
                                            {selectedItemIndex + 1} / {mediaItems.length}
                                        </span>
                                    )}
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="icon-sm"
                                        onClick={closePreview}
                                        aria-label="Close preview"
                                    >
                                        <X className="w-4 h-4" />
                                    </AppButton>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div
                                    className="relative min-h-[380px] sm:min-h-[500px] flex items-center justify-center p-4 bg-slate-950 dark:bg-black overflow-hidden border-b border-slate-200/90 dark:border-slate-800"
                                    onWheel={handleWheelZoom}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onDoubleClick={handleDoubleClick}
                                    style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                                >
                                    {selectedItemIndex > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrevImage();
                                            }}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 hover:border-pink-500 shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                                            title="Previous Image (← Left Arrow)"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                    )}

                                    {selectedItemIndex < mediaItems.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNextImage();
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 hover:border-pink-500 shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                                            title="Next Image (→ Right Arrow)"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    )}

                                    {!imageErrors.has(selectedItem.id) ? (
                                        <div
                                            className="transition-transform duration-100 ease-out will-change-transform"
                                            style={{
                                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`
                                            }}
                                        >
                                            <img
                                                src={selectedItem.imageUrl}
                                                alt={selectedItem.title}
                                                className="max-w-[85vw] sm:max-w-[75vw] max-h-[56vh] object-contain rounded-xl shadow-2xl border border-slate-800/80 select-none pointer-events-none"
                                                draggable={false}
                                                onError={() => {
                                                    setImageErrors((prev) => new Set(prev).add(selectedItem.id));
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center p-8">
                                            <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
                                                <ImageIcon className="w-8 h-8 text-slate-500" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-300">Image preview unavailable</p>
                                            <p className="mt-1 text-xs text-slate-500">The file link might be broken or expired</p>
                                        </div>
                                    )}

                                    <div
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-white text-xs font-semibold"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleZoomOut}
                                            disabled={zoom <= 0.5}
                                            className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                                            title="Zoom Out (-)"
                                        >
                                            <ZoomOut className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={resetZoomAndPan}
                                            className="px-2.5 py-1 hover:bg-slate-800 rounded-xl font-mono text-[11px] text-pink-400 transition-colors cursor-pointer"
                                            title="Reset Zoom (0 or double click)"
                                        >
                                            {Math.round(zoom * 100)}%
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleZoomIn}
                                            disabled={zoom >= 4}
                                            className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                                            title="Zoom In (+)"
                                        >
                                            <ZoomIn className="w-4 h-4" />
                                        </button>

                                        <span className="w-px h-4 bg-slate-700 mx-1" />

                                        <button
                                            type="button"
                                            onClick={handleRotateCcw}
                                            className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                            title="Rotate Counterclockwise"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleRotateCw}
                                            className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                            title="Rotate Clockwise"
                                        >
                                            <RotateCw className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={resetZoomAndPan}
                                            className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                            title="Fit to Screen"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6 bg-white dark:bg-slate-900 space-y-6">
                                    <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                            {selectedItem.supplier && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs">
                                                    <User className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
                                                    {selectedItem.supplier}
                                                </span>
                                            )}

                                            {selectedItem.po_number && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-2xs font-mono">
                                                    PO: {selectedItem.po_number}
                                                </span>
                                            )}

                                            {selectedItem.uploadDate && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                                    {selectedItem.uploadDate}
                                                </span>
                                            )}

                                            {selectedItem.fileSize && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                                                    <HardDrive className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                                    {selectedItem.fileSize}
                                                </span>
                                            )}
                                        </div>

                                        <AppButton
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => downloadImage(selectedItem)}
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>Download Asset</span>
                                        </AppButton>
                                    </div>

                                    {(selectedItem.parcel_batch || selectedItem.notes) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            {selectedItem.parcel_batch && (
                                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                                                    <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                        Parcel Batch
                                                    </span>
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {selectedItem.parcel_batch}
                                                    </p>
                                                </div>
                                            )}

                                            {selectedItem.notes && (
                                                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 sm:col-span-2 shadow-2xs">
                                                    <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                        Notes
                                                    </span>
                                                    <p className="leading-relaxed text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                                                        {selectedItem.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedItem.uploader && (
                                        <div className="pt-2 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={selectedItem.uploader.avatar}
                                                    alt={selectedItem.uploader.name}
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                                                />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {selectedItem.uploader.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        <span>{selectedItem.uploader.role}</span>
                                                        {selectedItem.uploader.email && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{selectedItem.uploader.email}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SessionGuard>
    );
}