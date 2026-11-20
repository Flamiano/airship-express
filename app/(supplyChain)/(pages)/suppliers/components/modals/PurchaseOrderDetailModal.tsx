// modal component for viewing complete purchase order details, line items, receipt, and approval pipeline

"use client";

import React, { useState, useMemo } from "react";
import Portal from "../../../../components/client/Portal";
import { PurchaseOrder } from "../../types";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { DigitalReceiptModal } from "../../../../components/modals/DigitalReceiptModal";
import {
    X,
    FileText,
    Receipt,
    Maximize2,
    Minimize2,
    Building2,
    Truck,
    Calendar,
    DollarSign,
    Package,
    ShieldCheck,
    Clock,
    Check,
    CheckCircle2,
    AlertCircle,
    MapPin,
    Tag,
    Copy,
    ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface PurchaseOrderDetailModalProps {
    isOpen: boolean;
    purchaseOrder: PurchaseOrder | any | null;
    onClose: () => void;
}

export function PurchaseOrderDetailModal({
    isOpen,
    purchaseOrder,
    onClose,
}: PurchaseOrderDetailModalProps) {
    const [activeTab, setActiveTab] = useState<"details" | "manage">("details");
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isDigitalReceiptOpen, setIsDigitalReceiptOpen] = useState(false);

    // Normalize and safely parse items
    const parsedItems = useMemo(() => {
        if (!purchaseOrder) return [];
        let items: any[] = [];
        if (typeof purchaseOrder.items === "string") {
            try {
                items = JSON.parse(purchaseOrder.items);
            } catch {
                items = [];
            }
        } else if (Array.isArray(purchaseOrder.items)) {
            items = purchaseOrder.items;
        }

        if (items.length === 0) {
            let fallbackName = purchaseOrder.item_name;
            if (!fallbackName && purchaseOrder.notes) {
                const m = purchaseOrder.notes.match(/\(([^)]+)\)/);
                if (m && m[1]) fallbackName = m[1];
            }
            if (fallbackName) {
                items = [
                    {
                        name: fallbackName,
                        item_name: fallbackName,
                        quantity: purchaseOrder.quantity || 1,
                        unit: purchaseOrder.unit || "units",
                        unit_price: purchaseOrder.unit_price || purchaseOrder.total_amount,
                        price: purchaseOrder.unit_price || purchaseOrder.total_amount,
                        total: purchaseOrder.total_amount,
                    },
                ];
            }
        }
        return items;
    }, [purchaseOrder]);

    if (!isOpen || !purchaseOrder) return null;

    const isPaid = Boolean(
        purchaseOrder.paid ||
        purchaseOrder.verification?.match_result === "matched" ||
        purchaseOrder.verification?.match_result === "forced"
    );

    const isAdminApproved = Boolean(
        (purchaseOrder.admin_approval || "").toLowerCase() === "approved"
    );
    const isFinancialApproved = Boolean(
        (purchaseOrder.financial_approval || "").toLowerCase() === "approved" ||
        (isAdminApproved && (purchaseOrder.financial_approval || "").toLowerCase() !== "pending")
    );

    const getStatusTone = (st: string) => {
        switch ((st || "").toLowerCase()) {
            case "pending": return "amber";
            case "issued": return "blue";
            case "delivered": return "emerald";
            case "cancelled": return "rose";
            case "confirmed": return "indigo";
            default: return "neutral";
        }
    };

    const handleCopyPoNumber = () => {
        if (purchaseOrder.po_number) {
            navigator.clipboard.writeText(purchaseOrder.po_number);
            toast.success(`Copied PO #${purchaseOrder.po_number} to clipboard`);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                {/* Modal Container */}
                <div
                    className={`bg-[#f0f3f8] dark:bg-[#161722] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden transition-all duration-300 animate-in zoom-in-95 ${
                        isFullScreen
                            ? "fixed inset-0 w-screen h-screen rounded-none z-[99999]"
                            : "w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-[12px_12px_36px_rgba(166,175,195,0.45),-12px_-12px_36px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)]"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-[#ebf0f7]/70 dark:bg-[#14151e]/70">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.35)]">
                                <FileText className="h-5 w-5 drop-shadow" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                        Purchase Order Details
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={handleCopyPoNumber}
                                        className="font-mono text-xs font-black text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2.5 py-0.5 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] hover:bg-pink-50 dark:hover:bg-pink-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Click to copy PO Number"
                                    >
                                        <span>#{purchaseOrder.po_number || `PO-${purchaseOrder.id}`}</span>
                                        <Copy className="w-3 h-3 text-pink-500" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                                    {purchaseOrder.supplier_name} • <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">₱{Number(purchaseOrder.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </p>
                            </div>
                        </div>

                        {/* Top Action Controls */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {/* Digital Receipt Trigger */}
                            <button
                                type="button"
                                onClick={() => setIsDigitalReceiptOpen(true)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                title="View & Print Official Digital Receipt"
                            >
                                <Receipt className="h-3.5 w-3.5 text-pink-500" />
                                <span className="hidden sm:inline">Digital Receipt</span>
                            </button>

                            {/* Fullscreen Toggle */}
                            <button
                                type="button"
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-pink-600 bg-[#ebf0f7] dark:bg-[#1e1f2c] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
                                aria-label={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
                            >
                                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            </button>

                            {/* Close Modal */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Segmented Navigation Tabs */}
                    <div className="px-5 sm:px-6 pt-2.5 pb-0 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200/70 dark:border-slate-800 flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab("details")}
                            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === "details"
                                    ? "bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent"
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Overview & Line Items</span>
                            {parsedItems.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-mono">
                                    {parsedItems.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("manage")}
                            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === "manage"
                                    ? "bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent"
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Status & Approval Pipeline</span>
                            <StatusBadge tone={getStatusTone(purchaseOrder.status)} size="xs">
                                {purchaseOrder.status || "Pending"}
                            </StatusBadge>
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                        {activeTab === "details" ? (
                            <>
                                {/* 4 Summary Metric Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 block tracking-wider">
                                            Total Amount
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                                            ₱{Number(purchaseOrder.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 block tracking-wider">
                                            Delivery Date
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                                            {purchaseOrder.delivery_date
                                                ? new Date(purchaseOrder.delivery_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                                : "Standard Schedule"}
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 block tracking-wider mb-1">
                                            Status
                                        </span>
                                        <StatusBadge tone={getStatusTone(purchaseOrder.status)} size="xs">
                                            {purchaseOrder.status || "Pending"}
                                        </StatusBadge>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 block tracking-wider mb-1">
                                            Payment
                                        </span>
                                        {isPaid ? (
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

                                {/* Buyer & Supplier Entity Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {/* Buyer Card */}
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                            <Building2 className="w-4 h-4 shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Buyer (Issuer)</span>
                                        </div>
                                        <p className="text-xs font-black text-slate-900 dark:text-white">
                                            Airship Express Logistics Corp.
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Procurement & Supply Chain Division
                                        </p>
                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-pink-500 mt-0.5 shrink-0" />
                                            <span className="leading-tight">
                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {purchaseOrder.delivery_location || "352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Central Hub)"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Supplier Card */}
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                            <Truck className="w-4 h-4 shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Supplier / Vendor</span>
                                        </div>
                                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                            {purchaseOrder.supplier_name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                                            {purchaseOrder.supplier_email || purchaseOrder.supplier_phone || "Registered Supplier"}
                                        </p>
                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-pink-500 mt-0.5 shrink-0" />
                                            <span className="leading-tight truncate" title={purchaseOrder.supplier_address || purchaseOrder.supplier_location || "On File / Registered Facility"}>
                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {purchaseOrder.supplier_address || purchaseOrder.supplier_location || "On File / Registered Facility"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Full Itemized Line Items Table */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                            <Package className="w-4 h-4 text-pink-500" />
                                            <span>Purchased Line Items</span>
                                        </div>
                                        <span className="text-xs font-black text-pink-600 dark:text-pink-400 px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-900/50">
                                            {parsedItems.length} {parsedItems.length === 1 ? "item" : "items"}
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#13141c] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-white/[0.02] text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                                                    <th className="py-2.5 px-3.5">Item Description</th>
                                                    <th className="py-2.5 px-3.5 text-center w-20">Qty</th>
                                                    <th className="py-2.5 px-3.5 text-right w-28">Unit Price</th>
                                                    <th className="py-2.5 px-3.5 text-right w-32">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                                                {parsedItems.length > 0 ? (
                                                    parsedItems.map((it: any, idx: number) => {
                                                        const itemName = it.item_name || it.name || `Purchased Goods #${idx + 1}`;
                                                        const quantity = Number(it.quantity || 1);
                                                        const unitPrice = Number(it.unit_price || it.price || 0);
                                                        const lineTotal = Number(it.total || quantity * unitPrice);

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/40 dark:hover:bg-white/[0.02]">
                                                                <td className="py-2.5 px-3.5 text-center font-mono text-slate-400">
                                                                    {idx + 1}
                                                                </td>
                                                                <td className="py-2.5 px-3.5">
                                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                                        {itemName}
                                                                    </div>
                                                                    {it.category && (
                                                                        <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">
                                                                            {it.category}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                                    {quantity} {it.unit || "units"}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                    ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                    ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="py-6 text-center text-slate-400">
                                                            No line items listed.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Financial Summary Breakdown */}
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                                        Financial Breakdown
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-bold">Subtotal</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                ₱{Number(purchaseOrder.subtotal || purchaseOrder.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-bold">Discount</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                                {Number(purchaseOrder.discount || 0) > 0 ? `-₱${Number(purchaseOrder.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-bold">Shipping Fee</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                {Number(purchaseOrder.shipping_fee || 0) > 0 ? `+₱${Number(purchaseOrder.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-bold">Tax ({purchaseOrder.tax_rate ?? 12}%)</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                +₱{Number(purchaseOrder.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <span className="text-[10px] text-pink-600 dark:text-pink-400 font-black block">Total Amount</span>
                                            <span className="font-mono font-black text-pink-600 dark:text-pink-400 text-base">
                                                ₱{Number(purchaseOrder.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Commercial Terms & Conditions */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Payment Terms
                                        </span>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            {purchaseOrder.payment_terms || "Net 30 Days (Standard B2B Commercial)"}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Category
                                        </span>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            {purchaseOrder.category || "General Procurement"}
                                        </p>
                                    </div>
                                </div>

                                {purchaseOrder.notes && (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Order Notes
                                        </span>
                                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {purchaseOrder.notes}
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Status & Approval Pipeline Tab */
                            <div className="space-y-5">
                                {/* 4-Stage Approval Progress Tracker */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-pink-500" />
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                4-Stage Procurement &amp; Delivery Lifecycle
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            Current: <strong className="text-pink-600 dark:text-pink-400">{purchaseOrder.status || "Pending"}</strong>
                                        </span>
                                    </div>

                                    {/* 4 Steps Timeline */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {/* Step 1: Admin Approval */}
                                        <div className={`p-3 rounded-2xl border text-center transition-all ${
                                            isAdminApproved
                                                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                                                : "bg-[#ebf0f7] dark:bg-[#161826] border-amber-300/60 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]"
                                        }`}>
                                            <div className="flex items-center justify-center mb-1.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                                    isAdminApproved
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-amber-500 text-white animate-pulse"
                                                }`}>
                                                    {isAdminApproved ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Clock className="w-3.5 h-3.5" />}
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-black block">1. Admin Approval</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80 block mt-0.5">
                                                {isAdminApproved ? "Approved ✓" : "Awaiting Review"}
                                            </span>
                                            {purchaseOrder.admin_approved_at && (
                                                <span className="text-[9px] text-slate-400 font-mono block mt-1">
                                                    {new Date(purchaseOrder.admin_approved_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Step 2: Financial Approval */}
                                        <div className={`p-3 rounded-2xl border text-center transition-all ${
                                            isFinancialApproved
                                                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                                                : "bg-[#ebf0f7] dark:bg-[#161826] border-slate-300/60 dark:border-white/5 text-slate-600 dark:text-slate-400"
                                        }`}>
                                            <div className="flex items-center justify-center mb-1.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                                    isFinancialApproved
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                }`}>
                                                    {isFinancialApproved ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-black block">2. Financial Approval</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80 block mt-0.5">
                                                {isFinancialApproved ? "Approved ✓" : "Pending Finance"}
                                            </span>
                                        </div>

                                        {/* Step 3: Issued */}
                                        <div className={`p-3 rounded-2xl border text-center transition-all ${
                                            ["issued", "delivered", "confirmed"].includes((purchaseOrder.status || "").toLowerCase())
                                                ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-300/80 dark:border-blue-800/40 text-blue-800 dark:text-blue-300 shadow-sm"
                                                : "bg-[#ebf0f7] dark:bg-[#161826] border-slate-300/60 dark:border-white/5 text-slate-600 dark:text-slate-400"
                                        }`}>
                                            <div className="flex items-center justify-center mb-1.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                                    ["issued", "delivered", "confirmed"].includes((purchaseOrder.status || "").toLowerCase())
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                }`}>
                                                    {["issued", "delivered", "confirmed"].includes((purchaseOrder.status || "").toLowerCase()) ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-black block">3. Issued & Sent</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80 block mt-0.5">
                                                {["issued", "delivered", "confirmed"].includes((purchaseOrder.status || "").toLowerCase()) ? "Dispatched" : "Pending Issue"}
                                            </span>
                                        </div>

                                        {/* Step 4: Delivered */}
                                        <div className={`p-3 rounded-2xl border text-center transition-all ${
                                            (purchaseOrder.status || "").toLowerCase() === "delivered"
                                                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                                                : "bg-[#ebf0f7] dark:bg-[#161826] border-slate-300/60 dark:border-white/5 text-slate-600 dark:text-slate-400"
                                        }`}>
                                            <div className="flex items-center justify-center mb-1.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                                    (purchaseOrder.status || "").toLowerCase() === "delivered"
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                }`}>
                                                    {(purchaseOrder.status || "").toLowerCase() === "delivered" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-black block">4. Delivered</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80 block mt-0.5">
                                                {(purchaseOrder.status || "").toLowerCase() === "delivered" ? "Delivered ✓" : "In Pipeline"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Stage Information Card */}
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                                        <AlertCircle className="w-4 h-4 text-pink-500" />
                                        <span>Status Workflow Explanation</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {!isAdminApproved ? (
                                            <>This Purchase Order is currently in <strong>Stage 1: Awaiting Administrative Review</strong>. The admin must inspect quantities, specifications, and commercial terms before financial clearance.</>
                                        ) : !isFinancialApproved ? (
                                            <>Administrative approval has been completed. This order is in <strong>Stage 2: Awaiting Financial Approval</strong> before budget release and supplier notification.</>
                                        ) : (purchaseOrder.status || "").toLowerCase() !== "delivered" ? (
                                            <>This order has been officially <strong>Approved &amp; Issued</strong>. Goods are currently in fulfillment or dispatch to the central receiving facility.</>
                                        ) : (
                                            <>This Purchase Order has been marked <strong>Delivered</strong> and goods have arrived at the receiving warehouse.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/70 flex items-center justify-between gap-3 shrink-0">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Status: <strong className="text-slate-800 dark:text-slate-200">{purchaseOrder.status || "Pending"}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsDigitalReceiptOpen(true)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                            >
                                <Receipt className="h-3.5 w-3.5 text-pink-500" />
                                <span>Digital Receipt</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.3)] cursor-pointer active:scale-95 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-modal: Digital Receipt Modal */}
                {isDigitalReceiptOpen && (
                    <DigitalReceiptModal
                        isOpen={isDigitalReceiptOpen}
                        onClose={() => setIsDigitalReceiptOpen(false)}
                        purchaseOrder={purchaseOrder}
                    />
                )}
            </div>
        </Portal>
    );
}
