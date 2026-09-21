// custom hook encapsulating all media gallery state, queries, caching, and realtime sync
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '../../../lib/services/client/supabase';
import { useDebounce } from '../../../hooks/useDebounce';
import { MediaItem, FilterState } from '../types';
import { formatFileSize } from '../utils/formatters';
import { imageCache, galleryDataCache, getCachedPublicUrl } from '../utils/imageCache';

const itemsPerPage = 12;

export function useGallery() {
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

    const searchParams = useSearchParams();
    const initialSearch = searchParams?.get('search') || '';

    const [filterState, setFilterState] = useState<FilterState>({
        searchTerm: initialSearch,
        searchType: 'all',
        selectedCategory: 'All',
        selectedSupplier: 'All',
        selectedExtension: 'all',
        dateRange: 'all'
    });

    const searchInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // clean address bar query if search param is present
    useEffect(() => {
        const querySearch = searchParams?.get('search');
        if (querySearch) {
            setFilterState(prev => ({
                ...prev,
                searchTerm: querySearch,
                searchType: 'all',
            }));
            if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, [searchParams]);

    const debouncedSearch = useDebounce(filterState.searchTerm, 400);
    const debouncedFilters = useDebounce(filterState, 500);

    // active item index
    const selectedItemIndex = useMemo(() => {
        if (!selectedItem) return -1;
        return mediaItems.findIndex(item => item.id === selectedItem.id);
    }, [selectedItem, mediaItems]);

    const getDateRangeFilter = useCallback((range: string) => {
        const now = new Date();
        switch (range) {
            case 'today': {
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                return today.toISOString();
            }
            case 'week': {
                const week = new Date(now);
                week.setDate(week.getDate() - 7);
                return week.toISOString();
            }
            case 'month': {
                const month = new Date(now);
                month.setMonth(month.getMonth() - 1);
                return month.toISOString();
            }
            case 'year': {
                const year = new Date(now);
                year.setFullYear(year.getFullYear() - 1);
                return year.toISOString();
            }
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
        if (filterState.selectedExtension && filterState.selectedExtension !== 'all') {
            const ext = filterState.selectedExtension;
            if (ext === 'jpg') {
                query = query.or('file_name.ilike.%.jpg,file_name.ilike.%.jpeg,file_type.ilike.%jpeg%');
            } else if (ext === 'png') {
                query = query.or('file_name.ilike.%.png,file_type.ilike.%png%');
            } else if (ext === 'pdf') {
                query = query.or('file_name.ilike.%.pdf,file_type.ilike.%pdf%');
            } else if (ext === 'word') {
                query = query.or('file_name.ilike.%.docx,file_name.ilike.%.doc,file_type.ilike.%word%,file_type.ilike.%officedocument%');
            } else if (ext === 'excel') {
                query = query.or('file_name.ilike.%.xlsx,file_name.ilike.%.xls,file_type.ilike.%sheet%,file_type.ilike.%excel%');
            }
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
    }, [debouncedSearch, filterState, getDateRangeFilter]);

    const fetchImages = useCallback(async (pageNum: number, isLoadMore: boolean = false, bypassCache: boolean = false) => {
        const cacheKey = JSON.stringify({
            s: (filterState.searchTerm || '').trim().toLowerCase(),
            st: filterState.searchType,
            c: filterState.selectedCategory,
            sup: filterState.selectedSupplier,
            ext: filterState.selectedExtension || 'all',
            d: filterState.dateRange,
            p: pageNum,
        });

        // 1. check in-memory swr cache for instant response
        if (!bypassCache) {
            const cached = galleryDataCache.get(cacheKey);
            if (cached.data) {
                if (isLoadMore) {
                    setMediaItems(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const newItems = cached.data!.items.filter(item => !existingIds.has(item.id));
                        return newItems.length > 0 ? [...prev, ...newItems] : prev;
                    });
                } else {
                    setMediaItems(cached.data.items);
                    if (cached.data.categories && cached.data.categories.length > 1) {
                        setCategories(cached.data.categories);
                    }
                    if (cached.data.suppliers && cached.data.suppliers.length > 1) {
                        setSuppliers(cached.data.suppliers);
                    }
                }
                setTotalCount(cached.data.totalCount);
                setTotalSize(cached.data.totalSize);
                setHasMore(cached.data.hasMore);
                setLoading(false);
                setLoadingMore(false);

                // if fresh, return immediately with zero database round-trip
                if (!cached.isStale) {
                    return;
                }
            }
        }

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
            const hasMoreItems = total > totalLoaded;
            setHasMore(hasMoreItems);

            let computedTotalSize = 0;
            if (!isLoadMore || pageNum === 1) {
                const sizeQuery = buildQuery(1, true);
                const { data: sizeData, error: sizeError } = await sizeQuery.select('file_size');
                if (!sizeError && sizeData) {
                    computedTotalSize = sizeData.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
                    setTotalSize(computedTotalSize);
                }
            }

            const transformedItems: MediaItem[] = (data || []).map((doc) => {
                const publicUrl = getCachedPublicUrl(doc.storage_path);
                const cachedImg = imageCache.get(doc.id);
                if (!cachedImg) {
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
                setMediaItems(prev => {
                    const existingIds = new Set(prev.map(item => item.id));
                    const newItems = transformedItems.filter(item => !existingIds.has(item.id));
                    return newItems.length > 0 ? [...prev, ...newItems] : prev;
                });
            } else {
                setMediaItems(transformedItems);
            }

            const uniqueCategories = !isLoadMore
                ? ['All', ...new Set((data || []).map(d => d.document_type).filter(Boolean))]
                : categories;
            const uniqueSuppliers = !isLoadMore
                ? ['All', ...new Set((data || []).map(d => d.supplier).filter(Boolean))]
                : suppliers;

            if (!isLoadMore) {
                setCategories(uniqueCategories);
                setSuppliers(uniqueSuppliers);
            }

            // save fresh query results in cache
            galleryDataCache.set(cacheKey, {
                items: transformedItems,
                totalCount: total,
                totalSize: computedTotalSize,
                hasMore: hasMoreItems,
                categories: uniqueCategories,
                suppliers: uniqueSuppliers,
            });
        } catch (error: any) {
            if (error?.name === 'AbortError') return;
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
    }, [buildQuery, fetching, categories, suppliers]);

    // initial fetch
    useEffect(() => {
        setIsInitialLoad(true);
        setPage(1);
        fetchImages(1, false);
    }, []);

    // fetch on filter change
    useEffect(() => {
        if (isInitialLoad) return;
        setPage(1);
        fetchImages(1, false);
    }, [debouncedFilters]);

    // realtime subscription for documents table
    useEffect(() => {
        const channel = supabase
            .channel(`gallery_realtime_${Date.now()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'documents' },
                (payload) => {
                    galleryDataCache.invalidateAll();
                    if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
                        const oldId = (payload.old as { id: string }).id;
                        if (oldId) {
                            imageCache.invalidate(oldId);
                            setSelectedItem(prev => (prev?.id === oldId ? null : prev));
                        }
                    } else if (payload.eventType === 'UPDATE' && payload.new && 'id' in payload.new) {
                        const newId = (payload.new as { id: string }).id;
                        if (newId) {
                            imageCache.invalidate(newId);
                        }
                    }
                    fetchImages(1, false, true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchImages]);

    // preload images in cache
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

    const handleLoadMore = () => {
        if (loadingMore || fetching || !hasMore) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
    };

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
    };

    const closePreview = () => {
        setIsPreviewOpen(false);
        setSelectedItem(null);
    };

    const handleNextImage = useCallback(() => {
        if (selectedItemIndex >= 0 && selectedItemIndex < mediaItems.length - 1) {
            const nextItem = mediaItems[selectedItemIndex + 1];
            setSelectedItem(nextItem);
        }
    }, [selectedItemIndex, mediaItems]);

    const handlePrevImage = useCallback(() => {
        if (selectedItemIndex > 0) {
            const prevItem = mediaItems[selectedItemIndex - 1];
            setSelectedItem(prevItem);
        }
    }, [selectedItemIndex, mediaItems]);

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
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
        }
        setFilterState({
            searchTerm: '',
            searchType: 'all',
            selectedCategory: 'All',
            selectedSupplier: 'All',
            selectedExtension: 'all',
            dateRange: 'all'
        });
        setPage(1);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    };

    return {
        mediaItems,
        loading,
        loadingMore,
        viewMode,
        setViewMode,
        selectedItem,
        selectedItemIndex,
        isPreviewOpen,
        hasMore,
        totalCount,
        totalSize,
        categories,
        suppliers,
        imageErrors,
        showFilters,
        setShowFilters,
        filterState,
        searchInputRef,
        handleLoadMore,
        handleFilterChange,
        handleSearchChange,
        handleImageClick,
        closePreview,
        handleNextImage,
        handlePrevImage,
        handleImageError,
        handleRetry,
        downloadImage,
        clearFilters,
    };
}
