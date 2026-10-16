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
    Image as ImageIcon,
    Receipt
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
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

const DigitalReceiptModal = dynamic(
    () => import("../../../components/modals/DigitalReceiptModal").then((m) => m.DigitalReceiptModal),
    { ssr: false }
);

interface PurchaseOrderItem {
    name?: string;
    item_name?: string;
    description?: string;
    quantity: number;
    unit_price: number;
    price?: number;
    total?: number;
    total_price: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id?: string;
    supplier_id: string;
    supplier_name?: string;
    supplier_email?: string;
    supplier_location?: string;
    supplier_address?: string;
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
    payment_terms?: string;
    terms_and_conditions?: string;
    admin_approval?: string;
    admin_approved_at?: string;
    financial_approval?: string;
    financial_approved_at?: string;
    notes?: string;
    items?: PurchaseOrderItem[] | any;
    paid?: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
}

// Helper to check if a Purchase Order is approved by both Admin and Finance, officially Issued, and NOT rejected
export function isApprovedAndIssuedPO(po: any): boolean {
    if (!po) return false;
    
    // 1. Admin Approval must be Approved
    const admApproved = String(po.admin_approval || "").trim().toLowerCase() === "approved";
    if (!admApproved) return false;

    // 2. Financial Approval must be Approved
    const finApproved = String(po.financial_approval || "").trim().toLowerCase() === "approved";
    if (!finApproved) return false;

    // 3. Must not be rejected, draft, or pending approval
    const st = String(po.status || "").trim().toLowerCase();
    if (
        st === "draft" || 
        st === "pending approval" || 
        st === "pending_approval" || 
        st === "rejected" || 
        st.includes("reject")
    ) {
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
    const [selectedPoTab, setSelectedPoTab] = useState<"details" | "manage">("details");
    const [digitalReceiptPO, setDigitalReceiptPO] = useState<PurchaseOrder | null>(null);
    const [isDigitalReceiptModalOpen, setIsDigitalReceiptModalOpen] = useState(false);
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
            if (isRejectedStatus(po.status)) return false;

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

            const isNowRejected = normStatus === 'rejected' || normStatus.includes('reject');
            toast.success(`Purchase order status updated to ${newStatus}`);
            setPurchaseOrders((prev) => {
                if (isNowRejected) {
                    return prev.filter((p) => p.id !== poId);
                }
                return prev.map((p) => (p.id === poId ? { ...p, status: newStatus } : p));
            });
            if (selectedPo && selectedPo.id === poId) {
                if (isNowRejected) {
                    setSelectedPo(null);
                } else {
                    setSelectedPo({ ...selectedPo, status: newStatus });
                }
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

    // Calculate Summary Metrics (Excluding Rejected Orders)
    const metrics = useMemo(() => {
        let totalValue = 0;
        let pendingCount = 0;
        let deliveredCount = 0;
        let count = 0;

        purchaseOrders.forEach((po) => {
            if (isRejectedStatus(po.status)) return;
            count++;
            totalValue += Number(po.total_amount) || 0;
            if (isDeliveredStatus(po.status)) deliveredCount++;
            else if (isPendingOrSentStatus(po.status)) pendingCount++;
        });

        return {
            totalCount: count,
            totalValue,
            pendingCount,
            deliveredCount,
        };
    }, [purchaseOrders]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {
            ALL: purchaseOrders.filter((po) => !isRejectedStatus(po.status)).length,
            PENDING: 0,
            CONFIRMED: 0,
            DELIVERED: 0,
            CANCELLED: 0,
        };
        purchaseOrders.forEach((po) => {
            if (isRejectedStatus(po.status)) return;
            if (isDeliveredStatus(po.status)) counts.DELIVERED++;
            else if (isConfirmedStatus(po.status)) counts.CONFIRMED++;
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
                                                    onClick={() => {
                                                        setSelectedPo(po);
                                                        setSelectedPoTab("details");
                                                    }}
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
                                                            onClick={() => {
                                                                setSelectedPo(po);
                                                                setSelectedPoTab("details");
                                                            }}
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
                                                            {(() => {
                                                                const isResolvedOrDone =
                                                                    (req.status as string) === "Resolved" ||
                                                                    (req.status as string) === "Claim Closed" ||
                                                                    (req.status as string) === "Closed" ||
                                                                    (req.status as string) === "Rejected" ||
                                                                    req.resolution_details?.replacement_receiving_status === "Received & Restocked" ||
                                                                    (req as any).replacement_receiving_status === "Received & Restocked";

                                                                return (
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <AppButton
                                                                            variant={isResolvedOrDone ? "secondary" : "pink"}
                                                                            size="xs"
                                                                            icon={isResolvedOrDone ? CheckCircle2 : ShieldAlert}
                                                                            disabled={isResolvedOrDone}
                                                                            title={isResolvedOrDone ? "This return claim has been resolved and the process is complete" : "Review & Respond"}
                                                                            onClick={() => {
                                                                                if (isResolvedOrDone) return;
                                                                                setSelectedReturnForModal(req);
                                                                                setIsReturnModalOpen(true);
                                                                            }}
                                                                        >
                                                                            {isResolvedOrDone ? "Resolved & Closed" : "Review & Respond"}
                                                                        </AppButton>
                                                                        {isResolvedOrDone && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedReturnForModal(req);
                                                                                    setIsReturnModalOpen(true);
                                                                                }}
                                                                                title="View read-only claim details, photos & audit logs"
                                                                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
                                                                            >
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                <span className="text-[11px] font-semibold hidden sm:inline">View</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
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
                    <div 
                        className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-200" 
                        onClick={() => setSelectedPo(null)}
                    >
                        <div 
                            className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-[12px_12px_36px_rgba(166,175,195,0.45),-12px_-12px_36px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200" 
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-pink-600 border border-pink-400/80 text-white flex items-center justify-center text-lg shrink-0 shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4)]">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                                Purchase Order Details
                                            </h2>
                                            <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2.5 py-0.5 rounded-full border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                #{selectedPo.po_number}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                            {selectedPo.supplier_name || supplierAccount?.suppliers?.name || supplierAccount?.company_name || 'Airship Express Logistics'} • <span className="font-bold text-slate-800 dark:text-slate-200">₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDigitalReceiptPO(selectedPo);
                                            setIsDigitalReceiptModalOpen(true);
                                        }}
                                        className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                        title="View & Print Digital Receipt"
                                    >
                                        <Receipt className="h-3.5 w-3.5 text-pink-500" />
                                        <span>Digital Receipt</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPo(null)}
                                        className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                        aria-label="Close modal"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            </div>

                            {/* Segmented Tabs Bar */}
                            <div className="px-6 pt-3 pb-0 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200/70 dark:border-slate-800 flex gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPoTab('details')}
                                    className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                        selectedPoTab === 'details'
                                            ? 'bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                    }`}
                                >
                                    <i className="fas fa-file-lines text-xs" />
                                    <span>Overview & Line Items</span>
                                    {selectedPo.items && selectedPo.items.length > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-mono">
                                            {selectedPo.items.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPoTab('manage')}
                                    className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                        selectedPoTab === 'manage'
                                            ? 'bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                    }`}
                                >
                                    <i className="fas fa-sliders text-xs" />
                                    <span>Status & Fulfillment</span>
                                    <StatusBadge tone={getPOStatusTone(selectedPo.status)} size="xs">
                                        {selectedPo.status}
                                    </StatusBadge>
                                </button>
                            </div>

                            {/* Content Body */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                                {selectedPoTab === 'details' ? (
                                    <>
                                        {/* 4 Summary Metric Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider">Total Amount</span>
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                                                    ₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider">Due / Delivery</span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                                                    {selectedPo.delivery_date ? new Date(selectedPo.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Standard Schedule'}
                                                </span>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider mb-1">Status</span>
                                                <StatusBadge tone={getPOStatusTone(selectedPo.status)} size="xs">
                                                    {selectedPo.status}
                                                </StatusBadge>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider mb-1">Payment</span>
                                                {selectedPo.paid ? (
                                                    <StatusBadge tone="purple" icon="fas fa-check-circle" size="xs">
                                                        Paid ✓
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="amber" icon="fas fa-hourglass-half" size="xs">
                                                        Unpaid
                                                    </StatusBadge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Entity Information (Buyer & Supplier Panels) */}
                                        {(() => {
                                            const matchedSupplierName = selectedPo.supplier_name || supplierAccount?.suppliers?.name || supplierAccount?.company_name || 'Authorized Supplier';
                                            const supplierEmail = (selectedPo as any).supplier_email || supplierAccount?.email || currentUserEmail || 'Verified Partner';
                                            const supplierLocation = (selectedPo as any).supplier_location || (selectedPo as any).supplier_address || supplierAccount?.suppliers?.address || 'On File / Registered Supplier Facility';
                                            const isFinancialApproved = (selectedPo.financial_approval === 'Approved' || selectedPo.admin_approval === 'Approved') &&
                                                                        selectedPo.financial_approval !== 'Pending' &&
                                                                        selectedPo.admin_approval !== 'Pending';
                                            const approvalDateStr = selectedPo.financial_approved_at
                                                ? new Date(selectedPo.financial_approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : selectedPo.admin_approved_at
                                                    ? new Date(selectedPo.admin_approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : selectedPo.created_at
                                                        ? new Date(selectedPo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : '—';

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                                    {/* Buyer (Issuer) Card */}
                                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                                            <i className="fas fa-building text-xs" />
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Buyer (Issuer)</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                            Airship Express Logistics Corp.
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            Procurement & Supply Chain Division
                                                        </p>
                                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                            <i className="fas fa-map-marker-alt text-pink-500 mt-0.5 text-[10px] shrink-0" />
                                                            <span className="leading-tight">
                                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {selectedPo.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Express Central Hub)'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span>Authorized Signatory:</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{(selectedPo as any).created_by || 'Authorized Officer'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Supplier / Vendor Card */}
                                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                                            <i className="fas fa-truck text-xs" />
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Supplier / Vendor</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                            {matchedSupplierName}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                                                            {supplierEmail}
                                                        </p>
                                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                            <i className="fas fa-map-marker-alt text-pink-500 mt-0.5 text-[10px] shrink-0" />
                                                            <span className="leading-tight truncate" title={supplierLocation}>
                                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {supplierLocation}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span>Issue Date:</span>
                                                            {isFinancialApproved ? (
                                                                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                                    <i className="fas fa-calendar-check text-[10px] text-emerald-500" />
                                                                    {approvalDateStr}
                                                                </span>
                                                            ) : (
                                                                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-950/40 px-2 py-0.5 rounded-full text-[10px] border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                                                                    <i className="fas fa-hourglass-half text-[9px]" />
                                                                    Pending
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Full Itemized Line Items Table */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    <i className="fas fa-boxes-stacked text-pink-500" />
                                                    <span>Purchased Line Items</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleExportSinglePoCSV(selectedPo)}
                                                        className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        <span>Export CSV</span>
                                                    </button>
                                                    <span className="text-xs font-bold text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-900/50">
                                                        {Array.isArray(selectedPo.items) && selectedPo.items.length > 0 ? selectedPo.items.length : 1} {Array.isArray(selectedPo.items) && selectedPo.items.length === 1 ? 'item' : 'items'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#13141c] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-white/[0.02] text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                                                            <th className="py-2.5 px-3.5">Item Description</th>
                                                            <th className="py-2.5 px-3.5 text-center w-20">Qty</th>
                                                            <th className="py-2.5 px-3.5 text-right w-28">Unit Price</th>
                                                            <th className="py-2.5 px-3.5 text-right w-32">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                                                        {Array.isArray(selectedPo.items) && selectedPo.items.length > 0 ? (
                                                            selectedPo.items.map((it: any, idx: number) => {
                                                                const qty = Number(it.quantity) || 1;
                                                                const price = Number(it.unit_price ?? it.price ?? 0);
                                                                const lineTotal = it.total ? Number(it.total) : (it.total_price ? Number(it.total_price) : qty * price);

                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                                                        <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-xs">
                                                                            {idx + 1}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                                                                            {it.name || it.item_name || it.description || 'Purchased Item'}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-center">
                                                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04]">
                                                                                {qty}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                            ₱{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                            ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-xs">1</td>
                                                                <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                                                                    {selectedPo.notes || 'Requisition Order Package'}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-center font-mono text-xs">1</td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono">
                                                                    ₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                    ₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                    <tfoot>
                                                        {(selectedPo.subtotal !== undefined || selectedPo.discount || selectedPo.shipping_fee || selectedPo.tax_amount) ? (
                                                            <>
                                                                <tr className="border-t border-slate-200/80 dark:border-slate-800 bg-white/30 dark:bg-white/[0.01]">
                                                                    <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">Subtotal</td>
                                                                    <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                        ₱{Number(selectedPo.subtotal ?? selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                                {Number(selectedPo.discount || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">Discount</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            -₱{Number(selectedPo.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {Number(selectedPo.shipping_fee || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">Shipping Fee</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                            +₱{Number(selectedPo.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {Number(selectedPo.tax_amount || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">VAT ({selectedPo.tax_rate ?? 12}%)</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                            +₱{Number(selectedPo.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-white/[0.02]">
                                                                    <td colSpan={3} className="py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                                        Total Order Value
                                                                    </td>
                                                                    <td colSpan={2} className="py-2.5 px-3.5 text-right font-mono text-base font-black text-pink-600 dark:text-pink-400">
                                                                        ₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            </>
                                                        ) : (
                                                            <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-white/[0.01]">
                                                                <td colSpan={3} className="py-2.5 px-3.5 text-xs font-bold text-slate-500 uppercase">
                                                                    Total Order Value
                                                                </td>
                                                                <td colSpan={2} className="py-2.5 px-3.5 text-right font-mono text-base font-black text-pink-600 dark:text-pink-400">
                                                                    ₱{Number(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Commercial Logistics & Payment Terms Panel */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Payment Terms & Method
                                                </span>
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {selectedPo.payment_terms || 'Net 30 Days (Standard B2B)'}
                                                </p>
                                            </div>

                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Procurement Category
                                                </span>
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {selectedPo.category || (selectedPo as any).items?.[0]?.category || 'General Procurement'}
                                                </p>
                                            </div>

                                            <div className="sm:col-span-2 md:col-span-1 p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Delivery Location / Hub
                                                </span>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2" title={selectedPo.delivery_location || 'Airship Express Hub'}>
                                                    {selectedPo.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Governing Terms & Conditions Box */}
                                        {selectedPo.terms_and_conditions && (
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Governing Terms & Conditions
                                                </span>
                                                <p className="font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {selectedPo.terms_and_conditions}
                                                </p>
                                            </div>
                                        )}

                                        {/* Requisition Notes Box */}
                                        {selectedPo.notes && (
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Requisition Notes & Instructions
                                                </span>
                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {selectedPo.notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons Toolbar */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDigitalReceiptPO(selectedPo);
                                                    setIsDigitalReceiptModalOpen(true);
                                                }}
                                                className="py-2.5 px-4 text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 border border-pink-400/80 rounded-xl shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                            >
                                                <Receipt className="h-4 w-4" />
                                                <span>View & Print Official Digital Receipt</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSelectedPoTab('manage')}
                                                className="py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#1a1b26] hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-[#2a2b38] rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                            >
                                                <i className="fas fa-sliders text-pink-500" />
                                                <span>Manage Status & Fulfillment</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Status & Fulfillment Management Tab */}
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                        Current Fulfillment State
                                                    </span>
                                                    <StatusBadge tone={getPOStatusTone(selectedPo.status)} size="sm">
                                                        {selectedPo.status}
                                                    </StatusBadge>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    {isConfirmedStatus(selectedPo.status)
                                                        ? "This purchase order has been accepted and confirmed. After preparing and delivering items to the hub, mark the order as Delivered."
                                                        : isDeliveredStatus(selectedPo.status)
                                                        ? "Order has been fulfilled and marked as Delivered. Receiving personnel have been notified for inspection."
                                                        : "This purchase order has been issued by Airship Express. Please review the line items and terms, then accept or reject this order."}
                                                </p>
                                            </div>

                                            {/* Status Action Controls */}
                                            <div className="space-y-2.5">
                                                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                                    <i className="fas fa-arrows-rotate text-pink-500 text-[11px]" />
                                                    Order Actions
                                                </label>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    {isConfirmedStatus(selectedPo.status) ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestStatusChange(selectedPo, "delivered")}
                                                                disabled={isUpdatingStatus}
                                                                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                <span>Confirm Delivered</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestStatusChange(selectedPo, "revert")}
                                                                disabled={isUpdatingStatus}
                                                                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                                <span>Revert to Pending</span>
                                                            </button>
                                                        </>
                                                    ) : isDeliveredStatus(selectedPo.status) ? (
                                                        <div className="col-span-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span>Delivered & Completed</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestStatusChange(selectedPo, "accept")}
                                                                disabled={isUpdatingStatus}
                                                                className="py-3 px-4 rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(236,72,153,0.45)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                                <span>Accept Order</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => requestStatusChange(selectedPo, "reject")}
                                                                disabled={isUpdatingStatus}
                                                                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                                            >
                                                                <X className="w-4 h-4" />
                                                                <span>Reject Order</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pt-3 flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 gap-2">
                                                <Link
                                                    href={`/suppliers_page/messages?po=${selectedPo.po_number}`}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-500/20 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    <span>Inquire About PO</span>
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => handleExportSinglePoCSV(selectedPo)}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35)] flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Export Line Items</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
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

            {/* Digital Receipt Modal */}
            <DigitalReceiptModal
                isOpen={isDigitalReceiptModalOpen}
                onClose={() => {
                    setIsDigitalReceiptModalOpen(false);
                    setDigitalReceiptPO(null);
                }}
                purchaseOrder={digitalReceiptPO}
            />
        </div>
    );
}
