// caching layers for images, supabase storage urls, and swr query responses
import { supabase } from '../../../lib/services/client/supabase';
import { CacheEntry, GalleryCachePayload } from '../types';

export class LRUImageCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxSize: number = 500;
    private readonly cacheDuration: number = 60 * 60 * 1000;
    private readonly maxRetries: number = 3;

    get(id: string): CacheEntry | null {
        const entry = this.cache.get(id);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.cacheDuration) {
            this.cache.delete(id);
            return null;
        }
        // move to most recent
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

export const imageCache = new LRUImageCache();

export class GalleryDataCache {
    private cache = new Map<string, GalleryCachePayload>();
    private readonly maxSize = 80;
    private readonly ttl = 5 * 60 * 1000; // 5 minutes fresh
    private readonly staleTime = 45 * 1000; // 45 seconds before background revalidation

    get(key: string): { data: GalleryCachePayload | null; isStale: boolean } {
        const entry = this.cache.get(key);
        if (!entry) return { data: null, isStale: true };
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return { data: null, isStale: true };
        }
        // lru bump
        this.cache.delete(key);
        this.cache.set(key, entry);
        return { data: entry, isStale: age > this.staleTime };
    }

    set(key: string, data: Omit<GalleryCachePayload, 'timestamp'>): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(key, { ...data, timestamp: Date.now() });
    }

    invalidateAll(): void {
        this.cache.clear();
    }
}

export const galleryDataCache = new GalleryDataCache();

// saved/cache supabase public storage urls
const storageUrlCache = new Map<string, string>();

export const getCachedPublicUrl = (path: string): string => {
    if (!path) return '';
    const cached = storageUrlCache.get(path);
    if (cached) return cached;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    storageUrlCache.set(path, publicUrl);
    return publicUrl;
};
