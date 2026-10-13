"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Search, 
    Filter, 
    FileText, 
    Calendar, 
    DollarSign, 
    Package, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Truck, 
    Eye, 
    RefreshCw, 
    X, 
    XCircle,
    RotateCcw,
    Building2, 
    Check, 
    MessageSquare, 
    ChevronRight, 
    ArrowUpDown, 
    Inbox, 
    ShieldAlert, 
    Download, 
    FileSpreadsheet,
    AlertTriangle,
    Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { user } from "../../../lib/services/Class/user";
import { supabase } from "../../../lib/services/client/supabase";
import { useDebounce } from "../../../hooks/useDebounce";
import { Pagination } from "../../../components/global/pagination";
import { StatusBadge, getPOStatusTone, BadgeTone } from "../../../components/ui/StatusBadge";
import { AppButton } from "../../../components/ui/AppButton";
import { CardsSkeleton, TableSkeleton } from "../../../components/ui/SkeletonLoader";
import Cards from "../../../components/global/Cards";
import { toast } from "sonner";
import Portal from "../../../components/client/Portal";
import { processDeliveredPurchaseOrdersAction } from "../../purchase-orders/server/actions/delivery-inventory";
import { SupplierReturnModal } from "./components/SupplierReturnModal";
import { 
    fetchSupplierReturnRequestsForSupplierAction, 
    SupplierReturnRequestRecord 
} from "../../warehousing/server/supplier-returns-actions";

interface PurchaseOrderItem {
    item_name?: string;
    description?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id?: string;
    supplier_id: string;
    supplier_name?: string;
    total_amount: number;
    subtotal?: number;
    discount?: number;
    shipping_fee?: number;
    tax_rate?: number;
    tax_amount?: number;
    category?: string;
    status: string;
    delivery_date?: string;
    delivery_location?: string;
    admin_approval?: string;
    admin_approved_at?: string;
    financial_approval?: string;
    financial_approved_at?: string;
    notes?: string;
    items?: PurchaseOrderItem[] | any;
    paid?: boolean;
    created_at?: string;
    updated_at?: string;
}

// Helper to check if a Purchase Order is approved by both Admin and Finance, and officially Issued
export function isApprovedAndIssuedPO(po: any): boolean {
    if (!po) return false;
    
    // 1. Admin Approval must be Approved
    const admApproved = String(po.admin_approval || "").trim().toLowerCase() === "approved";
    if (!admApproved) return false;

    // 2. Financial Approval must be Approved
    const finApproved = String(po.financial_approval || "").trim().toLowerCase() === "approved";
    if (!finApproved) return false;

    // 3. Must be an issued order (not an internal draft or pending internal review)
    const st = String(po.status || "").trim().toLowerCase();
    if (st === "draft" || st === "pending approval" || st === "pending_approval") {
        return false;
    }

    return true;
}

function EmptyState({
    title = "No Purchase Orders Yet",
    description = "No purchase orders matched your search or filter criteria.",
    icon = "fas fa-file-invoice",
    onClearSearch,
    isFilterActive = false,
}: {
    title?: string;
    description?: string;
    icon?: string;
    onClearSearch?: () => void;
    isFilterActive?: boolean;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center mb-4 text-pink-500 dark:text-pink-400 transition-transform duration-300 hover:scale-105">
                <i className={`${icon} text-2xl`} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {title}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {isFilterActive && onClearSearch && (
                <button
                    onClick={onClearSearch}
                    className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-white dark:hover:bg-slate-800 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] rounded-2xl transition-all cursor-pointer active:scale-95"
                >
                    Clear All Filters
                </button>
            )}
        </div>
    );
}

interface StatusConfirmState {
    poId: string;
    poNumber: string;
    actionType: "accept" | "reject" | "revert" | "cancel" | "delivered";
    targetStatus: string;
    title: string;
    description: string;
    confirmButtonText: string;
    confirmButtonColor: "emerald" | "pink" | "rose";
}

export default function SupplierPurchaseOrdersPage() {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
    const [supplierAccount, setSupplierAccount] = useState<any>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [confirmModal, setConfirmModal] = useState<StatusConfirmState | null>(null);

    // Defective Items & Return Claims State
    const [activeMainTab, setActiveMainTab] = useState<"orders" | "defects">("orders");
    const [supplierReturnRequests, setSupplierReturnRequests] = useState<SupplierReturnRequestRecord[]>([]);
    const [isLoadingReturns, setIsLoadingReturns] = useState(false);
    const [selectedReturnForModal, setSelectedReturnForModal] = useState<SupplierReturnRequestRecord | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [defectsSearchQuery, setDefectsSearchQuery] = useState("");
    const [defectsStatusFilter, setDefectsStatusFilter] = useState("ALL");
    const [defectsCurrentPage, setDefectsCurrentPage] = useState(1);
    const [defectsPageSize, setDefectsPageSize] = useState(10);

    const debouncedSearch = useDebounce(searchQuery, 300);
    const currentUserEmail = user.getEmail();

    // Check URL tab parameter on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("tab") === "defects") {
                setActiveMainTab("defects");
            }
        }
    }, []);

    // Fetch Supplier Return Requests
    const fetchReturnRequests = async (accOverride?: any) => {
        setIsLoadingReturns(true);
        try {
            const acc = accOverride || supplierAccount;
            const supId = acc?.supplier_id;
            const supEmail = acc?.email || currentUserEmail;
            const supName = acc?.suppliers?.name || acc?.company_name;

            const res = await fetchSupplierReturnRequestsForSupplierAction({
                supplierId: supId,
                supplierEmail: supEmail,
                supplierName: supName,
            });

            if (res.success && res.data) {
                setSupplierReturnRequests(res.data);
            }
        } catch (err) {
            console.error("Error fetching supplier return requests:", err);
        } finally {
            setIsLoadingReturns(false);
        }
    };

    // Fetch Supplier POs (Only show issued and approved by Admin and Financial Approval)
    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            // First identify the supplier ID
            const { data: acc } = await supabase
                .from("suppliers_account")
                .select("*, suppliers(*)")
                .ilike("email", currentUserEmail ? currentUserEmail.trim() : "")
                .maybeSingle();

            if (acc) {
                setSupplierAccount(acc);
                fetchReturnRequests(acc);

                let query = supabase
                    .from("purchase_orders")
                    .select("*")
                    .ilike("admin_approval", "approved")
                    .ilike("financial_approval", "approved")
                    .order("created_at", { ascending: false });

                if (acc.supplier_id) {
                    query = query.eq("supplier_id", acc.supplier_id);
                }

                const { data: pos, error } = await query;
                if (!error && pos) {
                    const uniqueMap = new Map();
                    pos.filter(isApprovedAndIssuedPO).forEach((p: any) => uniqueMap.set(p.id, p));
                    setPurchaseOrders(Array.from(uniqueMap.values()));
                }
            } else {
                // If logged in as internal staff viewing this portal, show all issued & approved
                fetchReturnRequests();
                const { data: pos } = await supabase
                    .from("purchase_orders")
                    .select("*")
                    .ilike("admin_approval", "approved")
                    .ilike("financial_approval", "approved")
                    .order("created_at", { ascending: false });
                if (pos) {
                    const uniqueMap = new Map();
                    pos.filter(isApprovedAndIssuedPO).forEach((p: any) => uniqueMap.set(p.id, p));
                    setPurchaseOrders(Array.from(uniqueMap.values()));
                }
            }
        } catch (err) {
            console.error("Error fetching supplier POs:", err);
            toast.error("Failed to load purchase orders");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel(`supplier_po_realtime_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "purchase_orders",
                },
                (payload: any) => {
                    if (payload.eventType === "INSERT") {
                        const newPo = payload.new;
                        // Only add if approved by admin, approved by finance, and issued
                        if (!isApprovedAndIssuedPO(newPo)) return;
                        setPurchaseOrders((prev) => {
                            if (prev.some((p) => p.id === newPo.id)) return prev;
                            if (supplierAccount?.supplier_id && newPo.supplier_id && String(newPo.supplier_id) !== String(supplierAccount.supplier_id)) {
                                return prev;
                            }
                            return [newPo, ...prev];
                        });
                        toast.info(`New purchase order received: #${newPo.po_number || ""}`);
                    } else if (payload.eventType === "UPDATE") {
                        const updatedPo = payload.new;
                        setPurchaseOrders((prev) => {
                            const isEligible = isApprovedAndIssuedPO(updatedPo);
                            const exists = prev.some((p) => p.id === updatedPo.id);

                            if (!isEligible) {
                                // If approval was revoked or draft, remove from supplier view
                                return prev.filter((p) => p.id !== updatedPo.id);
                            }

                            if (exists) {
                                return prev.map((p) => (p.id === updatedPo.id ? { ...p, ...updatedPo } : p));
                            }

                            // If freshly approved and belongs to this supplier, insert it
                            if (supplierAccount?.supplier_id && updatedPo.supplier_id && String(updatedPo.supplier_id) !== String(supplierAccount.supplier_id)) {
                                return prev;
                            }
                            return [updatedPo, ...prev];
                        });
                        setSelectedPo((prevSelected) => {
                            if (prevSelected && prevSelected.id === updatedPo.id) {
                                if (!isApprovedAndIssuedPO(updatedPo)) return null;
                                return { ...prevSelected, ...updatedPo };
                            }
                            return prevSelected;
                        });
                    } else if (payload.eventType === "DELETE") {
                        const deletedId = payload.old.id;
                        setPurchaseOrders((prev) => prev.filter((p) => p.id !== deletedId));
                        setSelectedPo((prevSelected) => {
                            if (prevSelected && prevSelected.id === deletedId) {
                                return null;
                            }
                            return prevSelected;
                        });
                    }
                }
            )
            .subscribe();

        const returnChannel = supabase
            .channel(`supplier_returns_realtime_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supplier_return_requests",
                },
                () => {
                    fetchReturnRequests();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supplier_return_messages",
                },
                () => {
                    fetchReturnRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(returnChannel);
        };
    }, [currentUserEmail, supplierAccount?.supplier_id]);

    // Status Helper Functions
    const isConfirmedStatus = (status?: string) => {
        const s = (status || "").toUpperCase();
        return s === "CONFIRMED" || s === "APPROVED" || s === "IN TRANSIT" || s === "DISPATCHED";
    };

    const isDeliveredStatus = (status?: string) => {
        const s = (status || "").toUpperCase();
        return s === "DELIVERED" || s === "COMPLETED";
    };

    const isRejectedStatus = (status?: string) => {
        const s = (status || "").toUpperCase();
        return s === "REJECTED" || s.includes("REJECT");
    };

    const isCancelledStatus = (status?: string) => {
        const s = (status || "").toUpperCase();
        return s === "CANCELLED" || s === "CANCELED";
    };

    const isPendingOrSentStatus = (status?: string) => {
        const s = (status || "").toUpperCase();
        return s === "SENT" || s === "DRAFT" || (!isConfirmedStatus(status) && !isDeliveredStatus(status) && !isRejectedStatus(status) && !isCancelledStatus(status));
    };

    // Filter and Search Logic
    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter((po) => {
            const matchesSearch =
                !debouncedSearch ||
                (po.po_number && po.po_number.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
                (po.notes && po.notes.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
                (po.status && po.status.toLowerCase().includes(debouncedSearch.toLowerCase()));

            let matchesStatus = true;
            if (selectedStatus === "CONFIRMED") {
                matchesStatus = isConfirmedStatus(po.status);
            } else if (selectedStatus === "DELIVERED") {
                matchesStatus = isDeliveredStatus(po.status);
            } else if (selectedStatus === "REJECTED") {
                matchesStatus = isRejectedStatus(po.status);
            } else if (selectedStatus === "CANCELLED") {
                matchesStatus = isCancelledStatus(po.status);
            } else if (selectedStatus === "PENDING") {
                matchesStatus = isPendingOrSentStatus(po.status);
            }

            return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, debouncedSearch, selectedStatus]);

    // Pagination slice
    const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrders.slice(start, start + pageSize);
    }, [filteredOrders, currentPage, pageSize]);

    // Export all filtered POs to CSV
    const handleExportCSV = () => {
        try {
            if (!filteredOrders || filteredOrders.length === 0) {
                toast.error("No purchase orders to export.");
                return;
            }

            const dateStr = new Date().toISOString().split("T")[0];
            const headers = [
                "PO Number",
                "Order Date",
                "Delivery Due Date",
                "Total Amount (PHP)",
                "Payment Status",
                "Fulfillment Status",
                "Order Notes",
                "Items Count"
            ];

            const escapeCSV = (val: any) => {
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            };

            const rows = filteredOrders.map((po) => {
                const itemsCount = Array.isArray(po.items) ? po.items.length : 0;
                return [
                    escapeCSV(po.po_number),
                    escapeCSV(po.created_at ? new Date(po.created_at).toLocaleDateString() : "N/A"),
                    escapeCSV(po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "N/A"),
                    escapeCSV(Number(po.total_amount || 0).toFixed(2)),
                    escapeCSV(po.paid ? "Paid" : "Unpaid"),
                    escapeCSV(po.status || "Pending"),
                    escapeCSV(po.notes || ""),
                    escapeCSV(itemsCount)
                ].join(",");
            });

            const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `purchase_orders_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(`Exported ${filteredOrders.length} purchase orders to CSV!`);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export purchase orders.");
        }
    };

    // Export single PO details to CSV
    const handleExportSinglePoCSV = (po: PurchaseOrder) => {
        try {
            const dateStr = new Date().toISOString().split("T")[0];
            const headers = ["Item Description", "Quantity", "Unit Price (PHP)", "Total Price (PHP)"];
            const escapeCSV = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

            const items = Array.isArray(po.items) ? po.items : [];
            const rows = items.map((item: any, idx: number) => [
                escapeCSV(item.item_name || item.description || `Item #${idx + 1}`),
                escapeCSV(item.quantity || 1),
                escapeCSV(Number(item.unit_price || 0).toFixed(2)),
                escapeCSV(Number(item.total_price || (item.quantity * item.unit_price) || 0).toFixed(2))
            ].join(","));

            const summary = [
                `"PO Number",${escapeCSV(po.po_number)}`,
                `"Order Date",${escapeCSV(po.created_at ? new Date(po.created_at).toLocaleDateString() : "N/A")}`,
                `"Delivery Due",${escapeCSV(po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "N/A")}`,
                `"Total Amount (PHP)",${escapeCSV(po.total_amount)}`,
                `"Status",${escapeCSV(po.status)}`,
                `"Payment",${escapeCSV(po.paid ? "Paid" : "Unpaid")}`,
                `"Notes",${escapeCSV(po.notes || "")}`,
                ``
            ];

            const csvContent = "\uFEFF" + [...summary, headers.join(","), ...rows].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `PO_${po.po_number}_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(`Exported PO ${po.po_number} line items to CSV!`);
        } catch (err) {
            toast.error("Failed to export PO details.");
        }
    };

    // Request status change with confirmation modal
    const requestStatusChange = (po: PurchaseOrder, action: "accept" | "reject" | "revert" | "cancel" | "delivered") => {
        switch (action) {
            case "accept":
                setConfirmModal({
                    poId: po.id,
                    poNumber: po.po_number,
                    actionType: "accept",
                    targetStatus: "Confirmed",
                    title: "Accept Purchase Order?",
                    description: `Are you sure you want to accept PO #${po.po_number}? This will notify the procurement team that you have accepted and confirmed this order.`,
                    confirmButtonText: "Yes, Accept Order",
                    confirmButtonColor: "pink",
                });
                break;
            case "reject":
                setConfirmModal({
                    poId: po.id,
                    poNumber: po.po_number,
                    actionType: "reject",
                    targetStatus: "Rejected",
                    title: "Reject Purchase Order?",
                    description: `Are you sure you want to reject PO #${po.po_number}? This purchase order will be marked as Rejected.`,
                    confirmButtonText: "Yes, Reject Order",
                    confirmButtonColor: "rose",
                });
                break;
            case "revert":
            case "cancel":
                const wasRejected = isRejectedStatus(po.status);
                setConfirmModal({
                    poId: po.id,
                    poNumber: po.po_number,
                    actionType: "revert",
                    targetStatus: "Sent",
                    title: wasRejected ? "Revert Order Rejection?" : "Revert Order Confirmation?",
                    description: wasRejected
                        ? `Are you sure you want to revert the rejection for PO #${po.po_number}? The order will revert back to "Sent" status so it can be reviewed and accepted.`
                        : `Are you sure you want to revert PO #${po.po_number}? The order will revert back to "Sent" status so it can be reviewed and accepted or rejected again.`,
                    confirmButtonText: "Yes, Revert to Sent",
                    confirmButtonColor: "rose",
                });
                break;
            case "delivered":
                setConfirmModal({
                    poId: po.id,
                    poNumber: po.po_number,
                    actionType: "delivered",
                    targetStatus: "Delivered",
                    title: "Confirm Order Delivery?",
                    description: `Are you sure you want to mark PO #${po.po_number} as Delivered? Ensure all items in this shipment have been handed over.`,
                    confirmButtonText: "Yes, Mark Delivered",
                    confirmButtonColor: "emerald",
                });
                break;
        }
    };

    // Execute status change confirmed in modal
    const handleExecuteConfirmStatus = async () => {
        if (!confirmModal) return;
        const { poId, targetStatus } = confirmModal;
        await handleUpdatePoStatus(poId, targetStatus);
        setConfirmModal(null);
    };

    // Update Status Handler (e.g. Acknowledge PO, Dispatch Shipment)
    const handleUpdatePoStatus = async (poId: string, newStatus: string) => {
        setIsUpdatingStatus(true);
        try {
            if (newStatus === "Delivered") {
                const deliveryRes = await processDeliveredPurchaseOrdersAction([poId], {
                    name: supplierAccount?.suppliers?.name || supplierAccount?.company_name || user.getName() || "Supplier",
                    role: "Supplier",
                    id: user.getId() || undefined,
                });
                if (!deliveryRes.success) {
                    throw new Error(deliveryRes.error || 'Failed to update inventory for delivered order');
                }
            } else {
                const { error } = await supabase
                    .from("purchase_orders")
                    .update({ 
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", poId);

                if (error) throw error;
            }

            const currentPo = purchaseOrders.find((p) => p.id === poId) || selectedPo;
            const supplierName = supplierAccount?.suppliers?.name || supplierAccount?.company_name || user.getName() || "Supplier";
            const supplierEmail = supplierAccount?.email || user.getEmail() || "supplier@portal.com";
            const poNumber = currentPo?.po_number || poId.slice(0, 8);
            const amountStr = currentPo?.total_amount ? ` (₱${Number(currentPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';

            let notifTitle = `Purchase Order Updated: #${poNumber}`;
            let notifMessage = `Supplier "${supplierName}" updated PO #${poNumber} status to "${newStatus}".`;

            const normStatus = (newStatus || '').toLowerCase();
            if (normStatus.includes('confirm') || normStatus.includes('accept') || normStatus.includes('approved')) {
                notifTitle = `Purchase Order Accepted: #${poNumber}`;
                notifMessage = `Supplier "${supplierName}" has accepted & confirmed Purchase Order #${poNumber}${amountStr}. Delivery schedule acknowledged.`;
            } else if (normStatus === 'rejected' || normStatus.includes('reject')) {
                notifTitle = `Purchase Order Rejected: #${poNumber}`;
                notifMessage = `Supplier "${supplierName}" has rejected Purchase Order #${poNumber}${amountStr}. Action required: Review and re-procure items.`;
            } else if (normStatus === 'sent') {
                notifTitle = `Purchase Order Confirmation Cancelled: #${poNumber}`;
                notifMessage = `Supplier "${supplierName}" cancelled confirmation for Purchase Order #${poNumber}${amountStr}. Status reverted to Sent.`;
            } else if (normStatus.includes('cancel')) {
                notifTitle = `Purchase Order Cancelled: #${poNumber}`;
                notifMessage = `Supplier "${supplierName}" has cancelled Purchase Order #${poNumber}${amountStr}. Action required: Review and re-procure items.`;
            } else if (normStatus.includes('deliver') || normStatus.includes('complete')) {
                notifTitle = `Purchase Order Delivered: #${poNumber}`;
                notifMessage = `Supplier "${supplierName}" marked Purchase Order #${poNumber}${amountStr} as Delivered. Ready for receiving verification.`;
            }

            // Insert notification targeting Manager, Admin & Executive
            try {
                await supabase
                    .from("notifications")
                    .insert({
                        creator_name: supplierName,
                        creator_email: supplierEmail,
                        title: notifTitle,
                        message: notifMessage,
                        type: 'alert',
                        link: `/purchase-orders?search=${encodeURIComponent(poNumber)}`,
                        role: ['Purchase Officer', 'Admin', 'Executive'],
                        is_read: false,
                        reference_type: 'purchase_order',
                        reference_id: poId,
                        po_request_id: currentPo?.request_id || null
                    });
            } catch (notifErr) {
                console.error("Error sending PO update notification:", notifErr);
            }

            toast.success(`Purchase order status updated to ${newStatus}`);
            setPurchaseOrders((prev) =>
                prev.map((p) => (p.id === poId ? { ...p, status: newStatus } : p))
            );
            if (selectedPo && selectedPo.id === poId) {
                setSelectedPo({ ...selectedPo, status: newStatus });
            }
        } catch (err: any) {
            toast.error("Failed to update status: " + err.message);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const formatCurrency = (amt: number) => `₱${(amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (dStr?: string) => {
        if (!dStr) return "N/A";
        return new Date(dStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    // Calculate Summary Metrics
    const metrics = useMemo(() => {
        let totalValue = 0;
        let pendingCount = 0;
        let deliveredCount = 0;

        purchaseOrders.forEach((po) => {
            totalValue += Number(po.total_amount) || 0;
            if (isDeliveredStatus(po.status)) deliveredCount++;
            else if (isPendingOrSentStatus(po.status)) pendingCount++;
        });

        return {
            totalCount: purchaseOrders.length,
            totalValue,
            pendingCount,
            deliveredCount,
        };
    }, [purchaseOrders]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {
            ALL: purchaseOrders.length,
            PENDING: 0,
            CONFIRMED: 0,
            DELIVERED: 0,
            REJECTED: 0,
            CANCELLED: 0,
        };
        purchaseOrders.forEach((po) => {
            if (isDeliveredStatus(po.status)) counts.DELIVERED++;
            else if (isConfirmedStatus(po.status)) counts.CONFIRMED++;
            else if (isRejectedStatus(po.status)) counts.REJECTED++;
            else if (isCancelledStatus(po.status)) counts.CANCELLED++;
            else counts.PENDING++;
        });
        return counts;
    }, [purchaseOrders]);

    // Computed Metrics & Filtering for Defective Items & Claims
    const activeDefectsCount = useMemo(() => {
        return supplierReturnRequests.filter(
            (r) =>
                (r.status as string) === "Awaiting Supplier Response" ||
                r.supplier_responsibility === "Pending Supplier Confirmation"
        ).length;
    }, [supplierReturnRequests]);

    const defectMetrics = useMemo(() => {
        let actionNeeded = 0;
        let inTransit = 0;
        let resolved = 0;

        supplierReturnRequests.forEach((req) => {
            const st = req.status as string;
            if (
                st === "Awaiting Supplier Response" ||
                req.supplier_responsibility === "Pending Supplier Confirmation"
            ) {
                actionNeeded++;
            } else if (
                st === "Approved for Return" ||
                st === "Return in Transit"
            ) {
                inTransit++;
            } else if (
                st === "Resolved" ||
                st === "Claim Closed" ||
                st === "Replacement Dispatched"
            ) {
                resolved++;
            }
        });

        return {
            total: supplierReturnRequests.length,
            actionNeeded,
            inTransit,
            resolved,
        };
    }, [supplierReturnRequests]);

    const defectStatusCounts = useMemo(() => {
        const counts: Record<string, number> = {
            ALL: supplierReturnRequests.length,
            ACTION_NEEDED: 0,
            INVESTIGATION: 0,
            IN_TRANSIT: 0,
            DISPATCHED: 0,
            RESOLVED: 0,
        };
        supplierReturnRequests.forEach((r) => {
            const st = r.status as string;
            if (
                st === "Awaiting Supplier Response" ||
                r.supplier_responsibility === "Pending Supplier Confirmation"
            ) {
                counts.ACTION_NEEDED++;
            }
            if (st === "Under Investigation") {
                counts.INVESTIGATION++;
            }
            if (st === "Approved for Return" || st === "Return in Transit") {
                counts.IN_TRANSIT++;
            }
            if (st === "Replacement Dispatched") {
                counts.DISPATCHED++;
            }
            if (st === "Resolved" || st === "Claim Closed") {
                counts.RESOLVED++;
            }
        });
        return counts;
    }, [supplierReturnRequests]);

    const debouncedDefectsSearch = useDebounce(defectsSearchQuery, 300);

    const filteredDefectRequests = useMemo(() => {
        return supplierReturnRequests.filter((req) => {
            const st = req.status as string;
            if (defectsStatusFilter === "ACTION_NEEDED") {
                if (
                    st !== "Awaiting Supplier Response" &&
                    req.supplier_responsibility !== "Pending Supplier Confirmation"
                ) {
                    return false;
                }
            } else if (defectsStatusFilter === "INVESTIGATION") {
                if (st !== "Under Investigation") return false;
            } else if (defectsStatusFilter === "IN_TRANSIT") {
                if (st !== "Approved for Return" && st !== "Return in Transit") {
                    return false;
                }
            } else if (defectsStatusFilter === "DISPATCHED") {
                if (st !== "Replacement Dispatched") return false;
            } else if (defectsStatusFilter === "RESOLVED") {
                if (st !== "Resolved" && st !== "Claim Closed") return false;
            }

            if (debouncedDefectsSearch) {
                const q = debouncedDefectsSearch.toLowerCase();
                const matchReq = req.return_request_number?.toLowerCase().includes(q);
                const matchPo = req.po_number?.toLowerCase().includes(q);
                const matchItem =
                    req.item_name?.toLowerCase().includes(q) ||
                    req.item_code?.toLowerCase().includes(q);
                const matchDefect =
                    req.defect_type?.toLowerCase().includes(q) ||
                    req.defect_description?.toLowerCase().includes(q);
                const matchStatus = req.status?.toLowerCase().includes(q);
                if (!matchReq && !matchPo && !matchItem && !matchDefect && !matchStatus) return false;
            }

            return true;
        });
    }, [supplierReturnRequests, defectsStatusFilter, debouncedDefectsSearch]);

    const paginatedDefectRequests = useMemo(() => {
        const start = (defectsCurrentPage - 1) * defectsPageSize;
        return filteredDefectRequests.slice(start, start + defectsPageSize);
    }, [filteredDefectRequests, defectsCurrentPage, defectsPageSize]);

    const defectsTotalPages = Math.ceil(filteredDefectRequests.length / defectsPageSize) || 1;

    const getReturnStatusTone = (status: string): BadgeTone => {
        switch (status) {
            case "Awaiting Supplier Response":
            case "Pending Review":
                return "amber";
            case "Under Investigation":
            case "Approved for Return":
            case "Return in Transit":
                return "blue";
            case "Replacement Dispatched":
            case "Resolved":
            case "Claim Closed":
                return "emerald";
            case "Rejected by Vendor":
            case "Claim Rejected":
            case "Rejected":
                return "rose";
            default:
                return "neutral";
        }
    };

    const getResponsibilityTone = (resp?: string): BadgeTone => {
        switch (resp) {
            case "Supplier Responsible":
                return "emerald";
            case "Pending Supplier Confirmation":
                return "amber";
            case "Supplier Not Responsible":
            case "Disputed / Further Investigation Required":
                return "rose";
            default:
                return "neutral";
        }
    };

    return (
        <div className="w-full space-y-5 sm:space-y-6 animate-fade-in bgCard">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Purchase Orders & Returns
                        </h2>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 sm:mt-1">
                        View orders, review line items, manage fulfillment stages, and review official defect claims & return workflows.
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <AppButton
                        variant="neutral"
                        size="sm"
                        icon={RefreshCw}
                        iconClassName={(isLoading || isLoadingReturns) ? "animate-spin text-pink-500" : "text-pink-500"}
                        onClick={() => {
                            fetchOrders();
                            fetchReturnRequests();
                        }}
                        disabled={isLoading || isLoadingReturns}
                    >
                        Refresh
                    </AppButton>
                </div>
            </div>

            {/* Top-Level Main Tab Switcher */}
            <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
                <button
                    onClick={() => setActiveMainTab("orders")}
                    className={`pb-2 px-3 text-xs sm:text-sm font-black flex items-center gap-2 transition-all border-b-2 cursor-pointer active:scale-95 ${
                        activeMainTab === "orders"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>Purchase Orders</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeMainTab === "orders"
                            ? "bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                        {purchaseOrders.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveMainTab("defects")}
                    className={`pb-2 px-3 text-xs sm:text-sm font-black flex items-center gap-2 transition-all border-b-2 cursor-pointer active:scale-95 ${
                        activeMainTab === "defects"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Defective Items & Return Claims</span>
                    {activeDefectsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]">
                            {activeDefectsCount} Action Required
                        </span>
                    ) : supplierReturnRequests.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {supplierReturnRequests.length}
                        </span>
                    ) : null}
                </button>
            </div>

            {activeMainTab === "orders" ? (
                <>

            {/* KPI Stat Cards */}
            {isLoading ? (
                <CardsSkeleton count={4} />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Cards
                        frontIcon="fas fa-file-invoice"
                        header="Total Orders"
                        data={metrics.totalCount.toString()}
                        arrow="fas fa-box"
                        description="All assigned POs"
                        frontTextColor="text-pink-500"
                        backHeader="Order Summary"
                        backDescription="Total cumulative purchase orders issued to your supplier account."
                    />
                    <Cards
                        frontIcon="fas fa-coins"
                        header="Total Value"
                        data={`₱${(metrics.totalValue / 1000).toFixed(1)}k`}
                        arrow="fas fa-chart-line"
                        description="Gross transaction"
                        frontTextColor="text-pink-500"
                        backHeader="Total Value"
                        backDescription={`Exact gross order amount: ${formatCurrency(metrics.totalValue)}`}
                    />
                    <Cards
                        frontIcon="fas fa-clock"
                        header="Pending Acceptance"
                        data={metrics.pendingCount.toString()}
                        arrow="fas fa-bell"
                        description="Awaiting review"
                        frontTextColor="text-pink-500"
                        backHeader="Pending Orders"
                        backDescription="POs awaiting supplier verification and confirmation."
                    />
                    <Cards
                        frontIcon="fas fa-truck-ramp-box"
                        header="Fulfilled Orders"
                        data={metrics.deliveredCount.toString()}
                        arrow="fas fa-circle-check"
                        description="Completed deliveries"
                        frontTextColor="text-pink-500"
                        backHeader="Fulfilled Orders"
                        backDescription="Total orders delivered and accepted by Airship Express."
                    />
                </div>
            )}

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                {[
                    { id: "ALL", label: "All Orders", count: statusCounts.ALL },
                    { id: "PENDING", label: "Pending / Issued", count: statusCounts.PENDING },
                    { id: "CONFIRMED", label: "Confirmed", count: statusCounts.CONFIRMED },
                    { id: "DELIVERED", label: "Delivered", count: statusCounts.DELIVERED },
                    { id: "REJECTED", label: "Rejected", count: statusCounts.REJECTED },
                    { id: "CANCELLED", label: "Cancelled", count: statusCounts.CANCELLED },
                ].map((tab) => {
                    const active = selectedStatus === tab.id;
                    return (
                        <button
                            key={`tab_${tab.id}`}
                            onClick={() => {
                                setSelectedStatus(tab.id);
                                setCurrentPage(1);
                            }}
                            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 ${
                                active
                                    ? "text-white bg-gradient-to-b from-pink-500 to-pink-600 border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5)] font-bold"
                                    : "text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]"
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                active ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Table & Search Card */}
            {isLoading ? (
                <TableSkeleton 
                    cols={7} 
                    rows={6} 
                    hasHeader={true} 
                    hasSearch={true} 
                    hasPagination={true} 
                />
            ) : (
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl p-3.5 sm:p-5 border border-white/80 dark:border-white/[0.08] shadow-[10px_10px_28px_rgba(166,175,195,0.35),-10px_-10px_28px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.7)] space-y-4">
                    {/* Search Bar & Table Toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by PO number, notes, status..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium bg-[#ebf0f7] dark:bg-[#13141c] text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] focus:outline-hidden focus:ring-2 focus:ring-pink-500/50 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                                >
                                    Clear search
                                </button>
                            )}
                            <AppButton
                                variant="neutral"
                                size="sm"
                                icon={Download}
                                iconClassName="text-pink-500"
                                onClick={handleExportCSV}
                                disabled={filteredOrders.length === 0}
                                title="Export current list"
                            >
                                Export
                            </AppButton>
                        </div>
                    </div>

                    {/* Mobile Orders Card View (Visible on small screens) */}
                    <div className="block md:hidden space-y-3">
                        {paginatedOrders.length === 0 ? (
                            <EmptyState
                                title={searchQuery || selectedStatus !== "ALL" ? "No Matching Orders" : "No Purchase Orders Found"}
                                description={searchQuery || selectedStatus !== "ALL" ? "Try adjusting your search query or switching the status filter." : "There are currently no purchase orders registered to your supplier portal."}
                                isFilterActive={Boolean(searchQuery || selectedStatus !== "ALL")}
                                onClearSearch={() => {
                                    setSearchQuery("");
                                    setSelectedStatus("ALL");
                                    setCurrentPage(1);
                                }}
                            />
                        ) : (
                            paginatedOrders.map((po, index) => {
                                const uniqueCardKey = `po_card_${po.id || 'idx'}_${index}`;
                                return (
                                    <div
                                        key={uniqueCardKey}
                                        className="p-4 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#13141c]/70 border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)] space-y-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-pink-500" />
                                                <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400">
                                                    {po.po_number}
                                                </span>
                                            </div>
                                            <StatusBadge
                                                tone={getPOStatusTone(po.status || "Pending")}
                                                size="xs"
                                            >
                                                {po.status || "Pending"}
                                            </StatusBadge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="p-2 rounded-xl bg-[#f0f3f8] dark:bg-[#181924] border border-white/80 dark:border-white/[0.04]">
                                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Amount</span>
                                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                                    {formatCurrency(po.total_amount)}
                                                </span>
                                            </div>
                                            <div className="p-2 rounded-xl bg-[#f0f3f8] dark:bg-[#181924] border border-white/80 dark:border-white/[0.04]">
                                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Payment</span>
                                                <span className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                                                    po.paid 
                                                        ? "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                }`}>
                                                    {po.paid ? "Paid" : "Unpaid"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
                                            <span>Due: {formatDate(po.delivery_date)}</span>
                                            <span>Ordered: {formatDate(po.created_at)}</span>
                                        </div>

                                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                {isConfirmedStatus(po.status) ? (
                                                    <>
                                                        <AppButton
                                                            variant="success"
                                                            size="xs"
                                                            icon={CheckCircle2}
                                                            onClick={() => requestStatusChange(po, "delivered")}
                                                            disabled={isUpdatingStatus}
                                                            title="Confirm Order Delivery"
                                                        >
                                                            Delivered
                                                        </AppButton>
                                                        <AppButton
                                                            variant="danger"
                                                            size="xs"
                                                            icon={RotateCcw}
                                                            onClick={() => requestStatusChange(po, "revert")}
                                                            disabled={isUpdatingStatus}
                                                            title="Revert Confirmed Order"
                                                        >
                                                            Revert
                                                        </AppButton>
                                                    </>
                                                ) : isRejectedStatus(po.status) ? (
                                                    <>
                                                        <AppButton
                                                            variant="danger"
                                                            size="xs"
                                                            icon={RotateCcw}
                                                            onClick={() => requestStatusChange(po, "revert")}
                                                            disabled={isUpdatingStatus}
                                                            title="Revert Rejected Order"
                                                        >
                                                            Revert
                                                        </AppButton>
                                                    </>
                                                ) : isDeliveredStatus(po.status) ? (
                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 rounded-xl">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                                                    </span>
                                                ) : (
                                                    <>
                                                        <AppButton
                                                            variant="pink"
                                                            size="xs"
                                                            icon={Check}
                                                            onClick={() => requestStatusChange(po, "accept")}
                                                            disabled={isUpdatingStatus}
                                                            title="Accept Purchase Order"
                                                        >
                                                            Accept
                                                        </AppButton>
                                                        <AppButton
                                                            variant="danger"
                                                            size="xs"
                                                            icon={X}
                                                            onClick={() => requestStatusChange(po, "reject")}
                                                            disabled={isUpdatingStatus}
                                                            title="Reject Purchase Order"
                                                        >
                                                            Reject
                                                        </AppButton>
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/suppliers_page/messages?po=${po.po_number}`}
                                                    className="p-1.5 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-500/20 flex items-center justify-center cursor-pointer active:scale-95"
                                                    title="Inquire About PO"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                </Link>
                                                <AppButton
                                                    variant="neutral"
                                                    size="xs"
                                                    icon={Eye}
                                                    iconClassName="text-pink-500"
                                                    onClick={() => setSelectedPo(po)}
                                                >
                                                    Details
                                                </AppButton>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop & Tablet Table Container */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/60 dark:border-white/[0.04]">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[#ebf0f7]/70 dark:bg-[#13141c]/70 text-slate-500 dark:text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                                    <th className="py-3.5 px-3 sm:px-4">PO Number</th>
                                    <th className="py-3.5 px-3 sm:px-4">Order Date</th>
                                    <th className="py-3.5 px-3 sm:px-4">Delivery Due</th>
                                    <th className="py-3.5 px-3 sm:px-4">Total Amount</th>
                                    <th className="py-3.5 px-3 sm:px-4">Payment</th>
                                    <th className="py-3.5 px-3 sm:px-4">Status</th>
                                    <th className="py-3.5 px-3 sm:px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                {paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-6">
                                            <EmptyState
                                                title={searchQuery || selectedStatus !== "ALL" ? "No Matching Orders" : "No Purchase Orders Found"}
                                                description={searchQuery || selectedStatus !== "ALL" ? "Try adjusting your search query or switching the status filter." : "There are currently no purchase orders registered to your supplier portal."}
                                                isFilterActive={Boolean(searchQuery || selectedStatus !== "ALL")}
                                                onClearSearch={() => {
                                                    setSearchQuery("");
                                                    setSelectedStatus("ALL");
                                                    setCurrentPage(1);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedOrders.map((po, index) => {
                                        const uniquePoKey = `po_row_${po.id || 'idx'}_${index}`;
                                        return (
                                            <tr
                                                key={uniquePoKey}
                                                className="hover:bg-slate-200/30 dark:hover:bg-slate-800/30 transition-colors"
                                            >
                                                <td className="py-3.5 px-3 sm:px-4 font-bold text-slate-800 dark:text-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-pink-600 dark:text-pink-400 font-bold">{po.po_number}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4 text-slate-600 dark:text-slate-400 font-medium">
                                                    {formatDate(po.created_at)}
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4 text-slate-600 dark:text-slate-400 font-medium">
                                                    {formatDate(po.delivery_date)}
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                                                    {formatCurrency(po.total_amount)}
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        po.paid 
                                                            ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20"
                                                            : "bg-slate-200/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/40"
                                                    }`}>
                                                        {po.paid ? "Paid" : "Unpaid"}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4">
                                                    <StatusBadge
                                                        tone={getPOStatusTone(po.status || "Pending")}
                                                        size="sm"
                                                    >
                                                        {po.status || "Pending"}
                                                    </StatusBadge>
                                                </td>
                                                <td className="py-3.5 px-3 sm:px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {isConfirmedStatus(po.status) ? (
                                                            <>
                                                                <AppButton
                                                                    variant="success"
                                                                    size="xs"
                                                                    icon={CheckCircle2}
                                                                    onClick={() => requestStatusChange(po, "delivered")}
                                                                    disabled={isUpdatingStatus}
                                                                    title="Confirm Delivery"
                                                                >
                                                                    Delivered
                                                                </AppButton>
                                                                <AppButton
                                                                    variant="danger"
                                                                    size="xs"
                                                                    icon={RotateCcw}
                                                                    onClick={() => requestStatusChange(po, "revert")}
                                                                    disabled={isUpdatingStatus}
                                                                    title="Revert Confirmed Order"
                                                                >
                                                                    Revert
                                                                </AppButton>
                                                            </>
                                                        ) : isRejectedStatus(po.status) ? (
                                                            <>
                                                                <AppButton
                                                                    variant="danger"
                                                                    size="xs"
                                                                    icon={RotateCcw}
                                                                    onClick={() => requestStatusChange(po, "revert")}
                                                                    disabled={isUpdatingStatus}
                                                                    title="Revert Rejected Order"
                                                                >
                                                                    Revert
                                                                </AppButton>
                                                            </>
                                                        ) : isDeliveredStatus(po.status) ? (
                                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 rounded-xl">
                                                                <CheckCircle2 className="w-3 h-3" /> Done
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <AppButton
                                                                    variant="pink"
                                                                    size="xs"
                                                                    icon={Check}
                                                                    onClick={() => requestStatusChange(po, "accept")}
                                                                    disabled={isUpdatingStatus}
                                                                    title="Accept Order"
                                                                >
                                                                    Accept
                                                                </AppButton>
                                                                <AppButton
                                                                    variant="danger"
                                                                    size="xs"
                                                                    icon={X}
                                                                    onClick={() => requestStatusChange(po, "reject")}
                                                                    disabled={isUpdatingStatus}
                                                                    title="Reject Order"
                                                                >
                                                                    Reject
                                                                </AppButton>
                                                            </>
                                                        )}
                                                        <AppButton
                                                            variant="neutral"
                                                            size="xs"
                                                            icon={Eye}
                                                            iconClassName="text-pink-500"
                                                            onClick={() => setSelectedPo(po)}
                                                            title="View PO Details"
                                                        >
                                                            Details
                                                        </AppButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination & Footer Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>
                                Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
                                {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400">Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2 py-1 rounded-xl text-xs font-semibold bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] focus:outline-hidden cursor-pointer"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={(p) => setCurrentPage(p)}
                        />
                    </div>
                </div>
            )}
                </>
            ) : (
                /* Defective Claims View */
                <div className="space-y-5 animate-fade-in">
                    {/* Defect KPI Cards */}
                    {isLoadingReturns ? (
                        <CardsSkeleton count={4} />
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <Cards
                                frontIcon="fas fa-triangle-exclamation"
                                header="Total Defect Claims"
                                data={defectMetrics.total.toString()}
                                arrow="fas fa-boxes-stacked"
                                description="Inspection reports"
                                frontTextColor="text-pink-500"
                                backHeader="Claims Summary"
                                backDescription="Total defective item return claims reported by warehouse quality inspection."
                            />
                            <Cards
                                frontIcon="fas fa-bell"
                                header="Action Required"
                                data={defectMetrics.actionNeeded.toString()}
                                arrow="fas fa-exclamation"
                                description="Awaiting response"
                                frontTextColor="text-rose-500"
                                backHeader="Action Needed"
                                backDescription="Defective claims awaiting supplier acknowledgment, RMA assignment, or response."
                            />
                            <Cards
                                frontIcon="fas fa-truck-fast"
                                header="Returns In Transit"
                                data={defectMetrics.inTransit.toString()}
                                arrow="fas fa-arrow-right-arrow-left"
                                description="Approved / Dispatch"
                                frontTextColor="text-pink-500"
                                backHeader="Return Logistics"
                                backDescription="Defective items approved for return or currently in transit back to supplier."
                            />
                            <Cards
                                frontIcon="fas fa-circle-check"
                                header="Resolved & Closed"
                                data={defectMetrics.resolved.toString()}
                                arrow="fas fa-check-double"
                                description="Replaced / Credited"
                                frontTextColor="text-emerald-500"
                                backHeader="Resolved Claims"
                                backDescription="Defective items replaced, restocked, or settled through vendor credit."
                            />
                        </div>
                    )}

                    {/* Defect Quick Status Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                        {[
                            { id: "ALL", label: "All Claims", count: defectStatusCounts.ALL },
                            { id: "ACTION_NEEDED", label: "Action Needed", count: defectStatusCounts.ACTION_NEEDED, highlight: true },
                            { id: "INVESTIGATION", label: "Under Investigation", count: defectStatusCounts.INVESTIGATION },
                            { id: "IN_TRANSIT", label: "Approved / In Transit", count: defectStatusCounts.IN_TRANSIT },
                            { id: "DISPATCHED", label: "Replacement Dispatched", count: defectStatusCounts.DISPATCHED },
                            { id: "RESOLVED", label: "Resolved & Closed", count: defectStatusCounts.RESOLVED },
                        ].map((tab) => {
                            const active = defectsStatusFilter === tab.id;
                            return (
                                <button
                                    key={`def_tab_${tab.id}`}
                                    onClick={() => {
                                        setDefectsStatusFilter(tab.id);
                                        setDefectsCurrentPage(1);
                                    }}
                                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 ${
                                        active
                                            ? "text-white bg-gradient-to-b from-pink-500 to-pink-600 border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5)] font-bold"
                                            : "text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]"
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                            active
                                                ? "bg-white/20 text-white"
                                                : tab.highlight && tab.count > 0
                                                ? "bg-rose-500 text-white"
                                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Defect Claims Table & Search Card */}
                    {isLoadingReturns ? (
                        <TableSkeleton
                            cols={7}
                            rows={5}
                            hasHeader={true}
                            hasSearch={true}
                            hasPagination={true}
                        />
                    ) : (
                        <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl p-3.5 sm:p-5 border border-white/80 dark:border-white/[0.08] shadow-[10px_10px_28px_rgba(166,175,195,0.35),-10px_-10px_28px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.7)] space-y-4">
                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                                <div className="relative max-w-md w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by Request #, PO #, item, defect reason..."
                                        value={defectsSearchQuery}
                                        onChange={(e) => {
                                            setDefectsSearchQuery(e.target.value);
                                            setDefectsCurrentPage(1);
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium bg-[#ebf0f7] dark:bg-[#13141c] text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] focus:outline-hidden focus:ring-2 focus:ring-pink-500/50 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    {defectsSearchQuery && (
                                        <button
                                            onClick={() => setDefectsSearchQuery("")}
                                            className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                                        >
                                            Clear search
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Claims Table */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-100/50 dark:bg-slate-900/40">
                                            <th className="py-3 px-3 sm:px-4">Return Request & Date</th>
                                            <th className="py-3 px-3 sm:px-4">PO & Line Item</th>
                                            <th className="py-3 px-3 sm:px-4">Defect Issue & Evidence</th>
                                            <th className="py-3 px-3 sm:px-4">Resolution Type</th>
                                            <th className="py-3 px-3 sm:px-4">Return Status</th>
                                            <th className="py-3 px-3 sm:px-4">Responsibility</th>
                                            <th className="py-3 px-3 sm:px-4 text-right">Official Review</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {paginatedDefectRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center">
                                                    <EmptyState
                                                        title="No Defect Claims Found"
                                                        description="There are currently no return requests or defect notices matching your filter."
                                                        icon="fas fa-shield-check"
                                                        isFilterActive={Boolean(defectsSearchQuery || defectsStatusFilter !== "ALL")}
                                                        onClearSearch={() => {
                                                            setDefectsSearchQuery("");
                                                            setDefectsStatusFilter("ALL");
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedDefectRequests.map((req) => {
                                                const hasActionNeeded =
                                                    req.status === "Awaiting Supplier Response" ||
                                                    req.supplier_responsibility === "Pending Supplier Confirmation";

                                                return (
                                                    <tr
                                                        key={`req_${req.id}`}
                                                        className={`transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/40 ${
                                                            hasActionNeeded ? "bg-rose-50/40 dark:bg-rose-950/10" : ""
                                                        }`}
                                                    >
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                                    {req.return_request_number}
                                                                    {hasActionNeeded && (
                                                                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                                                                    )}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400">
                                                                    {formatDate(req.inspection_date || req.created_at)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-sans">
                                                                    By: {req.reported_by || "QC Inspector"}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <div className="flex flex-col gap-0.5 max-w-[200px]">
                                                                <span className="font-mono text-pink-600 dark:text-pink-400 font-bold">
                                                                    #{req.po_number}
                                                                </span>
                                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                    {req.item_name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500">
                                                                    Defective:{" "}
                                                                    <strong className="text-rose-600 dark:text-rose-400 font-mono">
                                                                        {req.defective_quantity}
                                                                    </strong>{" "}
                                                                    / {req.quantity_received} {req.unit}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <div className="flex flex-col gap-1 max-w-[240px]">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                                        {req.defect_type || "Damaged"}
                                                                    </span>
                                                                    {req.evidence_urls && req.evidence_urls.length > 0 && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                            <ImageIcon className="w-3 h-3 text-pink-500" />
                                                                            {req.evidence_urls.length} photo{req.evidence_urls.length > 1 ? "s" : ""}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                                                    {req.defect_description || "Inspection discrepancy reported."}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 inline-block">
                                                                {req.requested_resolution || "Replacement"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <StatusBadge
                                                                tone={getReturnStatusTone(req.status)}
                                                                size="sm"
                                                            >
                                                                {req.status}
                                                            </StatusBadge>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4">
                                                            <StatusBadge
                                                                tone={getResponsibilityTone(req.supplier_responsibility)}
                                                                size="sm"
                                                            >
                                                                {req.supplier_responsibility || "Pending Confirmation"}
                                                            </StatusBadge>
                                                        </td>
                                                        <td className="py-3.5 px-3 sm:px-4 text-right">
                                                            <AppButton
                                                                variant="pink"
                                                                size="xs"
                                                                icon={ShieldAlert}
                                                                onClick={() => {
                                                                    setSelectedReturnForModal(req);
                                                                    setIsReturnModalOpen(true);
                                                                }}
                                                            >
                                                                Review & Respond
                                                            </AppButton>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Defect Pagination */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span>
                                        Showing{" "}
                                        {filteredDefectRequests.length > 0
                                            ? (defectsCurrentPage - 1) * defectsPageSize + 1
                                            : 0}{" "}
                                        to {Math.min(defectsCurrentPage * defectsPageSize, filteredDefectRequests.length)}{" "}
                                        of {filteredDefectRequests.length} claims
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-slate-400">Per page:</span>
                                        <select
                                            value={defectsPageSize}
                                            onChange={(e) => {
                                                setDefectsPageSize(Number(e.target.value));
                                                setDefectsCurrentPage(1);
                                            }}
                                            className="px-2 py-1 rounded-xl text-xs font-semibold bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] focus:outline-hidden cursor-pointer"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                </div>
                                <Pagination
                                    currentPage={defectsCurrentPage}
                                    totalPages={defectsTotalPages}
                                    onPageChange={(p) => setDefectsCurrentPage(p)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Purchase Order Details Modal */}
            {selectedPo && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-[#f0f3f8] dark:bg-[#181926] max-w-2xl w-full rounded-3xl p-6 border border-white/90 dark:border-white/[0.08] max-h-[90vh] flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                                            PO Ref: {selectedPo.po_number}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Issue Date: {((selectedPo.admin_approval === 'Approved' || (selectedPo as any).financial_approval === 'Approved') && selectedPo.admin_approval !== 'Pending' && (selectedPo as any).financial_approval !== 'Pending') 
                                                    ? formatDate((selectedPo as any).financial_approved_at || selectedPo.admin_approved_at || selectedPo.created_at) 
                                                    : 'Pending'}
                                            </p>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                <span>Admin & Finance Approved</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedPo(null)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto py-4 space-y-5">
                                {/* Summary Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{formatCurrency(selectedPo.total_amount)}</span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Date</span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatDate(selectedPo.delivery_date)}</span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
                                        <StatusBadge tone={getPOStatusTone(selectedPo.status || "Pending")} size="xs">
                                            {selectedPo.status || "Pending"}
                                        </StatusBadge>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment</span>
                                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400">{selectedPo.paid ? "Paid" : "Unpaid"}</span>
                                    </div>
                                </div>

                                {/* Delivery & Logistics Info */}
                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] text-xs">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Delivery Destination</span>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {selectedPo.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Express Central Hub)'}
                                    </p>
                                </div>

                                {/* Items Breakdown */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Line Items Breakdown
                                        </h4>
                                        <button
                                            onClick={() => handleExportSinglePoCSV(selectedPo)}
                                            className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <Download className="w-3 h-3" />
                                            <span>Export Line Items</span>
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto rounded-2xl border border-white/60 dark:border-white/[0.04] bg-[#ebf0f7]/50 dark:bg-[#13141c]/50">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="bg-slate-200/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500">
                                                    <th className="py-2.5 px-3">Item Description</th>
                                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                                                    <th className="py-2.5 px-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                                {Array.isArray(selectedPo.items) && selectedPo.items.length > 0 ? (
                                                    selectedPo.items.map((item: any, idx: number) => (
                                                        <tr key={`item_${selectedPo.id || 'po'}_${idx}`}>
                                                            <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                                                {item.item_name || item.description || `Item #${idx + 1}`}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                                                                {item.quantity || 1}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                {formatCurrency(item.unit_price || 0)}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                {formatCurrency(item.total_price || (item.quantity * item.unit_price) || 0)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="py-4 text-center text-slate-400">
                                                            Standard supply order package
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Order Notes */}
                                {selectedPo.notes && (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04]">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Order Notes</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300">{selectedPo.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer: Quick Actions */}
                            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                <Link
                                    href={`/suppliers_page/messages?po=${selectedPo.po_number}`}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-500/20 shadow-xs flex items-center gap-1.5"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Inquire About PO</span>
                                </Link>

                                <div className="flex items-center gap-2">
                                    {isConfirmedStatus(selectedPo.status) ? (
                                        <>
                                            <AppButton
                                                variant="success"
                                                size="sm"
                                                icon={CheckCircle2}
                                                onClick={() => requestStatusChange(selectedPo, "delivered")}
                                                disabled={isUpdatingStatus}
                                            >
                                                Mark as Delivered
                                            </AppButton>
                                            <AppButton
                                                variant="danger"
                                                size="sm"
                                                icon={RotateCcw}
                                                onClick={() => requestStatusChange(selectedPo, "revert")}
                                                disabled={isUpdatingStatus}
                                            >
                                                Revert Order
                                            </AppButton>
                                        </>
                                    ) : isRejectedStatus(selectedPo.status) ? (
                                        <>
                                            <AppButton
                                                variant="danger"
                                                size="sm"
                                                icon={RotateCcw}
                                                onClick={() => requestStatusChange(selectedPo, "revert")}
                                                disabled={isUpdatingStatus}
                                            >
                                                Revert Order
                                            </AppButton>
                                        </>
                                    ) : isDeliveredStatus(selectedPo.status) ? (
                                        <div className="px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 flex items-center gap-1.5 border border-emerald-500/20">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Delivered & Completed</span>
                                        </div>
                                    ) : (
                                        <>
                                            <AppButton
                                                variant="pink"
                                                size="sm"
                                                icon={Check}
                                                onClick={() => requestStatusChange(selectedPo, "accept")}
                                                disabled={isUpdatingStatus}
                                            >
                                                Accept Order
                                            </AppButton>
                                            <AppButton
                                                variant="danger"
                                                size="sm"
                                                icon={X}
                                                onClick={() => requestStatusChange(selectedPo, "reject")}
                                                disabled={isUpdatingStatus}
                                            >
                                                Reject Order
                                            </AppButton>
                                        </>
                                    )}

                                    <AppButton
                                        variant="neutral"
                                        size="sm"
                                        onClick={() => setSelectedPo(null)}
                                    >
                                        Close
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Status Action Confirmation Modal */}
            {confirmModal && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-[#f0f3f8] dark:bg-[#181926] max-w-md w-full rounded-3xl p-6 border border-white/90 dark:border-white/[0.08] flex flex-col space-y-4">
                            <div className="flex items-start gap-3.5">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                    confirmModal.confirmButtonColor === "pink"
                                        ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20"
                                        : confirmModal.confirmButtonColor === "emerald"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                }`}>
                                    {confirmModal.actionType === "accept" && <Check className="w-5 h-5" />}
                                    {confirmModal.actionType === "delivered" && <CheckCircle2 className="w-5 h-5" />}
                                    {confirmModal.actionType === "reject" && <X className="w-5 h-5" />}
                                    {(confirmModal.actionType === "revert" || confirmModal.actionType === "cancel") && <RotateCcw className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                                            {confirmModal.title}
                                        </h3>
                                        <button
                                            onClick={() => setConfirmModal(null)}
                                            disabled={isUpdatingStatus}
                                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.08] cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                        {confirmModal.description}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/60 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono">
                                <span className="text-slate-400 font-sans">PO Reference:</span>
                                <span className="font-bold text-pink-600 dark:text-pink-400">{confirmModal.poNumber}</span>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                                <AppButton
                                    variant="neutral"
                                    size="sm"
                                    onClick={() => setConfirmModal(null)}
                                    disabled={isUpdatingStatus}
                                >
                                    Cancel
                                </AppButton>
                                <AppButton
                                    variant={
                                        confirmModal.confirmButtonColor === "pink"
                                            ? "pink"
                                            : confirmModal.confirmButtonColor === "emerald"
                                            ? "success"
                                            : "danger"
                                    }
                                    size="sm"
                                    loading={isUpdatingStatus}
                                    onClick={handleExecuteConfirmStatus}
                                >
                                    {confirmModal.confirmButtonText}
                                </AppButton>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Supplier Return Details & Resolution Modal */}
            <SupplierReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => {
                    setIsReturnModalOpen(false);
                    setSelectedReturnForModal(null);
                }}
                returnRequest={selectedReturnForModal}
                supplierAccount={supplierAccount}
                onUpdated={() => {
                    fetchReturnRequests();
                    fetchOrders();
                }}
            />
        </div>
    );
}
