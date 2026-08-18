// app/(supplyChain)/(pages)/purchase-orders/page.tsx

"use client";

// ============================================================
// 1. IMPORTS
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import Chart from "chart.js/auto";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { sanitizeText, sanitizeNumber } from "@/app/(supplyChain)/components/global/sanitize";
import { PageSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import { TableContentLoader } from "@/app/(supplyChain)/components/global/Loader";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { PurchaseOrderModal } from "@/app/(supplyChain)/components/modals/PurchaseOrderModal";
import { ApprovedRequestsModal } from "@/app/(supplyChain)/components/modals/ApprovedRequestsModal";
import { PurchaseRequestModal } from "@/app/(supplyChain)/components/modals/PurchaseRequestModal";
import { ChartDetailModal } from "@/app/(supplyChain)/components/modals/ChartDetailModal";
import { createPurchaseRequest } from "@/app/(supplyChain)/(pages)/procurement/utils/procurementApi";

// ============================================================
// 2. TYPES & INTERFACES
// ============================================================
interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string;
    notes: string;
    items: any[];
    paid: boolean;
    created_at?: string;
    updated_at?: string;
}

interface Supplier {
    id: string;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string | null;
    notes: string | null;
    is_active: boolean;
}

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;

const getPOStatusColor = (status: string) => {
    switch (status) {
        case 'Draft': return 'bg-slate-100 text-slate-600';
        case 'Sent': return 'bg-blue-100 text-blue-600';
        case 'Confirmed': return 'bg-emerald-100 text-emerald-600';
        case 'Delivered': return 'bg-pink-100 text-pink-600';
        case 'Cancelled': return 'bg-red-100 text-red-600';
        default: return 'bg-slate-100 text-slate-600';
    }
};

const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case 'Draft': return 'bg-slate-50 text-slate-700 border-slate-200';
        case 'Sent': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'Confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Delivered': return 'bg-pink-50 text-pink-700 border-pink-200';
        case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
};

const getStatusDotColor = (status: string) => {
    switch (status) {
        case 'Draft': return 'bg-slate-400';
        case 'Sent': return 'bg-blue-500';
        case 'Confirmed': return 'bg-emerald-500';
        case 'Delivered': return 'bg-pink-500';
        case 'Cancelled': return 'bg-red-500';
        default: return 'bg-slate-400';
    }
};

// ============================================================
// 4. EMPTY STATE COMPONENT
// ============================================================
function EmptyState({
    title,
    description,
    icon = "fas fa-file-invoice",
    actionText,
    onAction
}: {
    title: string;
    description: string;
    icon?: string;
    actionText?: string;
    onAction?: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-400 mb-4 shadow-xs dark:shadow-black/40 transition-transform duration-300 hover:scale-105">
                <i className={`${icon} text-3xl text-slate-400 dark:text-slate-400`} />
            </div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2 text-center">
                {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
                {description}
            </p>

            {actionText && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2.5 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/50 border border-pink-200/60 dark:border-pink-800/40 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-2xs dark:shadow-pink-950/30"
                >
                    <i className="fas fa-plus text-xs" />
                    <span>{actionText}</span>
                </button>
            )}
        </div>
    );
}

// ============================================================
// 5. MAIN PURCHASE ORDERS COMPONENT
// ============================================================
export default function PurchaseOrders() {
    const { confirm } = useConfirm();
    const poChartRef = useRef<HTMLCanvasElement>(null);
    const poChartInstance = useRef<Chart | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const hasLoadedOnceRef = useRef(false);
    const [pendingRowId, setPendingRowId] = useState<string | null>(null);

    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [totalItems, setTotalItems] = useState(0);

    const [activeStatusFilter, setActiveStatusFilter] = useState<string>("all");
    const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false);
    const [isApprovedRequestsModalOpen, setIsApprovedRequestsModalOpen] = useState(false);
    const [isPurchaseRequestModalOpen, setIsPurchaseRequestModalOpen] = useState(false);
    const [selectedRequestForPO, setSelectedRequestForPO] = useState<any>(null);

    const [chartDetailModal, setChartDetailModal] = useState<{
        isOpen: boolean;
        month: string;
        monthIndex: number;
        orders: PurchaseOrder[];
        totalAmount: number;
    }>({
        isOpen: false,
        month: '',
        monthIndex: -1,
        orders: [],
        totalAmount: 0,
    });

    const userRole = "admin";

    const scrollToTable = useCallback(() => {
        if (tableContainerRef.current) {
            const targetElement = document.getElementById(tableContainerRef.current.id);
            if (targetElement) {
                const offset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                window.scrollTo({
                    top: elementPosition + window.pageYOffset - offset,
                    behavior: 'smooth'
                });
            }
        }
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setItemsPerPage(10);
            } else {
                setItemsPerPage(15);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ============================================================
    // FETCH DATA
    // ============================================================
    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;

        try {
            if (!silent && !hasLoadedOnceRef.current) {
                setLoading(true);
            } else if (!silent) {
                setIsRefreshing(true);
            }

            // Build query
            let query = supabase
                .from('purchase_orders')
                .select('*', { count: 'exact' });

            // Apply status filter
            if (activeStatusFilter !== 'all') {
                query = query.eq('status', activeStatusFilter);
            }

            // Apply search filter
            if (debouncedSearch) {
                query = query.or(
                    `po_number.ilike.%${debouncedSearch}%,` +
                    `supplier_name.ilike.%${debouncedSearch}%`
                );
            }

            // Get total count
            const { count: totalCount, error: countError } = await query;
            if (countError) throw countError;

            // Apply pagination
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            let ordersQuery = query.range(from, to).order('created_at', { ascending: false });
            const { data: orders, error: ordersError } = await ordersQuery;

            if (ordersError) {
                if (ordersError.code === 'PGRST103') {
                    setPurchaseOrders([]);
                    setTotalItems(totalCount || 0);
                    return;
                }
                throw ordersError;
            }

            setPurchaseOrders(orders || []);
            setTotalItems(totalCount || 0);

            // Fetch suppliers
            const { data: suppliersData, error: suppliersError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (!suppliersError) {
                setSuppliers(suppliersData || []);
            }

        } catch (error) {
            console.error('Error fetching purchase orders:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            hasLoadedOnceRef.current = true;
            if (!silent) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [currentPage, itemsPerPage, debouncedSearch, activeStatusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Realtime subscriptions
    useEffect(() => {
        const ordersSubscription = supabase
            .channel('purchase_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
                fetchData({ silent: true });
            })
            .subscribe();

        return () => {
            ordersSubscription.unsubscribe();
        };
    }, [fetchData]);

    // ============================================================
    // CRUD OPERATIONS
    // ============================================================
    const handleOrderCreated = useCallback(async (orderData: any) => {
        try {
            if (orderData.request_id) {
                const { error: reqError } = await supabase
                    .from('purchase_requests')
                    .update({ status: "Approved", updated_at: new Date().toISOString() })
                    .eq('id', orderData.request_id);

                if (reqError) {
                    console.warn("Could not update purchase request status:", reqError);
                }
            }

            const { error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id,
                    supplier_id: orderData.supplier_id,
                    supplier_name: orderData.supplier_name,
                    total_amount: orderData.total_amount,
                    status: orderData.status || 'Draft',
                    delivery_date: orderData.delivery_date,
                    notes: orderData.notes || '',
                    items: orderData.items || [],
                    paid: false,
                });

            if (orderError) throw orderError;

            setPurchaseOrders(prev => [{
                ...orderData,
                id: Date.now().toString(),
                paid: false,
                status: orderData.status || 'Draft',
            }, ...prev]);

            setTotalItems(prev => prev + 1);
            toast.success("Purchase Order created successfully!");
            setIsPurchaseOrderModalOpen(false);
            setSelectedRequestForPO(null);
        } catch (error) {
            console.error('Error creating purchase order:', error);
            toast.error('Failed to create purchase order');
        }
    }, []);

    const handleRequestSubmitted = async (newRequest: any) => {
        try {
            const createPayload = {
                type: newRequest.type || "New Request",
                description: newRequest.description || "",
                requested_by: newRequest.requested_by,
                department: newRequest.department || "Fleet",
                supplier_id: newRequest.supplier_id,
                supplier_name: newRequest.supplier_name,
                amount: newRequest.amount || 0,
                priority: newRequest.priority || "Normal",
                status: newRequest.status || "Pending",
                date: newRequest.date || new Date().toISOString().split("T")[0],
                items: newRequest.items || [],
                reason: newRequest.reason,
            };

            await createPurchaseRequest(createPayload);
            toast.success("Purchase request submitted successfully!");
            setIsPurchaseRequestModalOpen(false);
        } catch (error) {
            console.error('Error submitting purchase request:', error);
            toast.error('Failed to submit purchase request');
        }
    };

    const handleDeleteOrder = async (id: string) => {
        const confirmed = await confirm({
            title: "Delete Purchase Order",
            message: "Are you sure you want to delete this purchase order? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.filter(po => po.id !== id));
            setTotalItems(prev => prev - 1);
            toast.success("Purchase order deleted successfully");
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            toast.error('Failed to delete purchase order');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ 
                    status: newStatus, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(po =>
                po.id === id ? { ...po, status: newStatus } : po
            ));

            toast.success(`PO status updated to ${newStatus}`);
        } catch (error) {
            console.error('Error updating PO status:', error);
            toast.error('Failed to update PO status');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleTogglePaid = async (id: string, currentPaid: boolean) => {
        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ 
                    paid: !currentPaid, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(po =>
                po.id === id ? { ...po, paid: !currentPaid } : po
            ));

            toast.success(`Payment status updated`);
        } catch (error) {
            console.error('Error updating payment status:', error);
            toast.error('Failed to update payment status');
        } finally {
            setPendingRowId(null);
        }
    };

    // ============================================================
    // CHARTS
    // ============================================================
    useEffect(() => {
        if (loading) return;

        const createChart = () => {
            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }

            if (poChartRef.current && Chart && purchaseOrders.length > 0) {
                const statusData: Record<string, number> = {};
                const statusOrders: Record<string, PurchaseOrder[]> = {
                    'Draft': [],
                    'Sent': [],
                    'Confirmed': [],
                    'Delivered': [],
                    'Cancelled': []
                };

                purchaseOrders.forEach(order => {
                    statusData[order.status] = (statusData[order.status] || 0) + 1;
                    if (statusOrders[order.status]) {
                        statusOrders[order.status].push(order);
                    }
                });

                // Ensure all statuses are represented
                const allStatuses = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'];
                allStatuses.forEach(status => {
                    if (!statusData[status]) statusData[status] = 0;
                });

                const colors: Record<string, string> = {
                    'Draft': '#94A3B8',
                    'Sent': '#3B82F6',
                    'Confirmed': '#22C55E',
                    'Delivered': '#EC4899',
                    'Cancelled': '#EF4444',
                };

                const sortedLabels = allStatuses;
                const sortedData = sortedLabels.map(label => statusData[label] || 0);

                poChartInstance.current = new Chart(poChartRef.current, {
                    type: "bar",
                    data: {
                        labels: sortedLabels,
                        datasets: [{
                            label: "Purchase Orders",
                            data: sortedData,
                            backgroundColor: sortedLabels.map(label => colors[label] || '#94A3B8'),
                            borderRadius: 6,
                            borderSkipped: false,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (event: any, elements: any) => {
                            if (elements.length > 0) {
                                const element = elements[0];
                                const statusIndex = element.index;
                                const statusLabel = sortedLabels[statusIndex];
                                const orders = statusOrders[statusLabel] || [];
                                const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

                                if (orders.length > 0) {
                                    setChartDetailModal({
                                        isOpen: true,
                                        month: `${statusLabel} Status`,
                                        monthIndex: statusIndex,
                                        orders: orders,
                                        totalAmount: totalAmount,
                                    });
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false,
                            },
                            tooltip: {
                                backgroundColor: "rgba(15,23,42,0.9)",
                                titleColor: "#fff",
                                bodyColor: "#e2e8f0",
                                borderColor: "#EC4899",
                                borderWidth: 1,
                                padding: 12,
                                callbacks: {
                                    label: (context: any) => {
                                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                        const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                                        return [
                                            ` ${context.parsed.y} orders (${percentage}%)`,
                                            ` 💡 Click to view orders`
                                        ];
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { font: { size: 10 } },
                            },
                            y: {
                                grid: { color: "#F1F5F9" },
                                beginAtZero: true,
                                ticks: { stepSize: 1 },
                            },
                        },
                    },
                });
            }
        };

        const timer = setTimeout(createChart, 100);
        return () => {
            clearTimeout(timer);
            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }
        };
    }, [purchaseOrders, loading]);

    // ============================================================
    // FILTERING & PAGINATION
    // ============================================================
    const filteredOrders = purchaseOrders.filter((order) => {
        const matchesStatus = activeStatusFilter === 'all' || order.status === activeStatusFilter;
        const matchesSearch = (order.po_number || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (order.supplier_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            setTimeout(scrollToTable, 100);
        }
    };

    // Calculate stats
    const totalOrders = purchaseOrders.length;
    const pendingConfirmation = purchaseOrders.filter(o => o.status === 'Sent' || o.status === 'Draft').length;
    const inTransit = purchaseOrders.filter(o => o.status === 'Confirmed').length;
    const completed = purchaseOrders.filter(o => o.status === 'Delivered').length;
    const totalSpend = purchaseOrders
        .filter(o => o.paid === true)
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // ============================================================
    // HANDLE CREATE PO FROM APPROVED REQUEST
    // ============================================================
    const handleOpenApprovedRequests = () => {
        setIsApprovedRequestsModalOpen(true);
    };

    const handleSelectRequestForPO = (req: any) => {
        setSelectedRequestForPO(req);
        setIsApprovedRequestsModalOpen(false);
        setIsPurchaseOrderModalOpen(true);
    };

    if (loading) return <PageSkeleton />;

    return (
        <SessionGuard requiredRole={['Admin', 'Employee']}>
            <div className="p-6 space-y-6 fade-in bgCard">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 transition-colors">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-800/40 flex items-center justify-center text-pink-600 dark:text-pink-400 text-xl shadow-2xs shrink-0 mt-0.5 transition-colors">
                            <i className="fas fa-file-invoice" />
                        </div>

                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
                                Purchase Orders
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                                Manage approved purchase orders, supplier orders, and delivery tracking.
                            </p>

                            <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                                <i className="fas fa-user-tag text-[11px] text-slate-400 dark:text-slate-500" />
                                <span>Role:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        <button
                            type="button"
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-2xs hover:shadow-xs active:scale-[0.98] shrink-0 cursor-pointer"
                            onClick={() => setIsPurchaseRequestModalOpen(true)}
                        >
                            <i className="fas fa-plus text-pink-500 dark:text-pink-400 text-xs" />
                            <span>Make Purchase Request</span>
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-xs hover:shadow-pink-500/25 active:scale-[0.98] shrink-0 cursor-pointer"
                            onClick={handleOpenApprovedRequests}
                        >
                            <i className="fas fa-clipboard-check text-xs" />
                            <span>Create PO from Request</span>
                        </button>
                    </div>
                </div>

                {/* AI Suggested Questions */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                            <i className="fas fa-robot text-pink-500 mr-2" /> AI Suggested Questions
                        </span>
                        <span className="text-xs text-slate-400">
                            <i className="fas fa-mouse-pointer mr-1" /> Click to ask
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {[
                            {
                                label: 'PO summary',
                                color: 'bg-pink-400',
                                action: () => toast.info(`AI: PO Summary...\n\nTotal POs: ${totalOrders}\nPending: ${pendingConfirmation}\nIn Transit: ${inTransit}\nCompleted: ${completed}\nTotal Spend: ₱${totalSpend.toLocaleString()}`)
                            },
                            {
                                label: 'Top suppliers?',
                                color: 'bg-amber-400',
                                action: () => {
                                    const supplierData: Record<string, number> = {};
                                    purchaseOrders.forEach(order => {
                                        supplierData[order.supplier_name] = (supplierData[order.supplier_name] || 0) + (order.total_amount || 0);
                                    });
                                    const sorted = Object.entries(supplierData)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 3)
                                        .map(([key, value]) => `${key}: ₱${value.toLocaleString()}`)
                                        .join('\n');
                                    toast.info(`AI: Top suppliers by spend...\n\n${sorted || 'No data available'}`);
                                }
                            },
                            {
                                label: 'Delayed orders?',
                                color: 'bg-blue-400',
                                action: () => {
                                    const today = new Date();
                                    const delayed = purchaseOrders.filter(o => {
                                        if (!o.delivery_date) return false;
                                        const deliveryDate = new Date(o.delivery_date);
                                        return deliveryDate < today && o.status !== 'Delivered' && o.status !== 'Cancelled';
                                    });
                                    toast.info(`AI: Delayed orders...\n\n${delayed.map(o => `${o.po_number} - ${o.supplier_name} (${o.status})`).join('\n') || 'No delayed orders'}`);
                                }
                            },
                            {
                                label: 'Payment status?',
                                color: 'bg-emerald-400',
                                action: () => {
                                    const paid = purchaseOrders.filter(o => o.paid).length;
                                    const unpaid = purchaseOrders.filter(o => !o.paid).length;
                                    toast.info(`AI: Payment status...\n\nPaid: ${paid}\nUnpaid: ${unpaid}\nTotal: ${purchaseOrders.length}`);
                                }
                            }
                        ].map((item, index) => (
                            <button
                                key={index}
                                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-pink-200 hover:bg-pink-50 transition text-left"
                                onClick={item.action}
                            >
                                <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                                <span className="text-xs text-slate-700">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-file-invoice"
                        header="Total POs"
                        data={String(totalOrders)}
                        arrow="fa-solid fa-arrow-up"
                        description="All orders"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Overview"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Purchase Orders: ${totalOrders}\nPending: ${pendingConfirmation}\nCompleted: ${completed}`}
                        tooltip="View all POs"
                        tooltipLink="/purchase-orders"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-clock"
                        header="Pending"
                        data={String(pendingConfirmation)}
                        arrow="fa-solid fa-hourglass-half"
                        description="Awaiting confirmation"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Pending Orders"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Pending: ${pendingConfirmation}\n${pendingConfirmation > 0 ? 'Awaiting supplier confirmation' : 'No pending orders'}`}
                        tooltip="View pending orders"
                        tooltipLink="/purchase-orders?status=Sent"
                        badge={pendingConfirmation > 0 ? `${pendingConfirmation} waiting` : undefined}
                        frontTextColor="text-amber-500 dark:text-amber-400"
                        descriptionTextColor="text-amber-600 dark:text-amber-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-truck"
                        header="In Transit"
                        data={String(inTransit)}
                        arrow="fa-solid fa-arrow-right"
                        description="On the way"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="In Transit"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`In Transit: ${inTransit}\n${inTransit > 0 ? 'Orders currently being delivered' : 'No orders in transit'}`}
                        tooltip="View in transit orders"
                        tooltipLink="/purchase-orders?status=Confirmed"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-circle-check"
                        header="Completed"
                        data={String(completed)}
                        arrow="fa-solid fa-check-double"
                        description="Delivered"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Completed"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Completed: ${completed}\n${completed > 0 ? 'Orders successfully delivered' : 'No completed orders'}`}
                        tooltip="View completed orders"
                        tooltipLink="/purchase-orders?status=Delivered"
                        frontTextColor="text-emerald-500 dark:text-emerald-400"
                        descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-coins"
                        header="Total Spend"
                        data={`₱${totalSpend.toLocaleString()}`}
                        arrow="fa-solid fa-chart-line"
                        description="Paid orders"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Financial Summary"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Spend: ₱${totalSpend.toLocaleString()}\n${purchaseOrders.filter(o => o.paid).length} paid orders\n${totalSpend > 0 ? 'Tracking procurement costs' : 'No paid orders yet'}`}
                        tooltip="View financial details"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />
                </div>

                {/* Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center">
                                <i className="fas fa-chart-bar mr-2 text-pink-500 dark:text-pink-400" /> PO Status Distribution
                                <div className="relative ml-2 group">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold cursor-help hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                                        !
                                    </span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 dark:bg-slate-800 text-slate-200 dark:text-slate-300 text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                        <p className="font-semibold text-white mb-1">📊 Chart Info</p>
                                        <p>Distribution of purchase orders categorized by current status.</p>
                                        <p className="mt-1 text-slate-400 text-[10px]">💡 Click on any status bar to view detailed orders.</p>
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 dark:bg-slate-800"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                                <i className="fas fa-hand-pointer mr-1 text-slate-400 dark:text-slate-500 text-[10px]" /> Click bar for details
                            </div>
                        </div>
                        <div className="w-full h-[200px] mt-3 relative">
                            {purchaseOrders.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800">
                                    <i className="fas fa-chart-bar text-3xl mb-2 opacity-30" />
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No purchase order data</p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Create purchase orders to see status analytics</p>
                                </div>
                            ) : (
                                <canvas ref={poChartRef} className="w-full h-full cursor-pointer" />
                            )}
                        </div>
                    </div>

                    {/* Recent Activity / Timeline */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center">
                            <i className="fas fa-clock mr-2 text-pink-500 dark:text-pink-400" /> Recent Activity
                        </div>
                        <div className="mt-3 space-y-3 max-h-[200px] overflow-y-auto">
                            {purchaseOrders.slice(0, 5).map((order) => (
                                <div key={order.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(order.status)} block`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {order.po_number}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${getStatusBadgeColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                            {order.paid && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                                                    Paid
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {order.supplier_name}
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-slate-900 dark:text-white shrink-0">
                                        ₱{order.total_amount.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                            {purchaseOrders.length === 0 && (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                                    <i className="fas fa-inbox text-2xl mb-2 block" />
                                    <p className="text-sm">No purchase orders yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div
                    ref={tableContainerRef}
                    id="purchase-orders-table"
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden relative flex flex-col"
                >
                    {isRefreshing && <TableContentLoader />}

                    {/* Filter Bar */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/60 backdrop-blur-xl transition-all">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm mr-2 flex items-center gap-2">
                                <i className="fas fa-list text-pink-500 dark:text-pink-400" />
                                <span>Purchase Orders</span>
                                {isRefreshing && (
                                    <i className="fas fa-circle-notch fa-spin text-pink-400 text-xs" title="Refreshing..." />
                                )}
                            </div>

                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                                <input
                                    className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 pl-8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-500/30 transition-all shadow-2xs"
                                    placeholder="Search by PO # or supplier..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/70 p-1 rounded-xl border border-transparent dark:border-white/5">
                                {[
                                    { key: "all", label: "All", count: totalOrders },
                                    { key: "Draft", label: "Draft", count: purchaseOrders.filter(o => o.status === 'Draft').length },
                                    { key: "Sent", label: "Sent", count: purchaseOrders.filter(o => o.status === 'Sent').length },
                                    { key: "Confirmed", label: "Confirmed", count: purchaseOrders.filter(o => o.status === 'Confirmed').length },
                                    { key: "Delivered", label: "Delivered", count: purchaseOrders.filter(o => o.status === 'Delivered').length },
                                    { key: "Cancelled", label: "Cancelled", count: purchaseOrders.filter(o => o.status === 'Cancelled').length },
                                ].map((tab) => {
                                    const isActive = activeStatusFilter === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isActive
                                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs dark:shadow-black/20"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/40"
                                                }`}
                                            onClick={() => {
                                                setActiveStatusFilter(tab.key);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <span>{tab.label}</span>
                                            <span
                                                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${isActive
                                                    ? "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100"
                                                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                    }`}
                                            >
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 overflow-y-auto max-h-[500px] relative">
                        <div className="transition-opacity duration-200">
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                <table className="table-pro w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">PO #</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Supplier</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Items</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Amount</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Delivery Date</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Payment</th>
                                            <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {filteredOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12">
                                                    <EmptyState
                                                        title="No purchase orders found"
                                                        description={
                                                             activeStatusFilter !== 'all'
                                                                 ? `There are no orders with status "${activeStatusFilter}".`
                                                                 : "Select an approved purchase request to generate a purchase order."
                                                         }
                                                        icon="fas fa-file-invoice"
                                                        actionText="Create PO from Request"
                                                        onAction={handleOpenApprovedRequests}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.map((order) => {
                                                const rowBusy = pendingRowId === order.id;
                                                const statusOptions = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'];

                                                return (
                                                    <tr
                                                        key={order.id}
                                                        className={`group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${rowBusy ? "opacity-50 pointer-events-none" : "bg-transparent"}`}
                                                    >
                                                        <td data-label="PO #" className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                            {order.po_number}
                                                        </td>
                                                        <td data-label="Supplier" className="py-3.5 px-4">
                                                            <div className="font-medium text-slate-800 dark:text-slate-200">
                                                                {order.supplier_name}
                                                            </div>
                                                        </td>
                                                        <td data-label="Items" className="py-3.5 px-4">
                                                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px] block" title={order.items?.length ? order.items.map((i: any) => i.name).join(', ') : ''}>
                                                                {order.items?.length ? order.items.map((i: any) => i.name).join(', ') : 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td data-label="Amount" className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                                                            ₱{order.total_amount.toLocaleString()}
                                                        </td>
                                                        <td data-label="Delivery Date" className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                            {order.delivery_date || 'TBD'}
                                                        </td>
                                                        <td data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeColor(order.status)}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(order.status)}`} />
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td data-label="Payment" className="py-3.5 px-4 whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleTogglePaid(order.id, order.paid)}
                                                                disabled={rowBusy}
                                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${order.paid
                                                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                                    }`}
                                                            >
                                                                {order.paid ? '✅ Paid' : '⏳ Unpaid'}
                                                            </button>
                                                        </td>
                                                        <td data-label="Actions" className="py-3.5 px-4 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {rowBusy && (
                                                                    <svg className="w-4 h-4 animate-spin text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                    </svg>
                                                                )}

                                                                {/* Status Update Dropdown */}
                                                                <div className="relative group">
                                                                    <button
                                                                        type="button"
                                                                        disabled={rowBusy}
                                                                        className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
                                                                        title="Update Status"
                                                                    >
                                                                        <i className="fas fa-pen text-[10px]" />
                                                                    </button>
                                                                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[140px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                                                        {statusOptions.map((status) => (
                                                                            <button
                                                                                key={status}
                                                                                type="button"
                                                                                onClick={() => handleUpdateStatus(order.id, status)}
                                                                                disabled={rowBusy || status === order.status}
                                                                                className="w-full px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                            >
                                                                                <span className={`w-2 h-2 rounded-full ${getStatusDotColor(status)}`} />
                                                                                <span>{status}</span>
                                                                                {status === order.status && (
                                                                                    <i className="fas fa-check text-emerald-500 ml-auto" />
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Delete Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteOrder(order.id)}
                                                                    disabled={rowBusy}
                                                                    className="px-2 py-1 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
                                                                    title="Delete PO"
                                                                >
                                                                    <i className="fas fa-trash text-[10px]" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                Showing <span className="font-semibold text-slate-800 dark:text-white">
                                    {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                                </span> to{' '}
                                <span className="font-semibold text-slate-800 dark:text-white">
                                    {Math.min(currentPage * itemsPerPage, totalItems)}
                                </span> of{' '}
                                <span className="font-semibold text-slate-800 dark:text-white">{totalItems}</span> orders
                            </span>
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                </div>

                {/* Approved Requests Selection Modal */}
                <ApprovedRequestsModal
                    isOpen={isApprovedRequestsModalOpen}
                    onClose={() => setIsApprovedRequestsModalOpen(false)}
                    onSelectRequest={handleSelectRequestForPO}
                />

                {/* Purchase Order Modal - Shared modal with Procurement */}
                <PurchaseOrderModal
                    isOpen={isPurchaseOrderModalOpen}
                    onClose={() => {
                        setIsPurchaseOrderModalOpen(false);
                        setSelectedRequestForPO(null);
                    }}
                    request={selectedRequestForPO}
                    suppliers={suppliers}
                    onOrderCreated={handleOrderCreated}
                />

                {/* Make Purchase Request Modal */}
                <PurchaseRequestModal
                    isOpen={isPurchaseRequestModalOpen}
                    onClose={() => setIsPurchaseRequestModalOpen(false)}
                    suppliers={suppliers}
                    role={userRole}
                    onRequestSubmitted={handleRequestSubmitted}
                />

                {/* Chart Detail Modal */}
                <ChartDetailModal
                    isOpen={chartDetailModal.isOpen}
                    onClose={() => setChartDetailModal(prev => ({ ...prev, isOpen: false }))}
                    month={chartDetailModal.month}
                    monthIndex={chartDetailModal.monthIndex}
                    orders={chartDetailModal.orders}
                    totalAmount={chartDetailModal.totalAmount}
                />
            </div>
        </SessionGuard>
    );
}