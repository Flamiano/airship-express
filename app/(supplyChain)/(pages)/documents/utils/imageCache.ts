// cached supabase storage urls and image loading states for documents gallery
import { supabase } from '../../../lib/services/client/supabase';

export interface ImageCacheEntry {
    url: string;
    loading: boolean;
    loaded: boolean;
    timestamp: number;
    retries: number;
}

class LRUImageCache {
    private cache = new Map<string, ImageCacheEntry>();
    private readonly maxSize: number = 500;
    private readonly cacheDuration: number = 60 * 60 * 1000;
    private readonly maxRetries: number = 3;

    get(id: string): ImageCacheEntry | null {
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
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(id, {
            url,
            loading: false,
            loaded: false,
            timestamp: Date.now(),
            retries: 0,
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
            entry.loaded = false;
            entry.retries += 1;
            this.cache.set(id, entry);
        }
    }

    canRetry(id: string): boolean {
        const entry = this.cache.get(id);
        if (!entry) return true;
        return entry.retries < this.maxRetries;
    }

    clear(): void {
        this.cache.clear();
    }
}

export const imageCache = new LRUImageCache();

const storageUrlCache = new Map<string, string>();

export const getCachedPublicUrl = (path: string, fallbackUrl?: string | null): string => {
    if (!path && fallbackUrl) return fallbackUrl;
    if (!path) return '';
    const cached = storageUrlCache.get(path);
    if (cached) return cached;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    storageUrlCache.set(path, publicUrl || fallbackUrl || '');
    return publicUrl || fallbackUrl || '';
};
