'use client';
import { toast } from "sonner";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { useInventory } from '@/app/(supplyChain)/(pages)/inventory/hooks/useInventory';
import { useSearchParams } from 'next/navigation';
import { DashboardTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/DashboardTab';
import { InventoryTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/InventoryTab';
import { ParcelsTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/ParcelsTab';
import { AddItemModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/AddItemModal';
import { EditItemModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/EditItemModal';
import { StockInModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/StockInModal';
import { StockOutModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/StockOutModal';
import { ScopedPORequestModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/ScopedPORequestModal';
import { PurchaseRequestDetailModal } from '@/app/(supplyChain)/components/modals/PurchaseRequestDetailModal';
import { GroupedParcels, InventoryItem, ScannerUser } from '@/app/(supplyChain)/(pages)/inventory/types';
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { fetchInventoryPageData, type Parcel } from '@/app/(supplyChain)/(pages)/inventory/server/query';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import UnauthorizedEmptyState, { useUserRole } from '@/app/(supplyChain)/components/global/UnauthorizedEmptyState';

// SWR Cache Manager for Inventory data
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
class InventoryCacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private readonly maxSize = 60;
    private readonly ttl = 5 * 60 * 1000; // 5 min TTL
    private readonly staleTime = 45 * 1000; // 45 sec before background revalidate

    get<T>(key: string): {
        data: T | null;
        isStale: boolean;
    } {
        const entry = this.cache.get(key);
        if (!entry)
            return { data: null, isStale: true };
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return { data: null, isStale: true };
        }
        return { data: entry.data as T, isStale: age > this.staleTime };
    }
    set<T>(key: string, data: T): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest)
                this.cache.delete(oldest);
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    invalidateAll(): void {
        this.cache.clear();
    }
}
export const inventoryCache = new InventoryCacheManager();

export default function InventoryClient() {
    const searchParams = useSearchParams();
    const { role: userRole, userId: currentUserId, isPrivileged, isLoaded } = useUserRole();
    const urlTab = searchParams.get('tab');
    const initialTab = urlTab || (isLoaded && !isPrivileged ? 'parcels' : 'dashboard');
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [parcelSearchTerm, setParcelSearchTerm] = useState('');
    const [parcelStatusFilter, setParcelStatusFilter] = useState('');
    const [parcelDateFrom, setParcelDateFrom] = useState('');
    const [parcelDateTo, setParcelDateTo] = useState('');
    const [parcelScannedByFilter, setParcelScannedByFilter] = useState('');
    const [inventoryPage, setInventoryPage] = useState(1);
    const [parcelPage, setParcelPage] = useState(1);
    const itemsPerPage = 30;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStockInModal, setShowStockInModal] = useState(false);
    const [showStockOutModal, setShowStockOutModal] = useState(false);
    const [showScopedPOModal, setShowScopedPOModal] = useState(false);
    const [showPRDetailModal, setShowPRDetailModal] = useState(false);
    const [viewingPRId, setViewingPRId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [selectedItemForStock, setSelectedItemForStock] = useState<string>('');
    const [selectedItemObjectForStock, setSelectedItemObjectForStock] = useState<InventoryItem | null>(null);
    const [selectedItemForPO, setSelectedItemForPO] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [loadingParcels, setLoadingParcels] = useState(false);
    const [dashboardItems, setDashboardItems] = useState<InventoryItem[]>([]);
    const [dashboardStats, setDashboardStats] = useState<any>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [totalInventoryItems, setTotalInventoryItems] = useState(0);
    const [inventoryTotalPages, setInventoryTotalPages] = useState(1);
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [scanners, setScanners] = useState<ScannerUser[]>([]);
    const [totalParcels, setTotalParcels] = useState(0);
    const [parcelTotalPages, setParcelTotalPages] = useState(1);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedParcelSearch = useDebounce(parcelSearchTerm, 300);
    const isInitialLoad = useRef(true);
    const { confirm } = useConfirm();
    const { saving, deleting, addItem, updateItem, deleteItem, deleteMultipleItems, stockIn, stockOut } = useInventory();

    const fetchDashboardData = useCallback(async (forceRefresh = false) => {
        const cacheKey = `inventory_dashboard_data_${currentUserId || 'all'}_${isPrivileged}`;
        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setDashboardItems(cached.data.inventory?.items || []);
                setDashboardStats(cached.data.stats || null);
                setSuppliers(cached.data.suppliers || []);
                if (cached.data.scanners) setScanners(cached.data.scanners || []);
                if (!cached.isStale)
                    return; // 0ms instant cache response
            }
        }
        try {
            const result = await fetchInventoryPageData({
                inventoryPage: 1,
                inventoryLimit: 999,
                inventorySearch: '',
                inventoryCategory: 'all',
                inventoryStatus: 'all',
                parcelPage: 1,
                parcelLimit: 5,
                parcelSearch: '',
                parcelStatus: '',
                parcelDateFrom: '',
                parcelDateTo: '',
                parcelScannedBy: !isPrivileged && currentUserId ? currentUserId : undefined,
            });
            if (result.success && result.data) {
                setDashboardItems(result.data.inventory?.items || []);
                setDashboardStats(result.data.stats || null);
                setSuppliers(result.data.suppliers || []);
                if (result.data.scanners) setScanners(result.data.scanners || []);
                inventoryCache.set(cacheKey, result.data);
            }
        }
        catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }, [isPrivileged, currentUserId]);

    const effectiveParcelDateFrom = (parcelDateFrom && parcelDateTo) ? parcelDateFrom : '';
    const effectiveParcelDateTo = (parcelDateFrom && parcelDateTo) ? parcelDateTo : '';

    const fetchInventoryData = useCallback(async (showLoading = true, forceRefresh = false) => {
        const effectiveScannedBy = !isPrivileged && currentUserId ? currentUserId : parcelScannedByFilter;
        const effectiveDateFrom = (parcelDateFrom && parcelDateTo) ? parcelDateFrom : '';
        const effectiveDateTo = (parcelDateFrom && parcelDateTo) ? parcelDateTo : '';
        const cacheKey = JSON.stringify({
            uid: currentUserId,
            priv: isPrivileged,
            ip: inventoryPage,
            is: debouncedSearchTerm.trim().toLowerCase(),
            ic: categoryFilter,
            ist: statusFilter,
            pp: parcelPage,
            ps: debouncedParcelSearch.trim().toLowerCase(),
            pst: parcelStatusFilter,
            pdf: effectiveDateFrom,
            pdt: effectiveDateTo,
            psb: effectiveScannedBy,
        });
        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                if (cached.data.inventory) {
                    setInventoryItems(cached.data.inventory.items || []);
                    setTotalInventoryItems(cached.data.inventory.totalItems || 0);
                    setInventoryTotalPages(cached.data.inventory.totalPages || 1);
                }
                if (cached.data.parcels) {
                    setParcels(cached.data.parcels.parcels || []);
                    setTotalParcels(cached.data.parcels.totalItems || 0);
                    setParcelTotalPages(cached.data.parcels.totalPages || 1);
                }
                if (cached.data.scanners) {
                    setScanners(cached.data.scanners || []);
                }
                setLoadingInventory(false);
                setLoadingParcels(false);
                if (!cached.isStale)
                    return; // instant 0ms cache hit
            }
        }
        if (showLoading) {
            setLoadingInventory(true);
            setLoadingParcels(true);
        }
        try {
            const result = await fetchInventoryPageData({
                inventoryPage: inventoryPage,
                inventoryLimit: itemsPerPage,
                inventorySearch: debouncedSearchTerm,
                inventoryCategory: categoryFilter,
                inventoryStatus: statusFilter,
                parcelPage: parcelPage,
                parcelLimit: itemsPerPage,
                parcelSearch: debouncedParcelSearch,
                parcelStatus: parcelStatusFilter,
                parcelDateFrom: effectiveDateFrom,
                parcelDateTo: effectiveDateTo,
                parcelScannedBy: effectiveScannedBy,
            });
            if (result.success && result.data) {
                const { data } = result;
                if (data?.inventory) {
                    setInventoryItems(data.inventory.items || []);
                    setTotalInventoryItems(data.inventory.totalItems || 0);
                    setInventoryTotalPages(data.inventory.totalPages || 1);
                }
                if (data?.parcels) {
                    setParcels(data.parcels.parcels || []);
                    setTotalParcels(data.parcels.totalItems || 0);
                    setParcelTotalPages(data.parcels.totalPages || 1);
                }
                if (data?.scanners) {
                    setScanners(data.scanners || []);
                }
                inventoryCache.set(cacheKey, data);
            }
            else {
                toast.error(result.error || 'Failed to load inventory data');
            }
        }
        catch (error) {
            console.error('Error fetching inventory data:', error);
            toast.error('Failed to load inventory data');
        }
        finally {
            if (showLoading) {
                setLoadingInventory(false);
                setLoadingParcels(false);
            }
        }
    }, [
        inventoryPage,
        itemsPerPage,
        debouncedSearchTerm,
        categoryFilter,
        statusFilter,
        parcelPage,
        debouncedParcelSearch,
        parcelStatusFilter,
        parcelDateFrom,
        parcelDateTo,
        parcelScannedByFilter,
        isPrivileged,
        currentUserId,
    ]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            await Promise.all([
                fetchDashboardData(),
                fetchInventoryData(true)
            ]);
            setLoading(false);
            isInitialLoad.current = false;
        };
        loadInitialData();
    }, [fetchDashboardData, fetchInventoryData, isLoaded]);

    useEffect(() => {
        if (isInitialLoad.current)
            return;
        setInventoryPage(1);
        setParcelPage(1);
        const timeoutId = setTimeout(() => {
            fetchInventoryData(true);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [
        debouncedSearchTerm,
        categoryFilter,
        statusFilter,
        debouncedParcelSearch,
        parcelStatusFilter,
        effectiveParcelDateFrom,
        effectiveParcelDateTo,
        parcelScannedByFilter,
        fetchInventoryData,
    ]);

    useEffect(() => {
        if (isInitialLoad.current)
            return;
        fetchInventoryData(true);
    }, [inventoryPage, parcelPage, fetchInventoryData]);

    // Realtime Supabase Subscription for Parcels - smoothly updates local state without full re-fetch or page reload
    useEffect(() => {
        const channel = supabase
            .channel('inventory_parcels_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'parcels',
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newParcel = payload.new as Parcel;
                    if (newParcel && newParcel.id) {
                        setParcels(prev => {
                            if (prev.some(p => p.id === newParcel.id)) {
                                return prev.map(p => p.id === newParcel.id ? { ...p, ...newParcel } : p);
                            }
                            return [newParcel, ...prev];
                        });
                        setTotalParcels(prev => prev + 1);
                        toast.info(`New parcel added: ${newParcel.barcode || newParcel.tracking_number || newParcel.id}`, { duration: 3000 });
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as Parcel;
                    if (updated && updated.id) {
                        setParcels(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
                    }
                } else if (payload.eventType === 'DELETE') {
                    const deletedId = payload.old?.id;
                    if (deletedId) {
                        setParcels(prev => prev.filter(p => p.id !== deletedId));
                        setTotalParcels(prev => Math.max(0, prev - 1));
                    }
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    // Instant 0ms tab switching without triggering Next.js router full page re-evaluations
    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
        try {
            localStorage.setItem('inventoryActiveTab', tab);
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState(null, '', url.pathname + url.search);
        } catch (e) {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            const savedTab = localStorage.getItem('inventoryActiveTab');
            const urlTab = searchParams.get('tab');
            if (urlTab && ['dashboard', 'inventory', 'parcels'].includes(urlTab)) {
                setActiveTab(urlTab);
            }
            else if (savedTab && !urlTab && ['dashboard', 'inventory', 'parcels'].includes(savedTab)) {
                const targetTab = (isLoaded && !isPrivileged && (savedTab === 'dashboard' || savedTab === 'inventory')) ? 'parcels' : savedTab;
                setActiveTab(targetTab);
                const url = new URL(window.location.href);
                url.searchParams.set('tab', targetTab);
                window.history.replaceState(null, '', url.pathname + url.search);
            } else if (!urlTab && isLoaded && !isPrivileged && activeTab === 'dashboard') {
                setActiveTab('parcels');
            }
        } catch (e) {
            // ignore
        }
    }, [searchParams, isPrivileged, isLoaded, activeTab]);

    const handleInventoryPageChange = useCallback((page: number) => {
        if (page >= 1 && page <= inventoryTotalPages && page !== inventoryPage) {
            setInventoryPage(page);
        }
    }, [inventoryTotalPages, inventoryPage]);

    const handleParcelPageChange = useCallback((page: number) => {
        if (page >= 1 && page <= parcelTotalPages && page !== parcelPage) {
            setParcelPage(page);
        }
    }, [parcelTotalPages, parcelPage]);

    const handleAddItem = useCallback(async (data: any) => {
        await addItem(data);
        setShowAddModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    }, [addItem, fetchDashboardData, fetchInventoryData]);

    const handleUpdateItem = useCallback(async (data: any) => {
        await updateItem(data);
        setShowEditModal(false);
        setEditingItem(null);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    }, [updateItem, fetchDashboardData, fetchInventoryData]);

    const handleDeleteItem = useCallback(async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'Delete Item',
            message: `Are you sure you want to delete "${name}"?`,
            confirmText: 'Delete',
            confirmVariant: 'danger'
        });
        if (confirmed) {
            await deleteItem(id, name);
            inventoryCache.invalidateAll();
            await Promise.all([
                fetchDashboardData(true),
                fetchInventoryData(true, true)
            ]);
        }
    }, [confirm, deleteItem, fetchDashboardData, fetchInventoryData]);

    const handleDeleteMultiple = useCallback(async () => {
        if (selectedIds.size === 0) {
            toast.warning('Please select at least one item');
            return;
        }
        const confirmed = await confirm({
            title: `Delete ${selectedIds.size} Items`,
            message: `Are you sure you want to delete ${selectedIds.size} item(s)?`,
            confirmText: `Delete ${selectedIds.size}`,
            confirmVariant: 'danger'
        });
        if (confirmed) {
            await deleteMultipleItems(Array.from(selectedIds));
            setSelectedIds(new Set());
            inventoryCache.invalidateAll();
            await Promise.all([
                fetchDashboardData(true),
                fetchInventoryData(true, true)
            ]);
        }
    }, [selectedIds, confirm, deleteMultipleItems, fetchDashboardData, fetchInventoryData]);

    const handleDeleteMultipleParcels = useCallback(async (parcelIds: (string | number)[]) => {
        if (parcelIds.length === 0) {
            toast.warning('Please select at least one parcel');
            return;
        }
        const confirmed = await confirm({
            title: `Delete ${parcelIds.length} Parcels`,
            message: `Are you sure you want to delete ${parcelIds.length} parcel(s)?`,
            confirmText: `Delete ${parcelIds.length}`,
            confirmVariant: 'danger'
        });
        if (confirmed) {
            const toastId = toast.loading(`Deleting ${parcelIds.length} parcels...`);
            try {
                const { error } = await supabase
                    .from('parcels')
                    .delete()
                    .in('id', parcelIds);
                if (error) throw error;
                toast.success(`Successfully deleted ${parcelIds.length} parcels!`, { id: toastId });
                inventoryCache.invalidateAll();
                await Promise.all([
                    fetchDashboardData(true),
                    fetchInventoryData(true, true)
                ]);
            } catch (error) {
                console.error('error deleting parcels:', error);
                toast.error('Failed to delete parcels', { id: toastId });
            }
        }
    }, [confirm, fetchDashboardData, fetchInventoryData]);

    const handleStockIn = useCallback(async (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => {
        await stockIn(itemName, quantity, supplier, reference, remarks);
        setShowStockInModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    }, [stockIn, fetchDashboardData, fetchInventoryData]);

    const handleStockOut = useCallback(async (itemName: string, quantity: number, department?: string, purpose?: string, remarks?: string) => {
        await stockOut(itemName, quantity, department, purpose, remarks);
        setShowStockOutModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    }, [stockOut, fetchDashboardData, fetchInventoryData]);

    const openEditModal = useCallback((item: InventoryItem) => {
        setEditingItem(item);
        setShowEditModal(true);
    }, []);

    const openStockInModal = useCallback((itemName: string, itemObj?: InventoryItem) => {
        setSelectedItemForStock(itemName);
        setSelectedItemObjectForStock(itemObj || inventoryItems.find(i => i.item_name === itemName) || null);
        setShowStockInModal(true);
    }, [inventoryItems]);

    const openScopedPOModal = useCallback((item: InventoryItem) => {
        setSelectedItemForPO(item);
        setShowScopedPOModal(true);
    }, []);

    const handleCategoryClick = useCallback((category: string) => {
        handleTabChange('inventory');
        setCategoryFilter(category);
        setStatusFilter('all');
        setSearchTerm('');
        setSelectedIds(new Set());
        setInventoryPage(1);
    }, [handleTabChange]);

    const handleStatusClick = useCallback((status: string) => {
        handleTabChange('inventory');
        const statusMap: Record<string, string> = {
            'Available': 'available',
            'Low Stock': 'low-stock',
            'Out of Stock': 'out-of-stock'
        };
        setStatusFilter(statusMap[status] || status.toLowerCase());
        setCategoryFilter('all');
        setSearchTerm('');
        setSelectedIds(new Set());
        setInventoryPage(1);
    }, [handleTabChange]);

    const handleCategoryFilterChange = useCallback((val: string) => {
        setCategoryFilter(val);
        setInventoryPage(1);
    }, []);

    const handleStatusFilterChange = useCallback((val: string) => {
        setStatusFilter(val);
        setInventoryPage(1);
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === inventoryItems.length) {
            setSelectedIds(new Set());
        }
        else {
            setSelectedIds(new Set(inventoryItems.map(item => item.id)));
        }
    }, [selectedIds.size, inventoryItems]);

    const handleSelectOne = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleClearInventoryFilters = useCallback(() => {
        setSearchTerm('');
        setCategoryFilter('all');
        setStatusFilter('all');
        setSelectedIds(new Set());
        setInventoryPage(1);
    }, []);

    const handleClearParcelFilters = useCallback(() => {
        setParcelSearchTerm('');
        setParcelStatusFilter('');
        setParcelDateFrom('');
        setParcelDateTo('');
        setParcelScannedByFilter('');
        setParcelPage(1);
    }, []);

    const handleStockOutClick = useCallback((itemName: string) => {
        setSelectedItemForStock(itemName);
        setShowStockOutModal(true);
    }, []);

    const openAddItemModal = useCallback(() => {
        setShowAddModal(true);
    }, []);

    // Memoize parcel grouping to prevent recalculating on unrelated renders
    const filteredGroupedParcels = useMemo(() => {
        if (!parcels || parcels.length === 0) return [];
        return parcels.reduce((acc: GroupedParcels[], parcel) => {
            const date = parcel.created_at ? new Date(parcel.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'Recent';
            const existingGroup = acc.find(g => g.date === date);
            if (existingGroup) {
                existingGroup.parcels.push(parcel);
            }
            else {
                acc.push({ date, parcels: [parcel] });
            }
            return acc;
        }, []);
    }, [parcels]);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300 bgCard">
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0">
                            <i className="fa-solid fa-warehouse"></i>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Warehouse Inventory
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Manage warehouse supplies, equipment, parcels, and assets
                            </p>
                        </div>
                    </div>

                    {isPrivileged && (
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {selectedIds.size > 0 && (
                                <AppButton type="button" variant="danger" size="md" onClick={handleDeleteMultiple} disabled={deleting}>
                                    <i className="fas fa-trash-can text-xs"/>
                                    <span>Delete ({selectedIds.size})</span>
                                </AppButton>
                            )}

                            <AppButton type="button" variant="primary" size="md" onClick={openAddItemModal}>
                                <i className="fas fa-plus text-xs"/>
                                <span>Add Item</span>
                            </AppButton>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-fit overflow-x-auto no-scrollbar">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', restricted: isLoaded && !isPrivileged },
                        { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked', restricted: isLoaded && !isPrivileged },
                        { id: 'parcels', label: 'Parcels', icon: 'fa-box-archive', restricted: false },
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 relative cursor-pointer active:scale-95 ${isActive
                                    ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold'
                                    : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'}`}
                            >
                                <i className={`fas ${tab.restricted ? 'fa-lock' : tab.icon} text-xs transition-colors ${isActive ? 'text-white' : tab.restricted ? 'text-pink-500/80 dark:text-pink-400/80' : 'text-slate-400 dark:text-slate-500'}`}/>
                                <span>{tab.label}</span>
                                {tab.restricted && (
                                    <span className="text-[10px] opacity-75 font-normal ml-0.5">(Restricted)</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Keep-Alive Tab Container: Instant 0ms Tab Switching without unmounting */}
            <div className="relative min-h-[400px]">
                <div className={activeTab === 'dashboard' ? 'block animate-in fade-in duration-150' : 'hidden'} role="tabpanel" aria-hidden={activeTab !== 'dashboard'}>
                    {isLoaded && !isPrivileged ? (
                        <UnauthorizedEmptyState
                            title="Inventory Dashboard Restricted"
                            description="You do not have permission to view the inventory analytics dashboard. This section is restricted to Admin, Manager, and Executive personnel only."
                            currentRole={userRole}
                        />
                    ) : (
                        <DashboardTab
                            inventoryItems={dashboardItems}
                            stats={dashboardStats}
                            isLoading={loading}
                            onStockIn={openStockInModal}
                            onCategoryClick={handleCategoryClick}
                            onStatusClick={handleStatusClick}
                        />
                    )}
                </div>
                <div className={activeTab === 'inventory' ? 'block animate-in fade-in duration-150' : 'hidden'} role="tabpanel" aria-hidden={activeTab !== 'inventory'}>
                    {isLoaded && !isPrivileged ? (
                        <UnauthorizedEmptyState
                            title="Inventory Catalog Restricted"
                            description="You do not have permission to view or manage the warehouse inventory catalog. This section is restricted to Admin, Manager, and Executive personnel only."
                            currentRole={userRole}
                        />
                    ) : (
                        <InventoryTab
                            items={inventoryItems}
                            totalItems={totalInventoryItems}
                            currentPage={inventoryPage}
                            totalPages={inventoryTotalPages}
                            searchTerm={searchTerm}
                            categoryFilter={categoryFilter}
                            statusFilter={statusFilter}
                            selectedIds={selectedIds}
                            itemsPerPage={itemsPerPage}
                            isLoading={loading || loadingInventory}
                            onSearchChange={setSearchTerm}
                            onCategoryChange={handleCategoryFilterChange}
                            onStatusChange={handleStatusFilterChange}
                            onPageChange={handleInventoryPageChange}
                            onSelectAll={handleSelectAll}
                            onSelect={handleSelectOne}
                            onClearFilters={handleClearInventoryFilters}
                            onEdit={openEditModal}
                            onDelete={handleDeleteItem}
                            onDeleteMultiple={handleDeleteMultiple}
                            onStockIn={openStockInModal}
                            onOrderPO={openScopedPOModal}
                            onViewPurchaseRequest={(requestId) => {
                                setViewingPRId(requestId);
                                setShowPRDetailModal(true);
                            }}
                            onStockOut={handleStockOutClick}
                            onAddItem={openAddItemModal}
                        />
                    )}
                </div>
                <div className={activeTab === 'parcels' ? 'block animate-in fade-in duration-150' : 'hidden'} role="tabpanel" aria-hidden={activeTab !== 'parcels'}>
                    <ParcelsTab
                        parcels={parcels}
                        groupedParcels={filteredGroupedParcels}
                        searchTerm={parcelSearchTerm}
                        statusFilter={parcelStatusFilter}
                        dateFrom={parcelDateFrom}
                        dateTo={parcelDateTo}
                        scannedByFilter={parcelScannedByFilter}
                        scanners={scanners}
                        currentPage={parcelPage}
                        totalPages={parcelTotalPages}
                        totalItems={totalParcels}
                        isLoading={loading || loadingParcels}
                        onSearchChange={setParcelSearchTerm}
                        onStatusChange={setParcelStatusFilter}
                        onDateFromChange={setParcelDateFrom}
                        onDateToChange={setParcelDateTo}
                        onScannedByChange={(val) => {
                            setParcelScannedByFilter(val);
                            setParcelPage(1);
                        }}
                        onClearFilters={handleClearParcelFilters}
                        onPageChange={handleParcelPageChange}
                        onDeleteMultiple={handleDeleteMultipleParcels}
                    />
                </div>
            </div>

            <AddItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAddItem} suppliers={suppliers} loading={saving}/>

            {editingItem && (
                <EditItemModal isOpen={showEditModal} onClose={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                }} onSave={handleUpdateItem} item={editingItem} suppliers={suppliers} loading={saving}/>
            )}

            <StockInModal isOpen={showStockInModal} onClose={() => {
                setShowStockInModal(false);
                setSelectedItemForStock('');
                setSelectedItemObjectForStock(null);
            }} onStockIn={handleStockIn} onSuccess={() => {
                fetchDashboardData(true);
                fetchInventoryData(false, true);
            }} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} targetItem={selectedItemObjectForStock} loading={saving}/>

            <ScopedPORequestModal isOpen={showScopedPOModal} onClose={() => {
                setShowScopedPOModal(false);
                setSelectedItemForPO(null);
            }} item={selectedItemForPO} suppliers={suppliers} onSuccess={() => {
                fetchDashboardData(true);
                fetchInventoryData(false, true);
            }}/>

            <PurchaseRequestDetailModal
                isOpen={showPRDetailModal}
                onClose={() => {
                    setShowPRDetailModal(false);
                    setViewingPRId(null);
                }}
                requestId={viewingPRId}
                onSuccess={() => {
                    fetchDashboardData(true);
                    fetchInventoryData(false, true);
                }}
            />

            <StockOutModal isOpen={showStockOutModal} onClose={() => {
                setShowStockOutModal(false);
                setSelectedItemForStock('');
            }} onStockOut={handleStockOut} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} loading={saving}/>
        </div>
    );
}
