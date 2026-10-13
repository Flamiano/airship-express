"use client";

import { useEffect, useState } from "react";
import Portal from "../../../../components/client/Portal";
import { toast } from "sonner";
import AppButton from "../../../../components/ui/AppButton";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

export interface ItemDetailRecord {
    title: string;
    referenceId: string;
    barcode?: string;
    category?: string;
    status: string;
    supplier?: string;
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
        toast.success("Reference ID copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
                data-lenis-prevent
            >
                <div
                    className="relative w-full max-w-xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.08] rounded-3xl shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/70 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-base shadow-[0_3px_8px_rgba(236,72,153,0.35)] shrink-0">
                                <i className="fas fa-cube" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {item.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                        {item.referenceId}
                                    </span>
                                    <button
                                        onClick={copyReference}
                                        className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                                    >
                                        <i className={copied ? "fas fa-check" : "fas fa-copy"} />
                                        {copied ? "Copied" : "Copy"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <AppButton
                            variant="neutral"
                            size="xs"
                            onClick={onClose}
                            className="!p-2 shrink-0 rounded-xl"
                            aria-label="Close modal"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    {/* body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#f0f3f8] dark:bg-[#161722] overscroll-contain">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                {item.status && (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                                        <div className="mt-1">
                                            <StatusBadge tone="pink" size="xs">
                                                {item.status}
                                            </StatusBadge>
                                        </div>
                                    </div>
                                )}
                                {item.category && (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</p>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 mt-1">{item.category}</p>
                                    </div>
                                )}
                                {item.supplier && (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier / Vendor</p>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 mt-1">{item.supplier}</p>
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
