export interface LocalOfflineScan {
    barcode: string;
    scanned_at: string;
    tracking_number?: string;
    sender_name?: string | null;
    customer_name?: string | null;
    customer_number?: string | null;
    destination?: string | null;
    courier?: string | null;
    courier_id?: string | null;
    region?: string | null;
    city?: string | null;
    is_fetched?: boolean;
}

const OFFLINE_STORAGE_KEY = 'airship_offline_scans_queue';

export const getOfflineScans = (): LocalOfflineScan[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveOfflineScans = (scans: LocalOfflineScan[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(scans));
        window.dispatchEvent(new CustomEvent('offline_scans_updated', { detail: scans }));
    } catch (e) {
        console.error('Failed to save offline scans to localStorage:', e);
    }
};

export const addOfflineScan = (barcode: string): { scans: LocalOfflineScan[]; added: boolean } => {
    const current = getOfflineScans();
    const clean = barcode.trim().toUpperCase();
    if (!clean) return { scans: current, added: false };

    // Check if already in offline queue
    if (current.some(item => item.barcode.toUpperCase() === clean)) {
        return { scans: current, added: false };
    }

    const next: LocalOfflineScan[] = [
        { barcode: clean, scanned_at: new Date().toISOString() },
        ...current
    ];
    saveOfflineScans(next);
    return { scans: next, added: true };
};

export const updateMultipleOfflineScans = (updatedItems: LocalOfflineScan[]): LocalOfflineScan[] => {
    const current = getOfflineScans();
    const updateMap = new Map(updatedItems.map(item => [item.barcode.toUpperCase(), item]));
    const next = current.map(item => {
        const matching = updateMap.get(item.barcode.toUpperCase());
        return matching ? { ...item, ...matching } : item;
    });
    saveOfflineScans(next);
    return next;
};

export const removeOfflineScan = (barcode: string): LocalOfflineScan[] => {
    const current = getOfflineScans();
    const next = current.filter(item => item.barcode.toUpperCase() !== barcode.trim().toUpperCase());
    saveOfflineScans(next);
    return next;
};

export const clearOfflineScans = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('offline_scans_updated', { detail: [] }));
};
