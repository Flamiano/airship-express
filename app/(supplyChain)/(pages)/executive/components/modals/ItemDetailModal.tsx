"use client";

import { useEffect, useState, useMemo } from "react";
import Portal from "../../../../components/client/Portal";
import { toast } from "sonner";
import AppButton from "../../../../components/ui/AppButton";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { ParcelTrackingCard } from "../../../inventory/components/tracking/ParcelTrackingCard";

export interface ItemDetailRecord {
    title: string;
    referenceId: string;
    barcode?: string;
    category?: string;
    status: string;
    courierOrSupplier?: string;
    locationOrArea?: string;
    consignee?: string;
    sender?: string;
    timestamp?: string;
    amount?: string | number;
    description?: string;
    rawDetails?: Record<string, any>;
    isParcel?: boolean;
}

interface ItemDetailModalProps {
    item: ItemDetailRecord | null;
    onClose: () => void;
}

const STATUS_FLOW = [
    { key: 'received', label: 'Received at Facility', icon: 'fa-box' },
    { key: 'sorting', label: 'Sorting Lane', icon: 'fa-sort' },
    { key: 'ready_for_pickup', label: 'Ready for Dispatch', icon: 'fa-check-circle' },
    { key: 'picked_up', label: 'Carrier Linehaul Sweep', icon: 'fa-truck' },
    { key: 'in_transit', label: 'In Transit Hub', icon: 'fa-truck-moving' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: 'fa-shipping-fast' },
    { key: 'delivered', label: 'Delivered to Consignee', icon: 'fa-home' },
];

export default function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // build parcel object unconditionally before any early return
    const parcelObj = useMemo(() => {
        if (!item) return null;
        return {
            id: 1,
            barcode: item.barcode || item.referenceId || "BC-100234",
            tracking_number: item.referenceId || item.barcode || "AX-992031",
            sender_name: item.sender || "Airship Central Supplier",
            customer_name: item.consignee || item.title || "Consignee Client",
            destination: item.locationOrArea || "Manila Distribution Center",
            courier: item.courierOrSupplier || "Airship Express",
            status: (item.status || "sorting").toLowerCase().replace(/\s+/g, '_'),
            created_at: item.timestamp || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }, [item]);

    if (!item || !parcelObj) return null;

    const copyReference = () => {
        const copyText = item.barcode || item.referenceId;
        navigator.clipboard.writeText(copyText);
        setCopied(true);
        toast.success("Tracking/Barcode copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const isParcel = item.isParcel || item.title.toLowerCase().includes("parcel") || item.title.toLowerCase().includes("tracking");
    const isDelivered = parcelObj.status === 'delivered';
    const statusIndex = STATUS_FLOW.findIndex(s => s.key === parcelObj.status);
    const progressPercent = isDelivered
        ? 100
        : statusIndex >= 0
            ? Math.round(((statusIndex + 1) / STATUS_FLOW.length) * 100)
            : 45;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-4 transition-all duration-300 animate-in fade-in"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] overflow-hidden transform transition-all duration-300 animate-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0 bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                                <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] inline-flex items-center justify-center shrink-0">
                                    <i className={`fas ${isParcel ? 'fa-route' : 'fa-info-circle'} text-sm`} />
                                </span>
                                {isParcel ? 'Parcel Delivery Tracking' : (item.title || 'Record Details')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>Tracking: <code className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151e] px-2 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">{parcelObj.tracking_number}</code></span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>Courier: <strong className="font-bold text-slate-800 dark:text-slate-200">{parcelObj.courier}</strong></span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>Barcode: <code className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151e] px-2 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">{parcelObj.barcode}</code></span>
                                <button
                                    type="button"
                                    onClick={copyReference}
                                    className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer ml-1"
                                >
                                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </p>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    {/* body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#f0f3f8] dark:bg-[#161722] overscroll-contain">
                        {isParcel ? (
                            <>
                                {/* tracking map */}
                                <ParcelTrackingCard parcel={parcelObj} />

                                {/* progress card */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] space-y-4">
                                    {/* header */}
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1.5">
                                            <span className={`inline-block w-2 h-2 rounded-full ${isDelivered ? 'bg-emerald-500 animate-pulse' : 'bg-pink-500 animate-pulse'}`} />
                                            {isDelivered ? 'Delivery Complete' : 'Overall Delivery Progress'}
                                        </span>
                                        <StatusBadge
                                            tone={isDelivered ? "emerald" : "pink"}
                                            size="xs"
                                        >
                                            {isDelivered ? '100%' : `${progressPercent}%`}
                                        </StatusBadge>
                                    </div>

                                    {/* progress bar */}
                                    <div className="w-full bg-[#f0f3f8] dark:bg-[#191a24] h-3 rounded-full overflow-hidden relative p-0.5 border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isDelivered
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 shadow-[0_2px_8px_rgba(16,185,129,0.35)]'
                                                : 'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-400 dark:to-rose-300 shadow-[0_2px_8px_rgba(236,72,153,0.35)]'
                                                }`}
                                            style={{ width: `${isDelivered ? 100 : progressPercent}%` }}
                                        />
                                    </div>

                                    {/* complete banner */}
                                    {isDelivered && (
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold shadow-2xs">
                                            <i className="fas fa-check-circle text-sm text-emerald-600 dark:text-emerald-400" />
                                            <span>Parcel successfully delivered</span>
                                        </div>
                                    )}

                                    {/* metadata */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06] text-xs">
                                        <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[1px_1px_2px_rgba(166,175,195,0.2)] space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Sender</p>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 break-words">{parcelObj.sender_name}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[1px_1px_2px_rgba(166,175,195,0.2)] space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Destination</p>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 break-words">{parcelObj.destination}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[1px_1px_2px_rgba(166,175,195,0.2)] space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Courier Partner</p>
                                            <p className="font-bold text-pink-600 dark:text-pink-400 break-words">{parcelObj.courier}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[1px_1px_2px_rgba(166,175,195,0.2)] space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Current Status</p>
                                            <div>
                                                <StatusBadge tone={isDelivered ? "emerald" : "pink"} size="xs" dot>
                                                    {parcelObj.status.replace(/_/g, ' ').toUpperCase()}
                                                </StatusBadge>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* timeline */}
                                <div className="relative pl-2 pt-2">
                                    <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-slate-200/80 dark:border-white/[0.08] dark:bg-slate-800 rounded-full" />
                                    <div
                                        className={`absolute left-6 top-5 w-0.5 rounded-full transition-all duration-1000 ease-out ${isDelivered ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-pink-500 dark:bg-pink-400'}`}
                                        style={{ height: `${isDelivered ? 100 : progressPercent}%` }}
                                    />
                                    <div className="space-y-4">
                                        {STATUS_FLOW.map((flow) => {
                                            const idx = STATUS_FLOW.findIndex(s => s.key === flow.key);
                                            const isDone = isDelivered || (statusIndex >= 0 && idx <= statusIndex);
                                            const isCurr = !isDelivered && statusIndex === idx;

                                            return (
                                                <div key={flow.key} className="relative flex items-start gap-4">
                                                    <div className="relative z-10 shrink-0">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm transition-all duration-300 ${
                                                            isDone ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-[0_3px_8px_rgba(16,185,129,0.35)]' :
                                                            isCurr ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-[0_3px_10px_rgba(236,72,153,0.4)]' :
                                                            'bg-[#ebf0f7] dark:bg-[#14151e] text-slate-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]'
                                                        }`}>
                                                            <i className={`fas ${flow.icon}`} />
                                                        </div>
                                                    </div>

                                                    <div className={`flex-1 rounded-2xl p-4 border transition-all ${
                                                        isCurr ? 'bg-[#ebf0f7] dark:bg-[#14151e] border-pink-400/80 dark:border-pink-500/80 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]' :
                                                        isDone ? 'bg-[#ebf0f7] dark:bg-[#14151e] border-emerald-400/80 dark:border-emerald-500/80 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]' :
                                                        'bg-[#ebf0f7] dark:bg-[#14151e] border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]'
                                                    }`}>
                                                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                                            <p className={`font-bold ${!isDone && !isCurr ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                                                {flow.label}
                                                            </p>
                                                            {isCurr && (
                                                                <StatusBadge tone="pink" size="xs" dot>
                                                                    Current Stage
                                                                </StatusBadge>
                                                            )}
                                                            {isDone && (
                                                                <StatusBadge tone="emerald" size="xs" icon="fas fa-check-circle">
                                                                    Verified
                                                                </StatusBadge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Standard Non-Parcel Item Details */
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {item.courierOrSupplier && (
                                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Courier / Vendor</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 mt-1">{item.courierOrSupplier}</p>
                                        </div>
                                    )}
                                    {item.locationOrArea && (
                                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage Bin / Area</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 mt-1">{item.locationOrArea}</p>
                                        </div>
                                    )}
                                    {item.timestamp && (
                                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Created</p>
                                            <p className="font-mono font-medium text-slate-700 dark:text-slate-300 mt-1">{item.timestamp}</p>
                                        </div>
                                    )}
                                    {item.amount !== undefined && (
                                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorded Amount</p>
                                            <p className="font-mono font-bold text-pink-600 dark:text-pink-400 mt-1">
                                                {typeof item.amount === 'number' ? `₱ ${item.amount.toLocaleString()}` : item.amount}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {item.description && (
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-xs">
                                        <p className="font-bold text-pink-600 dark:text-pink-400 mb-1 flex items-center gap-1.5">
                                            <i className="fas fa-sticky-note text-[11px]" />
                                            <span>Audit Description</span>
                                        </p>
                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                            {item.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* footer */}
                    <div className="flex items-center justify-end px-6 py-4 bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 border-t border-slate-200/60 dark:border-white/[0.06] gap-2 shrink-0">
                        <AppButton
                            variant="neutral"
                            size="sm"
                            onClick={onClose}
                        >
                            Close
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
