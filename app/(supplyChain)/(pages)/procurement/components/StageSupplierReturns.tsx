"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Search,
    Filter,
    RotateCcw,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Truck,
    Building2,
    Calendar,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Eye,
    Mail,
    FileText,
    ArrowUpDown,
    Boxes
} from "lucide-react";
import { toast } from "sonner";
import Cards from "../../../components/global/Cards";
import { Pagination } from "../../../components/global/pagination";
import { useDebounce } from "../../../hooks/useDebounce";
import { supabase } from "../../../lib/services/client/supabase";
import {
    SupplierReturnRequestRecord,
    fetchSupplierReturnRequestsAction,
    SupplierReturnStatus
} from "../../warehousing/server/supplier-returns-actions";
import { IncidentReviewModal } from "./modals/IncidentReviewModal";

interface StageSupplierReturnsProps {
    onRefreshParent?: () => void;
}

export function StageSupplierReturns({ onRefreshParent }: StageSupplierReturnsProps) {
    const [returnRequests, setReturnRequests] = useState<SupplierReturnRequestRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Filters and search
    const [searchTerm, setSearchTerm] = useState<string>("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [supplierFilter, setSupplierFilter] = useState<string>("All");

    // Modal state
    const [selectedRequestForReview, setSelectedRequestForReview] = useState<SupplierReturnRequestRecord | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 8;

    // Load return requests
    const loadData = async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            else setIsRefreshing(true);

            const res = await fetchSupplierReturnRequestsAction();
            if (res.success && res.data) {
                setReturnRequests(res.data);
            } else {
                toast.error(res.error || "Failed to load supplier return requests.");
            }
        } catch (err: any) {
            console.error("Error fetching supplier returns:", err);
            toast.error(err.message || "Failed to load supplier return requests.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();

        const channelId = `procurement_stage_returns_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_return_requests" },
                () => {
                    loadData(true);
                    onRefreshParent?.();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "warehouse_damage_incidents" },
                () => {
                    loadData(true);
                    onRefreshParent?.();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [onRefreshParent]);

    // Unique suppliers for filter dropdown
    const availableSuppliers = useMemo(() => {
        const set = new Set<string>();
        returnRequests.forEach((r) => {
            if (r.supplier_name) set.add(r.supplier_name);
        });
        return Array.from(set).sort();
    }, [returnRequests]);

    // Metrics Overview
    const metrics = useMemo(() => {
        const total = returnRequests.length;
        const pendingReview = returnRequests.filter(
            (r) => r.status === "Pending Review" || r.status === "Under Investigation"
        ).length;
        const awaitingSupplierOrTransit = returnRequests.filter(
            (r) =>
                r.status === "Awaiting Supplier Response" ||
                r.status === "Approved for Return" ||
                r.status === "Return in Transit" ||
                r.status === "Awaiting Resolution"
        ).length;
        const resolved = returnRequests.filter((r) => r.status === "Resolved").length;

        return {
            total,
            pendingReview,
            awaitingSupplierOrTransit,
            resolved,
        };
    }, [returnRequests]);

    // Filtered list
    const filteredRequests = useMemo(() => {
        return returnRequests.filter((req) => {
            const matchesSearch =
                (req.return_request_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (req.incident_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (req.po_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (req.supplier_name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (req.item_name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (req.item_code || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === "All" ||
                req.status === statusFilter ||
                (statusFilter === "Pending" && (req.status === "Pending Review" || req.status === "Under Investigation"));

            const matchesSupplier =
                supplierFilter === "All" || req.supplier_name === supplierFilter;

            return matchesSearch && matchesStatus && matchesSupplier;
        });
    }, [returnRequests, debouncedSearchTerm, statusFilter, supplierFilter]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, supplierFilter]);

    const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRequests.slice(start, start + pageSize);
    }, [filteredRequests, currentPage, pageSize]);

    const handleOpenReview = (req: SupplierReturnRequestRecord) => {
        setSelectedRequestForReview(req);
        setIsReviewModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* 1. Metrics Overview - Flippable Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Total Claims"
                    data={metrics.total.toString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Return Requests"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Supplier Claims"
                    backIcon="fas fa-rotate-left"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${metrics.total} total defective return incident requests recorded across all warehouse receipts.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-clock mr-1"
                    header="Pending Review"
                    data={metrics.pendingReview.toString()}
                    arrow="fas fa-exclamation mr-1"
                    description="Awaiting Investigation"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Under Investigation"
                    backIcon="fas fa-magnifying-glass"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${metrics.pendingReview} requests awaiting procurement investigation of supplier terms & defect evidence.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-amber-500 dark:text-amber-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-truck mr-1"
                    header="Awaiting / In Transit"
                    data={metrics.awaitingSupplierOrTransit.toString()}
                    arrow="fas fa-arrow-right mr-1"
                    description="Active Negotiations"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Active Supplier Returns"
                    backIcon="fas fa-truck-ramp-box"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${metrics.awaitingSupplierOrTransit} claims awaiting vendor response, dispatched in transit, or awaiting replacement/refund.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-blue-500 dark:text-blue-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-check-circle mr-1"
                    header="Resolved Returns"
                    data={metrics.resolved.toString()}
                    arrow="fas fa-shield-check mr-1"
                    description="Verified & Closed"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Completed Resolutions"
                    backIcon="fas fa-circle-check"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${metrics.resolved} supplier claims fully resolved via verified replacement restocking, refund credit, or credit notes.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-emerald-500 dark:text-emerald-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            {/* 2. Controls & Filter Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by Return #, Incident #, PO #, item, or supplier..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 transition-colors"
                        />
                    </div>

                    {/* Status filter dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-pink-500 shadow-sm font-semibold shrink-0"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Pending Review">Pending Review</option>
                        <option value="Under Investigation">Under Investigation</option>
                        <option value="Awaiting Supplier Response">Awaiting Supplier Response</option>
                        <option value="Approved for Return">Approved for Return</option>
                        <option value="Return in Transit">Return in Transit</option>
                        <option value="Awaiting Resolution">Awaiting Resolution</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Rejected">Rejected</option>
                    </select>

                    {/* Supplier filter */}
                    {availableSuppliers.length > 0 && (
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="px-3 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-pink-500 shadow-sm font-semibold shrink-0"
                        >
                            <option value="All">All Suppliers</option>
                            {availableSuppliers.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="p-2.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Refresh Supplier Returns"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* 3. Returns List Table */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] overflow-hidden">
                {isLoading ? (
                    <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
                        <span>Loading supplier returns & damage incidents from Supabase...</span>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="p-14 text-center">
                        <RotateCcw className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            No Supplier Return Requests Found
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            No defective item claims match your search or filter. Report defective items from the Warehousing Receive tab.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-pro w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-white/[0.02]">
                                    <th className="py-3 px-4">Return / Incident Ref</th>
                                    <th className="py-3 px-4">PO &amp; Supplier</th>
                                    <th className="py-3 px-4">Item &amp; Defective Qty</th>
                                    <th className="py-3 px-4">Defect Classification</th>
                                    <th className="py-3 px-4">Reported Date</th>
                                    <th className="py-3 px-4">Requested Resolution</th>
                                    <th className="py-3 px-4">Workflow Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800">
                                {paginatedRequests.map((req) => (
                                    <tr
                                        key={req.id}
                                        className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10 transition-colors"
                                    >
                                        <td data-label="Return Ref" className="py-3.5 px-4">
                                            <div className="font-bold text-slate-800 dark:text-white font-mono">
                                                #{req.return_request_number}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-mono">
                                                {req.incident_number}
                                            </div>
                                        </td>

                                        <td data-label="PO & Supplier" className="py-3.5 px-4">
                                            <div className="font-bold text-slate-800 dark:text-white">
                                                #{req.po_number}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                                                {req.supplier_name}
                                            </div>
                                        </td>

                                        <td data-label="Item & Qty" className="py-3.5 px-4">
                                            <div className="font-bold text-slate-800 dark:text-white">
                                                {req.item_name}
                                            </div>
                                            <div className="text-[11px] text-pink-600 dark:text-pink-400 font-black">
                                                {req.defective_quantity} {req.unit || "units"} (out of {req.quantity_received})
                                            </div>
                                        </td>

                                        <td data-label="Defect" className="py-3.5 px-4">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                                                {req.defect_type}
                                            </span>
                                        </td>

                                        <td data-label="Reported Date" className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                                            {req.inspection_date || req.created_at.split("T")[0]}
                                        </td>

                                        <td data-label="Resolution" className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                            {req.proposed_resolution || req.requested_resolution}
                                        </td>

                                        <td data-label="Status" className="py-3.5 px-4">
                                            <span
                                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block ${
                                                    req.status === "Resolved"
                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                        : req.status === "Approved for Return" || req.status === "Return in Transit"
                                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                                        : req.status === "Awaiting Supplier Response"
                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                        : req.status === "Rejected"
                                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                                        : "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300"
                                                }`}
                                            >
                                                {req.status}
                                            </span>
                                        </td>

                                        <td data-label="Actions" className="py-3.5 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenReview(req)}
                                                className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>Review &amp; Resolve</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {filteredRequests.length > 0 && (
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/20 dark:bg-white/[0.01]">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredRequests.length)}</span> of{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRequests.length}</span> claims
                        </p>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* Detailed Incident Review Modal */}
            {isReviewModalOpen && selectedRequestForReview && (
                <IncidentReviewModal
                    isOpen={isReviewModalOpen}
                    onClose={() => {
                        setIsReviewModalOpen(false);
                        setSelectedRequestForReview(null);
                    }}
                    returnRequest={selectedRequestForReview}
                    allReturnRequests={returnRequests}
                    onUpdated={() => {
                        loadData(true);
                        if (onRefreshParent) onRefreshParent();
                    }}
                />
            )}
        </div>
    );
}
