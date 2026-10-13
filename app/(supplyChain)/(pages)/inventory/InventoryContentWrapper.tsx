'use client';
import { toast } from "sonner";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useInventory } from './hooks/useInventory';
import { useSearchParams } from 'next/navigation';
import { DashboardTab } from './components/tabs/DashboardTab';
import { InventoryTab } from './components/tabs/InventoryTab';
import { RequestsTab } from './components/tabs/RequestsTab';
import { StockMovementsTab } from './components/tabs/StockMovementsTab';
import { AddItemModal } from './components/modals/AddItemModal';
import { EditItemModal } from './components/modals/EditItemModal';
import { StockInModal } from './components/modals/StockInModal';
import { StockOutModal } from './components/modals/StockOutModal';
import { InternalRequestModal } from './components/modals/InternalRequestModal';
import { PurchaseOrderModal } from '../../components/modals/PurchaseOrderModal';
import { user } from '../../lib/services/Class/user';
import { PurchaseRequestDetailModal } from '../../components/modals/PurchaseRequestDetailModal';
import { InventoryItem, InventoryRequest, StockMovement, StockMovementStats } from './types';
import { useDebounce } from "../../hooks/useDebounce";
import { 
    fetchInventoryItems, 
    fetchSuppliers, 
    fetchDashboardStats, 
    fetchInventoryRequests 
} from './server/query';
import { fetchStockMovements } from './server/stock-movements';
import { AppButton } from '../../components/ui/AppButton';
import { supabase } from '../../lib/services/client/supabase';
import UnauthorizedEmptyState, { useUserRole } from '../../components/global/UnauthorizedEmptyState';

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
    const validTabs = useMemo(() => ['dashboard', 'inventory', 'requests', 'movements'], []);
    const urlTab = searchParams.get('tab');
    const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : 'dashboard';
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    // Sync active tab when URL changes
    useEffect(() => {
        const currentUrlTab = searchParams.get('tab');
        if (currentUrlTab && validTabs.includes(currentUrlTab) && currentUrlTab !== activeTab) {
            setActiveTab(currentUrlTab);
        }
    }, [searchParams, validTabs, activeTab]);

    // Redirect legacy parcels tab to Warehousing
    useEffect(() => {
        if (searchParams.get('tab') === 'parcels') {
            window.location.replace('/warehousing?tab=parcels');
        }
    }, [searchParams]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [inventoryPage, setInventoryPage] = useState(1);
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
    const [selectedRequestForPO, setSelectedRequestForPO] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [dashboardItems, setDashboardItems] = useState<InventoryItem[]>([]);
    const [dashboardStats, setDashboardStats] = useState<any>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [totalInventoryItems, setTotalInventoryItems] = useState(0);
    const [inventoryTotalPages, setInventoryTotalPages] = useState(1);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [requests, setRequests] = useState<InventoryRequest[]>([]);
    const [totalRequests, setTotalRequests] = useState<number>(0);
    const [requestsTotalPages, setRequestsTotalPages] = useState<number>(1);
    const [requestsPage, setRequestsPage] = useState<number>(1);
    const [requestsSearchTerm, setRequestsSearchTerm] = useState<string>('');
    const [requestsStatusFilter, setRequestsStatusFilter] = useState<string>('all');
    const [requestsTypeFilter, setRequestsTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
    const [requestsStats, setRequestsStats] = useState<{ total: number; pending: number; approved: number; received: number; rejected: number } | null>(null);
    const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
    const [showInternalRequestModal, setShowInternalRequestModal] = useState<boolean>(false);

    // Stock Movements State
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [totalMovements, setTotalMovements] = useState<number>(0);
    const [movementsTotalPages, setMovementsTotalPages] = useState<number>(1);
    const [movementsPage, setMovementsPage] = useState<number>(1);
    const [movementsSearchTerm, setMovementsSearchTerm] = useState<string>('');
    const [movementsTypeFilter, setMovementsTypeFilter] = useState<string>('all');
    const [movementsDateRangeFilter, setMovementsDateRangeFilter] = useState<string>('all');
    const [movementsUserDeptFilter, setMovementsUserDeptFilter] = useState<string>('all');
    const [movementsUserDeptOptions, setMovementsUserDeptOptions] = useState<string[]>([]);
    const [movementsStats, setMovementsStats] = useState<StockMovementStats | null>(null);
    const [loadingMovements, setLoadingMovements] = useState<boolean>(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedRequestsSearch = useDebounce(requestsSearchTerm, 300);
    const debouncedMovementsSearch = useDebounce(movementsSearchTerm, 300);
    const { confirm } = useConfirm();
    const { saving, deleting, addItem, updateItem, deleteItem, deleteMultipleItems, stockIn, stockOut } = useInventory();

    const fetchRequestsData = useCallback(async (showLoading = true, forceRefresh = false) => {
        const cacheKey = JSON.stringify({
            rp: requestsPage,
            rs: debouncedRequestsSearch.trim().toLowerCase(),
            rst: requestsStatusFilter,
            rt: requestsTypeFilter,
        });

        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setRequests(cached.data.requests || []);
                setTotalRequests(cached.data.totalItems || 0);
                setRequestsTotalPages(cached.data.totalPages || 1);
                setRequestsStats(cached.data.stats || null);
                setLoadingRequests(false);
                if (!cached.isStale) return; // instant 0ms response
            }
        }

        if (showLoading) setLoadingRequests(true);
        try {
            const res = await fetchInventoryRequests({
                page: requestsPage,
                limit: 20,
                search: debouncedRequestsSearch,
                status: requestsStatusFilter,
                type: requestsTypeFilter,
            });
            if (res.success && res.data) {
                setRequests(res.data.requests || []);
                setTotalRequests(res.data.totalItems || 0);
                setRequestsTotalPages(res.data.totalPages || 1);
                setRequestsStats(res.data.stats || null);
                inventoryCache.set(cacheKey, res.data);
            } else if (!res.success && res.error) {
                console.error('fetchInventoryRequests error:', res.error);
            }
            // Ensure lightweight inventory items are available for requisition modals
            if (inventoryItems.length === 0) {
                fetchInventoryItems({ page: 1, limit: 100 }).then(r => {
                    if (r.success && r.data?.items) setInventoryItems(r.data.items);
                }).catch(() => {});
            }
        } catch (err) {
            console.error('Error fetching inventory requests:', err);
        } finally {
            if (showLoading) setLoadingRequests(false);
        }
    }, [requestsPage, debouncedRequestsSearch, requestsStatusFilter, requestsTypeFilter, inventoryItems.length]);

    const fetchMovementsData = useCallback(async (showLoading = true, forceRefresh = false) => {
        const cacheKey = JSON.stringify({
            mp: movementsPage,
            ms: debouncedMovementsSearch.trim().toLowerCase(),
            mt: movementsTypeFilter,
            md: movementsDateRangeFilter,
            mud: movementsUserDeptFilter,
        });

        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setMovements(cached.data.movements || []);
                setTotalMovements(cached.data.totalCount || 0);
                setMovementsTotalPages(cached.data.totalPages || 1);
                setMovementsStats(cached.data.stats || null);
                setMovementsUserDeptOptions(cached.data.userDeptOptions || []);
                setLoadingMovements(false);
                if (!cached.isStale) return; // instant response
            }
        }

        if (showLoading) setLoadingMovements(true);
        try {
            const res = await fetchStockMovements({
                page: movementsPage,
                limit: 20,
                search: debouncedMovementsSearch,
                type: movementsTypeFilter,
                dateRange: movementsDateRangeFilter,
                userDepartment: movementsUserDeptFilter,
            });

            if (res.success && res.data) {
                setMovements(res.data.movements || []);
                setTotalMovements(res.data.totalCount || 0);
                setMovementsTotalPages(res.data.totalPages || 1);
                setMovementsStats(res.data.stats || null);
                setMovementsUserDeptOptions(res.data.userDeptOptions || []);
                inventoryCache.set(cacheKey, res.data);
            } else if (!res.success && res.error) {
                console.error('fetchStockMovements error:', res.error);
            }
        } catch (err) {
            console.error('Error fetching stock movements:', err);
        } finally {
            if (showLoading) setLoadingMovements(false);
        }
    }, [movementsPage, debouncedMovementsSearch, movementsTypeFilter, movementsDateRangeFilter, movementsUserDeptFilter]);

    const fetchDashboardData = useCallback(async (forceRefresh = false) => {
        const cacheKey = `inventory_dashboard_data_${currentUserId || 'all'}`;
        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setDashboardStats(cached.data.stats || null);
                setDashboardItems(cached.data.items || []);
                setSuppliers(cached.data.suppliers || []);
                if (!cached.isStale) return; // instant 0ms response
            }
        }
        try {
            const [statsRes, itemsRes, suppliersRes] = await Promise.all([
                fetchDashboardStats(),
                fetchInventoryItems({ page: 1, limit: 100 }),
                fetchSuppliers(),
            ]);
            if (statsRes.success && statsRes.data) {
                setDashboardStats(statsRes.data);
            }
            if (itemsRes.success && itemsRes.data?.items) {
                setDashboardItems(itemsRes.data.items);
            }
            if (suppliersRes.success && suppliersRes.data) {
                setSuppliers(suppliersRes.data);
            }
            inventoryCache.set(cacheKey, {
                stats: statsRes.data,
                items: itemsRes.data?.items || [],
                suppliers: suppliersRes.data || [],
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }, [currentUserId]);

    const fetchInventoryData = useCallback(async (showLoading = true, forceRefresh = false) => {
        const cacheKey = JSON.stringify({
            ip: inventoryPage,
            is: debouncedSearchTerm.trim().toLowerCase(),
            ic: categoryFilter,
            ist: statusFilter,
        });
        if (!forceRefresh) {
            const cached = inventoryCache.get<any>(cacheKey);
            if (cached.data) {
                setInventoryItems(cached.data.items || []);
                setTotalInventoryItems(cached.data.totalItems || 0);
                setInventoryTotalPages(cached.data.totalPages || 1);
                setLoadingInventory(false);
                if (!cached.isStale) return; // instant 0ms hit
            }
        }
        if (showLoading) setLoadingInventory(true);
        try {
            const [invRes, supRes] = await Promise.all([
                fetchInventoryItems({
                    page: inventoryPage,
                    limit: itemsPerPage,
                    search: debouncedSearchTerm,
                    category: categoryFilter,
                    status: statusFilter,
                }),
                suppliers.length === 0 ? fetchSuppliers() : Promise.resolve(null),
            ]);
            if (invRes.success && invRes.data) {
                setInventoryItems(invRes.data.items || []);
                setTotalInventoryItems(invRes.data.totalItems || 0);
                setInventoryTotalPages(invRes.data.totalPages || 1);
                inventoryCache.set(cacheKey, invRes.data);
            } else {
                toast.error(invRes.error || 'Failed to load inventory items');
            }
            if (supRes?.success && supRes.data) {
                setSuppliers(supRes.data);
            }
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            toast.error('Failed to load inventory items');
        } finally {
            if (showLoading) setLoadingInventory(false);
        }
    }, [inventoryPage, itemsPerPage, debouncedSearchTerm, categoryFilter, statusFilter, suppliers.length]);

    // Active tab data loading effects
    useEffect(() => {
        if (!isLoaded || activeTab !== 'dashboard') return;
        setLoading(true);
        fetchDashboardData().finally(() => setLoading(false));
    }, [activeTab, isLoaded, fetchDashboardData]);

    useEffect(() => {
        if (!isLoaded || activeTab !== 'inventory') return;
        fetchInventoryData(true).finally(() => setLoading(false));
    }, [activeTab, isLoaded, inventoryPage, debouncedSearchTerm, categoryFilter, statusFilter, fetchInventoryData]);

    useEffect(() => {
        if (!isLoaded || activeTab !== 'requests') return;
        fetchRequestsData(true).finally(() => setLoading(false));
    }, [activeTab, isLoaded, requestsPage, debouncedRequestsSearch, requestsStatusFilter, requestsTypeFilter, fetchRequestsData]);

    useEffect(() => {
        if (!isLoaded || activeTab !== 'movements') return;
        fetchMovementsData(true).finally(() => setLoading(false));
    }, [activeTab, isLoaded, movementsPage, debouncedMovementsSearch, movementsTypeFilter, movementsDateRangeFilter, movementsUserDeptFilter, fetchMovementsData]);

    // Reset inventory page to 1 when filters or search change
    const prevInventoryFiltersRef = useRef({
        search: debouncedSearchTerm,
        category: categoryFilter,
        status: statusFilter,
    });
    useEffect(() => {
        const prev = prevInventoryFiltersRef.current;
        const hasChanged =
            prev.search !== debouncedSearchTerm ||
            prev.category !== categoryFilter ||
            prev.status !== statusFilter;

        if (hasChanged) {
            prevInventoryFiltersRef.current = {
                search: debouncedSearchTerm,
                category: categoryFilter,
                status: statusFilter,
            };
            setInventoryPage(1);
        }
    }, [debouncedSearchTerm, categoryFilter, statusFilter]);

    // Comprehensive Realtime Supabase Subscription:
    // Listens for live changes on purchase_requests, inventory_requests, inventory_items, and inventory
    useEffect(() => {
        const channel = supabase
            .channel('inventory_realtime_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'purchase_requests',
            }, (payload) => {
                inventoryCache.invalidateAll();
                if (payload.eventType === 'INSERT') {
                    const newReq = payload.new as any;
                    const name = newReq?.item_name || (Array.isArray(newReq?.items) && newReq.items[0]?.name) || 'Department Items';
                    const dept = newReq?.department ? ` from ${newReq.department}` : '';
                    toast.info(`New requisition request${dept}: ${name}`, { duration: 4000 });
                }
                fetchRequestsData(false, true);
                fetchDashboardData(true);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'inventory_requests',
            }, (payload) => {
                inventoryCache.invalidateAll();
                if (payload.eventType === 'INSERT') {
                    const newReq = payload.new as any;
                    if (newReq?.item_name) {
                        toast.info(`New inventory request: ${newReq.item_name} (${newReq.quantity_requested || 1} qty)`, { duration: 3500 });
                    }
                }
                fetchRequestsData(false, true);
                fetchDashboardData(true);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'inventory_items',
            }, (payload) => {
                inventoryCache.invalidateAll();
                fetchInventoryData(false, true);
                fetchDashboardData(true);
                // Also refresh requests so stock feasibility updates live
                fetchRequestsData(false, true);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'inventory',
            }, (payload) => {
                inventoryCache.invalidateAll();
                fetchInventoryData(false, true);
                fetchDashboardData(true);
                fetchRequestsData(false, true);
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [fetchRequestsData, fetchInventoryData, fetchDashboardData]);

    // Instant 0ms tab switching without triggering Next.js router full page re-evaluations
    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
        if (tab === 'requests') {
            fetchRequestsData(false, true);
        } else if (tab === 'movements') {
            fetchMovementsData(false, true);
        }
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState(null, '', url.pathname + url.search);
        } catch (e) {
            // ignore
        }
    }, [fetchRequestsData, fetchMovementsData]);

    const handleInventoryPageChange = useCallback((page: number) => {
        if (page >= 1 && page <= inventoryTotalPages && page !== inventoryPage) {
            setInventoryPage(page);
        }
    }, [inventoryTotalPages, inventoryPage]);

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
            fetchInventoryData(true, true),
            fetchMovementsData(false, true)
        ]);
    }, [updateItem, fetchDashboardData, fetchInventoryData, fetchMovementsData]);

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
                fetchInventoryData(true, true),
                fetchMovementsData(false, true)
            ]);
        }
    }, [confirm, deleteItem, fetchDashboardData, fetchInventoryData, fetchMovementsData]);

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
                fetchInventoryData(true, true),
                fetchMovementsData(false, true)
            ]);
        }
    }, [selectedIds, confirm, deleteMultipleItems, fetchDashboardData, fetchInventoryData, fetchMovementsData]);

    const handleStockIn = useCallback(async (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => {
        await stockIn(itemName, quantity, supplier, reference, remarks);
        setShowStockInModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true),
            fetchMovementsData(false, true),
        ]);
    }, [stockIn, fetchDashboardData, fetchInventoryData, fetchMovementsData]);

    const handleStockOut = useCallback(async (itemName: string, quantity: number, department?: string, purpose?: string, remarks?: string) => {
        await stockOut(itemName, quantity, department, purpose, remarks);
        setShowStockOutModal(false);
        inventoryCache.invalidateAll();
        await Promise.all([
            fetchDashboardData(true),
            fetchInventoryData(true, true),
            fetchMovementsData(false, true),
        ]);
    }, [stockOut, fetchDashboardData, fetchInventoryData, fetchMovementsData]);

    const openEditModal = useCallback((item: InventoryItem) => {
        setEditingItem(item);
        setShowEditModal(true);
    }, []);

    const openStockInModal = useCallback((itemName: string, itemObj?: InventoryItem) => {
        setSelectedItemForStock(itemName);
        setSelectedItemObjectForStock(itemObj || inventoryItems.find(i => i.item_name === itemName) || null);
        setShowStockInModal(true);
    }, [inventoryItems]);

    const openScopedPOModal = useCallback((item: any, selectedSupplier?: any) => {
        if (!item) {
            setSelectedRequestForPO(null);
            setShowScopedPOModal(true);
            return;
        }
        const suggestedQty = item.minimum_stock > item.current_stock
            ? item.minimum_stock - item.current_stock
            : (item.quantity_requested || item.quantity || 10);
        const unitPrice = Number(item.purchase_price || item.unit_price || item.price || 0);

        let matchedSupplierId = selectedSupplier?.id ? String(selectedSupplier.id) : '';
        let matchedSupplierName = selectedSupplier?.name || item.supplier || '';
        if (!matchedSupplierId && item.supplier && suppliers.length > 0) {
            const matched = suppliers.find(
                s => s.name?.toLowerCase().trim() === item.supplier?.toLowerCase().trim() ||
                     String(s.id) === String(item.supplier)
            );
            if (matched) {
                matchedSupplierId = String(matched.id);
                matchedSupplierName = matched.name;
            } else if (suppliers.length > 0) {
                matchedSupplierId = String(suppliers[0].id);
                matchedSupplierName = suppliers[0].name;
            }
        } else if (!matchedSupplierId && suppliers.length > 0) {
            matchedSupplierId = String(suppliers[0].id);
            matchedSupplierName = suppliers[0].name;
        }

        const pseudoRequest = {
            id: String(item.id),
            request_number: item.item_code ? `INV-${item.item_code}` : `ITEM-${item.id}`,
            supplier_id: matchedSupplierId,
            supplier_name: matchedSupplierName,
            item_name: item.item_name,
            description: item.item_name,
            category: item.category || 'General',
            amount: unitPrice * suggestedQty,
            allowEditItems: true,
            admin_approval: 'Pending',
            items: [{
                id: item.id,
                name: item.item_name,
                item_name: item.item_name,
                quantity: Math.max(1, suggestedQty),
                unit_price: unitPrice,
                price: unitPrice,
                total: unitPrice * Math.max(1, suggestedQty),
                unit: item.unit || 'units',
                category: item.category || 'General',
            }],
        };

        setSelectedRequestForPO(pseudoRequest);
        setShowScopedPOModal(true);
    }, [suppliers]);

    const handleCreatePurchaseOrder = useCallback(async (orderData: any) => {
        try {
            const sanitizedItems = (orderData.items && orderData.items.length > 0
                ? orderData.items
                : [{
                    name: orderData.notes || "Purchase Order Item",
                    item_name: orderData.notes || "Purchase Order Item",
                    quantity: 1,
                    unit_price: Number(orderData.total_amount) || 0,
                    total: Number(orderData.total_amount) || 0,
                }]
            ).map((item: any) => {
                const itemName = item.item_name || item.name || item.description || "Purchase Order Item";
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unit_price = Number(item.unit_price ?? item.price ?? 0);
                const total = item.total ? Number(item.total) : Number((quantity * unit_price).toFixed(2));
                return {
                    ...item,
                    name: itemName,
                    item_name: itemName,
                    quantity,
                    unit_price,
                    total,
                };
            });

            const initialStatus = orderData.status || 'Draft';
            const subtotal = Number(orderData.subtotal || orderData.total_amount || 0);
            const discount = Number(orderData.discount || 0);
            const shippingFee = Number(orderData.shipping_fee || 0);
            const taxRate = Number(orderData.tax_rate || 0);
            const taxAmount = Number(orderData.tax_amount || 0);

            const { data: insertedPO, error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id || null,
                    supplier_id: orderData.supplier_id,
                    suppliers_qoutation_bid: orderData.suppliers_qoutation_bid || orderData.quotation_id || null,
                    supplier_name: orderData.supplier_name,
                    subtotal: subtotal,
                    discount: discount,
                    shipping_fee: shippingFee,
                    tax_rate: taxRate,
                    tax_amount: taxAmount,
                    total_amount: orderData.total_amount,
                    status: initialStatus,
                    delivery_date: orderData.delivery_date,
                    delivery_location: orderData.delivery_location || "352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)",
                    payment_terms: orderData.payment_terms || "Net 30 Days (Standard B2B)",
                    terms_and_conditions: orderData.terms_and_conditions || "1. All goods supplied are guaranteed brand new and authentic.\n2. Official BIR Invoice and Receipt must be provided upon delivery.\n3. Defective items will be replaced free of charge within 48 hours.",
                    notes: orderData.notes || '',
                    items: sanitizedItems,
                    paid: false,
                    fully_received: false,
                    admin_approval: 'Pending',
                    financial_approval: 'Pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (orderError) throw orderError;

            if (insertedPO) {
                try {
                    await supabase.from('supplier_documents').insert({
                        supplier_id: orderData.supplier_id || 1,
                        supplier: orderData.supplier_name || null,
                        po_number: orderData.po_number || null,
                        document_type: 'Digital Receipt',
                        title: `Digital Receipt - PO #${orderData.po_number}`,
                        file_name: `digital_receipt_${orderData.po_number}.pdf`,
                        storage_path: `documents/digital_receipt_${orderData.po_number}.pdf`,
                        file_type: 'receipt',
                        purchase_id: insertedPO.id,
                        notes: 'Official Digital Receipt generated at PO creation',
                        uploaded_by: user.getName() || 'System',
                    });
                } catch (docErr) {
                    console.warn('Could not record digital receipt document:', docErr);
                }
            }

            toast.success(`Purchase Order ${orderData.po_number} created with Admin Approval marked as Pending!`);
            setShowScopedPOModal(false);
            setSelectedRequestForPO(null);
            inventoryCache.invalidateAll();
            await Promise.all([
                fetchDashboardData(true),
                fetchInventoryData(false, true),
                fetchRequestsData(false, true),
                fetchMovementsData(false, true)
            ]);
        } catch (error: any) {
            console.error('Error creating PO:', error);
            toast.error(error?.message || 'Failed to create Purchase Order');
            throw error;
        }
    }, [fetchDashboardData, fetchInventoryData, fetchRequestsData, fetchMovementsData]);

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

    const handleStockOutClick = useCallback((itemName: string) => {
        setSelectedItemForStock(itemName);
        setShowStockOutModal(true);
    }, []);

    const openAddItemModal = useCallback(() => {
        if (suppliers.length === 0) {
            fetchSuppliers().then(res => {
                if (res.success && res.data) setSuppliers(res.data);
            }).catch(() => {});
        }
        setShowAddModal(true);
    }, [suppliers.length]);

    const criticalItems = useMemo(() => {
        const list = inventoryItems.length > 0 ? inventoryItems : dashboardItems;
        return list.filter(item => {
            const curr = Number(item.current_stock || 0);
            const min = Number(item.minimum_stock || 0);
            return curr <= 0 || (min > 0 && curr <= min);
        });
    }, [inventoryItems, dashboardItems]);

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
                                Manage warehouse supplies, equipment, and departmental inventory requests
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {isPrivileged && selectedIds.size > 0 && (
                            <AppButton type="button" variant="danger" size="md" onClick={handleDeleteMultiple} disabled={deleting}>
                                <i className="fas fa-trash-can text-xs"/>
                                <span>Delete ({selectedIds.size})</span>
                            </AppButton>
                        )}

                        {/* Standardized Departmental Requisition Request */}
                        <AppButton 
                            type="button" 
                            variant="neutral" 
                            size="md" 
                            onClick={() => setShowInternalRequestModal(true)}
                            title="Submit a standardized inventory request for approval"
                        >
                            <i className="fas fa-file-signature text-xs text-pink-500"/>
                            <span>Request Inventory</span>
                        </AppButton>

                        {isPrivileged && (
                            <AppButton type="button" variant="primary" size="md" onClick={openAddItemModal}>
                                <i className="fas fa-plus text-xs"/>
                                <span>Add Item</span>
                            </AppButton>
                        )}
                    </div>
                </div>

                {/* Critical Stock Level Notification Banner */}
                {criticalItems.length > 0 && (
                    <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent dark:from-rose-950/40 dark:via-amber-950/30 border border-rose-200/80 dark:border-rose-900/40 shadow-sm flex items-center justify-between gap-4 flex-wrap animate-in fade-in duration-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
                                <i className="fa-solid fa-triangle-exclamation text-base" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        Critical Stock Level Alert
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white font-mono">
                                        {criticalItems.length} item{criticalItems.length > 1 ? 's' : ''} low / out of stock
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Items are running below minimum safety threshold. Submit an inventory requisition to restock.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={() => handleStatusClick('Low Stock')}
                            >
                                <span>View Low Stock</span>
                            </AppButton>

                            <AppButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => setShowInternalRequestModal(true)}
                            >
                                <i className="fa-solid fa-cart-plus mr-1.5 text-xs" />
                                <span>Request Restock</span>
                            </AppButton>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-fit overflow-x-auto no-scrollbar">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', restricted: isLoaded && !isPrivileged },
                        { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked', restricted: isLoaded && !isPrivileged },
                        { id: 'requests', label: 'Requests', icon: 'fa-dolly-flatbed', badgeCount: requestsStats?.pending || 0, restricted: isLoaded && !isPrivileged },
                        { id: 'movements', label: 'Stock Movements', icon: 'fa-arrow-right-arrow-left', restricted: isLoaded && !isPrivileged },
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
                                {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'bg-amber-500 text-white'}`}>
                                        {tab.badgeCount}
                                    </span>
                                )}
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
                            description="You do not have permission to view the inventory analytics dashboard. This section is restricted to Admin, Purchase Officer, and Executive personnel only."
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
                            description="You do not have permission to view or manage the warehouse inventory catalog. This section is restricted to Admin, Purchase Officer, and Executive personnel only."
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
                            userRole={userRole}
                            suppliers={suppliers}
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
                <div className={activeTab === 'requests' ? 'block animate-in fade-in duration-150' : 'hidden'} role="tabpanel" aria-hidden={activeTab !== 'requests'}>
                    {isLoaded && !isPrivileged ? (
                        <UnauthorizedEmptyState
                            title="Inventory Requests Restricted"
                            description="You do not have permission to view or manage inventory requisitions. This section is restricted to Admin, Purchase Officer, and Executive personnel only."
                            currentRole={userRole}
                        />
                    ) : (
                        <RequestsTab
                            requests={requests}
                            inventoryItems={inventoryItems}
                            totalRequests={totalRequests}
                            currentPage={requestsPage}
                            totalPages={requestsTotalPages}
                            stats={requestsStats}
                            isLoading={loading || loadingRequests}
                            userRole={userRole}
                            searchTerm={requestsSearchTerm}
                            statusFilter={requestsStatusFilter}
                            typeFilter={requestsTypeFilter}
                            onSearchChange={(val) => {
                                setRequestsSearchTerm(val);
                                setRequestsPage(1);
                            }}
                            onStatusChange={(val) => {
                                setRequestsStatusFilter(val);
                                setRequestsPage(1);
                            }}
                            onTypeChange={(val) => {
                                setRequestsTypeFilter(val);
                                setRequestsPage(1);
                            }}
                            onPageChange={setRequestsPage}
                            onOpenInternalRequestModal={() => setShowInternalRequestModal(true)}
                            suppliers={suppliers}
                            onOpenPOModal={(item, selectedSupplier) => {
                                openScopedPOModal(item, selectedSupplier);
                            }}
                            onRefresh={() => {
                                inventoryCache.invalidateAll();
                                fetchRequestsData(false, true);
                                fetchInventoryData(false, true);
                                fetchDashboardData(true);
                                fetchMovementsData(false, true);
                            }}
                        />
                    )}
                </div>

                {/* Stock Movements Tab Panel */}
                <div className={activeTab === 'movements' ? 'block animate-in fade-in duration-150' : 'hidden'} role="tabpanel" aria-hidden={activeTab !== 'movements'}>
                    {isLoaded && !isPrivileged ? (
                        <UnauthorizedEmptyState
                            title="Stock Movements Restricted"
                            description="You do not have permission to view stock movement audit logs. This section is restricted to Admin, Purchase Officer, and Executive personnel only."
                            currentRole={userRole}
                        />
                    ) : (
                        <StockMovementsTab
                            movements={movements}
                            totalMovements={totalMovements}
                            currentPage={movementsPage}
                            totalPages={movementsTotalPages}
                            stats={movementsStats}
                            isLoading={loadingMovements}
                            searchTerm={movementsSearchTerm}
                            typeFilter={movementsTypeFilter}
                            dateRangeFilter={movementsDateRangeFilter}
                            userDeptFilter={movementsUserDeptFilter}
                            userDeptOptions={movementsUserDeptOptions}
                            onSearchChange={(val) => {
                                setMovementsSearchTerm(val);
                                setMovementsPage(1);
                            }}
                            onTypeChange={(val) => {
                                setMovementsTypeFilter(val);
                                setMovementsPage(1);
                            }}
                            onDateRangeChange={(val) => {
                                setMovementsDateRangeFilter(val);
                                setMovementsPage(1);
                            }}
                            onUserDeptChange={(val) => {
                                setMovementsUserDeptFilter(val);
                                setMovementsPage(1);
                            }}
                            onClearFilters={() => {
                                setMovementsSearchTerm('');
                                setMovementsTypeFilter('all');
                                setMovementsDateRangeFilter('all');
                                setMovementsUserDeptFilter('all');
                                setMovementsPage(1);
                            }}
                            onPageChange={setMovementsPage}
                            onRefresh={() => fetchMovementsData(true, true)}
                        />
                    )}
                </div>
            </div>

            <AddItemModal 
                isOpen={showAddModal} 
                onClose={() => setShowAddModal(false)} 
                onSave={handleAddItem} 
                suppliers={suppliers.filter((s: any) => s && s.is_active !== false && s.is_active !== 0 && s.is_active !== 'false')} 
                loading={saving}
            />

            {editingItem && (
                <EditItemModal 
                    isOpen={showEditModal} 
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingItem(null);
                    }} 
                    onSave={handleUpdateItem} 
                    item={editingItem} 
                    suppliers={suppliers.filter((s: any) => s && s.is_active !== false && s.is_active !== 0 && s.is_active !== 'false')} 
                    loading={saving}
                />
            )}

            <StockInModal isOpen={showStockInModal} onClose={() => {
                setShowStockInModal(false);
                setSelectedItemForStock('');
                setSelectedItemObjectForStock(null);
            }} onStockIn={handleStockIn} onSuccess={() => {
                fetchDashboardData(true);
                fetchInventoryData(false, true);
                fetchRequestsData(false, true);
                fetchMovementsData(false, true);
            }} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} targetItem={selectedItemObjectForStock} loading={saving}/>

            <PurchaseOrderModal 
                isOpen={showScopedPOModal} 
                onClose={() => {
                    setShowScopedPOModal(false);
                    setSelectedRequestForPO(null);
                }} 
                request={selectedRequestForPO} 
                suppliers={suppliers.filter((s: any) => s && s.is_active !== false && s.is_active !== 0 && s.is_active !== 'false')} 
                defaultAdminApproval="Pending"
                onOrderCreated={handleCreatePurchaseOrder}
            />

            <PurchaseRequestDetailModal
                isOpen={showPRDetailModal}
                onClose={() => {
                    setShowPRDetailModal(false);
                    setViewingPRId(null);
                }}
                requestId={viewingPRId}
                userRole={userRole}
                onSuccess={() => {
                    fetchDashboardData(true);
                    fetchInventoryData(false, true);
                    fetchRequestsData(false, true);
                }}
            />

            <StockOutModal isOpen={showStockOutModal} onClose={() => {
                setShowStockOutModal(false);
                setSelectedItemForStock('');
            }} onStockOut={handleStockOut} inventoryItems={inventoryItems} preSelectedItem={selectedItemForStock} loading={saving}/>

            <InternalRequestModal
                isOpen={showInternalRequestModal}
                onClose={() => setShowInternalRequestModal(false)}
                inventoryItems={inventoryItems}
                onSuccess={() => {
                    fetchRequestsData(false, true);
                    fetchInventoryData(false, true);
                    fetchDashboardData(true);
                }}
            />
        </div>
    );
}
