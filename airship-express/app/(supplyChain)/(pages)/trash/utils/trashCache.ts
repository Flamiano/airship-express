export type TrashTabKey = 'documents' | 'purchase_orders' | 'suppliers' | 'parcels';

export interface TrashCacheEntry<T = any> {
    data: T[];
    timestamp: number;
}

class TrashDataCache {
    private cache = new Map<TrashTabKey, TrashCacheEntry>();
    private readonly ttlMs: number = 5 * 60 * 1000; // 5 minutes validity
    private readonly staleTimeMs: number = 45 * 1000; // 45 seconds before background revalidation
    private listeners = new Set<(key?: TrashTabKey, action?: 'set' | 'invalidate' | 'force-refresh') => void>();

    get<T = any>(key: TrashTabKey): T[] | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T[];
    }

    set<T = any>(key: TrashTabKey, data: T[]): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
        this.notify(key);
    }

    isStale(key: TrashTabKey, customStaleTime?: number): boolean {
        const entry = this.cache.get(key);
        if (!entry) return true;
        const maxAge = customStaleTime ?? this.staleTimeMs;
        return Date.now() - entry.timestamp > maxAge;
    }

    removeItem(key: TrashTabKey, id: string | number): void {
        const entry = this.cache.get(key);
        if (!entry) return;
        entry.data = entry.data.filter((item: any) => item.id !== id);
        this.notify(key);
    }

    removeItems(key: TrashTabKey, ids: Set<string | number> | (string | number)[]): void {
        const entry = this.cache.get(key);
        if (!entry) return;
        const idSet = ids instanceof Set ? ids : new Set(ids);
        entry.data = entry.data.filter((item: any) => !idSet.has(item.id));
        this.notify(key);
    }

    invalidate(key?: TrashTabKey): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
        this.notify(key, 'invalidate');
    }

    forceRefresh(key?: TrashTabKey): void {
        this.invalidate(key);
        this.notify(key, 'force-refresh');
    }

    subscribe(listener: (key?: TrashTabKey, action?: 'set' | 'invalidate' | 'force-refresh') => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(key?: TrashTabKey, action: 'set' | 'invalidate' | 'force-refresh' = 'set'): void {
        this.listeners.forEach(cb => {
            try {
                cb(key, action);
            } catch (err) {
                console.error('Error in trashCache listener:', err);
            }
        });
    }
}

export const trashCache = new TrashDataCache();
