// app/(supplyChain)/inventory/components/tabs/ParcelsTab.tsx
'use client';
import { useState, memo, useMemo, useCallback } from 'react';
import { toast } from "sonner";
import { Parcel, GroupedParcels, ScannerUser, DriverOption } from '../../types';
import { getStatusLabel, getStatusTone } from '../../utils/helpers';
import { sanitizeSearch } from '../../../../components/global/sanitize';
import { Pagination } from '../../../../components/global/pagination';
import { TableSkeleton } from '../../../../components/ui/SkeletonLoader';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { SearchableDropdown, SearchableDropdownOption } from '../../../../components/ui/SearchableDropdown';
import { ParcelTrackingCard } from '../tracking/ParcelTrackingCard';
import { ScannerStatsModal } from '../modals/ScannerStatsModal';
import Portal from '../../../../components/client/Portal';
import { useUserRole } from '../../../../components/global/UnauthorizedEmptyState';

interface ParcelsTabProps {
    parcels: Parcel[];
    groupedParcels: GroupedParcels[];
    searchTerm: string;
    statusFilter: string;
    driverFilter?: string;
    drivers?: DriverOption[];
    dateFrom: string;
    dateTo: string;
    scannedByFilter?: string;
    scanners?: ScannerUser[];
    currentPage: number;
    totalPages: number;
    totalItems: number;
    isLoading?: boolean;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onDriverChange?: (value: string) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onScannedByChange?: (value: string) => void;
    onClearFilters: () => void;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
    onDeleteMultiple?: (ids: (string | number)[]) => void | Promise<void>;
}

const STATUS_FLOW = [
    { key: 'received', label: 'Received', icon: 'fa-box', color: 'blue' },
    { key: 'sorting', label: 'Sorting', icon: 'fa-sort', color: 'amber' },
    { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: 'fa-check-circle', color: 'emerald' },
    { key: 'picked_up', label: 'Picked Up', icon: 'fa-truck', color: 'purple' },
    { key: 'in_transit', label: 'In Transit', icon: 'fa-truck-moving', color: 'indigo' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: 'fa-shipping-fast', color: 'pink' },
    { key: 'delivered', label: 'Delivered', icon: 'fa-home', color: 'green' },
];

const STATUS_COLORS: Record<string, string> = {
    'received': 'bg-blue-500',
    'sorting': 'bg-amber-500',
    'ready_for_pickup': 'bg-emerald-500',
    'picked_up': 'bg-purple-500',
    'in_transit': 'bg-indigo-500',
    'out_for_delivery': 'bg-pink-500',
    'delivered': 'bg-green-500',
};

export const ParcelsTab = memo(function ParcelsTab({
    parcels,
    groupedParcels,
    searchTerm,
    statusFilter,
    driverFilter = '',
    drivers = [],
    dateFrom,
    dateTo,
    scannedByFilter = '',
    scanners = [],
    currentPage,
    totalPages,
    totalItems,
    isLoading = false,
    onSearchChange,
    onStatusChange,
    onDriverChange,
    onDateFromChange,
    onDateToChange,
    onScannedByChange,
    onClearFilters,
    onPageChange,
    itemsPerPage = 30,
    onDeleteMultiple,
}: ParcelsTabProps) {
    const { role: userRole, userId: currentUserId, isPrivileged } = useUserRole();
    const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string | number>>(new Set());

    // check if current user can delete a parcel (Admin/Manager/Executive can delete any; Operator can only delete their own scanned parcels)
    const canDeleteParcel = useCallback((parcel: Parcel) => {
        if (isPrivileged) return true;
        if (!currentUserId) return false;
        return parcel.scanned_by?.toLowerCase() === currentUserId.toLowerCase();
    }, [isPrivileged, currentUserId]);

    // all parcels currently present across all date groups
    const allParcelsInGroups = useMemo(() => groupedParcels.flatMap(g => g.parcels), [groupedParcels]);
    const selectableParcels = useMemo(() => allParcelsInGroups.filter(p => canDeleteParcel(p)), [allParcelsInGroups, canDeleteParcel]);
    const allSelected = selectableParcels.length > 0 && selectableParcels.every(p => selectedParcelIds.has(p.id));
    const someSelected = selectedParcelIds.size > 0 && !allSelected;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedParcelIds(new Set(selectableParcels.map(p => p.id)));
        } else {
            setSelectedParcelIds(new Set());
        }
    };

    const handleSelectGroup = (groupParcels: Parcel[], checked: boolean) => {
        const groupSelectable = groupParcels.filter(p => canDeleteParcel(p));
        const next = new Set(selectedParcelIds);
        if (checked) {
            groupSelectable.forEach(p => next.add(p.id));
        } else {
            groupSelectable.forEach(p => next.delete(p.id));
        }
        setSelectedParcelIds(next);
    };

    const handleSelectParcel = (parcel: Parcel, checked: boolean) => {
        if (!canDeleteParcel(parcel)) return;
        const next = new Set(selectedParcelIds);
        if (checked) {
            next.add(parcel.id);
        } else {
            next.delete(parcel.id);
        }
        setSelectedParcelIds(next);
    };
    const getStatusIndex = (status: string): number => {
        return STATUS_FLOW.findIndex(s => s.key === status);
    };
    const getStatusState = (status: string, currentStatus: string): 'completed' | 'current' | 'pending' => {
        const statusIndex = getStatusIndex(status);
        const currentIndex = getStatusIndex(currentStatus);
        if (statusIndex === -1)
            return 'pending';
        if (statusIndex < currentIndex)
            return 'completed';
        if (statusIndex === currentIndex)
            return 'current';
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
        if (diffMins < 1)
            return 'Just now';
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
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
                }
                else {
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
            }
            else {
                progressPercent = 0;
            }
        }
        return { timelineData, isDelivered, progressPercent };
    };
    const handlePageChange = (page: number) => {
        if (typeof onPageChange === 'function') {
            onPageChange(page);
        }
        else {
            console.warn('onPageChange is not a function');
        }
    };
    // memoized options for searchable dropdowns
    const driverOptions: SearchableDropdownOption[] = useMemo(() => {
        return (drivers || []).map((d) => ({
            value: d.name,
            label: d.name,
            count: d.count,
            icon: 'fas fa-id-badge',
        }));
    }, [drivers]);

    const scannerOptions: SearchableDropdownOption[] = useMemo(() => {
        return (scanners || [])
            .filter((s) => s.id !== 'unassigned')
            .map((s) => ({
                value: s.id,
                label: s.name,
                subLabel: s.role ? `${s.role}${s.email ? ` • ${s.email}` : ''}` : s.email,
                count: s.scanned_count,
                icon: 'fas fa-user-tag',
            }));
    }, [scanners]);

    // calculate range
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
    return (<>
            <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] overflow-hidden transition-colors flex flex-col">
                {/* header */}
                <div className="flex-shrink-0 p-4 border-b border-slate-200/60 dark:border-slate-800/80 bg-[#ebf0f7]/70 dark:bg-[#14151c]/70 backdrop-blur-md flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 justify-between relative z-20">
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
                        {/* search */}
                        <div className="relative flex-1 min-w-0 sm:min-w-[180px] sm:max-w-xs group">
                            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                            <input
                                type="search"
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.35),inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 transition-all"
                                placeholder="Search barcode, tracking, sender..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                            />
                        </div>

                        {/* status filter */}
                        <div className="relative min-w-0 sm:min-w-[125px] group">
                            <i className="fas fa-filter absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                            <select
                                className="w-full min-h-[38px] appearance-none bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-9 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 transition-all cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => onStatusChange(e.target.value)}
                            >
                                <option value="" className="dark:bg-slate-900">All Statuses</option>
                                <option value="received" className="dark:bg-slate-900">Received</option>
                                <option value="sorting" className="dark:bg-slate-900">Sorting</option>
                                <option value="ready_for_pickup" className="dark:bg-slate-900">Ready</option>
                                <option value="picked_up" className="dark:bg-slate-900">Picked Up</option>
                                <option value="in_transit" className="dark:bg-slate-900">In Transit</option>
                                <option value="out_for_delivery" className="dark:bg-slate-900">Out for Delivery</option>
                                <option value="delivered" className="dark:bg-slate-900">Delivered</option>
                            </select>
                            <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none"></i>
                        </div>

                        {/* searchable assigned driver filter */}
                        <SearchableDropdown
                            value={driverFilter || ''}
                            onChange={(val) => onDriverChange?.(val)}
                            options={driverOptions}
                            placeholder="All Drivers"
                            allOptionLabel="All Drivers"
                            unassignedOptionLabel="Unassigned Driver"
                            searchPlaceholder="Search driver name..."
                            icon="fas fa-id-badge"
                            className="min-w-[145px] flex-1 sm:flex-none"
                            title="Filter by Assigned Driver"
                        />

                        {/* searchable scanned by filter (privileged only) */}
                        {!isPrivileged ? (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/50 text-xs font-bold text-pink-700 dark:text-pink-300 min-h-[38px]">
                                <i className="fas fa-user-shield text-[10px]"></i>
                                <span>My Scanned Parcels</span>
                            </div>
                        ) : (
                            <SearchableDropdown
                                value={scannedByFilter || ''}
                                onChange={(val) => onScannedByChange?.(val)}
                                options={scannerOptions}
                                placeholder="All Scanners"
                                allOptionLabel="All Scanners"
                                unassignedOptionLabel="Unassigned / System"
                                searchPlaceholder="Search scanner or role..."
                                icon="fas fa-user-tag"
                                className="min-w-[145px] flex-1 sm:flex-none"
                                title="Filter by Operator / Scanner"
                            />
                        )}

                        {/* date filter */}
                        <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#ebf0f7] dark:bg-[#14151c] p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] min-h-[38px]">
                            <div className="relative flex items-center flex-1 sm:flex-none">
                                <input
                                    type="date"
                                    className="w-full sm:w-auto py-0.5 px-2 text-xs font-medium border-0 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer scheme-light dark:scheme-dark"
                                    value={dateFrom}
                                    max={dateTo || undefined}
                                    onChange={(e) => onDateFromChange(e.target.value)}
                                    title="Date From"
                                />
                            </div>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-medium uppercase">—</span>
                            <div className="relative flex items-center flex-1 sm:flex-none">
                                <input
                                    type="date"
                                    className="w-full sm:w-auto py-0.5 px-2 text-xs font-medium border-0 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer scheme-light dark:scheme-dark"
                                    value={dateTo}
                                    min={dateFrom || undefined}
                                    onChange={(e) => onDateToChange(e.target.value)}
                                    title="Date To"
                                />
                            </div>
                            {(dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDateFromChange('');
                                        onDateToChange('');
                                    }}
                                    className="text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 p-0.5 text-[10px] transition-colors cursor-pointer"
                                    title="Clear date range"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>

                        {/* Incomplete date range notice */}
                        {((dateFrom && !dateTo) || (!dateFrom && dateTo)) && (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-in fade-in">
                                <i className="fas fa-info-circle text-[10px]"></i>
                                {dateFrom && !dateTo ? 'Select "To" date to filter' : 'Select "From" date to filter'}
                            </span>
                        )}
                    </div>

                    {/* counter & bulk actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-between sm:justify-start w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                        {/* Scanner Stats button (privileged only) */}
                        {isPrivileged && (
                            <AppButton
                                type="button"
                                variant={scannedByFilter ? "primary" : "neutral"}
                                size="sm"
                                onClick={() => setShowScannerModal(true)}
                                title="View how many parcels each user/operator scanned"
                                className="!font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <i className="fas fa-qrcode text-pink-500 text-xs"></i>
                                <span>Scanner Stats</span>
                                {scanners && scanners.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-bold ml-0.5">
                                        {scanners.length}
                                    </span>
                                )}
                            </AppButton>
                        )}

                        {/* bulk checkbox button that checks all across all dates */}
                        <AppButton
                            type="button"
                            variant={allSelected ? "primary" : "neutral"}
                            size="sm"
                            onClick={() => handleSelectAll(!allSelected)}
                            disabled={selectableParcels.length === 0}
                            title={selectableParcels.length === 0 ? "No deletable parcels scanned by you" : "Check or uncheck all deletable parcels across all date groups"}
                            className="!font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <i className={`fas ${allSelected ? 'fa-square-check text-pink-500' : someSelected ? 'fa-minus-square text-pink-500' : 'fa-square text-slate-400'} text-xs`} />
                            <span>
                                {allSelected
                                    ? `Deselect All (${selectableParcels.length})`
                                    : someSelected
                                        ? `Select All (${selectableParcels.length}) [${selectedParcelIds.size} checked]`
                                        : `Select All Parcels (${selectableParcels.length})`}
                            </span>
                        </AppButton>

                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151c] px-3.5 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                            <i className="fas fa-box text-pink-500 dark:text-pink-400 text-[11px]"></i>
                            <span>{totalItems} parcels</span>
                        </span>

                        <button className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] hover:text-pink-600 dark:hover:text-pink-400 active:scale-95 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer" onClick={onClearFilters} title="Reset active filters">
                            <i className="fas fa-rotate-left text-[11px]"></i>
                            <span>Clear</span>
                        </button>

                        {selectedParcelIds.size > 0 && onDeleteMultiple && (
                            <button
                                type="button"
                                onClick={async () => {
                                    await onDeleteMultiple(Array.from(selectedParcelIds));
                                    setSelectedParcelIds(new Set());
                                }}
                                className="px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 animate-in fade-in duration-150"
                                title={`Delete ${selectedParcelIds.size} selected parcels`}
                            >
                                <i className="fas fa-trash-can text-[11px]"></i>
                                <span>Delete Selected ({selectedParcelIds.size})</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* content */}
                <div className="flex-1 overflow-y-auto md:max-h-[600px] p-4 space-y-5 bg-[#f0f3f8] dark:bg-[#191a24]">
                    {/* global bulk select-all banner */}
                    {selectableParcels.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#ebf0f7]/90 dark:bg-[#14151e]/90 border border-white/80 dark:border-white/[0.06] shadow-xs">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => {
                                        if (el) {
                                            el.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                />
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Select All Deletable Parcels ({selectableParcels.length} of {allParcelsInGroups.length} available)
                                </span>
                            </label>
                            {selectedParcelIds.size > 0 && (
                                <div className="flex items-center gap-2.5 text-xs flex-wrap">
                                    <span className="font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2.5 py-0.5 rounded-full border border-pink-200 dark:border-pink-800 text-[11px]">
                                        {selectedParcelIds.size} of {selectableParcels.length} selected
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const trackings = allParcelsInGroups.filter(p => selectedParcelIds.has(p.id)).map(p => p.tracking_number || p.barcode).filter(Boolean).join('\n');
                                            if (trackings) {
                                                navigator.clipboard.writeText(trackings);
                                                toast.success(`Copied ${selectedParcelIds.size} tracking numbers`);
                                            }
                                        }}
                                        className="text-[11px] font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 underline cursor-pointer"
                                    >
                                        Copy Tracking Numbers
                                    </button>
                                    {onDeleteMultiple && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await onDeleteMultiple(Array.from(selectedParcelIds));
                                                setSelectedParcelIds(new Set());
                                            }}
                                            className="text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline cursor-pointer flex items-center gap-1"
                                            title={`Delete ${selectedParcelIds.size} selected parcels`}
                                        >
                                            <i className="fas fa-trash-can text-[10px]" />
                                            <span>Delete Selected</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedParcelIds(new Set())}
                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {isLoading ? (<TableSkeleton rows={6} cardWrapper={false}/>) : groupedParcels.length > 0 ? (groupedParcels.map((group) => {
                        const groupSelectable = group.parcels.filter(p => canDeleteParcel(p));
                        const allInGroupSelected = groupSelectable.length > 0 && groupSelectable.every(p => selectedParcelIds.has(p.id));
                        const someInGroupSelected = groupSelectable.some(p => selectedParcelIds.has(p.id));

                        return (
                            <div key={group.date} className="rounded-2xl border border-white/80 dark:border-[#2c2d3c] overflow-hidden bg-[#f0f3f8] dark:bg-[#191a24] shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-colors">

                                {/* group header */}
                                <div className="bg-[#ebf0f7]/80 dark:bg-[#14151c]/80 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            checked={allInGroupSelected}
                                            disabled={groupSelectable.length === 0}
                                            ref={(el) => {
                                                if (el) {
                                                    el.indeterminate = someInGroupSelected && !allInGroupSelected;
                                                }
                                            }}
                                            onChange={(e) => handleSelectGroup(group.parcels, e.target.checked)}
                                            className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 accent-pink-500 bg-transparent ${
                                                groupSelectable.length === 0 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'
                                            }`}
                                            title={groupSelectable.length === 0 ? "No deletable parcels in this group" : `Select all ${groupSelectable.length} deletable parcels for ${group.date}`}
                                        />
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/20 inline-flex items-center justify-center text-pink-500 dark:text-pink-400 text-[11px]">
                                                <i className="fas fa-calendar-day"></i>
                                            </span>
                                            {group.date}
                                        </h3>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-[#ebf0f7] dark:bg-[#14151c] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                        {group.parcels.length} {group.parcels.length === 1 ? 'parcel' : 'parcels'}
                                    </span>
                                </div>

                                {/* table */}
                                <div className="overflow-x-auto">
                                    <table className="table-pro w-full border-collapse text-left">
                                        <thead>
                                            <tr>
                                                <th className="w-10 text-center px-2 py-3.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={allInGroupSelected}
                                                        disabled={groupSelectable.length === 0}
                                                        onChange={(e) => handleSelectGroup(group.parcels, e.target.checked)}
                                                        className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 accent-pink-500 bg-transparent ${
                                                            groupSelectable.length === 0 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'
                                                        }`}
                                                    />
                                                </th>
                                                <th className="hidden md:table-cell w-10 text-center px-2 py-3.5">#</th>
                                                <th>Barcode</th>
                                                <th>Tracking</th>
                                                <th>Sender</th>
                                                <th>Customer</th>
                                                <th>Customer Number</th>
                                                 <th>Destination</th>
                                                <th>Courier</th>
                                                <th>Driver</th>
                                                <th>Status</th>
                                                <th>Scanned By</th>
                                                <th>Time</th>
                                                <th className="text-right! sm:w-[80px] sm:min-w-[80px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.parcels.map((parcel, index) => {
                                                const isSelected = selectedParcelIds.has(parcel.id);
                                                const isDeletable = canDeleteParcel(parcel);

                                                return (<tr
                                                    key={parcel.id}
                                                    onClick={() => handleViewParcel(parcel)}
                                                    className={`hover:bg-[#e8edf5]/80 dark:hover:bg-[#20212f]/40 transition-colors duration-150 group cursor-pointer ${isSelected ? 'bg-pink-50/50 dark:bg-pink-950/30' : ''}`}
                                                >
                                                    <td data-label="Select" className="px-3.5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-between md:justify-center w-full">
                                                            <label className={`inline-flex items-center gap-2 select-none ${isDeletable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    disabled={!isDeletable}
                                                                    onChange={(e) => handleSelectParcel(parcel, e.target.checked)}
                                                                    aria-label={`Select parcel ${parcel.barcode}`}
                                                                    title={isDeletable ? `Select parcel ${parcel.barcode}` : "You can only select and delete parcels scanned by you"}
                                                                    className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 accent-pink-500 bg-transparent ${
                                                                        isDeletable ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'
                                                                    }`}
                                                                />
                                                                <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select Parcel</span>
                                                            </label>
                                                            <div className="md:hidden flex items-center gap-1.5">
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-pink-600 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800">
                                                                    {parcel.barcode}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60">
                                                                    #{index + 1}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td data-label="#" className="hidden md:table-cell text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                                        {index + 1}
                                                    </td>
                                                    <td data-label="Barcode" className="sm:whitespace-nowrap">
                                                        <div className="flex justify-end sm:justify-start">
                                                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-bold bg-[#ebf0f7] dark:bg-[#14151c] px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/50 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                                {parcel.barcode}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td data-label="Tracking" className="font-mono text-[11px] text-slate-600 dark:text-slate-300 sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.tracking_number}>
                                                            {parcel.tracking_number}
                                                        </span>
                                                    </td>
                                                    <td data-label="Sender" className="text-slate-800 dark:text-slate-200 font-semibold sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.sender_name || 'N/A'}>
                                                            {parcel.sender_name || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Customer" className="text-slate-800 dark:text-slate-200 font-semibold sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.customer_name || 'N/A'}>
                                                            {parcel.customer_name || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Customer Number" className="text-slate-800 dark:text-slate-200 font-semibold sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.customer_number || 'N/A'}>
                                                            {parcel.customer_number || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Destination" className="text-slate-600 dark:text-slate-300 sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.destination || 'N/A'}>
                                                            {parcel.destination || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Courier" className="text-slate-700 dark:text-slate-300 font-medium sm:whitespace-nowrap text-right sm:text-left">
                                                        <span className="truncate inline-block text-right" title={parcel.courier || 'N/A'}>
                                                            {parcel.courier || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Driver" className="sm:whitespace-nowrap text-right sm:text-left">
                                                        <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                                                            {parcel.driver_name ? (
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onDriverChange) {
                                                                            onDriverChange(parcel.driver_name!);
                                                                            toast.info(`Filtered by driver: ${parcel.driver_name}`);
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                                                                    title={`Assigned Driver: ${parcel.driver_name} - Click to filter`}
                                                                >
                                                                    <i className="fas fa-id-badge text-[10px] text-emerald-600 dark:text-emerald-400"></i>
                                                                    <span className="truncate max-w-[120px]">{parcel.driver_name}</span>
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onDriverChange) {
                                                                            onDriverChange('unassigned');
                                                                            toast.info('Filtered by unassigned drivers');
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                                                                    title="Unassigned driver - Click to filter unassigned"
                                                                >
                                                                    <i className="fas fa-user-slash text-[9px]"></i>
                                                                    <span>Unassigned</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-label="Status" className="sm:whitespace-nowrap">
                                                        <div className="flex justify-end sm:justify-start">
                                                            <StatusBadge tone={getStatusTone(parcel.status)} size="xs" dot>
                                                                {getStatusLabel(parcel.status)}
                                                            </StatusBadge>
                                                        </div>
                                                    </td>
                                                    <td data-label="Scanned By" className="sm:whitespace-nowrap text-right sm:text-left">
                                                        <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                                                            {parcel.scanned_by || parcel.scanner_name ? (
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const targetScannerId = parcel.scanned_by || '';
                                                                        if (targetScannerId && onScannedByChange) {
                                                                            onScannedByChange(targetScannerId);
                                                                            toast.info(`Filtered by scanner: ${parcel.scanner_name || 'Unknown'}`);
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-800 hover:text-pink-600 dark:hover:text-pink-400 transition-colors cursor-pointer"
                                                                    title={`Scanned by ${parcel.scanner_name || 'Unknown'}${parcel.scanner_role ? ` (${parcel.scanner_role})` : ''} - Click to filter`}
                                                                >
                                                                    <i className="fas fa-user-tag text-[10px] text-pink-500"></i>
                                                                    <span className="truncate max-w-[120px]">{parcel.scanner_name || 'Unknown'}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                                    <i className="fas fa-robot text-[9px]"></i>
                                                                    <span>System</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-label="Time" className="text-slate-400 dark:text-slate-500 text-[11px] font-mono sm:whitespace-nowrap text-right sm:text-left">
                                                        {new Date(parcel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td data-label="Action" className="text-right sm:whitespace-nowrap sm:w-[80px] sm:min-w-[80px] w-full" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end w-full">
                                                            <CrudActionButton action="view" ariaLabel={`View parcel ${parcel.barcode}`} title="View Parcel" onClick={() => handleViewParcel(parcel)}/>
                                                        </div>
                                                    </td>
                                                </tr>);
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })) : (
        /* empty state */
        <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
                <i className="fas fa-box-open text-xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No parcels found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto font-medium">Try adjusting your search query or active filter parameters</p>
        </div>)}
                </div>

                {/* pagination */}
                {!isLoading && groupedParcels.length > 0 && totalItems > 0 && (<div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 backdrop-blur-md flex-wrap gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{startIndex}</span> to{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{endIndex}</span> of{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalItems}</span> parcels
                        </span>
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange}/>
                    </div>)}
            </div>

            {/* modal */}
            {showModal && selectedParcel && (() => {
            const { timelineData, isDelivered, progressPercent } = getProgressData(selectedParcel);
            return (
                <Portal>
                    <div className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 transition-all duration-300 animate-in fade-in" onClick={() => setShowModal(false)}>
                        <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[16px_16px_40px_rgba(0,0,0,0.35)] border border-white/80 dark:border-[#2c2d3c] overflow-hidden transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>

                            {/* header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-200/60 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-900/40">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                                        <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] inline-flex items-center justify-center">
                                            <i className="fas fa-route text-sm"></i>
                                        </span>
                                        Parcel Delivery Tracking
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>Tracking: <code className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">{selectedParcel.tracking_number}</code></span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span>Courier: <strong className="font-bold text-slate-800 dark:text-slate-200">{selectedParcel.courier || 'Airship Express'}</strong></span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span>Barcode: <code className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#14151c] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">{selectedParcel.barcode}</code></span>
                                    </p>
                                </div>
                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowModal(false)} aria-label="Close modal">
                                    <i className="fas fa-times text-xs"></i>
                                </AppButton>
                            </div>

                            {/* body */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 overscroll-contain">

                                {/* tracking map */}
                                <ParcelTrackingCard parcel={selectedParcel}/>

                                {/* progress card */}
                                <div className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.65)] space-y-4">
                                    {/* header */}
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold flex items-center gap-1.5">
                                            <span className={`inline-block w-2 h-2 rounded-full ${isDelivered ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-pink-500 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.5)]'}`}/>
                                            {isDelivered ? 'Delivery Complete' : 'Overall Delivery Progress'}
                                        </span>
                                        <StatusBadge tone={isDelivered ? "emerald" : "pink"} size="xs">
                                            {isDelivered ? '100%' : `${Math.round(progressPercent)}%`}
                                        </StatusBadge>
                                    </div>

                                    {/* progress bar */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden relative p-0.5 border border-slate-200 dark:border-slate-700">
                                        <div className={`h-full rounded-full transition-all duration-500 ease-out relative ${isDelivered
                    ? 'bg-emerald-500'
                    : 'bg-pink-500'}`} style={{ width: `${isDelivered ? 100 : progressPercent}%` }}/>
                                    </div>

                                    {/* complete banner */}
                                    {isDelivered && (<div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                                            <i className="fas fa-check-circle text-sm text-emerald-600 dark:text-emerald-400"></i>
                                            <span>Parcel successfully delivered</span>
                                        </div>)}

                                    {/* metadata */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Sender</p>
                                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 break-words">{selectedParcel.sender_name || 'N/A'}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Destination</p>
                                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 break-words whitespace-normal">{selectedParcel.destination || 'N/A'}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Courier</p>
                                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 break-words">{selectedParcel.courier || 'N/A'}</p>
                                        </div>

                                        {/* Assigned Driver Info */}
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Assigned Driver</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                                                    <i className="fas fa-id-badge"></i>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                                                        {selectedParcel.driver_name || 'Unassigned'}
                                                    </p>
                                                    {selectedParcel.bulk_qr_code && (
                                                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate" title={`Bulk Manifest: ${selectedParcel.bulk_qr_code}`}>
                                                            Manifest: {selectedParcel.bulk_qr_code}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Status</p>
                                            <div>
                                                <StatusBadge tone={getStatusTone(selectedParcel.status)} size="xs" dot>
                                                    {getStatusLabel(selectedParcel.status)}
                                                </StatusBadge>
                                            </div>
                                        </div>

                                        {/* Scanned By Profile Info in Modal */}
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200 dark:border-slate-800 space-y-1 sm:col-span-2">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Scanned By</p>
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-300 flex items-center justify-center text-xs font-bold shrink-0">
                                                        <i className="fas fa-user-tag"></i>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                                            {selectedParcel.scanner_name || 'Unassigned / System Scan'}
                                                        </p>
                                                        {selectedParcel.scanner_email && (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{selectedParcel.scanner_email}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {selectedParcel.scanner_role && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                                        {selectedParcel.scanner_role}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* timeline */}
                                <div className="relative pl-2">

                                    {/* line */}
                                    <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-800 rounded-full"></div>

                                    {/* progress line */}
                                    <div className={`absolute left-6 top-5 w-0.5 rounded-full transition-all duration-500 ease-out ${isDelivered ? 'bg-emerald-500' : 'bg-pink-500'}`} style={{ height: isDelivered ? '100%' : `${progressPercent}%` }}></div>

                                    <div className="space-y-5">
                                        {timelineData.map((item, index) => {
                    const isCompleted = isDelivered || item.isCompleted;
                    const isCurrent = !isDelivered && item.isCurrent;
                    const isPending = !isDelivered && item.isPending;
                    const isLastDelivered = isDelivered && item.key === 'delivered';
                    return (<div key={item.key} className="relative flex items-start gap-4 group transition-all duration-300" style={{ animationDelay: `${index * 80}ms` }}>
                                                    {/* node */}
                                                    <div className="relative z-10 flex-shrink-0">
                                                        <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-200
                                        ${isCompleted || isLastDelivered ? `bg-emerald-500 text-white ring-4 ring-slate-100 dark:ring-slate-900` : ''}
                                        ${isCurrent ? `bg-pink-500 text-white ring-4 ring-pink-100 dark:ring-pink-950` : ''}
                                        ${isPending ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 ring-4 ring-slate-50 dark:ring-slate-900' : ''}
                                    `}>
                                                            <i className={`fas ${item.icon}`}></i>
                                                        </div>
                                                    </div>

                                                    {/* content */}
                                                    <div className={`flex-1 rounded-xl p-4 border transition-all duration-200 ${isCurrent
                            ? 'bg-white dark:bg-[#191a24] border-pink-400 dark:border-pink-600'
                            : isLastDelivered
                                ? 'bg-white dark:bg-[#191a24] border-emerald-400 dark:border-emerald-600'
                                : 'bg-white dark:bg-[#191a24] border-slate-200 dark:border-slate-800'}`}>
                                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                                            <div>
                                                                <p className={`font-bold text-sm ${isPending ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                                                    {item.label}
                                                                </p>

                                                                {(isCompleted || isCurrent || isLastDelivered) && item.formattedDate && (<p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                                                                        <i className="far fa-calendar-alt text-[10px]"></i>
                                                                        <span>{item.formattedDate}</span>
                                                                    </p>)}
                                                            </div>

                                                            {/* badges */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {(isCompleted || isCurrent || isLastDelivered) && item.relativeTime && (<span className="text-[11px] text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151c] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800 font-semibold shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                                        {item.relativeTime}
                                                                    </span>)}

                                                                {isCurrent && (<StatusBadge tone="pink" size="xs" dot>
                                                                        Current
                                                                    </StatusBadge>)}

                                                                {isLastDelivered && (<StatusBadge tone="emerald" size="xs" icon="fas fa-check-circle">
                                                                        Delivered
                                                                    </StatusBadge>)}

                                                                {isPending && (<StatusBadge tone="neutral" size="xs" icon="far fa-clock">
                                                                        Pending
                                                                    </StatusBadge>)}
                                                            </div>
                                                        </div>

                                                        {/* text */}
                                                        <div className="mt-2 text-xs">
                                                            {(isCompleted || isLastDelivered) && (<p className="text-slate-500 dark:text-slate-400 font-medium">
                                                                    {item.key === 'received' && 'Parcel received at facility'}
                                                                    {item.key === 'sorting' && 'Parcel is being sorted'}
                                                                    {item.key === 'ready_for_pickup' && 'Parcel ready for courier pickup'}
                                                                    {item.key === 'picked_up' && 'Parcel picked up by courier'}
                                                                    {item.key === 'in_transit' && 'Parcel is in transit to destination'}
                                                                    {item.key === 'delivered' && 'Parcel delivered successfully'}
                                                                </p>)}
                                                            {isCurrent && (<p className="text-pink-600 dark:text-pink-400 font-semibold">
                                                                    {item.key === 'received' && 'Currently being received at facility'}
                                                                    {item.key === 'sorting' && 'Currently being sorted'}
                                                                    {item.key === 'ready_for_pickup' && 'Awaiting courier pickup'}
                                                                    {item.key === 'picked_up' && 'Currently being picked up'}
                                                                    {item.key === 'in_transit' && 'In transit to destination'}
                                                                    {item.key === 'delivered' && 'Being delivered to recipient'}
                                                                </p>)}
                                                        </div>
                                                    </div>
                                                </div>);
                                })}
                                    </div>
                                </div>
                            </div>

                            {/* footer */}
                            <div className="flex justify-end gap-2 p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
                                <AppButton type="button" variant="primary" size="sm" onClick={() => setShowModal(false)}>
                                    <i className="fas fa-check text-[11px]"></i>
                                    <span>Done</span>
                                </AppButton>
                            </div>

                        </div>
                    </div>
                </Portal>
            );
        })()}

            {/* Scanner Analytics & Filtering Modal */}
            <ScannerStatsModal
                isOpen={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                scanners={scanners || []}
                onSelectScanner={(id) => onScannedByChange?.(id)}
                selectedScannerId={scannedByFilter}
                totalParcelsCount={totalItems}
            />
        </>);
});
