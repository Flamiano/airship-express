'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Portal from '../../../components/client/Portal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TrashRetentionBadge } from './TrashRetentionBadge';
import { supabase } from '../../../lib/services/client/supabase';
import {
    X,
    Copy,
    Check,
    Building2,
    Calendar,
    AlertTriangle,
    ShieldCheck,
    Receipt,
    Package,
    RotateCcw,
    Trash2,
    Clock,
    Radio,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export interface ArchivedPurchaseOrder {
    id: string;
    po_number: string;
    request_id?: string | null;
    supplier_id?: number | null;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date?: string | null;
    notes?: string | null;
    items?: any[];
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string;
    deleted_by: string;
    deletion_reason?: string | null;
    original_id: string;
    paid?: boolean | null;
    fully_received?: boolean;
    paid_verified_at?: string | null;
    paid_verified_by?: string | null;
    force_updated_by?: string | null;
    force_updated_at?: string | null;
    force_reason?: string | null;
    admin_approval?: string;
    admin_approved_at?: string | null;
    admin_approved_by?: string | null;
    financial_approval?: string;
    financial_approved_at?: string | null;
    financial_approved_by?: string | null;
    delivery_location?: string | null;
    payment_terms?: string | null;
    terms_and_conditions?: string | null;
    subtotal?: number;
    discount?: number;
    tax_rate?: number;
    tax_amount?: number;
    shipping_fee?: number;
    category?: string | null;
    suppliers_qoutation_bid?: number | null;
}

interface ArchivedPurchaseOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    po: ArchivedPurchaseOrder | null;
    onRestore?: (po: ArchivedPurchaseOrder) => Promise<void> | void;
    onPermanentDelete?: (po: ArchivedPurchaseOrder) => Promise<void> | void;
}

const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val)) return '₱0.00';
    return `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

export function ArchivedPurchaseOrderViewModal({
    isOpen,
    onClose,
    po,
    onRestore,
    onPermanentDelete,
}: ArchivedPurchaseOrderViewModalProps) {
    const [currentPo, setCurrentPo] = useState<ArchivedPurchaseOrder | null>(po);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [isRestoring, setIsRestoring] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [realtimePulse, setRealtimePulse] = useState<boolean>(false);

    // Keep currentPo in sync with prop po
    useEffect(() => {
        if (po) {
            setCurrentPo(po);
            setIsInitialLoading(true);
            const timer = setTimeout(() => setIsInitialLoading(false), 250);
            return () => clearTimeout(timer);
        } else {
            setCurrentPo(null);
        }
    }, [po]);

    // REALTIME SUBSCRIPTION FOR THIS ARCHIVED PURCHASE ORDER
    useEffect(() => {
        if (!isOpen || !currentPo?.id) return;

        const channelName = `realtime_archived_po_${currentPo.id}_${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'purchase_orders_archive',
                    filter: `id=eq.${currentPo.id}`
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        toast.info('This purchase order was purged or permanently removed in realtime.', {
                            icon: <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                        });
                        onClose();
                    } else if (payload.eventType === 'UPDATE' && payload.new) {
                        setCurrentPo((prev) => ({
                            ...(prev || {}),
                            ...(payload.new as ArchivedPurchaseOrder)
                        }));
                        setRealtimePulse(true);
                        toast.success('Purchase order updated in realtime', {
                            icon: <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                        });
                        setTimeout(() => setRealtimePulse(false), 2000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, currentPo?.id, onClose]);

    const handleCopy = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        toast.success(`Copied ${fieldName}`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleRestoreClick = async () => {
        if (!currentPo || isRestoring || isDeleting) return;
        setIsRestoring(true);
        try {
            if (onRestore) {
                await onRestore(currentPo);
            }
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!currentPo || isDeleting || isRestoring) return;
        setIsDeleting(true);
        try {
            if (onPermanentDelete) {
                await onPermanentDelete(currentPo);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const parsedItems: any[] = useMemo(() => {
        if (!currentPo) return [];
        if (Array.isArray(currentPo.items)) return currentPo.items;
        if (typeof currentPo.items === 'string') {
            try {
                return JSON.parse(currentPo.items);
            } catch {
                return [];
            }
        }
        return [];
    }, [currentPo]);

    if (!isOpen || !currentPo) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            >
                {/* Neumorphic Modal Container */}
                <div
                    className={`relative w-full max-w-4xl max-h-[92vh] bg-[#ebf0f7] dark:bg-[#14151e] rounded-3xl shadow-[12px_12px_28px_rgba(166,175,195,0.45),-12px_-12px_28px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_32px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.035)] border border-white/80 dark:border-white/[0.07] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 transition-all ${
                        realtimePulse ? 'ring-2 ring-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.3)]' : ''
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Neumorphic Header */}
                    <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200/50 dark:border-white/[0.05] bg-[#ebf0f7]/95 dark:bg-[#14151e]/95">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/90 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                <Receipt className="w-5 h-5 text-pink-500" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-mono">
                                        {currentPo.po_number}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(currentPo.po_number, 'PO Number')}
                                        className="text-slate-400 hover:text-pink-500 transition-colors p-1 cursor-pointer"
                                        title="Copy PO Number"
                                    >
                                        {copiedField === 'PO Number' ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ebf0f7] dark:bg-[#181926] text-pink-600 dark:text-pink-400 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)]">
                                        {currentPo.status || 'Draft'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Archived PO Record · Original ID: <span className="font-mono">{currentPo.original_id || currentPo.id}</span>
                                </p>
                            </div>
                        </div>

                        {/* Realtime Live Pulse Badge & Close Button */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Realtime Sync</span>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isRestoring || isDeleting}
                                className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.55),-2px_-2px_5px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
                        
                        {/* Archive Retention Banner - Neumorphic Inset Well */}
                        <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-amber-300/40 dark:border-amber-500/25 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.03)]">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#171824] border border-amber-300/60 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                            Archived Record (Trash)
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Deleted by <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentPo.deleted_by || 'Unknown'}</strong> on {formatDate(currentPo.deleted_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrashRetentionBadge deletedAt={currentPo.deleted_at} />
                                </div>
                            </div>
                            {currentPo.deletion_reason && (
                                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-300">
                                    <strong className="text-slate-800 dark:text-slate-200">Deletion Reason:</strong> {currentPo.deletion_reason}
                                </div>
                            )}
                            {currentPo.force_reason && (
                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                    <strong className="text-slate-800 dark:text-slate-200">Force Update Reason:</strong> {currentPo.force_reason}
                                </div>
                            )}
                        </div>

                        {/* INITIAL SKELETON LOADING STATE */}
                        {isInitialLoading ? (
                            <div className="space-y-5 animate-pulse">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="h-36 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]"></div>
                                    <div className="h-36 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]"></div>
                                </div>
                                <div className="h-44 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]"></div>
                            </div>
                        ) : (
                            <>
                                {/* Order & Supplier Information - Neumorphic Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Supplier Card */}
                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] space-y-2.5">
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                            <Building2 className="w-3.5 h-3.5 text-pink-500" /> Supplier Information
                                        </h3>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 dark:text-slate-400">Supplier Name:</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{currentPo.supplier_name}</span>
                                            </div>
                                            {currentPo.supplier_id && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Supplier ID:</span>
                                                    <span className="font-mono text-slate-800 dark:text-slate-200">{currentPo.supplier_id}</span>
                                                </div>
                                            )}
                                            {currentPo.category && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                                    <span className="text-slate-800 dark:text-slate-200">{currentPo.category}</span>
                                                </div>
                                            )}
                                            {currentPo.suppliers_qoutation_bid && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Quotation Bid ID:</span>
                                                    <span className="font-mono text-slate-800 dark:text-slate-200">{currentPo.suppliers_qoutation_bid}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Logistics & Delivery Card */}
                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] space-y-2.5">
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                            <Calendar className="w-3.5 h-3.5 text-pink-500" /> Logistics & Delivery
                                        </h3>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 dark:text-slate-400">Delivery Date:</span>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(currentPo.delivery_date)}</span>
                                            </div>
                                            {currentPo.delivery_location && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Delivery Location:</span>
                                                    <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={currentPo.delivery_location}>
                                                        {currentPo.delivery_location}
                                                    </span>
                                                </div>
                                            )}
                                            {currentPo.payment_terms && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Payment Terms:</span>
                                                    <span className="text-slate-800 dark:text-slate-200">{currentPo.payment_terms}</span>
                                                </div>
                                            )}
                                            {currentPo.request_id && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Request ID:</span>
                                                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={currentPo.request_id}>
                                                        {currentPo.request_id}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Approval Workflows - Neumorphic Well Card */}
                                <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] space-y-3">
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                        <ShieldCheck className="w-3.5 h-3.5 text-pink-500" /> Approvals & Verification Status
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                                        {/* Admin Approval */}
                                        <div className="p-3.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] space-y-1">
                                            <span className="text-[11px] text-slate-400">Admin Approval</span>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    currentPo.admin_approval === 'Approved'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : currentPo.admin_approval === 'Rejected'
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                }`}>
                                                    {currentPo.admin_approval || 'Pending'}
                                                </span>
                                            </div>
                                            {currentPo.admin_approved_at && (
                                                <p className="text-[10px] text-slate-400 mt-1">At: {formatDate(currentPo.admin_approved_at)}</p>
                                            )}
                                        </div>

                                        {/* Financial Approval */}
                                        <div className="p-3.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] space-y-1">
                                            <span className="text-[11px] text-slate-400">Financial Approval</span>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    currentPo.financial_approval === 'Approved'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : currentPo.financial_approval === 'Rejected'
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                }`}>
                                                    {currentPo.financial_approval || 'Pending'}
                                                </span>
                                            </div>
                                            {currentPo.financial_approved_at && (
                                                <p className="text-[10px] text-slate-400 mt-1">At: {formatDate(currentPo.financial_approved_at)}</p>
                                            )}
                                        </div>

                                        {/* Payment Verification */}
                                        <div className="p-3.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] space-y-1">
                                            <span className="text-[11px] text-slate-400">Payment Status</span>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    currentPo.paid
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {currentPo.paid ? 'Paid' : 'Unpaid'}
                                                </span>
                                            </div>
                                            {currentPo.paid_verified_at && (
                                                <p className="text-[10px] text-slate-400 mt-1">Verified: {formatDate(currentPo.paid_verified_at)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Items Ordered Table - Neumorphic Display */}
                                <div className="space-y-2.5">
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-pink-500" /> Line Items ({parsedItems.length})
                                        </span>
                                    </h3>

                                    {parsedItems.length === 0 ? (
                                        <div className="p-6 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-center text-slate-400 text-xs font-medium">
                                            No item records stored for this purchase order.
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] overflow-hidden bg-[#ebf0f7] dark:bg-[#12131b]">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead>
                                                        <tr className="bg-[#ebf0f7]/90 dark:bg-[#141520] border-b border-slate-200/60 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                                                            <th className="py-2.5 px-3.5">#</th>
                                                            <th className="py-2.5 px-3.5">Item Name / Description</th>
                                                            <th className="py-2.5 px-3.5 text-center">Qty</th>
                                                            <th className="py-2.5 px-3.5 text-right">Unit Price</th>
                                                            <th className="py-2.5 px-3.5 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/60">
                                                        {parsedItems.map((item, idx) => {
                                                            const qty = Number(item.quantity || item.qty || 0);
                                                            const unitPrice = Number(item.unit_price || item.price || 0);
                                                            const lineTotal = Number(item.total || (qty * unitPrice) || 0);
                                                            const name = item.item_name || item.name || item.description || `Item #${idx + 1}`;

                                                            return (
                                                                <tr key={idx} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                                                                    <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                                                    <td className="py-2.5 px-3.5 font-medium text-slate-800 dark:text-slate-200">
                                                                        <div>{name}</div>
                                                                        {item.description && item.description !== name && (
                                                                            <div className="text-[11px] text-slate-400">{item.description}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3.5 text-center font-mono">{qty}</td>
                                                                    <td className="py-2.5 px-3.5 text-right font-mono">{formatCurrency(unitPrice)}</td>
                                                                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                                                        {formatCurrency(lineTotal)}
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

                                {/* Financial Totals - Neumorphic Cards */}
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)]">
                                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                                        {currentPo.notes && (
                                            <div>
                                                <strong className="text-slate-700 dark:text-slate-300">Notes:</strong>
                                                <p className="mt-0.5 text-slate-600 dark:text-slate-400">{currentPo.notes}</p>
                                            </div>
                                        )}
                                        {currentPo.terms_and_conditions && (
                                            <div className="mt-2">
                                                <strong className="text-slate-700 dark:text-slate-300">Terms & Conditions:</strong>
                                                <p className="mt-0.5 text-slate-600 dark:text-slate-400 line-clamp-3">{currentPo.terms_and_conditions}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full sm:w-64 space-y-2 text-xs">
                                        {currentPo.subtotal !== undefined && currentPo.subtotal > 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Subtotal:</span>
                                                <span className="font-mono">{formatCurrency(currentPo.subtotal)}</span>
                                            </div>
                                        )}
                                        {currentPo.discount !== undefined && currentPo.discount > 0 && (
                                            <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                                <span>Discount:</span>
                                                <span className="font-mono">-{formatCurrency(currentPo.discount)}</span>
                                            </div>
                                        )}
                                        {currentPo.tax_amount !== undefined && currentPo.tax_amount > 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Tax ({currentPo.tax_rate || 0}%):</span>
                                                <span className="font-mono">{formatCurrency(currentPo.tax_amount)}</span>
                                            </div>
                                        )}
                                        {currentPo.shipping_fee !== undefined && currentPo.shipping_fee > 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Shipping Fee:</span>
                                                <span className="font-mono">{formatCurrency(currentPo.shipping_fee)}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t border-slate-200/50 dark:border-white/[0.06] flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white">
                                            <span>Total Amount:</span>
                                            <span className="font-mono text-base text-pink-600 dark:text-pink-400">
                                                {formatCurrency(currentPo.total_amount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Neumorphic Footer Actions Bar */}
                    <div className="px-6 py-4 border-t border-slate-200/50 dark:border-white/[0.05] bg-[#ebf0f7]/95 dark:bg-[#14151e]/95 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>Status:</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">Soft-Deleted in Trash</span>
                        </div>

                        <div className="flex items-center gap-3">
                            {onRestore && (
                                <button
                                    type="button"
                                    onClick={handleRestoreClick}
                                    disabled={isRestoring || isDeleting}
                                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-emerald-300/60 dark:border-emerald-700/50 shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-emerald-800 dark:hover:text-emerald-200 active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                                >
                                    {isRestoring ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isRestoring ? 'Restoring...' : 'Restore Purchase Order'}</span>
                                </button>
                            )}

                            {onPermanentDelete && (
                                <button
                                    type="button"
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting || isRestoring}
                                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-rose-300/60 dark:border-rose-700/50 shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-rose-800 dark:hover:text-rose-200 active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isRestoring || isDeleting}
                                className="px-4.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
