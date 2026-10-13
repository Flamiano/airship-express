"use client";

import React, { useState, useMemo } from "react";
import { 
    Send, 
    CheckCircle2, 
    Clock, 
    Search, 
    Filter, 
    Share2, 
    Boxes, 
    ArrowUpFromLine, 
    FileText, 
    Building2, 
    User, 
    AlertTriangle,
    Printer,
    BadgeAlert,
    X,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Eye
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import Portal from "../../../../components/client/Portal";
import { useDebounce } from "../../../../hooks/useDebounce";
import Cards from "../../../../components/global/Cards";
import { logStockMovement } from "../../../inventory/server/stock-movements";
import { user } from "../../../../lib/services/Class/user";
import { PurchaseRequestFormModal } from "../../../inventory/components/modals/PurchaseRequestFormModal";
import { issueRequisitionSupplies } from "../../../inventory/server/query";
import { Pagination } from "../../../../components/global/pagination";
import { checkRequestHasAvailableStock, getItemAvailableStock } from "../../server/warehouse-stock-utils";

interface IssueRequestsTabProps {
    requests: any[];
    inventoryItems: any[];
    onRefresh: () => void;
}

export function IssueRequestsTab({
    requests,
    inventoryItems,
    onRefresh,
}: IssueRequestsTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<"All" | "Approved" | "Completed">("All");
    const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 8;

    // Modal state for Issuing Supplies
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [issueForm, setIssueForm] = useState({
        recipientName: "",
        recipientEmployeeId: "",
        releasingOfficer: "",
        handoverLocation: "",
        issuedItems: {} as Record<string, number>, // itemId -> qtyToIssue
        handoverNotes: "",
    });

    // Digital Issuance Pass / Receipt modal
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [completedVoucher, setCompletedVoucher] = useState<any | null>(null);

    // Track locally issued/released requests initialized from localStorage
    const [issuedRequestIds, setIssuedRequestIds] = useState<Set<string>>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("airship_issued_requisitions");
                if (saved) return new Set(JSON.parse(saved));
            } catch {}
        }
        return new Set();
    });

    const markRequestAsIssued = (reqId: string, reqNumber?: string) => {
        setIssuedRequestIds((prev) => {
            const next = new Set(prev);
            if (reqId) next.add(String(reqId));
            if (reqNumber) next.add(String(reqNumber));
            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem("airship_issued_requisitions", JSON.stringify(Array.from(next)));
                } catch {}
            }
            return next;
        });
    };

    // View Request Details Modal
    const [selectedRequestForView, setSelectedRequestForView] = useState<any | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Extract unique departments for filter tabs
    const departments = useMemo(() => {
        const set = new Set<string>();
        requests.forEach((r) => {
            if (r.department) set.add(r.department);
        });
        return ["All", ...Array.from(set)];
    }, [requests]);

    // Helper to evaluate if a requisition is 100% completed/released (no deficit remaining)
    const checkIsCompleted = (r: any) => {
        const rawItems = Array.isArray(r.items) ? r.items : (typeof r.items === "string" ? JSON.parse(r.items || "[]") : []);
        const st = String(r.status || "").trim().toLowerCase();

        if (rawItems.length > 0) {
            const hasRemainingDeficit = rawItems.some((it: any) => {
                const reqQ = Number(it.quantity || it.quantity_requested || 0);
                const isQ = Number(it.issued_quantity) || 0;
                const defQ = it.deficit_quantity !== undefined ? Number(it.deficit_quantity) : Math.max(0, reqQ - isQ);
                return defQ > 0;
            });
            if (hasRemainingDeficit) return false;

            const allItemsFullyIssued = rawItems.every((it: any) => {
                const reqQ = Number(it.quantity || it.quantity_requested || 0);
                const isQ = Number(it.issued_quantity) || 0;
                return (isQ >= reqQ && reqQ > 0) || it.status === "Delivered" || it.is_issued === true;
            });
            return allItemsFullyIssued;
        }

        const isStatusCompleted = st === "delivered" || st === "completed" || st === "fulfilled" || st === "received";
        return isStatusCompleted || Boolean(r.fulfilled_at) || Boolean(r.fulfilled_by);
    };

    // Helper to check if a requisition is partially released (some units issued, deficit still remains)
    const checkIsPartiallyReleased = (r: any) => {
        const rawItems = Array.isArray(r.items) ? r.items : (typeof r.items === "string" ? JSON.parse(r.items || "[]") : []);
        if (rawItems.length === 0) return false;
        const totalIssued = rawItems.reduce((acc: number, it: any) => acc + (Number(it.issued_quantity) || 0), 0);
        const totalDeficit = rawItems.reduce((acc: number, it: any) => {
            const reqQ = Number(it.quantity || it.quantity_requested || 0);
            const isQ = Number(it.issued_quantity) || 0;
            return acc + (it.deficit_quantity !== undefined ? Number(it.deficit_quantity) : Math.max(0, reqQ - isQ));
        }, 0);
        return totalIssued > 0 && totalDeficit > 0;
    };

    // Filter requests
    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            const rawItems = Array.isArray(r.items) ? r.items : (typeof r.items === "string" ? JSON.parse(r.items || "[]") : []);
            const matchesSearch =
                (r.request_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (r.department || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (r.requested_by || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                rawItems.some((i: any) => (i.item_name || i.name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

            const st = String(r.status || "").trim().toLowerCase();
            const isCompleted = checkIsCompleted(r);
            const isPartial = checkIsPartiallyReleased(r);
            const isRejected = st === "rejected" || st === "cancelled";
            const isPending = st === "pending" && !isCompleted && !isPartial;
            if (isRejected || isPending) return false;

            const hasApprovedItems = rawItems.some((i: any) => 
                i.is_approved === true || 
                i.is_approve === true || 
                String(i.status || "").toLowerCase() === "approved" ||
                String(i.status || "").toLowerCase() === "released" ||
                String(i.status || "").toLowerCase() === "partially released" ||
                String(i.status || "").toLowerCase() === "delivered" ||
                String(i.action || "").toLowerCase().includes("warehousing") ||
                Number(i.approved_quantity) > 0 ||
                Number(i.available_quantity) > 0 ||
                Number(i.exported_quantity) > 0
            );
            const isApproved = (
                st === "approved" || 
                st.includes("approved") || 
                st === "partially approved" || 
                st === "partially released" ||
                hasApprovedItems
            ) && !isRejected && !isPending;

            // Strict requirement: Approved requisitions must have available warehouse stocks to be displayed for issuing
            const hasAvailableStock = checkRequestHasAvailableStock(r, inventoryItems);
            if (!isCompleted && !hasAvailableStock) {
                return false;
            }

            const matchesStatus =
                statusFilter === "All"
                    ? (isCompleted || (isApproved && hasAvailableStock))
                    : statusFilter === "Approved"
                    ? (!isCompleted && hasAvailableStock)
                    : isCompleted;

            const matchesDept = departmentFilter === "All" || r.department === departmentFilter;

            return matchesSearch && matchesStatus && matchesDept;
        });
    }, [requests, inventoryItems, debouncedSearchTerm, statusFilter, departmentFilter, issuedRequestIds]);

    // Reset pagination on filter or search term change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, departmentFilter]);

    // Paginated slice
    const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRequests.slice(start, start + pageSize);
    }, [filteredRequests, currentPage, pageSize]);

    // Quick Stats
    const stats = useMemo(() => {
        const approvedCount = requests.filter((r) => {
            const isCompleted = checkIsCompleted(r);
            if (isCompleted) return false;
            const st = String(r.status || "").trim().toLowerCase();
            const isRejected = st === "rejected" || st === "cancelled";
            const isPending = st === "pending";
            if (isRejected || isPending) return false;
            return checkRequestHasAvailableStock(r, inventoryItems);
        }).length;

        const completedCount = requests.filter((r) => {
            return checkIsCompleted(r);
        }).length;
        
        return {
            readyForIssuance: approvedCount,
            totalCompleted: completedCount,
            totalDepartments: new Set(requests.map((r) => r.department).filter(Boolean)).size,
            totalInventoryItems: inventoryItems.length,
        };
    }, [requests, inventoryItems, issuedRequestIds]);

    // Open Issue Modal
    const handleOpenIssueModal = (req: any) => {
        setSelectedRequest(req);
        const initialMap: Record<string, number> = {};
        const itemsList = Array.isArray(req.items) ? req.items : (typeof req.items === "string" ? JSON.parse(req.items || "[]") : []);

        if (Array.isArray(itemsList)) {
            itemsList.forEach((item: any, idx: number) => {
                const key = item.id || `item-${idx}`;
                const stockInfo = getItemAvailableStock(item, inventoryItems);
                const isApproved = item.is_approved === true || item.is_approve === true || String(item.status || "").toLowerCase() === "approved" || Number(item.available_quantity) > 0 || Number(item.approved_quantity) > 0 || (String(req.status || "").toLowerCase().includes("approved") && item.status !== "Rejected");
                
                const availQty = stockInfo.availableToIssue;

                // Default to available units to dispense if approved, or 0 if unapproved/rejected
                initialMap[key] = (isApproved || availQty > 0) ? availQty : 0;
            });
        }
        const activeCustodian = user.getName() || (typeof window !== "undefined" ? localStorage.getItem("user_name") || localStorage.getItem("logged_in_name") : "") || "Warehouse Custodian";

        setIssueForm({
            recipientName: req.requested_by || "",
            recipientEmployeeId: req.requested_by_id || req.requester_contact || "",
            releasingOfficer: activeCustodian,
            handoverLocation: "Central Warehouse Dispatch Bay 1",
            issuedItems: initialMap,
            handoverNotes: "",
        });
        setIsIssueModalOpen(true);
    };

    // Confirm Issue & Decrement Inventory via reliable Server Action
    const handleConfirmIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;

        setIsSubmitting(true);
        try {
            const rawItems = Array.isArray(selectedRequest.items) ? selectedRequest.items : (typeof selectedRequest.items === "string" ? JSON.parse(selectedRequest.items || "[]") : []);
            const itemsList = rawItems.map((it: any) => {
                const itemName = it.item_name || it.name;
                const matched = inventoryItems.find((inv) =>
                    (inv.item_name && itemName && inv.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()) ||
                    (it.item_code && inv.item_code === it.item_code)
                );
                return {
                    ...it,
                    catalog_item_id: it.catalog_item_id || matched?.id,
                };
            });

            // Execute server action for decrementing inventory and updating request status
            const res = await issueRequisitionSupplies({
                requestId: String(selectedRequest.id),
                requestNumber: selectedRequest.request_number,
                department: selectedRequest.department,
                recipientName: issueForm.recipientName,
                recipientEmployeeId: issueForm.recipientEmployeeId,
                releasingOfficer: issueForm.releasingOfficer,
                handoverLocation: issueForm.handoverLocation,
                handoverNotes: issueForm.handoverNotes,
                issuedItems: issueForm.issuedItems,
                items: itemsList,
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to complete supply issuance.");
            }

            // Mark locally & in localStorage if 100% fulfilled
            if (res.data?.isFullyFulfilled) {
                markRequestAsIssued(String(selectedRequest.id), selectedRequest.request_number);
            }

            // Prepare voucher pass
            setCompletedVoucher({
                voucherNumber: `VOUCHER-${Date.now().toString().slice(-6)}`,
                requestNumber: selectedRequest.request_number,
                department: selectedRequest.department,
                recipientName: issueForm.recipientName,
                recipientEmployeeId: issueForm.recipientEmployeeId,
                releasingOfficer: issueForm.releasingOfficer,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                items: res.data?.items || itemsList,
                issuedItemsQty: issueForm.issuedItems,
                notes: issueForm.handoverNotes,
            });

            toast.success(res.message || `Supplies successfully issued to ${selectedRequest.department}! Stock updated.`);
            setIsIssueModalOpen(false);
            setIsVoucherModalOpen(true);
            onRefresh();
        } catch (err: any) {
            console.error("Error issuing supplies:", err);
            toast.error(err.message || "Failed to issue supplies.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Overview & Metrics - Cards Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Cards
                    frontIcon="fas fa-clock mr-1"
                    header="Approved Requisitions"
                    data={stats.readyForIssuance.toString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Ready to Dispense"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Ready for Issuance"
                    backIcon="fas fa-dolly-flatbed"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.readyForIssuance} requisitions approved by authorities and ready for material issuance.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-circle-check mr-1"
                    header="Issued & Fulfilled"
                    data={stats.totalCompleted.toString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Vouchers Released"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Fulfilled Requisitions"
                    backIcon="fas fa-receipt"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.totalCompleted} material issuance vouchers processed and released to departments.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-building mr-1"
                    header="Departments Served"
                    data={stats.totalDepartments.toString()}
                    arrow="fas fa-arrow-right mr-1"
                    description="Divisions"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Receiving Departments"
                    backIcon="fas fa-building"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.totalDepartments} organizational divisions receiving warehouse material dispatches.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Catalog SKUs"
                    data={stats.totalInventoryItems.toString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Tracked Items"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Available Inventory"
                    backIcon="fas fa-boxes-stacked"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.totalInventoryItems} unique stock-keeping units maintained in warehouse storage.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            {/* 2. Controls & Actions Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px] flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by request #, department, or requester..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Department dropdown */}
                    <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-3 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                        {departments.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept === "All" ? "All Departments" : dept}
                            </option>
                        ))}
                    </select>

                    {/* Status filter */}
                    <div className="flex items-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] p-0.5 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] shrink-0">
                        {(["All", "Approved", "Completed"] as const).map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setStatusFilter(filter)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    statusFilter === filter
                                        ? "bg-pink-500 text-white shadow-[0_2px_8px_rgba(236,72,153,0.35)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="p-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold transition-all cursor-pointer active:scale-95"
                        title="Refresh Approved Requests"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 3. Approved Department Requisitions List */}
            <div className="space-y-3">
                {filteredRequests.length === 0 ? (
                    <div className="p-12 text-center rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)]">
                        <Share2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Department Requests Found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            No approved requisitions match your criteria. Approved requests from departments will appear here ready for warehouse issuing.
                        </p>
                    </div>
                ) : (
                    paginatedRequests.map((req) => {
                        const isCompleted = checkIsCompleted(req);
                        const isPartial = checkIsPartiallyReleased(req);
                        const isExpanded = expandedRequestId === req.id;
                        const itemsList = Array.isArray(req.items) ? req.items : (typeof req.items === "string" ? JSON.parse(req.items || "[]") : []);

                        // Check overall stock feasibility across all requested items
                        let totalReqQty = 0;
                        let totalIssuedQty = 0;
                        let totalDeficitQty = 0;
                        let totalAvailQty = 0;
                        let totalAvailForDeficit = 0;
                        let approvedItemsCount = 0;

                        itemsList.forEach((item: any) => {
                            const isApproved = item.is_approved === true || item.is_approve === true || String(item.status || "").toLowerCase() === "approved" || (String(req.status || "").toLowerCase().includes("approved") && item.status !== "Rejected");
                            if (isApproved) approvedItemsCount++;

                            const stockInfo = getItemAvailableStock(item, inventoryItems);
                            const inStock = stockInfo.inStock;
                            const reqQty = Number(item.quantity || item.quantity_requested) || 1;
                            const itemIssued = Number(item.issued_quantity) || 0;
                            const itemDeficit = stockInfo.remainingDeficit;

                            totalReqQty += reqQty;
                            totalIssuedQty += itemIssued;
                            totalDeficitQty += itemDeficit;

                            const availQty = stockInfo.availableToIssue;
                            totalAvailQty += availQty;

                            if (itemDeficit > 0) {
                                totalAvailForDeficit += Math.min(inStock, itemDeficit);
                            }
                        });

                        const isAllAvailable = totalAvailQty >= totalReqQty && totalReqQty > 0;
                        const isPartialAvailable = totalAvailQty > 0 && totalAvailQty < totalReqQty;
                        const hasStockForRemaining = totalAvailForDeficit > 0;

                        return (
                            <div
                                key={req.id}
                                className="rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] overflow-hidden transition-all"
                            >
                                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-start gap-3.5 min-w-[240px]">
                                        <div
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                isCompleted
                                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                                    : isPartial
                                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                                                    : "bg-[#f0f4f9] dark:bg-[#14151c] text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isPartial ? <AlertTriangle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                                    #{req.request_number || `REQ-${req.id}`}
                                                </span>

                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                                        isCompleted
                                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                                                            : isPartial
                                                            ? hasStockForRemaining
                                                                ? "bg-amber-500 text-white shadow-xs"
                                                                : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/50"
                                                            : approvedItemsCount === itemsList.length && itemsList.length > 0
                                                            ? "bg-pink-500 text-white"
                                                            : approvedItemsCount > 0
                                                            ? "bg-purple-600 text-white"
                                                            : "bg-pink-500 text-white"
                                                    }`}
                                                >
                                                    {isCompleted
                                                        ? "Released & Fulfilled"
                                                        : isPartial
                                                        ? hasStockForRemaining
                                                            ? `Partially Released (${totalIssuedQty}/${totalReqQty} Given) • Restocked (${totalAvailForDeficit} Ready)`
                                                            : `Partially Released (${totalIssuedQty}/${totalReqQty} Given) • Awaiting Stock (${totalDeficitQty} Deficit)`
                                                        : approvedItemsCount === itemsList.length && itemsList.length > 0
                                                        ? "Approved • Ready to Issue"
                                                        : approvedItemsCount > 0
                                                        ? `Partially Approved (${approvedItemsCount}/${itemsList.length}) • Ready to Issue`
                                                        : "Approved • Routed to Warehousing"}
                                                </span>

                                                {!isCompleted && !isPartial && (
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                            isAllAvailable
                                                                ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 border border-pink-200 dark:border-pink-800/40"
                                                                : isPartialAvailable
                                                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800/40"
                                                                : "bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800/40"
                                                        }`}
                                                    >
                                                        {isAllAvailable
                                                            ? `Full Stock Available (${totalAvailQty}/${totalReqQty})`
                                                            : isPartialAvailable
                                                            ? `Partial Stock: ${totalAvailQty}/${totalReqQty} Available • ${totalReqQty - totalAvailQty} in Procurement`
                                                            : `0/${totalReqQty} in Stock • Sent to Procurement`}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                                <span>Department: {req.department || "General Operations"}</span>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-slate-500 font-normal">{req.requested_by || "Requester"}</span>
                                            </div>

                                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                                                <span>Needed By: {new Date(req.needed_by_date || req.created_at || Date.now()).toLocaleDateString()}</span>
                                                <span>• {itemsList.length} items requested</span>
                                                {req.priority && (
                                                    <span className="font-bold text-pink-600 dark:text-pink-400">
                                                        Priority: {req.priority}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const enrichedReq = isCompleted
                                                    ? {
                                                        ...req,
                                                        status: "Delivered",
                                                        is_released: true,
                                                        is_issued: true,
                                                        items: itemsList.map((it: any) => ({
                                                            ...it,
                                                            is_released: true,
                                                            is_issued: true,
                                                            status: "Delivered",
                                                        })),
                                                    }
                                                    : req;
                                                setSelectedRequestForView(enrichedReq);
                                            }}
                                            className="px-3 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-[#e1e7f0] dark:hover:bg-[#1c1d27] text-pink-600 dark:text-pink-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] border border-pink-200/60 dark:border-pink-900/40 active:scale-95"
                                            title="View Full Requisition Details"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>View Request</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                                            className="px-3 py-2 rounded-2xl bg-[#f0f4f9] dark:bg-[#14151c] hover:bg-[#e4ebf5] text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>{isExpanded ? "Hide Items" : "View Items"}</span>
                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>

                                        {isCompleted ? (
                                            <button
                                                type="button"
                                                disabled
                                                className="px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5 cursor-not-allowed opacity-90 shadow-xs"
                                                title="Supplies have already been completely issued to department"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                <span>Supplies Released</span>
                                            </button>
                                        ) : isPartial ? (
                                            hasStockForRemaining ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenIssueModal(req)}
                                                    className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                                    title={`Issue restocked supplies (${totalAvailForDeficit} ready)`}
                                                >
                                                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                                                    <span>Issue Remaining ({totalAvailForDeficit}/{totalDeficitQty})</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800/40 flex items-center gap-1.5 cursor-not-allowed opacity-90 shadow-xs"
                                                    title={`Remaining unfulfilled deficit: ${totalDeficitQty}. Waiting for warehouse inventory restock from procurement.`}
                                                >
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                    <span>Awaiting Stock ({totalDeficitQty} Deficit)</span>
                                                </button>
                                            )
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenIssueModal(req)}
                                                className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                            >
                                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                                                <span>Issue Supplies</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Items details */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-white/[0.04] bg-[#f8fafc]/50 dark:bg-[#141624]/30">
                                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5">
                                            Requisition Items &amp; Warehouse Stock Feasibility:
                                        </h5>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                                        <th className="pb-2">Item Name</th>
                                                        <th className="pb-2">Storage Bin / Location</th>
                                                        <th className="pb-2 text-right">Available / Requested</th>
                                                        <th className="pb-2 text-right">Warehouse Total Stock</th>
                                                        <th className="pb-2 text-right">Availability Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {itemsList.map((item: any, idx: number) => {
                                                        const itemName = item.item_name || item.name;
                                                        const reqQty = Number(item.quantity || item.quantity_requested) || 1;
                                                        const itemIssued = Number(item.issued_quantity) || 0;
                                                        const itemDeficit = item.deficit_quantity !== undefined 
                                                            ? Number(item.deficit_quantity) 
                                                            : Math.max(0, reqQty - itemIssued);
                                                        const isItemFullyIssued = isCompleted || (itemIssued >= reqQty && reqQty > 0) || item.status === 'Delivered' || item.status === 'Released' || String(req.status || '').toLowerCase() === 'delivered';
                                                        const isItemPartialIssued = !isItemFullyIssued && itemIssued > 0;
                                                        const isApprovedItem = item.is_approved === true || item.is_approve === true || String(item.status || "").toLowerCase() === "approved" || (String(req.status || "").toLowerCase().includes("approved") && item.status !== "Rejected");
                                                        const stockInfo = getItemAvailableStock(item, inventoryItems);
                                                        const inStock = stockInfo.inStock;
                                                        const availForThis = stockInfo.availableToIssue;
                                                        const matchedInv = stockInfo.matchedItem;

                                                        return (
                                                            <tr key={idx} className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10">
                                                                <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span>{itemName || "General Supplies"}</span>
                                                                        {isItemFullyIssued ? (
                                                                            <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold uppercase tracking-wide flex items-center gap-1 border border-emerald-300/80 dark:border-emerald-800 shadow-xs">
                                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                                                                Fully Issued
                                                                            </span>
                                                                        ) : isItemPartialIssued ? (
                                                                            <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-wide flex items-center gap-1 border border-amber-300/80 dark:border-amber-800 shadow-xs">
                                                                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                                                                Partially Issued ({itemIssued}/{reqQty})
                                                                            </span>
                                                                        ) : isApprovedItem ? (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-extrabold uppercase tracking-wide">
                                                                                Approved
                                                                            </span>
                                                                        ) : item.status === "Rejected" ? (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-extrabold uppercase tracking-wide">
                                                                                Rejected
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wide">
                                                                                Pending
                                                                            </span>
                                                                        )}
                                                                        {item.is_new_item && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold uppercase tracking-wide">New Item</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                                                                    {matchedInv?.storage_location || "Central Warehouse Zone A"}
                                                                </td>
                                                                <td className="py-2.5 text-right font-black">
                                                                    <div className="font-mono text-xs">
                                                                        {isItemFullyIssued ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{itemIssued}/{reqQty}</span>
                                                                        ) : isItemPartialIssued ? (
                                                                            <span className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">{itemIssued}/{reqQty} Given</span>
                                                                        ) : (
                                                                            <span className="text-pink-600 dark:text-pink-400 font-extrabold text-sm">{Math.min(inStock, reqQty)}/{reqQty}</span>
                                                                        )}
                                                                        <span className="text-slate-400 font-normal ml-1 text-[11px]">{item.unit || "units"}</span>
                                                                    </div>
                                                                    {isItemPartialIssued ? (
                                                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                                                            ({itemDeficit} Deficit • {availForThis} restocked in warehouse)
                                                                        </div>
                                                                    ) : itemDeficit > 0 && !isItemFullyIssued && (
                                                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                                                            ({itemDeficit} lacking in Procurement)
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 text-right font-black text-slate-700 dark:text-slate-300 font-mono">
                                                                    {inStock} {matchedInv?.unit || "units"}
                                                                </td>
                                                                <td className="py-2.5 text-right">
                                                                    {isItemFullyIssued ? (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1">
                                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                            Fully Handed Over
                                                                        </span>
                                                                    ) : isItemPartialIssued ? (
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                                availForThis > 0
                                                                                    ? "bg-amber-500 text-white shadow-xs"
                                                                                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 border border-amber-200 dark:border-amber-800/40"
                                                                            }`}
                                                                        >
                                                                            {availForThis > 0 
                                                                                ? `${availForThis} Restocked • Ready to Issue` 
                                                                                : `Awaiting Restock (${itemDeficit} Deficit)`}
                                                                        </span>
                                                                    ) : (
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                                availForThis >= reqQty
                                                                                    ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 border border-pink-200 dark:border-pink-800/40"
                                                                                    : availForThis > 0
                                                                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800/40"
                                                                                    : "bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800/40"
                                                                            }`}
                                                                        >
                                                                            {availForThis >= reqQty 
                                                                                ? "Sufficient Stock" 
                                                                                : availForThis > 0 
                                                                                ? `${availForThis}/${reqQty} Ready • ${reqQty - availForThis} to Procurement` 
                                                                                : "0 in Stock • Routed to Procurement Stage 1"}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Pagination Controls */}
                {filteredRequests.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 px-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredRequests.length)}</span> of{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRequests.length}</span> requisitions
                        </p>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* 4. Modal: Issue Supplies Form */}
            {isIssueModalOpen && selectedRequest && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-xl rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <ArrowUpFromLine className="w-5 h-5 text-pink-500" />
                                        <span>Issue Supplies to Department</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Requisition #{selectedRequest.request_number} • {selectedRequest.department}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsIssueModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmIssue} className="mt-5 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Receiving Personnel (Recipient)
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={issueForm.recipientName}
                                            onChange={(e) => setIssueForm({ ...issueForm, recipientName: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="Enter recipient name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Recipient Employee ID
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={issueForm.recipientEmployeeId}
                                            onChange={(e) => setIssueForm({ ...issueForm, recipientEmployeeId: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                            placeholder="Enter employee ID"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                Releasing Warehouse Custodian
                                            </label>
                                            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800/40">
                                                Auto-filled
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                readOnly
                                                value={issueForm.releasingOfficer || user.getName() || "Warehouse Custodian"}
                                                onChange={(e) => setIssueForm({ ...issueForm, releasingOfficer: e.target.value })}
                                                className="w-full px-3.5 py-2 pr-28 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-semibold cursor-default"
                                                placeholder="Auto-assigned Custodian"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-pink-600 dark:text-pink-400 font-bold pointer-events-none">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" />
                                                <span>Active User</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Handover Location
                                        </label>
                                        <input
                                            type="text"
                                            value={issueForm.handoverLocation}
                                            onChange={(e) => setIssueForm({ ...issueForm, handoverLocation: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="Enter handover counter / location"
                                        />
                                    </div>
                                </div>

                                {/* Quantities to Dispense */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                        Quantities to Dispense (Will Deduct From Warehouse Stock):
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {(Array.isArray(selectedRequest.items) ? selectedRequest.items : (typeof selectedRequest.items === "string" ? JSON.parse(selectedRequest.items || "[]") : [])).map((item: any, idx: number) => {
                                            const key = item.id || `item-${idx}`;
                                            const itemName = item.item_name || item.name;
                                            const matchedInv = inventoryItems.find(
                                                (inv) => 
                                                    (inv.item_name && itemName && inv.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()) ||
                                                    (item.item_code && inv.item_code === item.item_code) ||
                                                    (item.catalog_item_id && String(inv.id) === String(item.catalog_item_id))
                                            );
                                            const inStock = Number(matchedInv?.current_stock) || 0;
                                            const reqQty = Number(item.quantity || item.quantity_requested) || 1;
                                            const prevIssued = Number(item.issued_quantity) || 0;
                                            const remainingDeficit = item.deficit_quantity !== undefined 
                                                ? Number(item.deficit_quantity) 
                                                : Math.max(0, reqQty - prevIssued);
                                            const isPartialHandover = prevIssued > 0;
                                            const targetDeficit = remainingDeficit > 0 ? remainingDeficit : (prevIssued >= reqQty ? 0 : reqQty);
                                            const maxAllowedToDispense = Math.min(inStock, targetDeficit);
                                            const curVal = issueForm.issuedItems[key] ?? maxAllowedToDispense;

                                            return (
                                                <div
                                                    key={key}
                                                    className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3"
                                                >
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                                            <span>{itemName}</span>
                                                            {isPartialHandover && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold uppercase">
                                                                    {prevIssued}/{reqQty} Given
                                                                </span>
                                                            )}
                                                            {item.is_new_item && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold uppercase">New Item</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                                                            <span>Requested: <strong className="text-slate-700 dark:text-slate-300">{reqQty} {item.unit || "units"}</strong></span>
                                                            {isPartialHandover ? (
                                                                <>
                                                                    <span>• Deficit: <strong className="text-amber-600 dark:text-amber-400">{remainingDeficit} {item.unit || "units"}</strong></span>
                                                                    <span>• In Stock: <strong className="text-slate-700 dark:text-slate-300">{inStock}</strong></span>
                                                                    <span>• Restocked Ready: <strong className="text-pink-600 dark:text-pink-400">{maxAllowedToDispense}/{remainingDeficit}</strong></span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>• In Stock: <strong className="text-slate-700 dark:text-slate-300">{inStock}</strong></span>
                                                                    <span>• Available to Dispense: <strong className="text-pink-600 dark:text-pink-400">{maxAllowedToDispense}/{reqQty}</strong></span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[11px] text-slate-500 font-bold">Qty Dispense:</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={maxAllowedToDispense}
                                                            value={curVal}
                                                            disabled={maxAllowedToDispense === 0}
                                                            onChange={(e) => {
                                                                const val = Math.max(0, Math.min(maxAllowedToDispense, parseInt(e.target.value, 10) || 0));
                                                                setIssueForm({
                                                                    ...issueForm,
                                                                    issuedItems: {
                                                                        ...issueForm.issuedItems,
                                                                        [key]: val,
                                                                    },
                                                                });
                                                            }}
                                                            className="w-20 px-2 py-1 text-xs text-right font-black rounded-lg bg-white dark:bg-[#1a1c29] border border-slate-300 dark:border-slate-700 text-pink-600 dark:text-pink-400 focus:outline-none focus:border-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Issuance Remarks &amp; Handover Notes
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={issueForm.handoverNotes}
                                        onChange={(e) => setIssueForm({ ...issueForm, handoverNotes: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        placeholder="Enter handover notes or inspector remarks..."
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsIssueModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition-all shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Dispensing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Confirm &amp; Dispense Supplies</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 5. Modal: Digital Issuance Pass / Voucher */}
            {isVoucherModalOpen && completedVoucher && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-lg rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-pink-500" />
                                        <span>Material Release Voucher</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                        {completedVoucher.voucherNumber}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsVoucherModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mt-4 p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Requisition:</span>
                                    <span className="font-bold text-slate-800 dark:text-white font-mono">{completedVoucher.requestNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Department:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{completedVoucher.department}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Recipient Employee:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{completedVoucher.recipientName} {completedVoucher.recipientEmployeeId ? `(${completedVoucher.recipientEmployeeId})` : ""}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Releasing Custodian:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{completedVoucher.releasingOfficer}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Date &amp; Time Released:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{completedVoucher.date} • {completedVoucher.time}</span>
                                </div>
                            </div>

                            <div className="mt-4">
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                    Dispensed Inventory Items:
                                </h5>
                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-1.5 text-xs">
                                    {Array.isArray(completedVoucher.items) && completedVoucher.items.map((item: any, idx: number) => {
                                        const key = item.id || `item-${idx}`;
                                        const qty = completedVoucher.issuedItemsQty[key] ?? item.quantity;
                                        return (
                                            <div key={idx} className="flex justify-between items-center py-1 border-b last:border-b-0 border-slate-200/60 dark:border-slate-800">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{item.item_name || item.name}</span>
                                                <span className="font-black text-pink-600 dark:text-pink-400">{qty} {item.unit || "units"}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.print();
                                    }}
                                    className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer flex items-center gap-1.5 active:scale-95"
                                >
                                    <Printer className="w-3.5 h-3.5 text-pink-500" />
                                    <span>Print Voucher</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsVoucherModalOpen(false)}
                                    className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 6. View Full Requisition Details Modal */}
            {selectedRequestForView && (
                <PurchaseRequestFormModal
                    isOpen={Boolean(selectedRequestForView)}
                    onClose={() => setSelectedRequestForView(null)}
                    request={selectedRequestForView}
                    inventoryItems={inventoryItems}
                    canManageRequests={false}
                    userRole={user.getRole() || "Admin"}
                />
            )}
        </div>
    );
}
