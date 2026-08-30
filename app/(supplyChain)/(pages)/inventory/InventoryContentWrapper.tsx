'use client';
import { toast } from "sonner";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { useInventory } from '@/app/(supplyChain)/(pages)/inventory/hooks/useInventory';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { DashboardTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/DashboardTab';
import { InventoryTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/InventoryTab';
import { ParcelsTab } from '@/app/(supplyChain)/(pages)/inventory/components/tabs/ParcelsTab';
import { AddItemModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/AddItemModal';
import { EditItemModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/EditItemModal';
import { StockInModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/StockInModal';
import { StockOutModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/StockOutModal';
import { ScopedPORequestModal } from '@/app/(supplyChain)/(pages)/inventory/components/modals/ScopedPORequestModal';
import { GroupedParcels, InventoryItem } from '@/app/(supplyChain)/(pages)/inventory/types';
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { fetchInventoryPageData, type Parcel } from '@/app/(supplyChain)/(pages)/inventory/server/query';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
const tabVariants: Variants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 30 : -30,
        opacity: 0,
        scale: 0.98
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: "easeOut" as const
        }
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 30 : -30,
        opacity: 0,
        scale: 0.98,
        transition: {
            duration: 0.2,
            ease: "easeIn" as const
        }
    })
};
// SWR Cache Manager for Inventory data
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
class InventoryCacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private readonly maxSize = 60;
    private readonly ttl = 5 * 60 * 1000; // 5 min TTL
    private readonly staleTime = 30 * 1000; // 30 sec before background revalidate
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'dashboard';
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [direction, setDirection] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [parcelSearchTerm, setParcelSearchTerm] = useState('');
    const [parcelStatusFilter, setParcelStatusFilter] = useState('');
    const [parcelDateFrom, setParcelDateFrom] = useState('');
    const [parcelDateTo, setParcelDateTo] = useState('');
    const [inventoryPage, setInventoryPage] = useState(1);
    const [parcelPage, setParcelPage] = useState(1);
    const itemsPerPage = 30;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStockInModal, setShowStockInModal] = useState(false);
    const [showStockOutModal, setShowStockOutModal] = useState(false);
    const [showScopedPOModal, setShowScopedPOModal] = useState(false);
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
    const [totalParcels, setTotalParcels] = useState(0);
    const [parcelTotalPages, setParcelTotalPages] = useState(1);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedParcelSearch = useDebounce(parcelSearchTerm, 300);
    const isInitialLoad = useRef(true);
    const { confirm } = useConfirm();
    const { saving, deleting, addItem, updateItem, deleteItem, deleteMultipleItems, stockIn, stockOut, } = useInventory();
    const fetchDashboardData = useCallback(async (forceRefresh = false) => {
        const cacheKey = 'inventory_dashboard_data';
        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setDashboardItems(cached.data.inventory?.items || []);
                setDashboardStats(cached.data.stats || null);
                setSuppliers(cached.data.suppliers || []);
                if (!cached.isStale)
                    return; // 0ms response
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
            });
            if (result.success && result.data) {
                setDashboardItems(result.data.inventory?.items || []);
                setDashboardStats(result.data.stats || null);
                setSuppliers(result.data.suppliers || []);
                inventoryCache.set(cacheKey, result.data);
            }
        }
        catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }, []);
    const fetchInventoryData = useCallback(async (showLoading = true, forceRefresh = false) => {
        const cacheKey = JSON.stringify({
            ip: inventoryPage,
            is: debouncedSearchTerm.trim().toLowerCase(),
            ic: categoryFilter,
            ist: statusFilter,
            pp: parcelPage,
            ps: debouncedParcelSearch.trim().toLowerCase(),
            pst: parcelStatusFilter,
            pdf: parcelDateFrom,
            pdt: parcelDateTo,
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
                parcelDateFrom: parcelDateFrom,
                parcelDateTo: parcelDateTo,
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
    }, []);
    useEffect(() => {
        if (isInitialLoad.current)
            return;
        setInventoryPage(1);
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
        parcelDateFrom,
        parcelDateTo,
    ]);
    useEffect(() => {
        if (isInitialLoad.current)
            return;
        fetchInventoryData(true);
    }, [inventoryPage, parcelPage]);
    const handleTabChange = (tab: string) => {
        const tabIndex = ['dashboard', 'inventory', 'parcels'].indexOf(tab);
        const currentIndex = ['dashboard', 'inventory', 'parcels'].indexOf(activeTab);
        setDirection(tabIndex > currentIndex ? 1 : -1);
        setActiveTab(tab);
        localStorage.setItem('inventoryActiveTab', tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`/inventory?${params.toString()}`, { scroll: false });
    };
    useEffect(() => {
        const savedTab = localStorage.getItem('inventoryActiveTab');
        const urlTab = searchParams.get('tab');
        if (urlTab && ['dashboard', 'inventory', 'parcels'].includes(urlTab)) {
            setActiveTab(urlTab);
        }
        else if (savedTab && !urlTab) {
            setActiveTab(savedTab);
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', savedTab);
            router.replace(`/inventory?${params.toString()}`, { scroll: false });
        }
    }, []);
    const handleInventoryPageChange = (page: number) => {
        if (page >= 1 && page <= inventoryTotalPages && page !== inventoryPage) {
            setInventoryPage(page);
        }
    };
    const handleParcelPageChange = (page: number) => {
        if (page >= 1 && page <= parcelTotalPages && page !== parcelPage) {
            setParcelPage(page);
        }
    };
    const handleAddItem = async (data: any) => {
        await addItem(data);
        setShowAddModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    };
    const handleUpdateItem = async (data: any) => {
        await updateItem(data);
        setShowEditModal(false);
        setEditingItem(null);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    };
    const handleDeleteItem = async (id: string, name: string) => {
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
    };
    const handleDeleteMultiple = async () => {
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
    };
    const handleStockIn = async (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => {
        await stockIn(itemName, quantity, supplier, reference, remarks);
        setShowStockInModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    };
    const handleStockOut = async (itemName: string, quantity: number, department?: string, purpose?: string, remarks?: string) => {
        await stockOut(itemName, quantity, department, purpose, remarks);
        setShowStockOutModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true)
        ]);
    };
    const openEditModal = (item: InventoryItem) => {
        setEditingItem(item);
        setShowEditModal(true);
    };
    const openStockInModal = (itemName: string, itemObj?: InventoryItem) => {
        setSelectedItemForStock(itemName);
        setSelectedItemObjectForStock(itemObj || inventoryItems.find(i => i.item_name === itemName) || null);
        setShowStockInModal(true);
    };
    const openScopedPOModal = (item: InventoryItem) => {
        setSelectedItemForPO(item);
        setShowScopedPOModal(true);
    };
    const handleCategoryClick = (category: string) => {
        handleTabChange('inventory');
        setCategoryFilter(category);
        setStatusFilter('all');
        setSearchTerm('');
        setSelectedIds(new Set());
        setInventoryPage(1);
    };
    const handleStatusClick = (status: string) => {
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
    };
    const filteredGroupedParcels = parcels.reduce((acc: GroupedParcels[], parcel) => {
        const date = new Date(parcel.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const existingGroup = acc.find(g => g.date === date);
        if (existingGroup) {
            existingGroup.parcels.push(parcel);
        }
        else {
            acc.push({ date, parcels: [parcel] });
        }
        return acc;
    }, []);
    const tabComponents = {
        dashboard: (<DashboardTab key="dashboard" inventoryItems={dashboardItems} stats={dashboardStats} isLoading={loading} onStockIn={openStockInModal} onCategoryClick={handleCategoryClick} onStatusClick={handleStatusClick}/>),
        inventory: (<InventoryTab key="inventory" items={inventoryItems} totalItems={totalInventoryItems} currentPage={inventoryPage} totalPages={inventoryTotalPages} searchTerm={searchTerm} categoryFilter={categoryFilter} statusFilter={statusFilter} selectedIds={selectedIds} itemsPerPage={itemsPerPage} onSearchChange={setSearchTerm} onCategoryChange={(val) => {
                setCategoryFilter(val);
                setInventoryPage(1);
            }} onStatusChange={(val) => {
                setStatusFilter(val);
                setInventoryPage(1);
            }} onPageChange={handleInventoryPageChange} onSelectAll={() => {
                if (selectedIds.size === inventoryItems.length) {
                    setSelectedIds(new Set());
                }
                else {
                    setSelectedIds(new Set(inventoryItems.map(item => item.id)));
                }
            }} onSelect={(id) => {
                const newSelected = new Set(selectedIds);
                if (newSelected.has(id))
                    newSelected.delete(id);
                else
                    newSelected.add(id);
                setSelectedIds(newSelected);
            }} onClearFilters={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setSelectedIds(new Set());
                setInventoryPage(1);
            }} onEdit={openEditModal} onDelete={handleDeleteItem} onStockIn={openStockInModal} onOrderPO={openScopedPOModal} onStockOut={(itemName) => {
                setSelectedItemForStock(itemName);
                setShowStockOutModal(true);
            }} onAddItem={() => setShowAddModal(true)} isLoading={loading || loadingInventory}/>),
        parcels: (<ParcelsTab key="parcels" parcels={parcels} groupedParcels={filteredGroupedParcels} searchTerm={parcelSearchTerm} statusFilter={parcelStatusFilter} dateFrom={parcelDateFrom} dateTo={parcelDateTo} currentPage={parcelPage} totalPages={parcelTotalPages} totalItems={totalParcels} isLoading={loading || loadingParcels} onSearchChange={setParcelSearchTerm} onStatusChange={setParcelStatusFilter} onDateFromChange={setParcelDateFrom} onDateToChange={setParcelDateTo} onClearFilters={() => {
                setParcelSearchTerm('');
                setParcelStatusFilter('');
                setParcelDateFrom('');
                setParcelDateTo('');
                setParcelPage(1);
            }} onPageChange={handleParcelPageChange}/>)
    };
    return (<div className="p-6 space-y-6 animate-in fade-in duration-300 bgCard">

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

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {selectedIds.size > 0 && (<AppButton type="button" variant="danger" size="md" onClick={handleDeleteMultiple} disabled={deleting}>
                                <i className="fas fa-trash-can text-xs"/>
                                <span>Delete ({selectedIds.size})</span>
                            </AppButton>)}

                        <AppButton type="button" variant="primary" size="md" onClick={() => setShowAddModal(true)}>
                            <i className="fas fa-plus text-xs"/>
                            <span>Add Item</span>
                        </AppButton>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-full border border-slate-200/90 dark:border-slate-800 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] max-w-fit">
                    {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
            { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
            { id: 'parcels', label: 'Parcels', icon: 'fa-box-archive' },
        ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (<button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 relative cursor-pointer active:scale-95 ${isActive
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <i className={`fas ${tab.icon} text-xs transition-colors ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}/>
                                <span>{tab.label}</span>
                            </button>);
        })}
                </div>
            </div>

            {/* Animated Tab Content */}
            <div className="relative overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div key={activeTab} custom={direction} variants={tabVariants} initial="enter" animate="center" exit="exit" className="min-h-[400px]">
                        {tabComponents[activeTab as keyof typeof tabComponents]}
                    </motion.div>
                </AnimatePresence>
            </div>

            <AddItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAddItem} suppliers={suppliers} loading={saving}/>

            {editingItem && (<EditItemModal isOpen={showEditModal} onClose={() => {
                setShowEditModal(false);
                setEditingItem(null);
            }} onSave={handleUpdateItem} item={editingItem} suppliers={suppliers} loading={saving}/>)}

            <StockInModal isOpen={showStockInModal} onClose={() => {
            setShowStockInModal(false);
            setSelectedItemForStock('');
            setSelectedItemObjectForStock(null);
        }} onStockIn={handleStockIn} onSuccess={() => {
            fetchDashboardData();
            fetchInventoryData(false);
        }} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} targetItem={selectedItemObjectForStock} loading={saving}/>

            <ScopedPORequestModal isOpen={showScopedPOModal} onClose={() => {
            setShowScopedPOModal(false);
            setSelectedItemForPO(null);
        }} item={selectedItemForPO} suppliers={suppliers} onSuccess={() => {
            fetchDashboardData();
            fetchInventoryData(false);
        }}/>

            <StockOutModal isOpen={showStockOutModal} onClose={() => {
            setShowStockOutModal(false);
            setSelectedItemForStock('');
        }} onStockOut={handleStockOut} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} loading={saving}/>
        </div>);
}
