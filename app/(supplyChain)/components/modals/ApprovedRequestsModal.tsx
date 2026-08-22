"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { PurchaseRequest, PurchaseOrder } from "@/app/(supplyChain)/(pages)/procurement/types/index";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

interface ApprovedRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectRequest: (request: PurchaseRequest) => void;
}

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'Critical': return 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400';
        case 'Urgent': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400';
        default: return 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400';
    }
};

export function ApprovedRequestsModal({
    isOpen,
    onClose,
    onSelectRequest,
}: ApprovedRequestsModalProps) {
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchApprovedRequests();
        }
    }, [isOpen]);

    const fetchApprovedRequests = async () => {
        setLoading(true);
        try {
            // fetch approved or completed requests
            const { data: requestsData, error: reqError } = await supabase
                .from('purchase_requests')
                .select('*')
                .in('status', ['Approved', 'Completed'])
                .order('created_at', { ascending: false });

            if (reqError) throw reqError;

            // fetch existing po request ids
            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select('request_id');

            if (poError) throw poError;

            const existingPoRequestIds = new Set((poData || []).map((po: any) => po.request_id));

            // exclude requests that already have a po
            const availableRequests = (requestsData || []).filter(
                (req: any) => !existingPoRequestIds.has(req.id)
            );

            setRequests(availableRequests);
        } catch (error) {
            console.error("Error fetching approved requests:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filtered = requests.filter(req =>
        (req.request_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.requested_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/70 border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100/50 dark:border-emerald-500/20">
                            <i className="fas fa-clipboard-check text-base" />
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Approved Requests Ready for PO
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Select an approved purchase request to generate its purchase order
                            </p>
                        </div>
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

                {/* Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20">
                    <div className="relative">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                        <input
                            type="text"
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-2xs"
                            placeholder="Search approved requests by PR #, supplier, requester..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List Body */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2.5 max-h-[420px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <i className="fas fa-spinner fa-spin text-2xl mb-2 text-emerald-500" />
                            <p className="text-xs">Loading approved requests...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                <i className="fas fa-inbox text-2xl text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                No approved requests ready for PO
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                                All approved requests either already have purchase orders created, or no requests are approved yet in the Procurement page.
                            </p>
                        </div>
                    ) : (
                        filtered.map((req) => (
                            <div
                                key={req.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:shadow-xs transition-all gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                            {req.request_number}
                                        </span>
                                        <StatusBadge
                                            tone={req.priority === 'Critical' ? 'rose' : req.priority === 'Urgent' ? 'amber' : 'blue'}
                                            size="xs"
                                        >
                                            {req.priority}
                                        </StatusBadge>
                                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                            {req.date}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 truncate" title={req.supplier_name}>
                                        Supplier: <span className="font-semibold text-slate-900 dark:text-white">{req.supplier_name}</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={req.description}>
                                        {req.description}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                        <span>By: <strong className="text-slate-600 dark:text-slate-300">{req.requested_by}</strong> ({req.department})</span>
                                        <span>•</span>
                                        <span className="font-semibold text-slate-900 dark:text-emerald-400">Est. ₱{(req.amount || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="shrink-0 flex items-center justify-end">
                                    <AppButton
                                        type="button"
                                        variant="success"
                                        size="sm"
                                        onClick={() => {
                                            onSelectRequest(req);
                                            onClose();
                                        }}
                                    >
                                        <i className="fas fa-file-invoice text-xs" />
                                        <span>Create PO</span>
                                    </AppButton>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
                    <span>{filtered.length} request{filtered.length !== 1 ? 's' : ''} available</span>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="xs"
                        onClick={onClose}
                    >
                        Close
                    </AppButton>
                </div>
            </div>
        </div>
    );
}
