// app/(supplyChain)/procurement/page.tsx

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Chart from "chart.js/auto";
import { toast } from "sonner";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { sanitizeText, sanitizeNumber } from "@/app/(supplyChain)/components/global/sanitize";
import { CardsSkeleton, ChartsSkeleton, TableSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import { TableContentLoader } from "@/app/(supplyChain)/components/global/Loader";
import {
    Supplier,
    PurchaseOrder,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseRequestModalProps,
    PurchaseOrderModalProps,
    ChartDetailModalProps
} from "./types/index";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge, getPOStatusTone } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { FileText, Check, X } from "lucide-react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import {
    fetchProcurementData,
    createPurchaseRequest,
    updatePurchaseRequest,
    deletePurchaseRequest,
    deleteMultiplePurchaseRequests,
    patchPurchaseRequest
} from '@/app/(supplyChain)/(pages)/procurement/utils/procurementApi';
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import { user } from "../../lib/services/Class/user";
import Link from "next/link";


const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'Critical': return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/50 shadow-2xs font-semibold';
        case 'Urgent': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50 shadow-2xs font-semibold';
        default: return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs font-semibold';
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50 shadow-2xs font-semibold';
        case 'Approved': return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs font-semibold';
        case 'Rejected': return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/50 shadow-2xs font-semibold';
        case 'Completed': return 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs font-semibold';
        default: return 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs font-semibold';
    }
};

const getPOStatusColor = (status: string) => {
    switch (status) {
        case 'Draft': return 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs font-semibold';
        case 'Sent': return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs font-semibold';
        case 'Confirmed': return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs font-semibold';
        case 'Delivered': return 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs font-semibold';
        default: return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/50 shadow-2xs font-semibold';
    }
};

import { PurchaseRequestModal } from "@/app/(supplyChain)/components/modals/PurchaseRequestModal";
import { PurchaseOrderModal } from "@/app/(supplyChain)/components/modals/PurchaseOrderModal";
import { ChartDetailModal } from "@/app/(supplyChain)/components/modals/ChartDetailModal";

// re-export modals
export { PurchaseRequestModal, PurchaseOrderModal, ChartDetailModal };


function EmptyState({
    title,
    description,
    icon = "fas fa-inbox",
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

export default function Procurement() {
    const { confirm } = useConfirm();
    const expenseChartCanvasRef = useRef<HTMLCanvasElement>(null);
    const priorityChartCanvasRef = useRef<HTMLCanvasElement>(null);
    const expenseChartInstanceRef = useRef<Chart | null>(null);
    const priorityChartInstanceRef = useRef<Chart | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

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

    const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved">("all");
    const [isPurchaseRequestModalOpen, setIsPurchaseRequestModalOpen] = useState(false);
    const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const hasLoadedOnceRef = useRef(false);
    const [pendingRowId, setPendingRowId] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectAll, setIsSelectAll] = useState(false);

    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [totalItems, setTotalItems] = useState(0);

    const [totalCounts, setTotalCounts] = useState<{ all: number; pending: number; approved: number }>({
        all: 0,
        pending: 0,
        approved: 0
    });

    const [isTabTransitioning, setIsTabTransitioning] = useState(false);
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

    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;

        try {
            if (!silent && !hasLoadedOnceRef.current) {
                setLoading(true);
            } else if (!silent) {
                setIsRefreshing(true);
                setIsTabTransitioning(true);
            }

            const data = await fetchProcurementData({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearch,
                tab: activeTab,
                includeOrders: true,
                includeSuppliers: true,
            });

            setRequests(data.requests || []);
            setPurchaseOrders(data.purchaseOrders || []);
            setSuppliers(data.suppliers || []);
            setTotalItems(data.totalItems || 0);

            if (data.counts) {
                setTotalCounts(data.counts);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load procurement data');
        } finally {
            hasLoadedOnceRef.current = true;
            if (!silent) {
                setLoading(false);
                setIsRefreshing(false);
                setTimeout(() => setIsTabTransitioning(false), 300);
            }
        }
    }, [currentPage, itemsPerPage, debouncedSearch, activeTab]);

    const updateCounts = useCallback(async () => {
        try {
            const { count: allCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true });

            const { count: pendingCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Pending');

            const { count: approvedCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true })
                .in('status', ['Approved', 'Completed']);

            setTotalCounts({
                all: allCount || 0,
                pending: pendingCount || 0,
                approved: approvedCount || 0
            });
        } catch (error) {
            console.error('Error updating counts:', error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // realtime
    useEffect(() => {
        const requestsSubscription = supabase
            .channel('purchase_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requests' }, () => {
                fetchData({ silent: true });
            })
            .subscribe();

        const ordersSubscription = supabase
            .channel('purchase_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
                fetchData({ silent: true });
            })
            .subscribe();

        const suppliersSubscription = supabase
            .channel('suppliers_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
                fetchData({ silent: true });
            })
            .subscribe();

        return () => {
            requestsSubscription.unsubscribe();
            ordersSubscription.unsubscribe();
            suppliersSubscription.unsubscribe();
        };
    }, [fetchData]);

    // crud operations

    const handleRequestSubmitted = async (newRequest: any) => {
        try {
            if (isEditMode && editData) {
                const updatePayload: Partial<PurchaseRequest> = {
                    type: newRequest.type,
                    description: newRequest.description,
                    requested_by: newRequest.requested_by,
                    department: newRequest.department,
                    supplier_id: newRequest.supplier_id,
                    supplier_name: newRequest.supplier_name,
                    amount: newRequest.amount,
                    priority: newRequest.priority,
                    status: newRequest.status,
                    date: newRequest.date,
                    items: newRequest.items,
                    reason: newRequest.reason,
                };

                const updated = await updatePurchaseRequest({
                    id: editData.id,
                    ...updatePayload
                });

                setRequests(prev => prev.map(r =>
                    r.id === editData.id ? { ...updated, id: editData.id } : r
                ));
                toast.success("Purchase request updated successfully!");
            } else {
                const createPayload: Omit<PurchaseRequest, 'id' | 'request_number' | 'created_at' | 'updated_at'> = {
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

                const created = await createPurchaseRequest(createPayload);
                setRequests(prev => [created, ...prev]);
                setTotalItems(prev => prev + 1);
                toast.success("Purchase request submitted successfully!");
            }

            setSelectedIds(new Set());
            setIsSelectAll(false);
            setIsEditMode(false);
            setEditData(null);
            setIsPurchaseRequestModalOpen(false);
            await updateCounts();
        } catch (error) {
            console.error('Error submitting request:', error);
            toast.error(isEditMode ? 'Failed to update request' : 'Failed to submit request');
        }
    };

    const handleCreateOrder = (request: PurchaseRequest) => {
        setSelectedRequest(request);
        setIsPurchaseOrderModalOpen(true);
    };

    const handleOrderCreated = async (orderData: any) => {
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({ status: "Approved", updated_at: new Date().toISOString() })
                .eq('id', orderData.request_id);

            if (error) throw error;

            const { error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id,
                    supplier_id: orderData.supplier_id,
                    supplier_name: orderData.supplier_name,
                    total_amount: orderData.total_amount,
                    status: orderData.status,
                    delivery_date: orderData.delivery_date,
                    notes: orderData.notes,
                    items: orderData.items,
                });

            if (orderError) throw orderError;

            setPurchaseOrders(prev => [...prev, { ...orderData, id: Date.now().toString() }]);
            setRequests(prev => prev.map(r =>
                r.id === orderData.request_id ? { ...r, status: "Approved" } : r
            ));

            toast.success("Purchase Order created successfully!");
            setIsPurchaseOrderModalOpen(false);
            setSelectedRequest(null);
            await updateCounts();
        } catch (error) {
            console.error('Error creating order:', error);
            toast.error('Failed to create purchase order');
        }
    };

    const handleEditRequest = (id: string) => {
        const request = requests.find(r => r.id === id);
        if (request) {
            setEditData(request);
            setIsEditMode(true);
            setIsPurchaseRequestModalOpen(true);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        const confirmed = await confirm({
            title: "Delete Purchase Request",
            message: "Are you sure you want to delete this request? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setPendingRowId(id);
        try {
            await deletePurchaseRequest(id);
            setRequests(prev => prev.filter(r => r.id !== id));
            setTotalItems(prev => prev - 1);
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            toast.success("Request deleted successfully");
            await updateCounts();
        } catch (error) {
            console.error('Error deleting request:', error);
            toast.error('Failed to delete request');
        } finally {
            setPendingRowId(null);
        }
    };

    const performBulkDelete = async (ids: string[]) => {
        try {
            setPendingRowId("bulk");
            await deleteMultiplePurchaseRequests(ids);
            setRequests(prev => prev.filter(r => !ids.includes(r.id)));
            setTotalItems(prev => prev - ids.length);
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Successfully deleted ${ids.length} request(s)`);
            await updateCounts();
        } catch (error) {
            console.error('Error deleting requests:', error);
            toast.error('Failed to delete selected requests');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            toast.warning("Please select at least one request to delete");
            return;
        }

        const selectedRequests = requests.filter(r => selectedIds.has(r.id));
        const nonDeletableSelected = selectedRequests.filter(
            r => r.status !== "Pending" && r.status !== "Rejected"
        );

        if (nonDeletableSelected.length > 0) {
            const confirmed = await confirm({
                title: "Bulk Delete Warning",
                message: `${nonDeletableSelected.length} selected request(s) are not in "Pending" or "Rejected" status. Only Pending and Rejected requests can be deleted. Would you like to delete only the eligible ones?`,
                confirmText: "Delete Eligible Only",
                cancelText: "Cancel",
                confirmVariant: "danger",
            });

            if (!confirmed) return;

            const deletableToDelete = selectedRequests.filter(
                r => r.status === "Pending" || r.status === "Rejected"
            );
            if (deletableToDelete.length === 0) {
                toast.warning("No eligible requests selected for deletion");
                return;
            }

            const confirmedFinal = await confirm({
                title: "Delete Selected Requests",
                message: `Are you sure you want to delete ${deletableToDelete.length} request(s)? This action cannot be undone.`,
                confirmText: `Delete ${deletableToDelete.length}`,
                cancelText: "Cancel",
                confirmVariant: "danger",
            });

            if (!confirmedFinal) return;
            await performBulkDelete(deletableToDelete.map(r => r.id));
            return;
        }

        const confirmed = await confirm({
            title: "Delete Selected Requests",
            message: `Are you sure you want to delete ${selectedIds.size} selected request(s)? This action cannot be undone.`,
            confirmText: `Delete ${selectedIds.size}`,
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;
        await performBulkDelete(Array.from(selectedIds));
    };

    const handleSelectAll = () => {
        if (isSelectAll) {
            setSelectedIds(new Set());
        } else {
            const selectableIds = filteredRequests
                .filter(r => r.status === "Pending" || r.status === "Rejected")
                .map(r => r.id);
            setSelectedIds(new Set(selectableIds));
        }
        setIsSelectAll(!isSelectAll);
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            const request = requests.find(r => r.id === id);
            if (request && request.status !== "Pending" && request.status !== "Rejected") {
                toast.warning("Only Pending or Rejected requests can be selected for bulk operations");
                return;
            }
            newSet.add(id);
        }
        setSelectedIds(newSet);
        const selectableIds = filteredRequests
            .filter(r => r.status === "Pending" || r.status === "Rejected")
            .map(r => r.id);
        const allSelected = selectableIds.every(id => newSet.has(id));
        setIsSelectAll(allSelected && newSet.size === selectableIds.length);
    };

    const handleApproveRequest = async (id: string) => {
        const confirmed = await confirm({
            title: "Approve Purchase Request",
            message: "Are you sure you want to approve this request?",
            confirmText: "Approve",
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;

        setPendingRowId(id);
        try {
            await patchPurchaseRequest({ id, action: 'approve' });
            setRequests(prev => prev.map(r =>
                r.id === id ? { ...r, status: "Approved" } : r
            ));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            toast.success("Request approved successfully");
            await updateCounts();
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error('Failed to approve request');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleRejectRequest = async (id: string) => {
        const confirmed = await confirm({
            title: "Reject Purchase Request",
            message: "Are you sure you want to reject this request?",
            confirmText: "Reject",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({ status: "Rejected", updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            setRequests(prev => prev.map(r =>
                r.id === id ? { ...r, status: "Rejected" } : r
            ));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            toast.info("Request rejected");
            await updateCounts();
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error('Failed to reject request');
        } finally {
            setPendingRowId(null);
        }
    };

    const getPurchaseOrderStatus = (requestId: string): string | null => {
        const order = purchaseOrders.find(po => po.request_id === requestId);
        return order ? order.status : null;
    };

    const getPurchaseOrderNumber = (requestId: string): string | null => {
        const order = purchaseOrders.find(po => po.request_id === requestId);
        return order ? order.po_number : null;
    };

    // charts
    useEffect(() => {
        if (loading) return;

        const createCharts = () => {
            if (expenseChartInstanceRef.current) {
                expenseChartInstanceRef.current.destroy();
                expenseChartInstanceRef.current = null;
            }
            if (priorityChartInstanceRef.current) {
                priorityChartInstanceRef.current.destroy();
                priorityChartInstanceRef.current = null;
            }

            const monthlyData = Array(12).fill(0);
            const monthlyOrders: PurchaseOrder[][] = Array(12).fill(null).map(() => []);
            const currentYear = new Date().getFullYear();

            purchaseOrders.forEach((order) => {
                if (order.delivery_date && (order.status === 'Delivered' || order.status === 'Confirmed') && order.paid === true) {
                    const orderDate = new Date(order.delivery_date);
                    if (orderDate.getFullYear() === currentYear) {
                        const month = orderDate.getMonth();
                        monthlyData[month] += order.total_amount || 0;
                        monthlyOrders[month].push(order);
                    }
                }
            });

            const priorityCounts = { Normal: 0, Urgent: 0, Critical: 0 };
            requests.forEach((req) => {
                if (req.priority === 'Normal') priorityCounts.Normal++;
                else if (req.priority === 'Urgent') priorityCounts.Urgent++;
                else if (req.priority === 'Critical') priorityCounts.Critical++;
            });

            if (expenseChartCanvasRef.current && Chart) {
                const ctx = expenseChartCanvasRef.current.getContext('2d');
                if (ctx) {
                    expenseChartInstanceRef.current = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                            datasets: [{
                                label: "Spend",
                                data: monthlyData,
                                borderColor: "#EC4899",
                                backgroundColor: "rgba(236,72,153,.12)",
                                fill: true,
                                tension: 0.35,
                                borderWidth: 2,
                                pointRadius: 4,
                                pointBackgroundColor: "#EC4899",
                                pointHoverRadius: 8,
                                pointHoverBackgroundColor: "#BE185D",
                                pointBorderColor: "#fff",
                                pointBorderWidth: 2,
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: "rgba(15,23,42,0.9)",
                                    titleColor: "#fff",
                                    bodyColor: "#e2e8f0",
                                    borderColor: "#EC4899",
                                    borderWidth: 1,
                                    padding: 12,
                                    callbacks: {
                                        label: (context: any) => {
                                            const amount = context.parsed.y;
                                            const monthIndex = context.dataIndex;
                                            const orderCount = monthlyOrders[monthIndex]?.length || 0;
                                            return [
                                                ` Amount: ₱${amount.toLocaleString()}`,
                                                ` Orders: ${orderCount}`
                                            ];
                                        }
                                    }
                                },
                            },
                            scales: {
                                x: { grid: { display: false } },
                                y: {
                                    grid: { color: "#F1F5F9" },
                                    ticks: { callback: (value: any) => `₱${value.toLocaleString()}` }
                                }
                            },
                            onClick: (event: any, elements: any) => {
                                if (elements.length > 0) {
                                    const element = elements[0];
                                    const monthIndex = element.index;
                                    const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex];
                                    const orders = monthlyOrders[monthIndex] || [];
                                    const totalAmount = monthlyData[monthIndex] || 0;

                                    if (orders.length > 0 || totalAmount > 0) {
                                        setChartDetailModal({
                                            isOpen: true,
                                            month: monthName,
                                            monthIndex: monthIndex,
                                            orders: orders,
                                            totalAmount: totalAmount,
                                        });
                                    }
                                }
                            },
                        },
                    });
                }
            }

            if (priorityChartCanvasRef.current && Chart) {
                priorityChartInstanceRef.current = new Chart(priorityChartCanvasRef.current, {
                    type: "doughnut",
                    data: {
                        labels: ['Normal', 'Urgent', 'Critical'],
                        datasets: [{
                            data: [priorityCounts.Normal, priorityCounts.Urgent, priorityCounts.Critical],
                            backgroundColor: [
                                '#F472B6',
                                '#EC4899',
                                '#BE185D'
                            ],
                            borderWidth: 2,
                            borderColor: "#fff",
                            hoverOffset: 15,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "65%",
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    usePointStyle: true,
                                    font: { size: 10 },
                                },
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
                                        const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    },
                });
            }
        };

        const timer = setTimeout(createCharts, 100);
        return () => {
            clearTimeout(timer);
            if (expenseChartInstanceRef.current) {
                expenseChartInstanceRef.current.destroy();
                expenseChartInstanceRef.current = null;
            }
            if (priorityChartInstanceRef.current) {
                priorityChartInstanceRef.current.destroy();
                priorityChartInstanceRef.current = null;
            }
        };
    }, [purchaseOrders, requests, loading]);

    const filteredRequests = requests.filter((req) => {
        const matchesTab = activeTab === "all" ||
            (activeTab === "pending" && req.status === "Pending") ||
            (activeTab === "approved" && (req.status === "Approved" || req.status === "Completed"));
        const matchesSearch = (req.request_number || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (req.requested_by || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (req.supplier_name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (req.description || '').toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            setSelectedIds(new Set());
            setIsSelectAll(false);
            setTimeout(scrollToTable, 100);
        }
    };

    const totalSpend = purchaseOrders
        .filter((o) => o.status !== 'Draft' && o.paid === true)
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return (
        <SessionGuard requiredRole={['Admin', 'Employee', 'Executive']}>
            <div className="p-6 space-y-6 fade-in bgCard">
                {/* header */}
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 transition-colors">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5 transition-colors">
                            <i className="fa-solid fa-cart-flatbed" />
                        </div>

                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
                                Procurement &amp; Sourcing
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                                Manage fleet maintenance, spare parts, fuel, and operational supplies.
                            </p>

                            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] transition-all">
                                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                                <i className="fas fa-user-tag text-[11px] text-slate-400 dark:text-slate-500" />
                                <span>Role:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    <AppButton
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => {
                            setIsEditMode(false);
                            setEditData(null);
                            setSelectedIds(new Set());
                            setIsSelectAll(false);
                            setIsPurchaseRequestModalOpen(true);
                        }}
                    >
                        <i className="fas fa-plus text-xs" />
                        <span>New Purchase Request</span>
                    </AppButton>
                </div>

                {/* ai questions */}
                <AiQuestions
                    title="AI Suggested Questions"
                    subtitle="Click to ask"
                    questions={[
                        {
                            question: "Procurement summary",
                            color: "bg-pink-400"
                        },
                        {
                            question: "Top expenses by category?",
                            color: "bg-amber-400"
                        },
                        {
                            question: "Any urgent purchase requests?",
                            color: "bg-blue-400"
                        },
                        {
                            question: "Supplier performance overview",
                            color: "bg-emerald-400"
                        }
                    ]}
                />

                {/* cards */}
                {loading ? (
                    <CardsSkeleton count={4} />
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Cards
                            frontIcon="fa-solid fa-file-invoice"
                            header="Total Requests"
                            data={String(totalCounts.all)}
                            arrow="fa-solid fa-arrow-up"
                            description={`${totalCounts.pending} pending`}
                            backBg="bg-ink dark:bg-ink/90"
                            backHeader="Overview"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Total purchase requests: ${totalCounts.all}\nPending approvals: ${totalCounts.pending}\nApproved: ${totalCounts.approved}\n${totalCounts.pending} requests awaiting review`}
                            tooltip="View all requests"
                            tooltipLink="/procurement?tab=all"
                            badge={totalCounts.pending > 0 ? `${totalCounts.pending} pending` : undefined}
                            frontTextColor="text-pink-500 dark:text-pink-400"
                            descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                        />

                        <Cards
                            frontIcon="fa-solid fa-clock"
                            header="Pending Approvals"
                            data={String(totalCounts.pending)}
                            arrow="fa-solid fa-hourglass-half"
                            description="Awaiting review"
                            backBg="bg-ink dark:bg-ink/90"
                            backHeader="Approval Status"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Pending requests: ${totalCounts.pending}\nNeed your attention\n${totalCounts.pending > 0 ? 'Review and approve to proceed' : 'No pending approvals'}`}
                            tooltip="Review pending requests"
                            tooltipLink="/procurement?tab=pending"
                            badge={totalCounts.pending > 0 ? `${totalCounts.pending} waiting` : undefined}
                            frontTextColor="text-amber-500 dark:text-amber-400"
                            descriptionTextColor="text-amber-600 dark:text-amber-400"
                        />

                        <Cards
                            frontIcon="fa-solid fa-circle-check"
                            header="Approved"
                            data={String(totalCounts.approved)}
                            arrow="fa-solid fa-check-double"
                            description="Ready for PO"
                            backBg="bg-ink dark:bg-ink/90"
                            backHeader="Approved Requests"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Approved: ${totalCounts.approved}\nReady for Purchase Order\n${totalCounts.approved} requests approved\n${totalCounts.approved > 0 ? 'Proceed to create POs' : 'No approved requests yet'}`}
                            tooltip="View approved requests"
                            tooltipLink="/procurement?tab=approved"
                            badge={totalCounts.approved > 0 ? `${totalCounts.approved} ready` : undefined}
                            frontTextColor="text-emerald-500 dark:text-emerald-400"
                            descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                        />

                        <Cards
                            frontIcon="fa-solid fa-coins"
                            header="Total Spend"
                            data={`₱${totalSpend.toLocaleString()}`}
                            arrow="fa-solid fa-chart-line"
                            description="Completed orders"
                            backBg="bg-ink dark:bg-ink/90"
                            backHeader="Financial Summary"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Total Spend: ₱${totalSpend.toLocaleString()}\nCompleted orders: ${purchaseOrders.filter(o => o.status === 'Delivered' || o.status === 'Confirmed').length}\n${totalSpend > 0 ? 'Tracking procurement costs' : 'No completed orders yet'}`}
                            tooltip="View financial details"
                            tooltipLink="/procurement?tab=approved"
                            frontTextColor="text-blue-500 dark:text-blue-400"
                            descriptionTextColor="text-blue-600 dark:text-blue-400"
                        />
                    </div>
                )}

                {/* charts */}
                {loading ? (
                    <ChartsSkeleton />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 xl:col-span-2 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center">
                                    <i className="fas fa-chart-bar mr-2 text-pink-500 dark:text-pink-400" /> Procurement Spending Trend
                                    <div className="relative ml-2 group">
                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold cursor-help">
                                            ?
                                        </span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 dark:bg-slate-800 text-slate-200 dark:text-slate-300 text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                            <p className="font-semibold text-white mb-1">📊 Chart Info</p>
                                            <p>Shows monthly spending from <span className="text-pink-400 font-medium">Delivered</span> and <span className="text-pink-400 font-medium">Confirmed</span> orders that are <span className="text-emerald-400 font-medium">paid</span>.</p>
                                            <p className="mt-1 text-slate-400 text-[10px]">💡 Click on any data point to see orders for that month.</p>
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 dark:bg-slate-800"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                                    <i className="fas fa-calendar-alt mr-1 text-slate-400 dark:text-slate-500" /> Completed orders (Paid)
                                </div>
                            </div>
                            <div className="w-full h-[200px] mt-3">
                                <canvas ref={expenseChartCanvasRef} className="w-full h-full" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 transition-all">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center">
                                <i className="fas fa-chart-pie mr-2 text-pink-500 dark:text-pink-400" /> Request Priority Distribution
                            </div>
                            <div className="w-full h-[200px] mt-3">
                                <canvas ref={priorityChartCanvasRef} className="w-full h-full" />
                            </div>
                        </div>
                    </div>
                )}

                {/* table */}
                {loading ? (
                    <TableSkeleton
                        rows={itemsPerPage}
                        hasFilter
                        hasSearch
                        hasPagination
                        columns={[
                            { type: 'checkbox', width: 'w-10' },
                            { header: 'Request ID', type: 'mono' },
                            { header: 'Priority', type: 'badge' },
                            { header: 'Requester', type: 'avatar-text', subtext: true },
                            { header: 'Department', type: 'text' },
                            { header: 'Category', type: 'text' },
                            { header: 'Total Cost', type: 'currency' },
                            { header: 'Date', type: 'date' },
                            { header: 'Status', type: 'badge' },
                            { header: 'Next Approver', type: 'text' },
                            { header: 'Approval Step', type: 'badge' },
                            { header: 'Actions', type: 'actions', align: 'right', width: 'w-[170px]' },
                        ]}
                    />
                ) : (
                    <div
                        ref={tableContainerRef}
                        id="procurement-table"
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden relative flex flex-col"
                    >
                        {isRefreshing && <TableContentLoader />}

                        {/* filter bar */}
                        <div className="flex-shrink-0 p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

                                {/* left */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                                    {/* title */}
                                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2.5 shrink-0">
                                        <div className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/50 border border-pink-200/50 dark:border-pink-800/50 text-pink-500 dark:text-pink-400">
                                            <i className="fas fa-list text-xs" />
                                        </div>
                                        <span>Purchase Requests</span>
                                        {isRefreshing && (
                                            <i className="fas fa-circle-notch fa-spin text-pink-500 text-xs ml-0.5" title="Refreshing..." />
                                        )}
                                    </div>

                                    {/* search */}
                                    <div className="relative flex-1 max-w-sm">
                                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                                        <input
                                            className="w-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-1.5 pl-9 pr-8 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-500/30 transition-all shadow-xs"
                                            placeholder="Search by ID, requester, supplier..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 rounded-md"
                                                aria-label="Clear search"
                                            >
                                                <i className="fas fa-times" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* right */}
                                <div className="flex items-center justify-between sm:justify-end gap-2 ">
                                    {/* tabs */}
                                    <div className="inline-flex gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-white/5">
                                        {[
                                            { key: "all", label: "All", count: totalCounts.all },
                                            { key: "pending", label: "Pending", count: totalCounts.pending },
                                            { key: "approved", label: "Approved", count: totalCounts.approved },
                                        ].map((tab) => {
                                            const isActive = activeTab === tab.key;
                                            return (
                                                <button
                                                    key={tab.key}
                                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isActive
                                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/30"
                                                        }`}
                                                    onClick={() => {
                                                        setActiveTab(tab.key as any);
                                                        setSelectedIds(new Set());
                                                        setIsSelectAll(false);
                                                    }}
                                                >
                                                    <span>{tab.label}</span>
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${isActive
                                                            ? "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100"
                                                            : "bg-slate-300/50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400"
                                                            }`}
                                                    >
                                                        {tab.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* po link */}
                                    <Link
                                        href="/purchase-orders"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 active:bg-pink-800 dark:bg-pink-600 dark:hover:bg-pink-500 rounded-lg transition-all shadow-xs hover:shadow-sm"
                                    >
                                        <span className="text-xxs">Purchase Orders</span>
                                    </Link>
                                </div>

                            </div>
                        </div>

                        {/* body */}
                        <div data-lenis-prevent className="flex-1 overflow-y-auto max-h-[500px] relative overscroll-contain">
                            <div className={`transition-opacity duration-200 ${isTabTransitioning ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                                <div data-lenis-prevent className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overscroll-contain">
                                    {isTabTransitioning && <TableContentLoader />}
                                    <table className="table-pro w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
                                                <th className="w-10 py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600"
                                                            checked={isSelectAll && selectedIds.size > 0}
                                                            onChange={handleSelectAll}
                                                            disabled={filteredRequests.filter((r) => r.status === "Pending" || r.status === "Rejected").length === 0}
                                                            title={filteredRequests.filter((r) => r.status === "Pending" || r.status === "Rejected").length === 0 ? "No pending or rejected requests to select" : "Select all pending and rejected requests"}
                                                        />
                                                        {selectedIds.size > 0 && (
                                                            <span className="text-[10px] bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold px-1.5 py-0.2 rounded-full border border-pink-200/60 dark:border-pink-900/40">
                                                                {selectedIds.size}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">PR #</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Type</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Description</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Requested By</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Dept</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Supplier</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Amount</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Priority</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Date</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">PO Status</th>
                                                <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right! w-[170px] min-w-[170px]">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                            {filteredRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={13} className="py-12">
                                                        <EmptyState
                                                            title="No purchase requests found"
                                                            description={
                                                                activeTab === "pending"
                                                                    ? "There are no pending requests waiting for approval."
                                                                    : activeTab === "approved"
                                                                        ? "There are no approved requests ready for purchase orders."
                                                                        : "Try adjusting your search filters or create a new request."
                                                            }
                                                            icon="fas fa-shopping-cart"
                                                            actionText="Create New Request"
                                                            onAction={() => {
                                                                setIsEditMode(false);
                                                                setEditData(null);
                                                                setIsPurchaseRequestModalOpen(true);
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRequests.map((req) => {
                                                    const hasPO = purchaseOrders.some((po) => po.request_id === req.id);
                                                    const poStatus = getPurchaseOrderStatus(req.id);
                                                    const poNumber = getPurchaseOrderNumber(req.id);
                                                    const rowBusy = pendingRowId === req.id;
                                                    const isSelected = selectedIds.has(req.id);
                                                    const isPending = req.status === "Pending";

                                                    return (
                                                        <tr
                                                            key={req.id}
                                                            className={`group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${rowBusy ? "opacity-50 pointer-events-none" : ""
                                                                } ${isSelected ? "bg-pink-50/50 dark:bg-pink-950/20" : "bg-transparent"
                                                                }`}
                                                        >
                                                            <td data-label="" className="py-3.5 px-4 text-center whitespace-nowrap">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    checked={isSelected}
                                                                    onChange={() => handleSelectOne(req.id)}
                                                                    disabled={(!isPending && req.status !== "Rejected") || rowBusy}
                                                                    title={!isPending && req.status !== "Rejected" ? "Only pending or rejected requests can be selected" : ""}
                                                                />
                                                            </td>
                                                            <td data-label="PR #" className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                                {req.request_number}
                                                            </td>
                                                            <td data-label="Type" className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                                {req.type}
                                                            </td>
                                                            <td data-label="Description" className="py-3.5 px-4">
                                                                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[180px] block" title={req.description}>
                                                                    {req.description}
                                                                </span>
                                                            </td>
                                                            <td data-label="Requested By" className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                                {req.requested_by}
                                                            </td>
                                                            <td data-label="Dept" className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                                {req.department}
                                                            </td>
                                                            <td data-label="Supplier" className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[140px] truncate" title={req.supplier_name}>
                                                                {req.supplier_name}
                                                            </td>
                                                            <td data-label="Amount" className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                                                                ₱{req.amount.toLocaleString()}
                                                            </td>
                                                            <td data-label="Priority" className="py-3.5 px-4 whitespace-nowrap">
                                                                <StatusBadge
                                                                    tone={req.priority === 'Critical' ? 'rose' : req.priority === 'Urgent' ? 'amber' : 'indigo'}
                                                                    size="xs"
                                                                >
                                                                    {req.priority}
                                                                </StatusBadge>
                                                            </td>
                                                            <td data-label="Date" className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                                {req.date}
                                                            </td>
                                                            <td data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                                                                <StatusBadge
                                                                    tone={req.status === 'Pending' ? 'amber' : req.status === 'Approved' ? 'purple' : req.status === 'Rejected' ? 'rose' : req.status === 'Completed' ? 'pink' : 'neutral'}
                                                                    dot
                                                                    size="xs"
                                                                >
                                                                    {req.status}
                                                                </StatusBadge>
                                                            </td>
                                                            <td data-label="PO Status" className="py-3.5 px-4 whitespace-nowrap">
                                                                {hasPO && poStatus ? (
                                                                    <StatusBadge
                                                                        tone={getPOStatusTone(poStatus)}
                                                                        size="xs"
                                                                        title={`PO Status: ${poStatus} ${poNumber ? `(#${poNumber})` : ''}`}
                                                                    >
                                                                        {poStatus} {poNumber && `#${poNumber}`}
                                                                    </StatusBadge>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">No PO</span>
                                                                )}
                                                            </td>
                                                            <td data-label="Actions" className="py-3.5 px-4 text-right whitespace-nowrap w-[170px] min-w-[170px]">
                                                                <div className="flex items-center justify-end gap-2.5">
                                                                    {rowBusy && (
                                                                        <svg className="w-4 h-4 animate-spin text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                        </svg>
                                                                    )}

                                                                    {req.status === "Approved" && !hasPO && (
                                                                        <CrudActionButton
                                                                            action="custom"
                                                                            label="Create PO"
                                                                            icon={FileText}
                                                                            onClick={() => handleCreateOrder(req)}
                                                                            disabled={rowBusy}
                                                                            ariaLabel="Create Purchase Order"
                                                                            title="Create Purchase Order"
                                                                        />
                                                                    )}

                                                                    {req.status === "Pending" && (
                                                                        <>
                                                                            <CrudActionButton
                                                                                action="custom"
                                                                                label="Approve"
                                                                                icon={Check}
                                                                                onClick={() => handleApproveRequest(req.id)}
                                                                                disabled={rowBusy}
                                                                                ariaLabel="Approve Request"
                                                                                title="Approve Request"
                                                                            />
                                                                            <CrudActionButton
                                                                                action="custom"
                                                                                label="Reject"
                                                                                icon={X}
                                                                                onClick={() => handleRejectRequest(req.id)}
                                                                                disabled={rowBusy}
                                                                                ariaLabel="Reject Request"
                                                                                title="Reject Request"
                                                                            />
                                                                            <CrudActionButton
                                                                                action="edit"
                                                                                onClick={() => handleEditRequest(req.id)}
                                                                                disabled={rowBusy}
                                                                                ariaLabel="Edit Request"
                                                                                title="Edit Request"
                                                                            />
                                                                            <CrudActionButton
                                                                                action="delete"
                                                                                onClick={() => handleDeleteRequest(req.id)}
                                                                                disabled={rowBusy}
                                                                                ariaLabel="Delete Request"
                                                                                title="Delete Request"
                                                                            />
                                                                        </>
                                                                    )}

                                                                    {req.status === "Approved" && hasPO && (
                                                                        <StatusBadge tone="emerald" icon="fas fa-check" size="xs" title="Purchase order already generated">
                                                                            PO Created
                                                                        </StatusBadge>
                                                                    )}

                                                                    {req.status === "Rejected" && (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full">
                                                                            <span>Rejected</span>
                                                                        </span>
                                                                    )}
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

                        {/* pagination */}
                        <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Showing <span className="font-semibold text-slate-800 dark:text-white">
                                        {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                                    </span> to{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {Math.min(currentPage * itemsPerPage, totalItems)}
                                    </span> of{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">{totalItems}</span> requests
                                </span>

                                {selectedIds.size > 0 && (
                                    <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10 animate-in fade-in duration-150">
                                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/40 shadow-2xs">
                                            {selectedIds.size} selected
                                        </span>

                                        <button
                                            onClick={handleBulkDelete}
                                            disabled={pendingRowId === "bulk"}
                                            className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl border border-red-200/60 dark:border-red-800/40 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                                        >
                                            {pendingRowId === "bulk" ? (
                                                <i className="fas fa-spinner fa-spin text-xs" />
                                            ) : (
                                                <i className="fas fa-trash-alt text-xs" />
                                            )}
                                            <span>Delete Selected</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setSelectedIds(new Set());
                                                setIsSelectAll(false);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                            title="Clear selection"
                                            aria-label="Clear selection"
                                        >
                                            <i className="fas fa-times text-xs" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </div>
                )}

                <PurchaseRequestModal
                    isOpen={isPurchaseRequestModalOpen}
                    onClose={() => {
                        setIsPurchaseRequestModalOpen(false);
                        setIsEditMode(false);
                        setEditData(null);
                    }}
                    suppliers={suppliers}
                    role={userRole}
                    onRequestSubmitted={handleRequestSubmitted}
                    editData={editData}
                    isEdit={isEditMode}
                />

                <PurchaseOrderModal
                    isOpen={isPurchaseOrderModalOpen}
                    onClose={() => {
                        setIsPurchaseOrderModalOpen(false);
                        setSelectedRequest(null);
                    }}
                    request={selectedRequest}
                    suppliers={suppliers}
                    onOrderCreated={handleOrderCreated}
                />

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