"use client";

import React, { useState, useEffect } from "react";
import {
    X,
    ShieldAlert,
    Building2,
    Calendar,
    FileText,
    Image as ImageIcon,
    Mail,
    Send,
    CheckCircle2,
    AlertTriangle,
    Clock,
    RefreshCw,
    ExternalLink,
    DollarSign,
    RotateCcw,
    ChevronRight,
    Loader2,
    Check,
    MessageSquare,
    Truck,
    Package,
    Sparkles,
    Info,
    ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";
import {
    SupplierReturnRequestRecord,
    SupplierReturnMessageRecord,
    SupplierResponsibility,
    SupplierReturnStatus,
    fetchSupplierReturnMessagesAction,
    supplierRespondToReturnRequestAction
} from "../../../warehousing/server/supplier-returns-actions";

interface SupplierReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    returnRequest: SupplierReturnRequestRecord | null;
    supplierAccount: any;
    onUpdated: () => void;
}

function generateAutoRma(req: SupplierReturnRequestRecord | null) {
    if (!req) return `RMA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawReqNum = (req.return_request_number || "").replace(/^SRR-?/i, "");
    if (rawReqNum) {
        return `RMA-${rawReqNum}`;
    }
    const poNum = (req.po_number || "").replace(/^PO-?/i, "");
    if (poNum) {
        return `RMA-${poNum}-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`;
    }
    return `RMA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function SupplierReturnModal({
    isOpen,
    onClose,
    returnRequest,
    supplierAccount,
    onUpdated,
}: SupplierReturnModalProps) {
    const [activeTab, setActiveTab] = useState<"defects" | "po_terms" | "messages" | "status_action">("defects");

    // Supplier Responsibility State
    const [supplierResponsibility, setSupplierResponsibility] = useState<SupplierResponsibility>(
        "Pending Supplier Confirmation"
    );
    const [responsibilityNotes, setResponsibilityNotes] = useState<string>("");

    // Workflow Status & Resolution Details
    const [workflowStatus, setWorkflowStatus] = useState<SupplierReturnStatus>("Under Investigation");
    const [autoDetectStatus, setAutoDetectStatus] = useState<boolean>(true);
    const [resolutionDetails, setResolutionDetails] = useState<any>({});

    // Messaging State
    const [replyMessage, setReplyMessage] = useState<string>("");
    const [messagesHistory, setMessagesHistory] = useState<SupplierReturnMessageRecord[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (returnRequest && isOpen) {
            setSupplierResponsibility(returnRequest.supplier_responsibility || "Pending Supplier Confirmation");
            setResponsibilityNotes(returnRequest.supplier_responsibility_notes || "");
            setWorkflowStatus(returnRequest.status || "Under Investigation");

            const existingDetails = returnRequest.resolution_details || {};
            const initialRma = existingDetails.supplier_reference || generateAutoRma(returnRequest);
            setResolutionDetails({
                ...existingDetails,
                supplier_reference: initialRma,
            });

            setReplyMessage("");
            loadMessages(returnRequest.id);
        }
    }, [returnRequest, isOpen]);

    const loadMessages = async (reqId: string) => {
        setIsLoadingMessages(true);
        try {
            const res = await fetchSupplierReturnMessagesAction(reqId);
            if (res.success && res.data) {
                setMessagesHistory(res.data);
            }
        } catch (err) {
            console.error("Error loading messages:", err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Auto-detect status progression based on supplier actions
    useEffect(() => {
        if (!autoDetectStatus || !returnRequest) return;

        if (supplierResponsibility === "Supplier Responsible") {
            if (resolutionDetails.replacement_receiving_status === "In Transit" || resolutionDetails.tracking_number) {
                setWorkflowStatus("Return in Transit");
            } else if (resolutionDetails.expected_replacement_date || resolutionDetails.supplier_reference) {
                setWorkflowStatus("Approved for Return");
            } else {
                setWorkflowStatus("Under Investigation");
            }
        } else if (
            supplierResponsibility === "Supplier Not Responsible" ||
            supplierResponsibility === "Disputed / Further Investigation Required"
        ) {
            setWorkflowStatus("Under Investigation");
        }
    }, [supplierResponsibility, resolutionDetails, autoDetectStatus, returnRequest]);

    // Check if the claim process is already resolved, completed, or closed
    const statusStr = String(returnRequest?.status || "");
    const isResolvedOrDone =
        statusStr === "Resolved" ||
        statusStr === "Claim Closed" ||
        statusStr === "Closed" ||
        statusStr === "Rejected" ||
        returnRequest?.resolution_details?.replacement_receiving_status === "Received & Restocked" ||
        (returnRequest as any)?.replacement_receiving_status === "Received & Restocked";

    const handleSubmitResponse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnRequest) return;

        if (isResolvedOrDone) {
            toast.info("This claim is already resolved and the process is complete.");
            return;
        }

        if (
            (supplierResponsibility === "Supplier Not Responsible" ||
                supplierResponsibility === "Disputed / Further Investigation Required") &&
            !responsibilityNotes.trim()
        ) {
            toast.error("Please provide recorded remarks explaining why you dispute responsibility.");
            return;
        }

        setIsSubmitting(true);
        try {
            const supplierName = supplierAccount?.suppliers?.name || returnRequest.supplier_name || "Supplier";
            const supplierEmail = supplierAccount?.email || returnRequest.supplier_email || "";
            const supplierId = supplierAccount?.supplier_id || returnRequest.supplier_id || undefined;

            const res = await supplierRespondToReturnRequestAction({
                returnRequestId: returnRequest.id,
                supplierId,
                supplierName,
                supplierEmail,
                messageBody: replyMessage.trim() || undefined,
                supplierResponsibility,
                supplierResponsibilityNotes: responsibilityNotes,
                updatedStatus: autoDetectStatus ? undefined : workflowStatus,
                resolutionDetails,
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to submit response.");
            }

            toast.success(res.message || "Response submitted and workflow status updated!");
            onUpdated();
            onClose();
        } catch (err: any) {
            console.error("Error submitting supplier response:", err);
            toast.error(err.message || "Failed to submit response.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !returnRequest) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/[0.08] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-500/20 shadow-sm shrink-0">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                        Return Claim #{returnRequest.return_request_number}
                                    </h3>
                                    <span
                                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                            returnRequest.status === "Resolved"
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                : returnRequest.status === "Approved for Return" || returnRequest.status === "Return in Transit"
                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                                : returnRequest.status === "Awaiting Supplier Response"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                : "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300"
                                        }`}
                                    >
                                        {returnRequest.status}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    PO #{returnRequest.po_number} • Incident #{returnRequest.incident_number} • Reported on {returnRequest.inspection_date}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="px-5 sm:px-6 pt-3 border-b border-slate-200/60 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-slate-50/50 dark:bg-[#14151c]/50">
                        <button
                            type="button"
                            onClick={() => setActiveTab("defects")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "defects"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Reported Defects & Evidence</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("po_terms")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "po_terms"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PO Details & Agreed Terms</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("messages")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "messages"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Official Communication Audit ({messagesHistory.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("status_action")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "status_action"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>3. Workflow Status & Response</span>
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                        {/* TAB 1: DEFECT REPORT & EVIDENCE */}
                        {activeTab === "defects" && (
                            <div className="space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider">
                                                Defective Item Identified
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                {returnRequest.item_name}
                                            </h4>
                                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                Item Code: {returnRequest.item_code}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block">
                                                Defective / Nonconforming Qty
                                            </span>
                                            <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                                                {returnRequest.defective_quantity} {returnRequest.unit}
                                            </span>
                                            <span className="text-[11px] text-slate-400 block">
                                                Total Delivered: {returnRequest.quantity_received} {returnRequest.unit}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Defect Type</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.defect_type}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Inspection Date</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.inspection_date}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Requested Resolution</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.requested_resolution}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Reported By</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.reported_by}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                            Warehouse Inspection Description
                                        </span>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-pre-line">
                                            {returnRequest.defect_description}
                                        </div>
                                    </div>
                                </div>

                                {/* Photographic Evidence */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-pink-500" />
                                            <span>Attached Photo Evidence from Warehouse Dock</span>
                                        </h5>
                                        <span className="text-xs text-slate-400">
                                            {returnRequest.evidence_urls?.length || 0} photo(s)
                                        </span>
                                    </div>

                                    {returnRequest.evidence_urls && returnRequest.evidence_urls.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {returnRequest.evidence_urls.map((url, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedPreviewImage(url)}
                                                    className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 aspect-video cursor-pointer hover:border-pink-500 transition-colors shadow-sm"
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Evidence ${idx + 1}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    />
                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                                        <span>View Full</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            No photos or physical evidence attached for this incident.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: PO DETAILS & AGREED TERMS */}
                        {activeTab === "po_terms" && (
                            <div className="space-y-4">
                                {/* Original PO Summary */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-pink-500" />
                                        <span>Purchase Order Summary</span>
                                    </h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">PO Number</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                #{returnRequest.po_number}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Total Order Value</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                ₱{Number(returnRequest.po_details?.total_amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Payment Status</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.po_details?.paid ? "Paid" : "On Account / Unpaid"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Delivery Address</span>
                                            <span className="font-bold text-slate-800 dark:text-white truncate">
                                                {returnRequest.po_details?.supplier_address || "Airship Central Hub"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* PO Line Items Breakdown */}
                                {returnRequest.po_details?.items && Array.isArray(returnRequest.po_details.items) && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                        <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <Package className="w-4 h-4 text-pink-500" />
                                            <span>PO Line Items Breakdown</span>
                                        </h5>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                                        <th className="pb-2">Item Description</th>
                                                        <th className="pb-2 text-right">Quantity</th>
                                                        <th className="pb-2 text-right">Unit Price</th>
                                                        <th className="pb-2 text-right">Total Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {returnRequest.po_details.items.map((item: any, idx: number) => {
                                                        const isDefectiveMatch =
                                                            (item.item_name || item.name || "")
                                                                .toLowerCase()
                                                                .includes(returnRequest.item_name.toLowerCase());
                                                        return (
                                                            <tr
                                                                key={idx}
                                                                className={
                                                                    isDefectiveMatch
                                                                        ? "bg-rose-50/50 dark:bg-rose-950/20 font-bold"
                                                                        : ""
                                                                }
                                                            >
                                                                <td className="py-2.5">
                                                                    <span>{item.item_name || item.name || `Item #${idx + 1}`}</span>
                                                                    {isDefectiveMatch && (
                                                                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500 text-white">
                                                                            Reported Defect
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 text-right">
                                                                    {item.quantity} {item.unit || "units"}
                                                                </td>
                                                                <td className="py-2.5 text-right">
                                                                    ₱{Number(item.unit_price || 0).toLocaleString()}
                                                                </td>
                                                                <td className="py-2.5 text-right font-black">
                                                                    ₱{Number(item.total_price || item.quantity * item.unit_price || 0).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Recorded Terms & Conditions */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-pink-500" />
                                        <span>Contract Terms & Conditions, Return Policy & Payment</span>
                                    </h5>
                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                                Agreed Payment & Credit Terms
                                            </span>
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                                {returnRequest.po_details?.payment_terms || "Standard Net 30 Days"}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                                Agreed Return Policy & Warranty Terms
                                            </span>
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-pre-line">
                                                {returnRequest.po_details?.terms_and_conditions ||
                                                    "All damaged, non-conforming or defective items must be replaced or credited within 14 calendar days upon formal notice."}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: OFFICIAL COMMUNICATION AUDIT */}
                        {activeTab === "messages" && (
                            <div className="space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-pink-500" />
                                            <span>Communication History & Delivery Audit</span>
                                        </h5>
                                        <button
                                            type="button"
                                            onClick={() => loadMessages(returnRequest.id)}
                                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                            title="Refresh message audit"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {isLoadingMessages ? (
                                        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                                            <span>Loading message logs...</span>
                                        </div>
                                    ) : messagesHistory.length > 0 ? (
                                        <div className="space-y-3">
                                            {messagesHistory.map((msg) => {
                                                const isSupplierSender = msg.sender_email === supplierAccount?.email || msg.template_used === "Supplier Portal Response";
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`p-3.5 rounded-2xl text-xs space-y-1.5 border ${
                                                            isSupplierSender
                                                                ? "bg-pink-50/60 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/40 ml-4"
                                                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 mr-4"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-slate-800 dark:text-white">
                                                                {msg.subject}
                                                            </span>
                                                            <span
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                    msg.delivery_status === "Sent"
                                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                                                }`}
                                                            >
                                                                {msg.delivery_status}
                                                            </span>
                                                        </div>

                                                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                                            <span>From: {msg.sender_name} ({msg.sender_email})</span>
                                                            <span>{new Date(msg.created_at).toLocaleString()}</span>
                                                        </div>

                                                        <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                                            {msg.message_body}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            No message audit logs found yet.
                                        </div>
                                    )}

                                    {/* Quick Reply Box */}
                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Write Official Reply to Procurement:
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={replyMessage}
                                            disabled={isResolvedOrDone}
                                            onChange={(e) => setReplyMessage(e.target.value)}
                                            placeholder={
                                                isResolvedOrDone
                                                    ? "This claim is resolved. Further replies are locked."
                                                    : "Type your official acknowledgement, technical clarification, or delivery timeline..."
                                            }
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 resize-none font-sans disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: 3. WORKFLOW STATUS & SUPPLIER ACTION */}
                        {activeTab === "status_action" && (
                            <form id="supplierResponseForm" onSubmit={handleSubmitResponse} className="space-y-4">
                                {isResolvedOrDone && (
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="text-xs space-y-1">
                                            <h6 className="font-bold text-sm">Process Completed & Claim Finalized</h6>
                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                                This return claim has been closed with status: <strong>{returnRequest.status}</strong>
                                                {returnRequest.resolution_details?.replacement_receiving_status === "Received & Restocked" ||
                                                (returnRequest as any)?.replacement_receiving_status === "Received & Restocked"
                                                    ? " (Items Received & Restocked)"
                                                    : ""}. 
                                                Further updates, responsibility changes, and workflow transitions have been disabled.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 1. Supplier Responsibility Acknowledgment */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-pink-500" />
                                        <span>1. Supplier Responsibility & Claim Acknowledgment</span>
                                    </h5>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {(
                                            [
                                                "Supplier Responsible",
                                                "Supplier Not Responsible",
                                                "Disputed / Further Investigation Required",
                                                "Pending Supplier Confirmation",
                                            ] as SupplierResponsibility[]
                                        ).map((resp) => (
                                            <button
                                                key={resp}
                                                type="button"
                                                disabled={isResolvedOrDone}
                                                onClick={() => !isResolvedOrDone && setSupplierResponsibility(resp)}
                                                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                                                    isResolvedOrDone
                                                        ? "cursor-not-allowed opacity-75"
                                                        : "cursor-pointer"
                                                } ${
                                                    supplierResponsibility === resp
                                                        ? "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 shadow-sm"
                                                        : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                                                }`}
                                            >
                                                <span>
                                                    {resp === "Supplier Responsible"
                                                        ? "Acknowledge Claim (Supplier Responsible)"
                                                        : resp}
                                                </span>
                                                {supplierResponsibility === resp && (
                                                    <Check className="w-4 h-4 text-pink-600" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {(supplierResponsibility === "Supplier Not Responsible" ||
                                        supplierResponsibility === "Disputed / Further Investigation Required") && (
                                        <div className="mt-2">
                                            <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                                                Explanation & Technical Remarks <span className="text-rose-500">* (Required)</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                disabled={isResolvedOrDone}
                                                value={responsibilityNotes}
                                                onChange={(e) => setResponsibilityNotes(e.target.value)}
                                                placeholder="Explain why the supplier is not responsible (e.g. carrier transit damage, improper storage) or reasons for dispute..."
                                                required
                                                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/50 text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 resize-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* 2. Action Details based on Requested Resolution */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <Truck className="w-4 h-4 text-pink-500" />
                                        <span>2. Resolution Action & Logistics Confirmation</span>
                                    </h5>

                                    <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/20 text-xs text-pink-800 dark:text-pink-300">
                                        Procurement requested: <strong>{returnRequest.requested_resolution}</strong> for {returnRequest.defective_quantity} {returnRequest.unit}.
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                    RMA / Vendor Ref #
                                                </label>
                                                {!isResolvedOrDone && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                supplier_reference: generateAutoRma(returnRequest),
                                                            })
                                                        }
                                                        title="Auto-generate standard RMA reference"
                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
                                                    >
                                                        <Sparkles className="w-2.5 h-2.5" />
                                                        <span>Auto-generate</span>
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    disabled={isResolvedOrDone}
                                                    placeholder="e.g. RMA-2026-X1"
                                                    value={resolutionDetails.supplier_reference || ""}
                                                    onChange={(e) =>
                                                        setResolutionDetails({
                                                            ...resolutionDetails,
                                                            supplier_reference: e.target.value,
                                                        })
                                                    }
                                                    className="w-full pl-3 pr-14 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                                {resolutionDetails.supplier_reference && (
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 pointer-events-none">
                                                        Auto
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                                Auto-generated from Claim #{returnRequest.return_request_number}. Editable.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Expected Dispatch / Resolution Date
                                            </label>
                                            <input
                                                type="date"
                                                disabled={isResolvedOrDone}
                                                min={new Date().toISOString().split("T")[0]}
                                                value={resolutionDetails.expected_replacement_date || ""}
                                                onChange={(e) =>
                                                    setResolutionDetails({
                                                        ...resolutionDetails,
                                                        expected_replacement_date: e.target.value,
                                                    })
                                                }
                                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Replacement Shipping Status
                                            </label>
                                            <select
                                                disabled={isResolvedOrDone}
                                                value={resolutionDetails.replacement_receiving_status || "Awaiting Shipment"}
                                                onChange={(e) =>
                                                    setResolutionDetails({
                                                        ...resolutionDetails,
                                                        replacement_receiving_status: e.target.value,
                                                    })
                                                }
                                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <option value="Awaiting Shipment">1. Scheduled / Awaiting Dispatch</option>
                                                <option value="In Transit">2. In Transit (Dispatched to Warehouse)</option>
                                                <option value="Received & Restocked">3. Delivered to Airship Express</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Return Request Workflow Status Selection / Auto-Detection */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-pink-500" />
                                            <span>3. Return Request Workflow Status</span>
                                        </h5>

                                        <div className="flex items-center gap-1.5 text-xs">
                                            <input
                                                type="checkbox"
                                                id="autoDetectToggle"
                                                disabled={isResolvedOrDone}
                                                checked={autoDetectStatus}
                                                onChange={(e) => setAutoDetectStatus(e.target.checked)}
                                                className="rounded text-pink-600 focus:ring-pink-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            <label htmlFor="autoDetectToggle" className={`font-bold ${isResolvedOrDone ? "text-slate-400 cursor-not-allowed" : "cursor-pointer text-pink-600 dark:text-pink-400"}`}>
                                                Auto-detect status based on action
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Workflow Status State {autoDetectStatus && <span className="text-pink-500 font-normal">(Auto-calculated)</span>}
                                        </label>
                                        <select
                                            disabled={autoDetectStatus || isResolvedOrDone}
                                            value={workflowStatus}
                                            onChange={(e) => setWorkflowStatus(e.target.value as SupplierReturnStatus)}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            <option value="Under Investigation">Under Investigation (Claim Received)</option>
                                            <option value="Approved for Return">Approved for Return (Return Authorized)</option>
                                            <option value="Return in Transit">Return in Transit (Replacement/Defect Dispatched)</option>
                                            <option value="Awaiting Resolution">Awaiting Resolution (Finance Verification Pending)</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Footer Controls */}
                    <div className="p-4 sm:p-5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmitResponse}
                            disabled={isSubmitting || isResolvedOrDone}
                            className={`px-6 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 ${
                                isResolvedOrDone
                                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                    : "bg-pink-500 hover:bg-pink-600 text-white shadow-[0_4px_14px_rgba(236,72,153,0.45)] cursor-pointer disabled:opacity-50"
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Submitting Response...</span>
                                </>
                            ) : isResolvedOrDone ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Process Completed (Resolved)</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Update Status & Submit Response</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Photo Zoom Modal */}
                {selectedPreviewImage && (
                    <div
                        onClick={() => setSelectedPreviewImage(null)}
                        className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
                    >
                        <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl">
                            <img
                                src={selectedPreviewImage}
                                alt="Evidence preview"
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedPreviewImage(null)}
                                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Portal>
    );
}
