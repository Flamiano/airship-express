"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/services/client/supabase";
import { PurchaseRequest } from "../../(pages)/procurement/types/index";
import { AppButton } from "../ui/AppButton";
import { StatusBadge } from "../ui/StatusBadge";
import Portal from "../client/Portal";

interface ApprovedRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectRequest: (request: PurchaseRequest) => void;
}

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
            const availableRequests = (requestsData || []).filter((req: any) => !existingPoRequestIds.has(req.id));
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
        <Portal>
            <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0">
                            <i className="fas fa-clipboard-check text-base"/>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Approved Requests Ready for PO
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Select an approved purchase request to generate its purchase order
                            </p>
                        </div>
                    </div>
                    <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                        <i className="fas fa-times text-xs"/>
                    </AppButton>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div className="relative">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"/>
                        <input
                            type="text"
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
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
                            <i className="fas fa-spinner fa-spin text-2xl mb-2 text-pink-500"/>
                            <p className="text-xs font-medium">Loading approved requests...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center mx-auto mb-3 text-pink-500 dark:text-pink-400">
                                <i className="fas fa-inbox text-2xl"/>
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                No approved requests ready for PO
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                                All approved requests either already have purchase orders created, or no requests are approved yet in the Procurement page.
                            </p>
                        </div>
                    ) : (
                        filtered.map((req) => (
                            <div
                                key={req.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] transition-all gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                            {req.request_number}
                                        </span>
                                        <StatusBadge tone={req.priority === 'Critical' ? 'rose' : req.priority === 'Urgent' ? 'amber' : 'blue'} size="xs">
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
                                        <span className="font-bold text-slate-900 dark:text-pink-400">
                                            Est. ₱{((Number(req.amount) > 0 ? Number(req.amount) : (req.items?.reduce((s: number, i: any) => s + ((Number(i.quantity) || 1) * (Number(i.unit_price ?? i.price ?? 0))), 0))) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="shrink-0 flex items-center justify-end">
                                    <AppButton
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            onSelectRequest(req);
                                            onClose();
                                        }}
                                    >
                                        <i className="fas fa-file-invoice text-xs"/>
                                        <span>Create PO</span>
                                    </AppButton>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200/60 dark:border-slate-800/80 flex justify-between items-center text-xs text-slate-500">
                    <span>{filtered.length} request{filtered.length !== 1 ? 's' : ''} available</span>
                    <AppButton type="button" variant="neutral" size="xs" onClick={onClose}>
                        Close
                    </AppButton>
                </div>
            </div>
            </div>
        </Portal>
    );
}
