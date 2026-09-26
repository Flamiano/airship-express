// types for media gallery module

export interface MediaItem {
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

export interface CacheEntry {
    url: string;
    loading: boolean;
    loaded: boolean;
    timestamp: number;
    retries: number;
    imageObj?: HTMLImageElement;
}

export interface GalleryCachePayload {
    items: MediaItem[];
    totalCount: number;
    totalSize: number;
    hasMore: boolean;
    categories: string[];
    suppliers: string[];
    timestamp: number;
}

export interface FilterState {
    searchTerm: string;
    searchType: 'all' | 'title' | 'uploader' | 'supplier' | 'po';
    selectedCategory: string;
    selectedSupplier: string;
    selectedExtension: string;
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
}
