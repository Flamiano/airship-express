'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { InventoryRequest, InventoryItem } from '../../types';
import { sanitizeSearch } from '../../../../components/global/sanitize';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { AppButton } from '../../../../components/ui/AppButton';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { toast } from 'sonner';
import { 
    Inbox, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    PackageCheck, 
    ArrowUpRight, 
    AlertTriangle, 
    Plus, 
    Building2, 
    User, 
    Filter, 
    Search,
    Layers,
    Check,
    X,
    FileText,
    ChevronDown
} from 'lucide-react';
import Portal from '../../../../components/client/Portal';
import { approveInventoryRequest, rejectInventoryRequest } from '../../server/query';

interface RequestsTabProps {
    requests: InventoryRequest[];
    inventoryItems: InventoryItem[];
    totalRequests: number;
    currentPage: number;
    totalPages: number;
    stats: {
        total: number;
        pending: number;
        approved: number;
        received: number;
        rejected: number;
    } | null;
    isLoading?: boolean;
    userRole?: string;
    searchTerm: string;
    statusFilter: string;
    typeFilter: 'all' | 'internal' | 'external';
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onTypeChange: (value: 'all' | 'internal' | 'external') => void;
    onPageChange: (page: number) => void;
    onOpenInternalRequestModal: () => void;
    onOpenReleaseModal: (req: InventoryRequest) => void;
    onRefresh: () => void;
}

export const RequestsTab = memo(function RequestsTab({
    requests,
    inventoryItems,
    totalRequests,
    currentPage,
    totalPages,
    stats,
    isLoading = false,
    userRole = '',
    searchTerm,
    statusFilter,
    typeFilter,
    onSearchChange,
    onStatusChange,
    onTypeChange,
    onPageChange,
    onOpenInternalRequestModal,
    onOpenReleaseModal,
    onRefresh,
}: RequestsTabProps) {
    const [rejectingRequest, setRejectingRequest] = useState<InventoryRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const handleApprove = async (req: InventoryRequest) => {
        setActionLoadingId(req.id);
        const toastId = toast.loading(`Approving request #${req.request_number}...`);
        try {
            const res = await approveInventoryRequest(req.id, userRole || 'Manager');
            if (res.success) {
                toast.success(res.message || 'Request approved successfully! Stock allocated for export.', { id: toastId });
                onRefresh();
            } else {
                toast.error(res.error || 'Failed to approve request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error approving request:', err);
            toast.error(err?.message || 'Failed to approve request', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectingRequest) return;

        setActionLoadingId(rejectingRequest.id);
        const toastId = toast.loading(`Rejecting request #${rejectingRequest.request_number}...`);
        try {
            const res = await rejectInventoryRequest(
                rejectingRequest.id,
                rejectionReason.trim() || 'Declined by inventory manager',
                userRole || 'Manager'
            );
            if (res.success) {
                toast.success('Request rejected', { id: toastId });
                setRejectingRequest(null);
                setRejectionReason('');
                onRefresh();
            } else {
                toast.error(res.error || 'Failed to reject request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error rejecting request:', err);
            toast.error(err?.message || 'Failed to reject request', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const itemsPerPage = 20;
    const startIndex = totalRequests === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalRequests);

    return (
        <div className="space-y-6">
            {/* Top KPI Cards - Minimalist & Calm */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Requests */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Total Requests
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.total || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            All incoming requisitions
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Inbox className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Pending Review */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Pending Review
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.pending || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Awaiting stock feasibility
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Clock className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Approved (Exporting) */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Approved (Exporting)
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.approved || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Committed ready for release
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <PackageCheck className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Received / Outed */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Received / Outed
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.received || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Fulfilled and stock deducted
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.35),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] overflow-hidden transition-colors flex flex-col">
                {/* Filter Toolbar */}
                <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none group-focus-within:text-pink-500 transition-colors w-4 h-4" />
                            <input
                                className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                placeholder="Search by item, request code, requester..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="relative min-w-[140px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => onStatusChange(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="received">Received / Outed</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>

                        {/* Origin Filter */}
                        <div className="relative min-w-[170px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                                value={typeFilter}
                                onChange={(e) => onTypeChange(e.target.value as any)}
                            >
                                <option value="all">All Requisition Sources</option>
                                <option value="internal">Internal Requisitions</option>
                                <option value="external">External Systems</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>
                    </div>

                    {/* New Internal Request Action */}
                    <div className="flex items-center gap-2">
                        <AppButton type="button" variant="primary" size="md" onClick={onOpenInternalRequestModal}>
                            <Plus className="w-4 h-4 mr-1.5" />
                            <span>New Internal Request</span>
                        </AppButton>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-white/[0.06] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-[#ebf0f7]/40 dark:bg-[#12131b]/40">
                                <th className="px-4 py-3.5 whitespace-nowrap">Request #</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Source</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Department</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Requester</th>
                                <th className="px-4 py-3.5">Requested Item</th>
                                <th className="px-4 py-3.5 text-center whitespace-nowrap">Qty</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Stock Feasibility</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] text-xs">
                            {isLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'mono', width: 'w-24' },
                                        { type: 'badge', width: 'w-16' },
                                        { type: 'text', width: 'w-24' },
                                        { type: 'text', width: 'w-28' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'text', width: 'w-40' },
                                        { type: 'mono', width: 'w-10', align: 'center' },
                                        { type: 'badge', width: 'w-32' },
                                        { type: 'badge', width: 'w-24' },
                                        { type: 'actions', align: 'right', width: 'w-24' },
                                    ]}
                                />
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-20 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-inner">
                                                <Inbox className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No inventory requests found</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                    Incoming requests from external systems or internal staff will show up here.
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => {
                                    const status = (req.status || 'pending').toLowerCase();
                                    const isPending = status === 'pending';
                                    const isApproved = status === 'approved';
                                    const isReceived = status === 'received' || status === 'fulfilled';
                                    const isRejected = status === 'rejected';

                                    const isInternal = req.Internal_request === true || req.internal_request === true || req.is_internal === true || Boolean(req.requested_by);
                                    
                                    // Matched item stock data
                                    const item = (req as any).inventory_item;
                                    const currentStock = (req as any).current_stock ?? item?.current_stock ?? 0;
                                    const availableStock = (req as any).available_stock ?? item?.available_stock ?? currentStock;
                                    const requestedQty = Number(req.quantity_requested || 1);
                                    const isStockFeasible = availableStock >= requestedQty && currentStock > 0;
                                    const isOutOfStock = currentStock <= 0;

                                    return (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors duration-150"
                                        >
                                            {/* 1. Request # */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 rounded-lg border border-white/80 dark:border-white/[0.05] shadow-inner text-[11px]">
                                                    {req.request_number || `#${req.id.slice(0, 8)}`}
                                                </span>
                                            </td>

                                            {/* 2. Source */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <StatusBadge
                                                    tone="neutral"
                                                    size="xs"
                                                >
                                                    {isInternal ? 'Internal' : 'External'}
                                                </StatusBadge>
                                            </td>

                                            {/* 3. Date */}
                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                                {req.created_at ? (
                                                    new Date(req.created_at).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                ) : (
                                                    <span className="text-slate-400 italic">Recent</span>
                                                )}
                                            </td>

                                            {/* 4. Department */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    <span>{req.department || 'General'}</span>
                                                </div>
                                            </td>

                                            {/* 5. Requester */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                                                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[140px]" title={(req as any).requester_name || (isInternal ? 'Internal Staff' : (req.requester_system || 'External System'))}>
                                                        {(req as any).requester_name || (isInternal ? (req.department ? `${req.department} Staff` : 'Internal Staff') : (req.requester_system || 'External System'))}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 6. Requested Item */}
                                            <td className="px-4 py-3.5">
                                                <span className="font-extrabold text-slate-900 dark:text-slate-100 block truncate max-w-[200px]" title={req.item_name}>
                                                    {req.item_name}
                                                </span>
                                            </td>

                                            {/* 7. Quantity */}
                                            <td className="px-4 py-3.5 text-center font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                                                {requestedQty}
                                            </td>

                                            {/* 8. Stock Feasibility */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                {isOutOfStock ? (
                                                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium inline-flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        Out of stock
                                                    </span>
                                                ) : !isStockFeasible ? (
                                                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium inline-flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                        Insufficient ({availableStock})
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium inline-flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                        Ready ({availableStock})
                                                    </span>
                                                )}
                                            </td>

                                            {/* 9. Status Badge */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <StatusBadge
                                                    tone={
                                                        isApproved ? 'pink' : isReceived ? 'emerald' : isRejected ? 'rose' : 'amber'
                                                    }
                                                    dot
                                                    size="xs"
                                                >
                                                    {isApproved ? 'Approved (Exporting)' : isReceived ? 'Received / Fulfilled' : isRejected ? 'Rejected' : 'Pending Review'}
                                                </StatusBadge>
                                                {isRejected && req.rejection_reason && (
                                                    <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 truncate max-w-[130px]" title={req.rejection_reason}>
                                                        {req.rejection_reason}
                                                    </p>
                                                )}
                                            </td>

                                            {/* 10. Actions */}
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {isPending && (
                                                        <>
                                                            <CrudActionButton
                                                                action="approve"
                                                                variant="neutral"
                                                                onClick={() => handleApprove(req)}
                                                                disabled={actionLoadingId === req.id}
                                                                ariaLabel={`Approve request #${req.request_number || req.id.slice(0, 8)}`}
                                                                title="Approve request and allocate stock for export"
                                                            />

                                                            <CrudActionButton
                                                                action="reject"
                                                                variant="pink"
                                                                onClick={() => setRejectingRequest(req)}
                                                                disabled={actionLoadingId === req.id}
                                                                ariaLabel={`Reject request #${req.request_number || req.id.slice(0, 8)}`}
                                                                title="Decline request"
                                                            />
                                                        </>
                                                    )}

                                                    {isApproved && (
                                                        isInternal ? (
                                                            <CrudActionButton
                                                                action="custom"
                                                                label="Stock Out"
                                                                icon={ArrowUpRight}
                                                                variant="pink"
                                                                onClick={() => onOpenReleaseModal(req)}
                                                                ariaLabel={`Stock Out ${requestedQty} units`}
                                                                title={`Release and Stock Out up to ${requestedQty} units`}
                                                            />
                                                        ) : (
                                                            <span 
                                                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-inner"
                                                                title="Stock is committed for export. Waiting for external system confirmation."
                                                            >
                                                                <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                                                                <span>Awaiting Receipt</span>
                                                            </span>
                                                        )
                                                    )}

                                                    {isReceived && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" /> Fulfilled
                                                        </span>
                                                    )}

                                                    {isRejected && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                            <XCircle className="w-3.5 h-3.5 text-slate-400" /> Declined
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex-shrink-0 p-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Showing <span className="font-extrabold text-slate-900 dark:text-slate-100">{startIndex}</span> to{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{endIndex}</span> of{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{totalRequests}</span> requests
                    </span>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>

            {/* Rejection Modal */}
            {rejectingRequest && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setRejectingRequest(null)}
                    >
                        <div
                            className="relative w-full max-w-md bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] overflow-hidden transition-all my-auto p-5 sm:p-6 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                                    <XCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        Reject Request #{rejectingRequest.request_number}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Item: {rejectingRequest.item_name}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleConfirmReject} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Reason for Rejection <span className="text-pink-500">*</span>
                                    </label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={3}
                                        placeholder="e.g., Out of stock / Discontinued / Exceeded department quota..."
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-rose-500 resize-none"
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <AppButton type="button" variant="secondary" size="md" onClick={() => setRejectingRequest(null)}>
                                        Cancel
                                    </AppButton>
                                    <AppButton
                                        type="submit"
                                        variant="pink"
                                        size="md"
                                    >
                                        Confirm Rejection
                                    </AppButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
});
