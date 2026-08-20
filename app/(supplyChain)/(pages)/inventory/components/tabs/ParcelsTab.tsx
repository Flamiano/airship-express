// app/(supplyChain)/inventory/components/tabs/ParcelsTab.tsx

'use client';

import { useState } from 'react';
import { Parcel, GroupedParcels } from '../../types';
import { getStatusBadge, getStatusLabel } from '../../utils/helpers';
import { sanitizeSearch } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';

interface ParcelsTabProps {
    parcels: Parcel[];
    groupedParcels: GroupedParcels[];
    searchTerm: string;
    statusFilter: string;
    dateFrom: string;
    dateTo: string;
    currentPage: number;
    totalPages: number;
    totalItems: number;
    isLoading?: boolean;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onClearFilters: () => void;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
}

const STATUS_FLOW = [
    { key: 'received', label: 'Received', icon: 'fa-box', color: 'blue' },
    { key: 'sorting', label: 'Sorting', icon: 'fa-sort', color: 'amber' },
    { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: 'fa-check-circle', color: 'emerald' },
    { key: 'picked_up', label: 'Picked Up', icon: 'fa-truck', color: 'purple' },
    { key: 'in_transit', label: 'In Transit', icon: 'fa-truck-moving', color: 'indigo' },
    { key: 'delivered', label: 'Delivered', icon: 'fa-home', color: 'green' },
];

const STATUS_COLORS: Record<string, string> = {
    'received': 'bg-blue-500',
    'sorting': 'bg-amber-500',
    'ready_for_pickup': 'bg-emerald-500',
    'picked_up': 'bg-purple-500',
    'in_transit': 'bg-indigo-500',
    'delivered': 'bg-green-500',
};

export function ParcelsTab({
    parcels,
    groupedParcels,
    searchTerm,
    statusFilter,
    dateFrom,
    dateTo,
    currentPage,
    totalPages,
    totalItems,
    isLoading = false,
    onSearchChange,
    onStatusChange,
    onDateFromChange,
    onDateToChange,
    onClearFilters,
    onPageChange,
    itemsPerPage = 30,
}: ParcelsTabProps) {
    const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
    const [showModal, setShowModal] = useState(false);

    const getStatusIndex = (status: string): number => {
        return STATUS_FLOW.findIndex(s => s.key === status);
    };

    const getStatusState = (status: string, currentStatus: string): 'completed' | 'current' | 'pending' => {
        const statusIndex = getStatusIndex(status);
        const currentIndex = getStatusIndex(currentStatus);

        if (statusIndex === -1) return 'pending';
        if (statusIndex < currentIndex) return 'completed';
        if (statusIndex === currentIndex) return 'current';
        return 'pending';
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (date: string) => {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const getTimelineData = (parcel: Parcel) => {
        const currentStatus = parcel.status;

        return STATUS_FLOW.map((status, index) => {
            const state = getStatusState(status.key, currentStatus);
            const isCompleted = state === 'completed';
            const isCurrent = state === 'current';
            const isPending = state === 'pending';

            let timestamp = null;
            let formattedDate = null;
            let relativeTime = null;

            if (isCompleted || isCurrent) {
                if (isCurrent) {
                    timestamp = new Date(parcel.updated_at);
                } else {
                    const baseDate = new Date(parcel.created_at);
                    const estimatedMinutes = index * 15;
                    timestamp = new Date(baseDate.getTime() + estimatedMinutes * 60000);
                }
                formattedDate = timestamp ? formatDate(timestamp.toISOString()) : null;
                relativeTime = timestamp ? formatRelativeTime(timestamp.toISOString()) : null;
            }

            return {
                ...status,
                state,
                isCompleted,
                isCurrent,
                isPending,
                timestamp,
                formattedDate,
                relativeTime,
            };
        });
    };

    const handleViewParcel = (parcel: Parcel) => {
        setSelectedParcel(parcel);
        setShowModal(true);
    };

    const getProgressData = (parcel: Parcel) => {
        const timelineData = getTimelineData(parcel);
        const isDelivered = parcel.status === 'delivered' ||
            parcel.status === 'returned' ||
            parcel.status === 'cancelled';

        let progressPercent = 100;

        if (!isDelivered) {
            const currentIndex = timelineData.findIndex(item => item.isCurrent);
            if (currentIndex >= 0) {
                progressPercent = Math.min(100, Math.max(0, (currentIndex / (timelineData.length - 1)) * 100));
            } else {
                progressPercent = 0;
            }
        }

        return { timelineData, isDelivered, progressPercent };
    };

    const handlePageChange = (page: number) => {
        if (typeof onPageChange === 'function') {
            onPageChange(page);
        } else {
            console.warn('onPageChange is not a function');
        }
    };

    // Calculate the correct range display
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-slate-950/50 overflow-hidden transition-colors flex flex-col">
                {/* Header Control Bar - Stays fixed */}
                <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 backdrop-blur-md flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs group">
                            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                            <input
                                type="search"
                                className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-9 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-2xs"
                                placeholder="Search barcode, tracking, sender..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                            />
                        </div>

                        {/* Status Filter Dropdown */}
                        <div className="relative min-w-[140px] group">
                            <i className="fas fa-filter absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                            <select
                                className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-9 pr-8 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer shadow-2xs appearance-none"
                                value={statusFilter}
                                onChange={(e) => onStatusChange(e.target.value)}
                            >
                                <option value="" className="dark:bg-slate-900">All Statuses</option>
                                <option value="received" className="dark:bg-slate-900">Received</option>
                                <option value="sorting" className="dark:bg-slate-900">Sorting</option>
                                <option value="ready_for_pickup" className="dark:bg-slate-900">Ready</option>
                                <option value="picked_up" className="dark:bg-slate-900">Picked Up</option>
                                <option value="in_transit" className="dark:bg-slate-900">In Transit</option>
                                <option value="delivered" className="dark:bg-slate-900">Delivered</option>
                            </select>
                            <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none"></i>
                        </div>

                        {/* Date Range Selector */}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs focus-within:border-pink-500/80 transition-colors">
                            <div className="relative flex items-center">
                                <input
                                    type="date"
                                    className="py-0.5 px-2 text-xs border-0 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer scheme-light dark:scheme-dark"
                                    value={dateFrom}
                                    onChange={(e) => onDateFromChange(e.target.value)}
                                    title="Date From"
                                />
                            </div>
                            <span className="text-slate-300 dark:text-slate-600 text-[10px] font-medium uppercase">—</span>
                            <div className="relative flex items-center">
                                <input
                                    type="date"
                                    className="py-0.5 px-2 text-xs border-0 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer scheme-light dark:scheme-dark"
                                    value={dateTo}
                                    onChange={(e) => onDateToChange(e.target.value)}
                                    title="Date To"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Counter Badge & Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                            <i className="fas fa-box text-pink-500 dark:text-pink-400 text-[11px]"></i>
                            <span>{totalItems} parcels</span>
                        </span>

                        <button
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 active:scale-95 rounded-xl transition-all flex items-center gap-1.5"
                            onClick={onClearFilters}
                            title="Reset active filters"
                        >
                            <i className="fas fa-rotate-left text-[11px]"></i>
                            <span>Clear</span>
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Container - Only this scrolls */}
                <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-5 bg-slate-50/30 dark:bg-slate-950/40">
                    {isLoading ? (
                        <TableContentLoader />
                    ) : groupedParcels.length > 0 ? (
                        groupedParcels.map((group) => (
                            <div key={group.date} className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs bg-white dark:bg-slate-900 transition-colors">

                                {/* Date Group Header */}
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/20 inline-flex items-center justify-center text-pink-500 dark:text-pink-400 text-[11px]">
                                            <i className="fas fa-calendar-day"></i>
                                        </span>
                                        {group.date}
                                    </h3>
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                                        {group.parcels.length} {group.parcels.length === 1 ? 'parcel' : 'parcels'}
                                    </span>
                                </div>

                                {/* Table View */}
                                <div className="overflow-x-auto">
                                    <table className="table-pro p-1">
                                        <thead>
                                            <tr>
                                                <th className="w-10 text-center">#</th>
                                                <th>Barcode</th>
                                                <th>Tracking</th>
                                                <th>Sender</th>
                                                <th>Customer</th>
                                                <th>Customer Number</th>
                                                <th>Destination</th>
                                                <th>Courier</th>
                                                <th>Status</th>
                                                <th>Time</th>
                                                <th className="text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.parcels.map((parcel, index) => (
                                                <tr key={parcel.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150 group">
                                                    <td data-label="#" className="text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                                        {index + 1}
                                                    </td>
                                                    <td data-label="Barcode" className="whitespace-nowrap">
                                                        <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/50">
                                                            {parcel.barcode}
                                                        </span>
                                                    </td>
                                                    <td data-label="Tracking" className="font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {parcel.tracking_number}
                                                    </td>
                                                    <td data-label="Sender" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                        {parcel.sender_name || 'N/A'}
                                                    </td>
                                                    <td data-label="Customer" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                        {parcel.customer_name || 'N/A'}
                                                    </td>
                                                    <td data-label="Customer Number" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                        {parcel.customer_number || 'N/A'}
                                                    </td>
                                                    <td data-label="Destination" className="text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-3">
                                                        {parcel.destination || 'N/A'}
                                                    </td>
                                                    <td data-label="Courier" className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                                        {parcel.courier || 'N/A'}
                                                    </td>
                                                    <td data-label="Status" className="whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(parcel.status)}`}>
                                                            {getStatusLabel(parcel.status)}
                                                        </span>
                                                    </td>
                                                    <td data-label="Time" className="text-slate-400 dark:text-slate-500 text-[11px] font-mono whitespace-nowrap">
                                                        {new Date(parcel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td data-label="Action" className="text-right whitespace-nowrap">
                                                        <button
                                                            onClick={() => handleViewParcel(parcel)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 bg-pink-50/50 dark:bg-pink-500/10 hover:bg-pink-100/70 dark:hover:bg-pink-500/20 active:scale-95 rounded-lg transition-all border border-pink-100 dark:border-pink-500/20 ml-auto shadow-2xs"
                                                        >
                                                            <i className="fas fa-eye text-[10px]"></i>
                                                            <span>View</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    ) : (
                        /* Empty State */
                        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3 shadow-inner">
                                <i className="fas fa-box-open text-xl"></i>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No parcels found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">Try adjusting your search query or active filter parameters</p>
                        </div>
                    )}
                </div>

                {/* Pagination Bar - FIXED - Stays fixed */}
                {!isLoading && groupedParcels.length > 0 && totalItems > 0 && (
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 backdrop-blur-md flex-wrap gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{startIndex}</span> to{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{endIndex}</span> of{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalItems}</span> parcels
                        </span>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && selectedParcel && (() => {
                const { timelineData, isDelivered, progressPercent } = getProgressData(selectedParcel);

                return (
                    <div
                        className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-in fade-in"
                        onClick={() => setShowModal(false)}
                    >
                        <div
                            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl dark:shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4"
                            onClick={(e) => e.stopPropagation()}
                        >

                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                                        <span className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-500 dark:text-pink-400 inline-flex items-center justify-center">
                                            <i className="fas fa-box text-xs"></i>
                                        </span>
                                        Parcel Timeline
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>Tracking: <code className="font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/50">{selectedParcel.tracking_number}</code></span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span>Barcode: <code className="font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/50">{selectedParcel.barcode}</code></span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-all flex items-center justify-center cursor-pointer"
                                    aria-label="Close modal"
                                >
                                    <i className="fas fa-times text-xs"></i>
                                </button>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/30 overscroll-contain">

                                {/* Overall Progress & Metadata Card */}
                                <div className="p-5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
                                    {/* Header & Percentage Badge */}
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-semibold flex items-center gap-1.5">
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isDelivered ? 'bg-emerald-500 animate-pulse' : 'bg-pink-500 animate-pulse'}`} />
                                            {isDelivered ? 'Delivery Complete' : 'Overall Delivery Progress'}
                                        </span>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] tracking-tight border transition-colors ${isDelivered
                                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-800/60'
                                                : 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border-pink-200/70 dark:border-pink-900/40'
                                                }`}
                                        >
                                            {isDelivered ? '100%' : `${Math.round(progressPercent)}%`}
                                        </span>
                                    </div>

                                    {/* Clean Progress Bar with Pulse Glow */}
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
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                                            <i className="fas fa-check-circle text-sm text-emerald-600 dark:text-emerald-400"></i>
                                            <span>Parcel successfully delivered</span>
                                        </div>
                                    )}

                                    {/* Metadata Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Sender</p>
                                            <p className="font-medium text-xs text-slate-800 dark:text-slate-200 break-words">{selectedParcel.sender_name || 'N/A'}</p>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Destination</p>
                                            <p className="font-medium text-xs text-slate-800 dark:text-slate-200 break-words whitespace-normal">{selectedParcel.destination || 'N/A'}</p>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Courier</p>
                                            <p className="font-medium text-xs text-slate-800 dark:text-slate-200 break-words">{selectedParcel.courier || 'N/A'}</p>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Status</p>
                                            <div>
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(selectedParcel.status)}`}>
                                                    {getStatusLabel(selectedParcel.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Vertical Timeline */}
                                <div className="relative pl-2">

                                    {/* Base Vertical Line */}
                                    <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-800 rounded-full"></div>

                                    {/* Active Progress Line Overlay */}
                                    <div
                                        className={`absolute left-6 top-5 w-0.5 rounded-full transition-all duration-1000 ease-out ${isDelivered ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-pink-500 dark:bg-pink-400'
                                            }`}
                                        style={{ height: isDelivered ? '100%' : `${progressPercent}%` }}
                                    ></div>

                                    <div className="space-y-5">
                                        {timelineData.map((item, index) => {
                                            const isCompleted = isDelivered || item.isCompleted;
                                            const isCurrent = !isDelivered && item.isCurrent;
                                            const isPending = !isDelivered && item.isPending;
                                            const isLastDelivered = isDelivered && item.key === 'delivered';

                                            return (
                                                <div
                                                    key={item.key}
                                                    className="relative flex items-start gap-4 group transition-all duration-300"
                                                    style={{ animationDelay: `${index * 80}ms` }}
                                                >
                                                    {/* Timeline Icon Node */}
                                                    <div className="relative z-10 flex-shrink-0">
                                                        <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300
                                        ${isCompleted || isLastDelivered ? `bg-emerald-500 dark:bg-emerald-600 text-white ring-4 ring-white dark:ring-slate-900` : ''}
                                        ${isCurrent ? `bg-pink-500 dark:bg-pink-600 text-white ring-4 ring-pink-50 dark:ring-pink-950/50` : ''}
                                        ${isPending ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/80 ring-4 ring-white dark:ring-slate-900' : ''}
                                    `}>
                                                            <i className={`fas ${item.icon}`}></i>
                                                        </div>
                                                    </div>

                                                    {/* Timeline Content Box */}
                                                    <div className={`flex-1 bg-white dark:bg-slate-900 rounded-xl p-3.5 border transition-all duration-200 ${isCurrent
                                                        ? 'border-pink-200 dark:border-pink-900/60 shadow-2xs bg-pink-50/20 dark:bg-pink-950/10'
                                                        : isLastDelivered
                                                            ? 'border-emerald-200 dark:border-emerald-900/60 shadow-2xs bg-emerald-50/20 dark:bg-emerald-950/10'
                                                            : 'border-slate-200/70 dark:border-slate-800 shadow-2xs'
                                                        }`}>
                                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                                            <div>
                                                                <p className={`font-semibold text-sm ${isPending ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                                                    {item.label}
                                                                </p>

                                                                {(isCompleted || isCurrent || isLastDelivered) && item.formattedDate && (
                                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                                        <i className="far fa-calendar-alt text-[10px]"></i>
                                                                        <span>{item.formattedDate}</span>
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Status Badges */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {(isCompleted || isCurrent || isLastDelivered) && item.relativeTime && (
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded font-medium">
                                                                        {item.relativeTime}
                                                                    </span>
                                                                )}

                                                                {isCurrent && (
                                                                    <span className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                                                                        <span>Current</span>
                                                                    </span>
                                                                )}

                                                                {isLastDelivered && (
                                                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                                                        <i className="fas fa-check-circle text-[10px]"></i>
                                                                        <span>Delivered</span>
                                                                    </span>
                                                                )}

                                                                {isPending && (
                                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 px-2.5 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-800/80 flex items-center gap-1">
                                                                        <i className="far fa-clock text-[10px]"></i>
                                                                        <span>Pending</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Timeline Node Context Text */}
                                                        <div className="mt-2 text-xs">
                                                            {(isCompleted || isLastDelivered) && (
                                                                <p className="text-slate-500 dark:text-slate-400">
                                                                    {item.key === 'received' && 'Parcel received at facility'}
                                                                    {item.key === 'sorting' && 'Parcel is being sorted'}
                                                                    {item.key === 'ready_for_pickup' && 'Parcel ready for courier pickup'}
                                                                    {item.key === 'picked_up' && 'Parcel picked up by courier'}
                                                                    {item.key === 'in_transit' && 'Parcel is in transit to destination'}
                                                                    {item.key === 'delivered' && 'Parcel delivered successfully'}
                                                                </p>
                                                            )}
                                                            {isCurrent && (
                                                                <p className="text-pink-600 dark:text-pink-400 font-medium">
                                                                    {item.key === 'received' && 'Currently being received at facility'}
                                                                    {item.key === 'sorting' && 'Currently being sorted'}
                                                                    {item.key === 'ready_for_pickup' && 'Awaiting courier pickup'}
                                                                    {item.key === 'picked_up' && 'Currently being picked up'}
                                                                    {item.key === 'in_transit' && 'In transit to destination'}
                                                                    {item.key === 'delivered' && 'Being delivered to recipient'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl bg-pink-500 dark:bg-pink-600 hover:bg-pink-600 dark:hover:bg-pink-500 active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <i className="fas fa-check text-[11px]"></i>
                                    <span>Done</span>
                                </button>
                            </div>

                        </div>
                    </div>
                );
            })()}
        </>
    );
}