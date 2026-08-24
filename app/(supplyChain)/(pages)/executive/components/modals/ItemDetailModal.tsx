"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import AppButton from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { ParcelTrackingCard } from "@/app/(supplyChain)/(pages)/inventory/components/tracking/ParcelTrackingCard";

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

    if (!item) return null;

    const copyReference = () => {
        const copyText = item.barcode || item.referenceId;
        navigator.clipboard.writeText(copyText);
        setCopied(true);
        toast.success("Tracking/Barcode copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const isParcel = item.isParcel || item.title.toLowerCase().includes("parcel") || item.title.toLowerCase().includes("tracking");

    // Construct parcel object for ParcelTrackingCard & progress calculation
    const parcelObj = useMemo(() => {
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

    const isDelivered = parcelObj.status === 'delivered';
    const statusIndex = STATUS_FLOW.findIndex(s => s.key === parcelObj.status);
    const progressPercent = isDelivered
        ? 100
        : statusIndex >= 0
            ? Math.round(((statusIndex + 1) / STATUS_FLOW.length) * 100)
            : 45;

    return (
        <div
            className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl dark:shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transform transition-all duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-500 dark:text-pink-400 inline-flex items-center justify-center">
                                <i className={`fas ${isParcel ? 'fa-route' : 'fa-info-circle'} text-xs`} />
                            </span>
                            {isParcel ? 'Parcel Delivery Tracking' : (item.title || 'Record Details')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>Tracking: <code className="font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/50">{parcelObj.tracking_number}</code></span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>Courier: <strong className="font-semibold text-slate-700 dark:text-slate-200">{parcelObj.courier}</strong></span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>Barcode: <code className="font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/50">{parcelObj.barcode}</code></span>
                            <button
                                type="button"
                                onClick={copyReference}
                                className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer ml-1"
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
                        <i className="fas fa-times text-xs" />
                    </AppButton>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/30 overscroll-contain">
                    {isParcel ? (
                        <>
                            {/* Interactive Leaflet Delivery Tracking Map */}
                            <ParcelTrackingCard parcel={parcelObj} />

                            {/* Overall Progress & Metadata Card */}
                            <div className="p-5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow duration-200 space-y-4">
                                {/* Header & Percentage Badge */}
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-semibold flex items-center gap-1.5">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isDelivered ? 'bg-emerald-500 animate-pulse' : 'bg-pink-500 animate-pulse'}`} />
                                        {isDelivered ? 'Delivery Complete' : 'Overall Delivery Progress'}
                                    </span>
                                    <StatusBadge
                                        tone={isDelivered ? "emerald" : "pink"}
                                        size="xs"
                                    >
                                        {isDelivered ? '100%' : `${progressPercent}%`}
                                    </StatusBadge>
                                </div>

                                {/* Clean Progress Bar */}
                                <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden relative p-0.5 ring-1 ring-slate-900/5 dark:ring-white/5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isDelivered
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 shadow-sm shadow-emerald-500/20'
                                            : 'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-400 dark:to-rose-300 shadow-sm shadow-pink-500/20'
                                            }`}
                                        style={{ width: `${isDelivered ? 100 : progressPercent}%` }}
                                    />
                                </div>

                                {/* Delivery Complete Banner */}
                                {isDelivered && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                                        <i className="fas fa-check-circle text-sm text-emerald-600 dark:text-emerald-400" />
                                        <span>Parcel successfully delivered</span>
                                    </div>
                                )}

                                {/* Metadata Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Sender</p>
                                        <p className="font-medium text-slate-800 dark:text-slate-200 break-words">{parcelObj.sender_name}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Destination</p>
                                        <p className="font-medium text-slate-800 dark:text-slate-200 break-words">{parcelObj.destination}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Courier Partner</p>
                                        <p className="font-medium text-indigo-600 dark:text-indigo-400 break-words">{parcelObj.courier}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Current Status</p>
                                        <div>
                                            <StatusBadge tone={isDelivered ? "emerald" : "pink"} size="xs" dot>
                                                {parcelObj.status.replace(/_/g, ' ').toUpperCase()}
                                            </StatusBadge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vertical Timeline */}
                            <div className="relative pl-2 pt-2">
                                <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                <div
                                    className={`absolute left-6 top-5 w-0.5 rounded-full transition-all duration-1000 ease-out ${isDelivered ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-pink-500 dark:bg-pink-400'}`}
                                    style={{ height: `${isDelivered ? 100 : progressPercent}%` }}
                                />
                                <div className="space-y-5">
                                    {STATUS_FLOW.map((flow, index) => {
                                        const idx = STATUS_FLOW.findIndex(s => s.key === flow.key);
                                        const isDone = isDelivered || (statusIndex >= 0 && idx <= statusIndex);
                                        const isCurr = !isDelivered && statusIndex === idx;

                                        return (
                                            <div key={flow.key} className="relative flex items-start gap-4">
                                                <div className="relative z-10 shrink-0">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                                                        isDone ? 'bg-emerald-500 text-white ring-4 ring-white dark:ring-slate-900 shadow-md' :
                                                        isCurr ? 'bg-gradient-to-tr from-pink-600 to-rose-500 text-white ring-4 ring-pink-50 dark:ring-pink-950/50 shadow-md' :
                                                        'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 ring-4 ring-white dark:ring-slate-900'
                                                    }`}>
                                                        <i className={`fas ${flow.icon}`} />
                                                    </div>
                                                </div>

                                                <div className={`flex-1 bg-white dark:bg-slate-900 rounded-xl p-3.5 border transition-all ${
                                                    isCurr ? 'border-pink-200 dark:border-pink-900/60 bg-pink-50/20 dark:bg-pink-950/10' :
                                                    isDone ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10' :
                                                    'border-slate-200/70 dark:border-slate-800'
                                                }`}>
                                                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                                        <p className={`font-semibold ${!isDone && !isCurr ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
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
                                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Courier / Vendor</p>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{item.courierOrSupplier}</p>
                                    </div>
                                )}
                                {item.locationOrArea && (
                                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Storage Bin / Area</p>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{item.locationOrArea}</p>
                                    </div>
                                )}
                                {item.timestamp && (
                                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date Created</p>
                                        <p className="font-mono text-slate-700 dark:text-slate-300 mt-1">{item.timestamp}</p>
                                    </div>
                                )}
                                {item.amount !== undefined && (
                                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recorded Amount</p>
                                        <p className="font-mono font-bold text-pink-600 dark:text-pink-400 mt-1">
                                            {typeof item.amount === 'number' ? `₱ ${item.amount.toLocaleString()}` : item.amount}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {item.description && (
                                <div className="p-4 rounded-xl bg-pink-50/40 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30 text-xs">
                                    <p className="font-semibold text-pink-700 dark:text-pink-300 mb-1 flex items-center gap-1.5">
                                        <i className="fas fa-sticky-note text-[11px]" />
                                        <span>Audit Description</span>
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer with standard AppButton */}
                <div className="flex items-center justify-end px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 gap-2 shrink-0">
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
    );
}
