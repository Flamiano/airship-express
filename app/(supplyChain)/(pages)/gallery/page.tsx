"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Grid, List, Calendar, User, Tag, Eye, X, Download, Image as ImageIcon, HardDrive, Filter, XCircle, Loader2, Images } from 'lucide-react';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { toast } from 'sonner';
import { PageSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';

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
}

class LRUImageCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxSize: number = 200;
    private readonly cacheDuration: number = 30 * 60 * 1000;
    private readonly maxRetries: number = 3;

    get(id: string): CacheEntry | null {
        const entry = this.cache.get(id);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.cacheDuration) {
            this.cache.delete(id);
            return null;
        }

        this.cache.delete(id);
        this.cache.set(id, entry);
        return entry;
    }

    set(id: string, url: string): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = Array.from(this.cache.keys())[0];
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

    markLoaded(id: string): void {
        const entry = this.cache.get(id);
        if (entry) {
            entry.loading = false;
            entry.loaded = true;
            entry.timestamp = Date.now();
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
const retryQueue = new Map<string, number>();

interface FilterState {
    searchTerm: string;
    searchType: 'all' | 'title' | 'uploader' | 'supplier' | 'po';
    selectedCategory: string;
    selectedSupplier: string;
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
}

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

    useEffect(() => {
        if (searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, []);

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            if (!isLoadMore && !isInitialLoad) {
            }

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

            const transformedItems = (data || []).map((doc) => {
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
    }, [buildQuery, fetching, isInitialLoad, mediaItems, itemsPerPage]);

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

    useEffect(() => {
        if (mediaItems.length > 0 && !loading) {
            const preloadCount = Math.min(6, mediaItems.length);
            for (let i = 0; i < preloadCount; i++) {
                const item = mediaItems[i];
                if (!item) continue;

                const cached = imageCache.get(item.id);
                if (!cached || (!cached.loaded && !cached.loading)) {
                    const img = new Image();
                    img.src = item.imageUrl;
                    imageCache.markLoading(item.id);

                    img.onload = () => {
                        imageCache.markLoaded(item.id);
                        setImageErrors(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(item.id);
                            return newSet;
                        });
                    };

                    img.onerror = () => {
                        imageCache.markError(item.id);
                        if (imageCache.canRetry(item.id)) {
                            const retries = retryQueue.get(item.id) || 0;
                            retryQueue.set(item.id, retries + 1);
                            const delay = 2000 * Math.pow(2, retries);
                            setTimeout(() => {
                                const retryImg = new Image();
                                retryImg.src = item.imageUrl;
                                retryImg.onload = () => {
                                    imageCache.markLoaded(item.id);
                                    retryQueue.delete(item.id);
                                    setImageErrors(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(item.id);
                                        return newSet;
                                    });
                                };
                                retryImg.onerror = () => {
                                    imageCache.markError(item.id);
                                    setImageErrors(prev => new Set(prev).add(item.id));
                                };
                            }, delay);
                        } else {
                            setImageErrors(prev => new Set(prev).add(item.id));
                        }
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
        setIsPreviewOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const closePreview = () => {
        setIsPreviewOpen(false);
        setSelectedItem(null);
        document.body.style.overflow = 'auto';
    };

    const handleImageError = (id: string) => {
        if (!imageCache.canRetry(id)) {
            setImageErrors(prev => new Set(prev).add(id));
        }
    };

    const downloadImage = async (item: MediaItem) => {
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
            <div className="mx-auto p-6 bg-slate-50 dark:bg-ink/40 min-h-screen bgCard dark:bg-ink/80">
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-800/30 flex items-center justify-center text-pink-600 dark:text-pink-400 text-lg shadow-xs shrink-0">
                                    <Images className="w-5 h-5" />
                                </div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        Media Library
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/50 font-medium text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold">{totalCount}</span> images
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/50 font-medium text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold">{formatFileSize(totalSize)}</span> total
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span>
                                            <strong className="text-slate-700 dark:text-slate-300">
                                                {Math.max(0, categories.length - 1)}
                                            </strong> categories
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span>
                                            <strong className="text-slate-700 dark:text-slate-300">
                                                {Math.max(0, suppliers.length - 1)}
                                            </strong> suppliers
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 self-end sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 shadow-xs ${showFilters
                                        ? 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/30 text-pink-600 dark:text-pink-400 shadow-pink-500/5'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <Filter className="w-4 h-4" />
                                    <span>Filters</span>
                                    {showFilters && (
                                        <span className="w-2 h-2 rounded-full bg-pink-500 dark:bg-pink-400"></span>
                                    )}
                                </button>

                                <div className="bg-slate-100/80 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center gap-0.5 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        title="Grid View"
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid'
                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
                                            }`}
                                    >
                                        <Grid className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        title="List View"
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list'
                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
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
                                    className="w-full pl-10 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-xs"
                                    autoFocus
                                />
                                {filterState.searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleFilterChange('searchTerm', '');
                                            setTimeout(() => {
                                                searchInputRef.current?.focus();
                                            }, 50);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
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
                                    setTimeout(() => {
                                        searchInputRef.current?.focus();
                                    }, 50);
                                }}
                                className="py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-xs"
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
                        <div className="bg-white dark:bg-ink rounded-2xl border border-slate-200/80 dark:border-ink/20 p-4 shadow-2xs space-y-4 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-ink/20 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xs">
                                        <i className="fas fa-sliders text-[11px]" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                        Advanced Filters
                                    </h3>
                                </div>

                                <button
                                    onClick={clearFilters}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <i className="fas fa-rotate-left text-[10px]" />
                                    <span>Reset All</span>
                                </button>
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
                                            aria-label="Filter by Category"
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 focus:bg-white dark:focus:bg-ink/60 transition-all cursor-pointer appearance-none shadow-2xs"
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none" />
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
                                            aria-label="Filter by Supplier"
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 focus:bg-white dark:focus:bg-ink/60 transition-all cursor-pointer appearance-none shadow-2xs"
                                        >
                                            {suppliers.map((sup) => (
                                                <option key={sup} value={sup}>
                                                    {sup}
                                                </option>
                                            ))}
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none" />
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
                                            aria-label="Filter by Date Range"
                                            className="w-full py-2 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 focus:bg-white dark:focus:bg-ink/60 transition-all cursor-pointer appearance-none shadow-2xs"
                                        >
                                            <option value="all">All Time</option>
                                            <option value="today">Today</option>
                                            <option value="week">Last 7 Days</option>
                                            <option value="month">Last 30 Days</option>
                                            <option value="year">Last Year</option>
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Active Filters
                                    </label>
                                    <div className="min-h-9.5 p-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-ink/20 flex flex-wrap items-center gap-1.5">
                                        {filterState.selectedCategory !== 'All' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400 border border-pink-200/60 dark:border-pink-800/30 shadow-2xs">
                                                <span>{filterState.selectedCategory}</span>
                                                <button
                                                    onClick={() => handleFilterChange('selectedCategory', 'All')}
                                                    // // className="p-0.5 hover:bg-pink-100/80 dark:hover:bg-pink-900/30 rounded transition-colors text-pink-600 dark:text-pink-400 cursor-pointer"w
                                                    title="Remove category filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.selectedSupplier !== 'All' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/30 shadow-2xs">
                                                <span>{filterState.selectedSupplier}</span>
                                                <button
                                                    onClick={() => handleFilterChange('selectedSupplier', 'All')}
                                                    className="p-0.5 hover:bg-blue-100/80 dark:hover:bg-blue-900/30 rounded transition-colors text-blue-600 dark:text-blue-400 cursor-pointer"
                                                    title="Remove supplier filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.dateRange !== 'all' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/30 shadow-2xs">
                                                <span className="capitalize">{filterState.dateRange}</span>
                                                <button
                                                    onClick={() => handleFilterChange('dateRange', 'all')}
                                                    className="p-0.5 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 rounded transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                                    title="Remove date filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {filterState.searchTerm && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-ink/20 shadow-2xs">
                                                <span className="truncate max-w-25">"{filterState.searchTerm}"</span>
                                                <button
                                                    onClick={() => {
                                                        handleFilterChange('searchTerm', '');
                                                        setTimeout(() => searchInputRef.current?.focus(), 50);
                                                    }}
                                                    className="p-0.5 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 rounded transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
                                                    title="Remove search filter"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        )}

                                        {!filterState.searchTerm &&
                                            filterState.selectedCategory === 'All' &&
                                            filterState.selectedSupplier === 'All' &&
                                            filterState.dateRange === 'all' && (
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
                        {mediaItems.map((item) => {
                            const hasError = imageErrors.has(item.id);
                            const cached = imageCache.get(item.id);
                            const isLoading = cached?.loading;

                            return (
                                <div
                                    key={item.id}
                                    className="group bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-xl dark:hover:shadow-pink-500/10 hover:border-pink-200 dark:hover:border-pink-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
                                    onClick={() => handleImageClick(item)}
                                >
                                    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-950/60">
                                        {isLoading && !hasError && (
                                            <div className="absolute inset-0 animate-pulse bg-linear-to-r from-slate-200 dark:from-slate-800 via-slate-100 dark:via-slate-700 to-slate-200 dark:to-slate-800" />
                                        )}

                                        {!hasError ? (
                                            <img
                                                src={imageCache.get(item.id)?.url || item.imageUrl}
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                                loading="lazy"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/60 text-slate-400 dark:text-slate-500 gap-2">
                                                <ImageIcon className="w-10 h-10 opacity-60" />
                                                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                                    Failed to load
                                                </span>
                                                {imageCache.canRetry(item.id) && (
                                                    <button
                                                        type="button"
                                                        className="text-xs text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300 mt-1 inline-flex items-center gap-1 cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            imageCache.invalidate(item.id);
                                                            setImageErrors((prev) => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete(item.id);
                                                                return newSet;
                                                            });
                                                            const img = new Image();
                                                            img.src = item.imageUrl;
                                                            img.onload = () => {
                                                                imageCache.markLoaded(item.id);
                                                                setImageErrors((prev) => {
                                                                    const newSet = new Set(prev);
                                                                    newSet.delete(item.id);
                                                                    return newSet;
                                                                });
                                                            };
                                                        }}
                                                    >
                                                        <i className="fas fa-redo text-[10px]" />
                                                        <span>Retry</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                            <div className="bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border dark:border-white/10 rounded-full p-3 shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300 flex items-center justify-center">
                                                <Eye className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                                            </div>
                                        </div>

                                        <span className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-white/40 dark:border-white/15 text-slate-800 dark:text-slate-200 text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full shadow-2xs">
                                            {item.category}
                                        </span>

                                        {item.supplier && (
                                            <span className="absolute bottom-3 left-3 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-700/50 dark:border-white/10 text-white dark:text-slate-200 text-[10px] font-medium px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)] shrink-0" />
                                                <span className="truncate max-w-30">{item.supplier}</span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <h3
                                                    className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1"
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </h3>
                                            </div>
                                            {item.po_number && (
                                                <div className="mt-1.5">
                                                    <span className="inline-flex items-center text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/10 px-1.5 py-0.5 rounded-md">
                                                        PO: {item.po_number}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <img
                                                    src={item.uploader.avatar}
                                                    alt={item.uploader.name}
                                                    className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-white/15 shrink-0 shadow-2xs"
                                                />
                                                <p className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate leading-none">
                                                    {item.uploader.name}
                                                </p>
                                            </div>

                                            <div className="flex items-center text-slate-400 dark:text-slate-400 shrink-0 gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                                                    {item.uploadDate}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* List Layout View */
                    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-black/40 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                        {mediaItems.map((item) => {
                            const hasError = imageErrors.has(item.id);
                            const cached = imageCache.get(item.id);
                            const isLoading = cached?.loading;

                            return (
                                <div
                                    key={item.id}
                                    className="p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-all cursor-pointer group"
                                    onClick={() => handleImageClick(item)}
                                >
                                    <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                                        <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/10 shrink-0 overflow-hidden shadow-2xs group-hover:border-pink-300 dark:group-hover:border-pink-500/40 transition-colors">
                                            {isLoading && !hasError && (
                                                <div className="absolute inset-0 animate-pulse bg-linear-to-r from-slate-200 dark:from-slate-800 via-slate-100 dark:via-slate-700 to-slate-200 dark:to-slate-800" />
                                            )}
                                            {!hasError ? (
                                                <img
                                                    src={imageCache.get(item.id)?.url || item.imageUrl}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    loading="lazy"
                                                    onError={() => handleImageError(item.id)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
                                                    <ImageIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                    {item.title}
                                                </h3>
                                                {item.po_number && (
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-300 font-mono text-[10px] font-semibold border border-slate-200/60 dark:border-white/10 shrink-0">
                                                        PO: {item.po_number}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                                                <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-white/10">
                                                    <Tag className="w-3 h-3 text-pink-500 dark:text-pink-400" />
                                                    {item.category}
                                                </span>

                                                {item.supplier && (
                                                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                                        <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                                        {item.supplier}
                                                    </span>
                                                )}

                                                <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                                                    <HardDrive className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                                    {item.fileSize}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 sm:gap-5 text-xs shrink-0">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={item.uploader.avatar}
                                                alt={item.uploader.name}
                                                className="w-7 h-7 rounded-full border border-slate-200 dark:border-white/10 object-cover shrink-0"
                                            />
                                            <span className="font-medium text-slate-700 dark:text-slate-200 hidden lg:inline">
                                                {item.uploader.name}
                                            </span>
                                        </div>

                                        <div className="hidden md:flex items-center text-slate-400 dark:text-slate-400 font-medium text-[11px]">
                                            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                                            <span>{item.uploadDate}</span>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadImage(item);
                                            }}
                                            title="Download file"
                                            aria-label={`Download ${item.title}`}
                                            className="p-2 hover:bg-pink-50 dark:hover:bg-pink-500/20 text-slate-400 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-300 rounded-xl transition-all border border-transparent hover:border-pink-200 dark:hover:border-pink-500/40 shadow-2xs cursor-pointer"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && mediaItems.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        {hasMore ? (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore || fetching}
                                className="px-8 py-3 bg-white dark:bg-slate-900/80 backdrop-blur-md border-2 border-pink-200 dark:border-pink-500/30 hover:border-pink-400 dark:hover:border-pink-500 text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 font-semibold text-sm rounded-2xl transition-all duration-200 shadow-sm hover:shadow-lg dark:hover:shadow-pink-500/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2.5 cursor-pointer group"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-pink-500 dark:text-pink-400" />
                                        <span className="tracking-wide">Loading more...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-chevron-down text-xs transition-transform duration-200 group-hover:translate-y-0.5 opacity-80" />
                                        <span>
                                            Load More <span className="opacity-80 font-mono text-xs">({mediaItems.length} / {totalCount})</span>
                                        </span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 bg-emerald-50/30 dark:bg-emerald-950/20 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-200/80 dark:border-emerald-800/30 shadow-2xs">
                                <i className="fas fa-check-circle text-emerald-500 dark:text-emerald-400 text-sm" />
                                <span>All {totalCount} items loaded</span>
                            </div>
                        )}

                        {mediaItems.length > 0 && (
                            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase">
                                Showing <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">{mediaItems.length}</span> of <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">{totalCount}</span> items
                            </div>
                        )}
                    </div>
                )}

                {!loading && mediaItems.length === 0 && (
                    <div className="text-center py-16 px-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-white/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <div className="absolute inset-0 bg-pink-500/10 dark:bg-pink-500/15 rounded-2xl blur-xl" />
                            <div className="relative w-16 h-16 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/10 flex items-center justify-center shadow-2xs dark:shadow-black/20">
                                <ImageIcon className="w-8 h-8 text-slate-400 dark:text-pink-400/80" />
                            </div>
                        </div>

                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                            No images found
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                            We couldn't find anything matching your current criteria. Try adjusting your search or active filters.
                        </p>

                        <button
                            onClick={clearFilters}
                            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-pink-500/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 hover:bg-pink-500 dark:hover:bg-pink-500 hover:text-white dark:hover:text-white border border-pink-200/60 dark:border-pink-500/30 transition-all duration-200 shadow-2xs cursor-pointer active:scale-95"
                        >
                            <i className="fas fa-rotate-left text-[11px]" />
                            <span>Clear all filters</span>
                        </button>
                    </div>
                )}

                {isPreviewOpen && selectedItem && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                        onClick={closePreview}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="preview-modal-title"
                    >
                        <div
                            className="flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] dark:shadow-pink-500/5 transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/10">
                                <div className="flex items-center gap-3 min-w-0">
                                    {selectedItem?.category && (
                                        <span className="inline-flex items-center shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border border-pink-200/60 dark:border-pink-500/20 shadow-xs dark:shadow-pink-500/10">
                                            <Tag className="w-3.5 h-3.5 mr-1.5" />
                                            {selectedItem.category}
                                        </span>
                                    )}
                                    <h2
                                        id="preview-modal-title"
                                        className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight"
                                        title={selectedItem?.title}
                                    >
                                        {selectedItem?.title || 'Asset Preview'}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={closePreview}
                                    className="p-2 shrink-0 rounded-full text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/40 cursor-pointer"
                                    aria-label="Close preview"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar dark:scrollbar-thumb-slate-800">
                                <div className="relative flex-1 min-h-95 sm:min-h-115 flex items-center justify-center p-6 bg-slate-950 dark:bg-black group selection:bg-none overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.06)_0,transparent_70%)] pointer-events-none" />

                                    {selectedItem?.id && !imageErrors.has(selectedItem.id) ? (
                                        <img
                                            src={selectedItem.imageUrl}
                                            alt={selectedItem.title || 'Asset preview image'}
                                            className="relative z-10 max-w-full max-h-[58vh] object-contain rounded-xl shadow-2xl dark:shadow-black/80 transition-transform duration-300"
                                            onError={() => {
                                                if (selectedItem?.id) {
                                                    setImageErrors((prev) => new Set(prev).add(selectedItem.id));
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="relative z-10 text-center p-8">
                                            <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-slate-900/90 dark:bg-slate-800/80 border border-slate-800 dark:border-white/10 shadow-inner">
                                                <ImageIcon className="w-8 h-8 text-slate-500 dark:text-slate-400" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-300 dark:text-slate-200">
                                                Image preview unavailable
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                The file link might be broken or expired
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-white dark:bg-slate-900 space-y-6">
                                    <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/10">
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            {selectedItem?.supplier && (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-white/10">
                                                    <User className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-400" />
                                                    {selectedItem.supplier}
                                                </span>
                                            )}

                                            {selectedItem?.po_number && (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20 font-semibold">
                                                    PO: {selectedItem.po_number}
                                                </span>
                                            )}

                                            {selectedItem?.uploadDate && (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/10">
                                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-400" />
                                                    {selectedItem.uploadDate}
                                                </span>
                                            )}

                                            {selectedItem?.fileSize && (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/10">
                                                    <HardDrive className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-400" />
                                                    {selectedItem.fileSize}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => selectedItem && downloadImage(selectedItem)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-all shadow-md shadow-pink-500/20 dark:shadow-pink-500/25 focus:outline-none focus:ring-2 focus:ring-pink-500/50 cursor-pointer"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Asset
                                        </button>
                                    </div>

                                    {(selectedItem?.parcel_batch || selectedItem?.notes) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            {selectedItem.parcel_batch && (
                                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10">
                                                    <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                                        Parcel Batch
                                                    </span>
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {selectedItem.parcel_batch}
                                                    </p>
                                                </div>
                                            )}

                                            {selectedItem.notes && (
                                                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 sm:col-span-2">
                                                    <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400">
                                                        Notes
                                                    </span>
                                                    <p className="leading-relaxed text-slate-700 dark:text-slate-200">
                                                        {selectedItem.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedItem?.uploader && (
                                        <div className="pt-2 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={selectedItem.uploader.avatar}
                                                    alt={selectedItem.uploader.name || 'Uploader avatar'}
                                                    className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700/80 shadow-sm"
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
                                                                <span className="text-slate-400 dark:text-slate-400">
                                                                    {selectedItem.uploader.email}
                                                                </span>
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