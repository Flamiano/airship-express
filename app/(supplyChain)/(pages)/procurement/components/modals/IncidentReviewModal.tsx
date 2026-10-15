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
    User,
    Info,
    ArrowUpRight,
    ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";
import { user } from "../../../../lib/services/Class/user";
import {
    SupplierReturnRequestRecord,
    SupplierReturnMessageRecord,
    SupplierResponsibility,
    RequestedResolution,
    SupplierReturnStatus,
    updateSupplierReturnStatusAndResolutionAction,
    sendSupplierReturnMessageAction,
    fetchSupplierReturnMessagesAction
} from "../../../warehousing/server/supplier-returns-actions";

interface IncidentReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    returnRequest: SupplierReturnRequestRecord | null;
    allReturnRequests?: SupplierReturnRequestRecord[];
    onUpdated: () => void;
}

export function IncidentReviewModal({
    isOpen,
    onClose,
    returnRequest,
    allReturnRequests = [],
    onUpdated,
}: IncidentReviewModalProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "investigation" | "messaging" | "po_terms">("overview");

    // Supplier Responsibility State
    const [supplierResponsibility, setSupplierResponsibility] = useState<SupplierResponsibility>(
        "Pending Supplier Confirmation"
    );
    const [responsibilityNotes, setResponsibilityNotes] = useState<string>("");

    // Proposed Resolution State
    const [proposedResolution, setProposedResolution] = useState<RequestedResolution | "No Return / Other">(
        "Replacement"
    );
    const [resolutionDetails, setResolutionDetails] = useState<any>({});
    const [workflowStatus, setWorkflowStatus] = useState<SupplierReturnStatus>("Under Investigation");
    const [financeVerified, setFinanceVerified] = useState<boolean>(false);

    // Messaging State
    const [recipientEmail, setRecipientEmail] = useState<string>("");
    const [messageSubject, setMessageSubject] = useState<string>("");
    const [messageBody, setMessageBody] = useState<string>("");
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [includeAttachments, setIncludeAttachments] = useState<boolean>(true);
    const [isConfirmingSend, setIsConfirmingSend] = useState<boolean>(false);
    const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
    const [messagesHistory, setMessagesHistory] = useState<SupplierReturnMessageRecord[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

    const [isSavingResolution, setIsSavingResolution] = useState<boolean>(false);
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

    // Initialize data from current return request
    useEffect(() => {
        if (returnRequest && isOpen) {
            setSupplierResponsibility(returnRequest.supplier_responsibility || "Pending Supplier Confirmation");
            setResponsibilityNotes(returnRequest.supplier_responsibility_notes || "");
            setProposedResolution(
                (returnRequest.proposed_resolution as any) ||
                returnRequest.requested_resolution ||
                "Replacement"
            );
            setResolutionDetails(returnRequest.resolution_details || {});
            setWorkflowStatus(returnRequest.status || "Pending Review");
            setFinanceVerified(Boolean(returnRequest.finance_verified));

            // Populate messaging recipient
            const supEmail =
                returnRequest.supplier_email ||
                (returnRequest.po_details as any)?.contact_email ||
                "";
            setRecipientEmail(supEmail);
            setMessageSubject(
                `[Airship Express QA Notice] Defective Items Report: PO #${returnRequest.po_number} - Req #${returnRequest.return_request_number}`
            );

            // Load message history
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

    // Pre-populate message templates
    const applyTemplate = (templateType: string) => {
        if (!returnRequest) return;
        setSelectedTemplate(templateType);

        const supplierName = returnRequest.supplier_name || "Supplier Partner";
        const poNum = returnRequest.po_number;
        const itemName = returnRequest.item_name;
        const defectiveQty = returnRequest.defective_quantity;
        const unit = returnRequest.unit || "units";
        const defectDesc = returnRequest.defect_description;
        const reqNum = returnRequest.return_request_number;

        if (templateType === "replacement") {
            setMessageSubject(`[Replacement Request] Defective Items on PO #${poNum} (Return Ref: ${reqNum})`);
            setMessageBody(
                `Dear ${supplierName} Team,\n\nDuring our warehouse quality check for Purchase Order #${poNum}, our inspection team identified ${defectiveQty} ${unit} of "${itemName}" with the following issue:\n\n• Defect Details: ${defectDesc}\n\nPlease review the attached evidence and confirm if you can dispatch a replacement batch of ${defectiveQty} ${unit} under RMA reference at your earliest convenience.\n\nThank you,\nAirship Express Procurement Team`
            );
        } else if (templateType === "refund") {
            setMessageSubject(`[Refund Notice] Nonconforming Items on PO #${poNum} (Return Ref: ${reqNum})`);
            setMessageBody(
                `Dear ${supplierName} Accounts Team,\n\nWe are writing to officially report nonconforming units delivered under Purchase Order #${poNum}.\n\n• Item: ${itemName}\n• Nonconforming Quantity: ${defectiveQty} ${unit}\n• Issue Observed: ${defectDesc}\n\nPer our agreed supplier terms, we request a refund processing for the affected quantity. Please review the attached photos and advise on the credit/remittance timeline.\n\nSincerely,\nAirship Express Procurement & Accounts`
            );
        } else if (templateType === "credit_note") {
            setMessageSubject(`[Credit Note Request] Quality Issue PO #${poNum} (Return Ref: ${reqNum})`);
            setMessageBody(
                `Dear ${supplierName} Team,\n\nRegarding delivery for PO #${poNum}, we logged ${defectiveQty} ${unit} of defective "${itemName}" during receiving inspection.\n\n• Problem: ${defectDesc}\n\nPlease issue an official Supplier Credit Note for the equivalent amount to be applied towards our upcoming procurement orders.\n\nBest regards,\nAirship Express Procurement`
            );
        } else if (templateType === "clarification") {
            setMessageSubject(`[Quality Clarification Inquiry] Inspection Notice for PO #${poNum}`);
            setMessageBody(
                `Dear ${supplierName} QA Team,\n\nWe encountered discrepancy/quality variance on ${defectiveQty} ${unit} of "${itemName}" under PO #${poNum}.\n\nBefore finalizing the return request, we invite your technical team to examine the attached photographic evidence and provide clarification or warranty guidance.\n\nLooking forward to your swift response.\nAirship Express Quality Assurance`
            );
        }
    };

    // Save Responsibility and Resolution
    const handleSaveResolution = async () => {
        if (!returnRequest) return;

        // Validation for explanation requirement
        if (
            (supplierResponsibility === "Supplier Not Responsible" ||
                supplierResponsibility === "Disputed / Further Investigation Required") &&
            !responsibilityNotes.trim()
        ) {
            toast.error(
                `Please provide a recorded justification when setting responsibility to "${supplierResponsibility}".`
            );
            return;
        }

        setIsSavingResolution(true);
        try {
            const reviewerName = user.getName() || "Procurement Officer";
            const reviewerId = user.getId() || undefined;

            const res = await updateSupplierReturnStatusAndResolutionAction({
                id: returnRequest.id,
                status: workflowStatus,
                supplierResponsibility,
                supplierResponsibilityNotes: responsibilityNotes,
                proposedResolution,
                resolutionDetails,
                financeVerified,
                assignedReviewer: reviewerName,
                assignedReviewerId: reviewerId,
                reviewerName,
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to update resolution.");
            }

            toast.success("Supplier responsibility and proposed resolution saved successfully!");
            onUpdated();
        } catch (err: any) {
            console.error("Error saving resolution:", err);
            toast.error(err.message || "Failed to save resolution.");
        } finally {
            setIsSavingResolution(false);
        }
    };

    // Send Supplier Message via Server Action
    const handleSendMessage = async () => {
        if (!returnRequest) return;
        if (!recipientEmail || !recipientEmail.includes("@")) {
            toast.error("Please provide a valid supplier email address.");
            return;
        }
        if (!messageBody.trim()) {
            toast.error("Message body cannot be empty.");
            return;
        }

        setIsSendingMessage(true);
        try {
            const senderName = user.getName() || "Airship Express Procurement";
            const senderEmail = user.getEmail() || undefined;

            const res = await sendSupplierReturnMessageAction({
                returnRequestId: returnRequest.id,
                incidentId: returnRequest.incident_id || undefined,
                poNumber: returnRequest.po_number,
                supplierId: returnRequest.supplier_id || undefined,
                supplierName: returnRequest.supplier_name,
                supplierEmail: recipientEmail,
                senderName,
                senderEmail,
                subject: messageSubject,
                messageBody,
                templateUsed: selectedTemplate || "Custom Message",
                attachments: includeAttachments ? returnRequest.evidence_urls || [] : [],
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to deliver message to supplier.");
            }

            toast.success(
                `Official communication delivered to ${recipientEmail} (Status: ${res.deliveryStatus})`
            );
            setIsConfirmingSend(false);
            setWorkflowStatus("Awaiting Supplier Response");
            loadMessages(returnRequest.id);
            onUpdated();
        } catch (err: any) {
            console.error("Error sending supplier message:", err);
            toast.error(err.message || "Failed to send message to supplier.");
        } finally {
            setIsSendingMessage(false);
        }
    };

    if (!isOpen || !returnRequest) return null;

    // Check related returns for this PO to prevent duplicate claims
    const relatedReturnsForPO = allReturnRequests.filter(
        (r) => r.po_number === returnRequest.po_number && r.id !== returnRequest.id
    );

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
                                        Return Request #{returnRequest.return_request_number}
                                    </h3>
                                    <span
                                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                            workflowStatus === "Resolved"
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                : workflowStatus === "Approved for Return" || workflowStatus === "Return in Transit"
                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                                : workflowStatus === "Awaiting Supplier Response"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                : workflowStatus === "Rejected"
                                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                                : "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300"
                                        }`}
                                    >
                                        {workflowStatus}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    PO #{returnRequest.po_number} • Incident #{returnRequest.incident_number} • Supplier: {returnRequest.supplier_name}
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
                            onClick={() => setActiveTab("overview")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "overview"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Incident & Evidence</span>
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
                            <span>PO & Supplier Terms</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("investigation")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "investigation"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Investigation & Resolution</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("messaging")}
                            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "messaging"
                                    ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-800"
                                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Supplier Messaging ({messagesHistory.length})</span>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                        {/* TAB 1: INCIDENT & EVIDENCE */}
                        {activeTab === "overview" && (
                            <div className="space-y-5">
                                {/* Defective Item Summary Card */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider">
                                                Affected Line Item
                                            </span>
                                            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                {returnRequest.item_name}
                                            </h4>
                                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                Code: {returnRequest.item_code}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block">
                                                Quarantined Defective Qty
                                            </span>
                                            <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                                                {returnRequest.defective_quantity} {returnRequest.unit}
                                            </span>
                                            <span className="text-[11px] text-slate-400 block">
                                                (Total Received: {returnRequest.quantity_received} {returnRequest.unit})
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
                                            Defect Description & Notes
                                        </span>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-pre-line">
                                            {returnRequest.defect_description}
                                        </div>
                                    </div>
                                </div>

                                {/* Photos & Evidence Gallery */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-pink-500" />
                                            <span>Photographic & Document Evidence</span>
                                        </h5>
                                        <span className="text-xs text-slate-400">
                                            {returnRequest.evidence_urls?.length || 0} attached
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

                                {/* Related Returns Notice (to prevent duplicates) */}
                                {relatedReturnsForPO.length > 0 && (
                                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                                        <div className="flex items-center gap-2 font-bold">
                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                            <span>
                                                Notice: {relatedReturnsForPO.length} other return request(s) exist for Purchase Order #{returnRequest.po_number}
                                            </span>
                                        </div>
                                        <p className="text-[11px] opacity-90">
                                            Check existing returns before negotiating replacements or refunds to prevent duplicate adjustments:
                                        </p>
                                        <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                                            {relatedReturnsForPO.map((rel) => (
                                                <li key={rel.id}>
                                                    Req #{rel.return_request_number} — {rel.item_name} ({rel.defective_quantity} {rel.unit}) • Status: {rel.status}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: PO DETAILS & SUPPLIER TERMS */}
                        {activeTab === "po_terms" && (
                            <div className="space-y-4">
                                {/* Supplier Profile & Contact Card */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-pink-500" />
                                        <span>Supplier Contact & Profile</span>
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Vendor Name</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.supplier_name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Contact Person</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.po_details?.supplier_contact_person || "Vendor Rep"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Verified Email</span>
                                            <span className="font-bold text-pink-600 dark:text-pink-400">
                                                {returnRequest.supplier_email || "Not recorded"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Purchase Order Financial & Receiving Status */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-pink-500" />
                                        <span>Purchase Order Status & Financial Tracking</span>
                                    </h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">PO Total Amount</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                ₱{Number(returnRequest.po_details?.total_amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Financial Approval</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.po_details?.financial_approval || "Approved"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Payment Status</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.po_details?.paid ? "Paid" : "Pending / On Account"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">PO Status</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {returnRequest.po_details?.status || "Issued"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                 {/* Agreed Terms and Conditions & Return Policy */}
                                 <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                     <div className="flex items-center justify-between">
                                         <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                             <Info className="w-4 h-4 text-pink-500" />
                                             <span>Recorded Terms & Conditions, Return Policy & Warranty</span>
                                         </h5>
                                         {returnRequest.po_details?.quotation_id && (
                                             <span className="text-[10px] font-mono font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-md border border-pink-200 dark:border-pink-800">
                                                 Awarded Quotation #{returnRequest.po_details.quotation_id}
                                             </span>
                                         )}
                                     </div>

                                     <div className="space-y-3.5 text-xs">
                                         <div>
                                             <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                                 Payment & Credit Terms
                                             </span>
                                             <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                                 {returnRequest.po_details?.payment_terms || "Not specified in purchase order"}
                                             </div>
                                         </div>

                                         <div>
                                             <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                                 Warranty Coverage & Value-Added Services
                                             </span>
                                             <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                                 <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                                     <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                                     <span>{returnRequest.po_details?.warranty_terms || "Standard Manufacturer / Supplier Warranty"}</span>
                                                 </div>
                                                 {returnRequest.po_details?.services_offered && returnRequest.po_details.services_offered.length > 0 && (
                                                     <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                                                         {returnRequest.po_details.services_offered.map((srv, idx) => (
                                                             <span
                                                                 key={idx}
                                                                 className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-medium"
                                                             >
                                                                 <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                 {srv}
                                                             </span>
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         <div>
                                             <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                                                 Supplier Return Policy & Terms & Conditions
                                             </span>
                                             <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-pre-line leading-relaxed">
                                                 {returnRequest.po_details?.terms_and_conditions ||
                                                     returnRequest.po_details?.quotation_clauses ||
                                                     "No specific return policy clauses recorded in purchase order."}
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                            </div>
                        )}

                        {/* TAB 3: INVESTIGATION & RESOLUTION */}
                        {activeTab === "investigation" && (
                            <div className="space-y-5">
                                {/* 1. Supplier Responsibility */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-pink-500" />
                                        <span>1. Investigation Finding & Supplier Responsibility</span>
                                    </h5>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {(
                                            [
                                                "Pending Supplier Confirmation",
                                                "Supplier Responsible",
                                                "Supplier Not Responsible",
                                                "Disputed / Further Investigation Required",
                                            ] as SupplierResponsibility[]
                                        ).map((resp) => (
                                            <button
                                                key={resp}
                                                type="button"
                                                onClick={() => setSupplierResponsibility(resp)}
                                                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                                                    supplierResponsibility === resp
                                                        ? "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 shadow-sm"
                                                        : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                                                }`}
                                            >
                                                <span>{resp}</span>
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
                                                Explanation & Justification <span className="text-rose-500">* (Required)</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={responsibilityNotes}
                                                onChange={(e) => setResponsibilityNotes(e.target.value)}
                                                placeholder="Detail why the supplier was deemed not responsible or what requires further dispute/investigation..."
                                                required
                                                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/50 text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 resize-none font-mono"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* 2. Proposed Resolution Formulation */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                    <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-pink-500" />
                                        <span>2. Proposed Resolution Option</span>
                                    </h5>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(["Replacement", "Refund", "Supplier Credit", "No Return / Other"] as const).map(
                                            (res) => (
                                                <button
                                                    key={res}
                                                    type="button"
                                                    onClick={() => setProposedResolution(res)}
                                                    className={`p-3 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                                                        proposedResolution === res
                                                            ? "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 shadow-sm"
                                                            : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {res}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    {/* Sub-form based on selected resolution */}
                                    {proposedResolution === "Replacement" && (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Quantity to Replace
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={resolutionDetails.replacement_quantity || returnRequest.defective_quantity}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                replacement_quantity: Number(e.target.value),
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Expected Delivery Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        min={new Date().toISOString().split("T")[0]}
                                                        value={resolutionDetails.expected_replacement_date || ""}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                expected_replacement_date: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Supplier RMA / Ref #
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. RMA-99482"
                                                        value={resolutionDetails.supplier_reference || ""}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                supplier_reference: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Replacement Receiving Status
                                                </label>
                                                <select
                                                    value={resolutionDetails.replacement_receiving_status || "Awaiting Shipment"}
                                                    onChange={(e) =>
                                                        setResolutionDetails({
                                                            ...resolutionDetails,
                                                            replacement_receiving_status: e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                >
                                                    <option value="Awaiting Shipment">Awaiting Supplier Shipment</option>
                                                    <option value="In Transit">Replacement In Transit</option>
                                                    <option value="Received & Restocked">Received & Restocked at Dock</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {proposedResolution === "Refund" && (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Agreed Refund Amount (₱)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={resolutionDetails.agreed_refund_amount || ""}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                agreed_refund_amount: Number(e.target.value),
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Currency
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={resolutionDetails.currency || "PHP"}
                                                        readOnly
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Refund Status
                                                    </label>
                                                    <select
                                                        value={resolutionDetails.refund_status || "Pending Vendor Payment"}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                refund_status: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                    >
                                                        <option value="Pending Vendor Payment">Pending Vendor Payment</option>
                                                        <option value="Payment Received">Payment Received by Finance</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {proposedResolution === "Supplier Credit" && (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Agreed Credit Amount (₱)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={resolutionDetails.agreed_credit_amount || ""}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                agreed_credit_amount: Number(e.target.value),
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        Credit Note Reference #
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="CN-2026-001"
                                                        value={resolutionDetails.credit_note_reference || ""}
                                                        onChange={(e) =>
                                                            setResolutionDetails({
                                                                ...resolutionDetails,
                                                                credit_note_reference: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <input
                                                    type="checkbox"
                                                    id="availFutureCheckbox"
                                                    checked={resolutionDetails.credit_available_for_future ?? true}
                                                    onChange={(e) =>
                                                        setResolutionDetails({
                                                            ...resolutionDetails,
                                                            credit_available_for_future: e.target.checked,
                                                        })
                                                    }
                                                    className="rounded text-pink-600 focus:ring-pink-500"
                                                />
                                                <label htmlFor="availFutureCheckbox" className="text-slate-700 dark:text-slate-300 font-medium">
                                                    Credit available for deduction on future purchase order
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {proposedResolution === "No Return / Other" && (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Alternative Approved Resolution & Justification
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={resolutionDetails.alternative_justification || ""}
                                                    onChange={(e) =>
                                                        setResolutionDetails({
                                                            ...resolutionDetails,
                                                            alternative_justification: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Specify the approved concession, price discount, or warehouse write-off..."
                                                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none font-mono"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Workflow Status & Finance Verification */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 text-xs">
                                    <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-pink-500" />
                                        <span>3. Return Request Workflow Status</span>
                                    </h5>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Update Workflow Stage
                                            </label>
                                            <select
                                                value={workflowStatus}
                                                onChange={(e) => setWorkflowStatus(e.target.value as SupplierReturnStatus)}
                                                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                                            >
                                                <option value="Pending Review">1. Pending Review</option>
                                                <option value="Under Investigation">2. Under Investigation</option>
                                                <option value="Awaiting Supplier Response">3. Awaiting Supplier Response</option>
                                                <option value="Approved for Return">4. Approved for Return</option>
                                                <option value="Return in Transit">5. Return in Transit (Defective Stock Dispatched)</option>
                                                <option value="Awaiting Resolution">6. Awaiting Resolution</option>
                                                <option value="Resolved">7. Resolved (Verification Complete)</option>
                                                <option value="Rejected">8. Rejected (Declined / Withdrawn)</option>
                                            </select>
                                        </div>

                                        <div className="flex flex-col justify-end">
                                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
                                                <input
                                                    type="checkbox"
                                                    id="financeVerifiedCheckbox"
                                                    checked={financeVerified}
                                                    onChange={(e) => setFinanceVerified(e.target.checked)}
                                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <label htmlFor="financeVerifiedCheckbox" className="cursor-pointer">
                                                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                                                        Finance Verified
                                                    </span>
                                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                                        Sign-off on funds receipt, credit note ledger, or account adjustment
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: SUPPLIER MESSAGING */}
                        {activeTab === "messaging" && (
                            <div className="space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-pink-500" />
                                            <span>Official Vendor Communication</span>
                                        </h5>
                                        <span className="text-[11px] text-slate-400">
                                            Uses verified Airship Express Mailer
                                        </span>
                                    </div>

                                    {/* Template selection quick pills */}
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                                            Load Official Template:
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => applyTemplate("replacement")}
                                                className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[11px] font-bold cursor-pointer hover:bg-pink-100"
                                            >
                                                Replacement Request
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyTemplate("refund")}
                                                className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[11px] font-bold cursor-pointer hover:bg-pink-100"
                                            >
                                                Refund Claim
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyTemplate("credit_note")}
                                                className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[11px] font-bold cursor-pointer hover:bg-pink-100"
                                            >
                                                Credit Note Notice
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyTemplate("clarification")}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold cursor-pointer hover:bg-slate-200"
                                            >
                                                Quality Inquiry
                                            </button>
                                        </div>
                                    </div>

                                    {/* Fields */}
                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Supplier Recipient Email <span className="text-pink-500">* (Verified)</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                placeholder="vendor.contact@company.com"
                                                required
                                                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Subject Line
                                            </label>
                                            <input
                                                type="text"
                                                value={messageSubject}
                                                onChange={(e) => setMessageSubject(e.target.value)}
                                                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Message Body
                                            </label>
                                            <textarea
                                                rows={5}
                                                value={messageBody}
                                                onChange={(e) => setMessageBody(e.target.value)}
                                                placeholder="Write message to supplier regarding defect details, resolution, or questions..."
                                                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-sans resize-none"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="attachEvidenceCheckbox"
                                                    checked={includeAttachments}
                                                    onChange={(e) => setIncludeAttachments(e.target.checked)}
                                                    className="rounded text-pink-600 focus:ring-pink-500"
                                                />
                                                <label htmlFor="attachEvidenceCheckbox" className="text-slate-600 dark:text-slate-400 text-xs font-medium cursor-pointer">
                                                    Include {returnRequest.evidence_urls?.length || 0} photo evidence link(s) in email
                                                </label>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setIsConfirmingSend(true)}
                                                disabled={isSendingMessage || !recipientEmail || !messageBody.trim()}
                                                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Send Notice</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Confirmation Modal before sending */}
                                {isConfirmingSend && (
                                    <div className="p-4 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 text-xs space-y-3">
                                        <div className="flex items-center gap-2 font-bold text-pink-900 dark:text-pink-300">
                                            <AlertTriangle className="w-4 h-4 text-pink-600" />
                                            <span>Confirm Email Dispatch to Supplier</span>
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300">
                                            Are you sure you want to send this official notice to{" "}
                                            <strong className="text-pink-600">{recipientEmail}</strong>? This will record in the message log and set the workflow status to <em>Awaiting Supplier Response</em>.
                                        </p>
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsConfirmingSend(false)}
                                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSendMessage}
                                                disabled={isSendingMessage}
                                                className="px-4 py-1.5 rounded-lg bg-pink-600 text-white font-bold cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                            >
                                                {isSendingMessage ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Dispatching...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Yes, Send Email</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Message History Thread */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-pink-500" />
                                            <span>Communication History & Delivery Audit</span>
                                        </h5>
                                        <button
                                            type="button"
                                            onClick={() => loadMessages(returnRequest.id)}
                                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                            title="Refresh message log"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {isLoadingMessages ? (
                                        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                                            <span>Loading message logs...</span>
                                        </div>
                                    ) : messagesHistory.length > 0 ? (
                                        <div className="space-y-2.5">
                                            {messagesHistory.map((msg) => (
                                                <div
                                                    key={msg.id}
                                                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
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
                                                        <span>To: {msg.supplier_email} ({msg.supplier_name})</span>
                                                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                                        {msg.message_body}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 text-xs">
                                            No messages sent to supplier yet for this return request.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Controls */}
                    <div className="p-4 sm:p-5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Close
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveResolution}
                            disabled={isSavingResolution}
                            className="px-5 py-2.5 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45)] transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            {isSavingResolution ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving Findings & Status...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Save Investigation & Status</span>
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
