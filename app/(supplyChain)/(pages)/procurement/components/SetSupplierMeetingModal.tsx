// app/(supplyChain)/(pages)/procurement/components/SetSupplierMeetingModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { 
    Calendar, 
    Clock, 
    Video, 
    MapPin, 
    Phone, 
    Mail, 
    User, 
    Building2, 
    FileText, 
    Send, 
    X, 
    CheckCircle2, 
    RefreshCw, 
    AlertCircle, 
    Link2, 
    Copy, 
    Check, 
    Layers,
    ExternalLink,
    Clipboard,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../components/client/Portal";
import { user } from "../../../lib/services/Class/user";
import { scheduleSupplierMeetingAction, removeSupplierMeetingAction } from "../server/meeting-actions";

export interface SetSupplierMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    meeting?: any | null; // Existing meeting to update/remove
    supplier?: {
        id?: number | string;
        dbSupplierId?: number;
        name: string;
        email?: string;
        phone?: string;
        contact_person?: string;
    } | null;
    group?: {
        requestId?: string;
        requestNumber?: string;
        itemName?: string;
        department?: string;
        category?: string;
    } | null;
    initialQuote?: {
        id?: number;
        total_amount?: number;
        lead_time_days?: string;
    } | null;
    onMeetingScheduled?: (result: any) => void;
    onMeetingRemoved?: (meetingId: string) => void;
}

export function SetSupplierMeetingModal({
    isOpen,
    onClose,
    meeting,
    supplier,
    group,
    initialQuote,
    onMeetingScheduled,
    onMeetingRemoved,
}: SetSupplierMeetingModalProps) {
    const [supplierName, setSupplierName] = useState("");
    const [supplierEmail, setSupplierEmail] = useState("");
    const [contactPerson, setContactPerson] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [title, setTitle] = useState("");
    const [meetingType, setMeetingType] = useState<"Video Conference" | "On-Site / In-Person" | "Phone Call">("Video Conference");
    const [meetingDate, setMeetingDate] = useState("");
    const [startTime, setStartTime] = useState("10:00");
    const [duration, setDuration] = useState("45 mins");
    const [meetingLink, setMeetingLink] = useState("");
    const [location, setLocation] = useState("");
    const [agenda, setAgenda] = useState("");
    const [internalNotes, setInternalNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // Initialize values when modal opens (prefill from existing meeting if editing)
    useEffect(() => {
        if (isOpen) {
            if (meeting) {
                // Editing an existing meeting
                setSupplierName(meeting.supplier_name || supplier?.name || "");
                setSupplierEmail(meeting.supplier_email || supplier?.email || "");
                setContactPerson(meeting.contact_person || supplier?.contact_person || "");
                setContactPhone(meeting.contact_phone || supplier?.phone || "");
                setTitle(meeting.title || "");
                setMeetingDate(meeting.meeting_date || "");
                setStartTime(meeting.start_time || "10:00");
                setDuration(meeting.duration || "45 mins");
                setMeetingType(meeting.meeting_type || "Video Conference");
                setMeetingLink(meeting.meeting_link || "");
                setLocation(meeting.location || "Airship Express Central Warehouse Logistics Hub - Conference Room 2");
                setAgenda(meeting.agenda || "");
                setInternalNotes(meeting.internal_notes || "");
            } else {
                // Setting a new meeting
                const sName = supplier?.name || "";
                const sEmail = supplier?.email || "";
                const sContact = supplier?.contact_person || "";
                const sPhone = supplier?.phone || "";
                const reqNum = group?.requestNumber || "";
                const iName = group?.itemName || "";

                setSupplierName(sName);
                setSupplierEmail(sEmail);
                setContactPerson(sContact);
                setContactPhone(sPhone);

                if (iName) {
                    setTitle(`Quotation & Terms Clarification for ${iName} - ${sName || "Supplier"}`);
                } else {
                    setTitle(`Procurement Sourcing & Supply Discussion - ${sName || "Vendor"}`);
                }

                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const yyyy = tomorrow.getFullYear();
                const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
                const dd = String(tomorrow.getDate()).padStart(2, "0");
                setMeetingDate(`${yyyy}-${mm}-${dd}`);

                setStartTime("10:00");
                setDuration("45 mins");
                setMeetingType("Video Conference");
                setMeetingLink("");
                setLocation("Airship Express Central Warehouse Logistics Hub - Conference Room 2");

                const defaultAgendaBullets = [
                    `1. Review submitted proposal and quotation specifications${reqNum ? ` for ${reqNum}` : ""}.`,
                    `2. Verify material compliance, warranty guarantees, and manufacturer certificates.`,
                    `3. Discuss expected production lead times, delivery milestones, and batch shipments.`,
                    `4. Finalize unit pricing, volume discounts, and payment terms (Net 30 / COD).`,
                    `5. Outline next steps for Purchase Order issuance or agreement signing.`
                ].join("\n");
                setAgenda(defaultAgendaBullets);

                setInternalNotes(`Scheduled from Procurement Stage 3 Quotation Evaluation.`);
            }
        }
    }, [isOpen, meeting, supplier, group, initialQuote]);

    if (!isOpen) return null;

    // Direct clipboard paste handler
    const handlePasteLink = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                setMeetingLink(text.trim());
                toast.success("Meeting link pasted from clipboard!");
            } else {
                toast.error("Clipboard is empty.");
            }
        } catch {
            toast.info("Please paste the link directly into the input field (Ctrl+V).");
        }
    };

    const handleCopyLink = () => {
        if (!meetingLink) return;
        navigator.clipboard.writeText(meetingLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast.success("Meeting link copied to clipboard!");
    };

    // Remove / Cancel meeting
    const handleRemoveMeeting = async () => {
        if (!meeting?.id) return;
        if (!window.confirm(`Are you sure you want to cancel and remove this scheduled meeting with ${supplierName}?`)) {
            return;
        }

        setIsRemoving(true);
        try {
            const res = await removeSupplierMeetingAction(meeting.id);
            if (res.success) {
                toast.success("Meeting has been removed.");
                onMeetingRemoved?.(meeting.id);
                onClose();
            } else {
                toast.error(res.error || "Failed to remove meeting.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to remove meeting.");
        } finally {
            setIsRemoving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supplierEmail.trim()) {
            toast.error("Please provide the supplier's email address to send the invitation.");
            return;
        }
        if (!meetingDate || !startTime) {
            toast.error("Please specify the scheduled date and start time.");
            return;
        }
        if (!title.trim()) {
            toast.error("Please enter a meeting title.");
            return;
        }
        if (!agenda.trim()) {
            toast.error("Please outline the meeting agenda.");
            return;
        }
        if (meetingType === "Video Conference" && !meetingLink.trim()) {
            toast.error("Please paste your Google Meet, Zoom, or Teams video call link.");
            return;
        }

        setIsSubmitting(true);
        try {
            const organizerName = user.getName() || "Procurement Specialist";
            const organizerEmail = user.getEmail() || "procurement@airship-express.com";
            const resolvedSupplierId = supplier?.dbSupplierId || supplier?.id || meeting?.supplier_id || null;

            const result = await scheduleSupplierMeetingAction({
                meetingId: meeting?.id,
                supplierId: resolvedSupplierId,
                supplierName: supplierName.trim() || "Supplier Representative",
                supplierEmail: supplierEmail.trim(),
                contactPerson: contactPerson.trim() || undefined,
                contactPhone: contactPhone.trim() || undefined,
                title: title.trim(),
                meetingType,
                meetingDate,
                startTime,
                duration,
                timezone: "Asia/Manila (GMT+8)",
                meetingLink: meetingType === "Video Conference" ? meetingLink.trim() : undefined,
                location: meetingType === "On-Site / In-Person" ? location.trim() : undefined,
                agenda: agenda.trim(),
                internalNotes: internalNotes.trim() || undefined,
                requisitionId: group?.requestId || meeting?.requisition_id,
                requestNumber: group?.requestNumber || meeting?.request_number,
                itemName: group?.itemName || meeting?.item_name,
                quotationId: initialQuote?.id || meeting?.quotation_id || null,
                organizerId: user.getId() || null,
                organizerName,
                organizerEmail,
            });

            if (result.success) {
                toast.success(result.message || (meeting ? "Meeting updated successfully!" : "Meeting scheduled successfully!"));
                onMeetingScheduled?.(result);
                onClose();
            } else {
                toast.error(result.error || "Failed to save meeting.");
            }
        } catch (err: any) {
            console.error("Error submitting meeting:", err);
            toast.error(err.message || "An unexpected error occurred while scheduling the meeting.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isBusy = isSubmitting || isRemoving;
    const isSaving = isSubmitting && !meeting;
    const isUpdating = isSubmitting && !!meeting;
    const isDeleting = isRemoving;

    return (
        <Portal>
            <div 
                className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
                onClick={!isBusy ? onClose : undefined}
            >
                <div 
                    className="relative w-full max-w-2xl bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-white/80 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.9),_8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.6)] overflow-hidden my-auto flex flex-col max-h-[92vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Prominent Loading Overlay during Saving, Updating, or Deleting */}
                    {isBusy && (
                        <div className="absolute inset-0 z-50 bg-[#ebf0f7]/90 dark:bg-[#161826]/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 select-none">
                            <div className="relative mb-4">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-none ${
                                    isDeleting 
                                        ? "bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" 
                                        : "bg-pink-500/15 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400"
                                }`}>
                                    <RefreshCw className={`w-8 h-8 animate-spin ${isDeleting ? "text-rose-600 dark:text-rose-400" : "text-pink-600 dark:text-pink-400"}`} />
                                </div>
                                {isDeleting ? (
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                ) : (
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-pink-600 text-white flex items-center justify-center shadow">
                                        <Calendar className="w-3.5 h-3.5" />
                                    </div>
                                )}
                            </div>

                            <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>
                                    {isDeleting 
                                        ? "Deleting Meeting..." 
                                        : isUpdating 
                                        ? "Updating Meeting..." 
                                        : "Saving & Scheduling Meeting..."}
                                </span>
                            </h4>

                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm font-medium leading-relaxed">
                                {isDeleting 
                                    ? "Canceling scheduled session, clearing calendar sync, and updating supplier records..." 
                                    : isUpdating 
                                    ? "Saving modified schedule, updating video link, and notifying meeting participants..." 
                                    : "Registering meeting schedule, generating calendar invitation, and syncing with Supplier Portal..."}
                            </p>

                            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#12131e] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm">
                                <span className={`w-2 h-2 rounded-full animate-ping ${isDeleting ? "bg-rose-500" : "bg-pink-500"}`} />
                                <span className="text-[11px]">
                                    {isDeleting 
                                        ? "Removing meeting records..." 
                                        : isUpdating 
                                        ? "Applying updates..." 
                                        : "Sending notifications..."}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Header - Solid Pink Theme, No Gradients */}
                    <div className="p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-500/15 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-none">
                                <Calendar className="w-5 h-5 stroke-[2.2]" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                    <span>{meeting ? "Update Meeting with Supplier" : "Schedule Meeting with Supplier"}</span>
                                    {isDeleting ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                            Deleting...
                                        </span>
                                    ) : isUpdating ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40 flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                            Updating...
                                        </span>
                                    ) : isSaving ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40 flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                            Saving...
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40">
                                            Stage 3 Negotiation
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {meeting 
                                        ? "Update date, time, video link or cancel this scheduled meeting" 
                                        : "Send calendar invitation to vendor email & post notice in Supplier Portal"}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isBusy}
                            className="p-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.5)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
                        <fieldset disabled={isBusy} className="space-y-4 contents">
                            {/* 1. Supplier & Requisition Overview Banner */}
                            <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#12131f]/70 border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                            {supplierName || "Selected Vendor"}
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {contactPerson ? `Contact: ${contactPerson}` : "Procurement Vendor Partner"}
                                        </div>
                                    </div>
                                </div>

                                {(group?.requestNumber || meeting?.request_number) && (
                                    <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#181926] border border-slate-200 dark:border-white/[0.06] font-mono text-[10px] text-slate-700 dark:text-slate-300">
                                        Ref: <span className="font-bold text-pink-600 dark:text-pink-400">{group?.requestNumber || meeting?.request_number}</span>
                                        {(group?.itemName || meeting?.item_name) && ` (${group?.itemName || meeting?.item_name})`}
                                    </div>
                                )}
                            </div>

                            {/* 2. Meeting Title */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                    Meeting Subject / Title <span className="text-pink-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Quotation Review & Price Negotiation Session"
                                    required
                                    disabled={isBusy}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* 3. Meeting Type Tabs */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                    Meeting Format <span className="text-pink-600">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["Video Conference", "On-Site / In-Person", "Phone Call"] as const).map((type) => {
                                        const isSelected = meetingType === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setMeetingType(type)}
                                                disabled={isBusy}
                                                className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    isSelected
                                                        ? "bg-pink-600 text-white border-pink-500 shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.4)]"
                                                        : "bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 border-white/80 dark:border-white/10 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)]"
                                                }`}
                                            >
                                                {type === "Video Conference" && <Video className="w-4 h-4" />}
                                                {type === "On-Site / In-Person" && <MapPin className="w-4 h-4" />}
                                                {type === "Phone Call" && <Phone className="w-4 h-4" />}
                                                <span className="text-[11px]">{type}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4. Date, Time & Duration */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Date <span className="text-pink-600">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={meetingDate}
                                            onChange={(e) => setMeetingDate(e.target.value)}
                                            required
                                            disabled={isBusy}
                                            className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Start Time <span className="text-pink-600">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        required
                                        disabled={isBusy}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Duration
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        disabled={isBusy}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="15 mins">15 minutes</option>
                                        <option value="30 mins">30 minutes</option>
                                        <option value="45 mins">45 minutes</option>
                                        <option value="1 hour">1 hour</option>
                                        <option value="1.5 hours">1.5 hours</option>
                                        <option value="2 hours">2 hours</option>
                                    </select>
                                </div>
                            </div>

                            {/* 5. Video Call Link */}
                            {meetingType === "Video Conference" ? (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                                            Video Call Link (Google Meet / Zoom / Teams) <span className="text-pink-600">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handlePasteLink}
                                            disabled={isBusy}
                                            className="text-[10px] text-pink-600 dark:text-pink-400 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Paste link from clipboard"
                                        >
                                            <Clipboard className="w-3 h-3" />
                                            <span>Paste Link</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="url"
                                            value={meetingLink}
                                            onChange={(e) => setMeetingLink(e.target.value)}
                                            placeholder="Paste video conference URL (e.g. https://meet.google.com/xyz-abcd-efg or https://zoom.us/j/...)"
                                            required
                                            disabled={isBusy}
                                            className="flex-1 bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                        {meetingLink && (
                                            <button
                                                type="button"
                                                onClick={handleCopyLink}
                                                disabled={isBusy}
                                                className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.4)] transition-all cursor-pointer disabled:opacity-50"
                                                title="Copy link"
                                            >
                                                {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        Paste your meeting link above. It will be emailed to the vendor and displayed in their Supplier Portal.
                                    </p>
                                </div>
                            ) : meetingType === "On-Site / In-Person" ? (
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Physical Office / Warehouse Location
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g. Airship Express Central Logistics Hub, Conference Room 2"
                                        disabled={isBusy}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>
                            ) : null}

                            {/* 6. Supplier Contact Email & Phone */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Supplier Email <span className="text-pink-600">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={supplierEmail}
                                        onChange={(e) => setSupplierEmail(e.target.value)}
                                        placeholder="sales@supplier.com"
                                        required
                                        disabled={isBusy}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                        Contact Person / Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={contactPhone || contactPerson}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        placeholder="e.g. +63 917 123 4567"
                                        disabled={isBusy}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* 7. Discussion Agenda */}
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                                    Discussion Agenda &amp; Objectives <span className="text-pink-600">*</span>
                                </label>
                                <textarea
                                    value={agenda}
                                    onChange={(e) => setAgenda(e.target.value)}
                                    rows={4}
                                    required
                                    disabled={isBusy}
                                    placeholder="List agenda items, quotation discussion points, delivery commitments..."
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl p-3.5 text-xs font-medium text-slate-900 dark:text-white leading-relaxed shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* 8. Notification Channels Badge */}
                            <div className="p-3.5 rounded-2xl bg-pink-50/70 dark:bg-pink-950/20 border border-pink-200/70 dark:border-pink-900/30 text-[11px] text-slate-800 dark:text-slate-200 flex items-start gap-2.5">
                                <Send className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 leading-relaxed">
                                    <span className="font-bold text-pink-700 dark:text-pink-300">Automated Delivery Channels:</span>
                                    <div>• Formal calendar invitation email will be dispatched to <strong>{supplierEmail || "supplier"}</strong>.</div>
                                    <div>• Meeting announcement &amp; link will be posted to the supplier&apos;s <strong>Portal Inbox &amp; Meetings</strong> tab.</div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Footer Buttons */}
                        <div className="pt-2 flex items-center justify-end gap-3 flex-wrap">
                            {meeting && (
                                <button
                                    type="button"
                                    onClick={handleRemoveMeeting}
                                    disabled={isBusy}
                                    className="mr-auto px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(244,63,94,0.15)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)]"
                                    title="Cancel and remove this scheduled meeting"
                                >
                                    {isDeleting ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isDeleting ? "Deleting Meeting..." : "Remove Meeting"}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isBusy}
                                className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isBusy || !supplierEmail.trim()}
                                className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(236,72,153,0.4)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                <span>
                                    {isSubmitting 
                                        ? (meeting ? "Updating Meeting..." : "Saving Meeting...") 
                                        : (meeting ? "Update Meeting" : "Schedule & Send Meeting")}
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
