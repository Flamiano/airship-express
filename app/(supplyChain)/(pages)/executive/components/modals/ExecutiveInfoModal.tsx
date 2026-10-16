"use client";

import React, { useEffect } from "react";
import Portal from "../../../../components/client/Portal";
import { StatusBadge, type BadgeTone } from "../../../../components/ui/StatusBadge";
import {
    type IssuedPOAnalyticsItem,
    type DefectiveIncidentAnalyticsItem,
    type ReplacementCaseAnalyticsItem
} from "../../hooks/useExecutiveData";

export type ExecutiveModalContentType =
    | { type: "po"; data: IssuedPOAnalyticsItem }
    | { type: "incident"; data: DefectiveIncidentAnalyticsItem }
    | { type: "return"; data: ReplacementCaseAnalyticsItem }
    | {
          type: "info";
          data: {
              title: string;
              subtitle?: string;
              icon?: string;
              description: string;
              details?: { label: string; value: string | number; tone?: BadgeTone }[];
              note?: string;
          };
      };

interface ExecutiveInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: ExecutiveModalContentType | null;
}

export default function ExecutiveInfoModal({ isOpen, onClose, content }: ExecutiveInfoModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !content) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
                data-lenis-prevent
            >
                <div
                    className="relative w-full max-w-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.08] rounded-3xl shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#f0f3f8] dark:bg-[#191a24]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] shrink-0">
                                {content.type === "po" && <i className="fas fa-file-invoice-dollar text-base" />}
                                {content.type === "incident" && <i className="fas fa-shield-halved text-base" />}
                                {content.type === "return" && <i className="fas fa-arrows-rotate text-base" />}
                                {content.type === "info" && <i className={`fas ${content.data.icon || "fa-info-circle"} text-base`} />}
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                                    {content.type === "po" && `Purchase Order: ${content.data.po_number}`}
                                    {content.type === "incident" && `Defect Incident: ${content.data.incident_number}`}
                                    {content.type === "return" && `Supplier Return: ${content.data.return_request_number}`}
                                    {content.type === "info" && content.data.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {content.type === "po" && "Authoritative issued purchase order details"}
                                    {content.type === "incident" && "Warehouse receiving inspection & quarantine report"}
                                    {content.type === "return" && "Supplier return request & replacement fulfillment status"}
                                    {content.type === "info" && (content.data.subtitle || "Executive Information & Oversight")}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6)] cursor-pointer active:scale-95 transition-all"
                            title="Close"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
                        {/* 1. PURCHASE ORDER CONTENT */}
                        {content.type === "po" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Status
                                        </span>
                                        <StatusBadge tone={content.data.status === "Delivered" ? "emerald" : "blue"}>
                                            {content.data.status}
                                        </StatusBadge>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Total Amount
                                        </span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                            ₱{content.data.total_amount.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Finance Approval
                                        </span>
                                        <StatusBadge tone={content.data.financial_approval === "Approved" ? "emerald" : "amber"}>
                                            {content.data.financial_approval || "Pending"}
                                        </StatusBadge>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Fulfillment
                                        </span>
                                        <StatusBadge
                                            tone={
                                                content.data.delivery_status === "Fully Received"
                                                    ? "emerald"
                                                    : content.data.delivery_status === "Partially Received"
                                                    ? "blue"
                                                    : "amber"
                                            }
                                        >
                                            {content.data.delivery_status}
                                        </StatusBadge>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-2.5">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Supplier Name</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">
                                            {content.data.supplier_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Delivery Schedule</span>
                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {content.data.delivery_date || "Open Schedule"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-500">Order Creation Date</span>
                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {content.data.created_at ? new Date(content.data.created_at).toLocaleDateString() : "N/A"}
                                        </span>
                                    </div>
                                </div>

                                {content.data.distinct_items && content.data.distinct_items.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                                            Ordered Items ({content.data.distinct_items.length} items)
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {content.data.distinct_items.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] text-slate-800 dark:text-slate-200 shadow-2xs"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. DEFECT INCIDENT CONTENT */}
                        {content.type === "incident" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Severity
                                        </span>
                                        <StatusBadge
                                            tone={
                                                content.data.severity === "Critical"
                                                    ? "rose"
                                                    : content.data.severity === "High"
                                                    ? "amber"
                                                    : "blue"
                                            }
                                        >
                                            {content.data.severity}
                                        </StatusBadge>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Defective Qty
                                        </span>
                                        <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                                            {content.data.quantity} {content.data.unit}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Status
                                        </span>
                                        <StatusBadge tone="amber">{content.data.status}</StatusBadge>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Defective Quantity
                                        </span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                            {content.data.quantity} {content.data.unit}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-2.5">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Item Name</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">
                                            {content.data.item_name} ({content.data.item_code})
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Supplier</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {content.data.supplier_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">PO Reference</span>
                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {content.data.po_number || "Direct Inbound"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-500">Discrepancy Category</span>
                                        <span className="font-bold text-pink-600 dark:text-pink-400">
                                            {content.data.discrepancy_type} • {content.data.defect_type}
                                        </span>
                                    </div>
                                </div>

                                {content.data.action_taken && (
                                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
                                        <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                                            Action Taken / Quarantine:
                                        </span>
                                        <p className="text-amber-900 dark:text-amber-200 text-xs">
                                            {content.data.action_taken}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. SUPPLIER RETURN REQUEST CONTENT */}
                        {content.type === "return" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Status
                                        </span>
                                        <StatusBadge tone={content.data.status === "Resolved" ? "emerald" : "blue"}>
                                            {content.data.status}
                                        </StatusBadge>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Defective Units
                                        </span>
                                        <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                                            {content.data.defective_quantity}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Replacements Received
                                        </span>
                                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                            {content.data.replacement_quantity_received}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            Outstanding
                                        </span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                            {content.data.outstanding_quantity}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-2.5">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Supplier Name</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">
                                            {content.data.supplier_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Item Name</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {content.data.item_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">Associated PO</span>
                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {content.data.po_number}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <span className="font-bold text-slate-500">QC Condition</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {content.data.qc_condition}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-500">Expected / Received Date</span>
                                        <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {content.data.replacement_received_date || content.data.expected_replacement_date || "Awaiting dispatch"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. GENERAL INFO CONTENT */}
                        {content.type === "info" && (
                            <div className="space-y-4">
                                <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                    {content.data.description}
                                </p>

                                {content.data.details && content.data.details.length > 0 && (
                                    <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-2.5">
                                        {content.data.details.map((det, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex justify-between items-center ${
                                                    idx !== content.data.details!.length - 1
                                                        ? "pb-2 border-b border-slate-200/60 dark:border-slate-800"
                                                        : ""
                                                }`}
                                            >
                                                <span className="font-bold text-slate-500">{det.label}</span>
                                                {det.tone ? (
                                                    <StatusBadge tone={det.tone}>{String(det.value)}</StatusBadge>
                                                ) : (
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {det.value}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {content.data.note && (
                                    <div className="p-3.5 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40 text-pink-900 dark:text-pink-200 text-xs">
                                        <i className="fas fa-circle-info mr-1.5 text-pink-500" />
                                        {content.data.note}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#f0f3f8] dark:bg-[#191a24] flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
