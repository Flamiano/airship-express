"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { TablePagination } from "./TablePagination";
import { deleteMultipleParcels, deleteParcel } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/delete";
import { receiveMultipleParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/parcels";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { useUserRole } from "@/app/(supplyChain)/components/global/UnauthorizedEmptyState";
import { BulkActionsToolbar } from "@/app/(supplyChain)/components/global/BulkActionsToolbar";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    region: string | null;
    courier: string | null;
    scanned_by: string | null;
    scanned_at: string;
    status: 'pending' | 'verified' | 'rejected' | 'not_synced';
    is_fetched?: boolean;
}

interface IncomingTableProps {
    initialParcels: Parcel[];
    onDelete?: (id: number) => void;
    onBatchDelete?: (ids: number[]) => void;
    onBatchReceive?: (ids: number[]) => void;
    onFetchMockData?: (parcels: Parcel[]) => Promise<void> | void;
    onAddInQueue?: (parcels: Parcel[]) => Promise<void> | void;
    isOnline?: boolean;
    onRefresh?: () => void;
    page?: number;
    totalPages?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    isLoading?: boolean;
}

export function IncomingTable({
    initialParcels,
    onDelete,
    onBatchDelete,
    onBatchReceive,
    onFetchMockData,
    onAddInQueue,
    isOnline = true,
    onRefresh,
    page = 1,
    totalPages = 1,
    totalItems = 0,
    onPageChange,
    isLoading = false,
}: IncomingTableProps) {
    const { role: userRole, userId: currentUserId, userName, userEmail, isPrivileged } = useUserRole();
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeletingBatch, setIsDeletingBatch] = useState(false);
    const [isReceivingBatch, setIsReceivingBatch] = useState(false);
    const [isFetchingBatch, setIsFetchingBatch] = useState(false);
    const [isAddingInQueueBatch, setIsAddingInQueueBatch] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [fetchingId, setFetchingId] = useState<number | null>(null);
    const [addingInQueueId, setAddingInQueueId] = useState<number | null>(null);
    const { confirm } = useConfirm();

    // check if current user can delete a parcel (Admin/Manager/Executive can delete any; Operator can delete their own scanned parcels or unassigned queue items, or offline not_synced parcels)
    const canDeleteParcel = useCallback((parcel: Parcel) => {
        if (parcel.status === 'not_synced' || parcel.id < 0) return true;
        if (isPrivileged) return true;
        const currentIdentifiers = [currentUserId, userName, userEmail].filter(Boolean).map(s => s!.toLowerCase().trim());
        
        // If parcel has no scanned_by recorded yet, allow active operator to delete it so it's not locked out forever
        if (!parcel.scanned_by) return true;

        const parcelScannedBy = parcel.scanned_by.toLowerCase().trim();
        return currentIdentifiers.some(id => id === parcelScannedBy);
    }, [isPrivileged, currentUserId, userName, userEmail]);

    const duplicateBarcodes = useMemo(() => {
        const barcodeCount: Record<string, number> = {};
        const duplicates: Set<string> = new Set();

        initialParcels.forEach(p => {
            if (p.barcode) {
                barcodeCount[p.barcode] = (barcodeCount[p.barcode] || 0) + 1;
                if (barcodeCount[p.barcode] > 1) {
                    duplicates.add(p.barcode);
                }
            }
        });

        return duplicates;
    }, [initialParcels]);

    const isDuplicate = (barcode: string) => duplicateBarcodes.has(barcode);

    const selectableParcels = useMemo(() => {
        return initialParcels.filter(p => canDeleteParcel(p));
    }, [initialParcels, canDeleteParcel]);

    const allSelected = selectableParcels.length > 0 && selectableParcels.every(p => selectedIds.has(p.id));
    const someSelected = selectedIds.size > 0 && !allSelected;

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableParcels.map(p => p.id)));
        }
    };

    const handleSelect = (parcel: Parcel) => {
        if (!canDeleteParcel(parcel)) return;
        const newSelected = new Set(selectedIds);
        if (newSelected.has(parcel.id)) {
            newSelected.delete(parcel.id);
        } else {
            newSelected.add(parcel.id);
        }
        setSelectedIds(newSelected);
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) {
            toast.warning('Please select at least one parcel to delete');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedIds.size} Parcels`,
            message: `Are you sure you want to delete ${selectedIds.size} selected parcel(s)? This action cannot be undone.`,
            confirmText: `Delete ${selectedIds.size}`,
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setIsDeletingBatch(true);
        const toastId = toast.loading(`Deleting ${selectedIds.size} parcels...`);

        try {
            const idsToDelete = Array.from(selectedIds);
            const dbIds = idsToDelete.filter(id => id > 0);

            if (dbIds.length > 0) {
                const result = await deleteMultipleParcels(dbIds);
                if (!result.success) {
                    toast.error(result.error || 'Failed to delete database parcels', {
                        id: toastId,
                        duration: 5000,
                    });
                    return;
                }
            }

            toast.success(`Successfully deleted ${selectedIds.size} parcel(s)`, {
                id: toastId,
                duration: 3000,
            });

            onBatchDelete?.(idsToDelete);
            setSelectedIds(new Set());
            onRefresh?.();
        } catch (error) {
            console.error('Error deleting parcels:', error);
            toast.error('Failed to delete parcels', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsDeletingBatch(false);
        }
    };

    const handleBatchReceive = async () => {
        if (selectedIds.size === 0) {
            toast.warning('Please select at least one parcel to receive');
            return;
        }

        // check received
        const selectedParcels = initialParcels.filter(p => selectedIds.has(p.id));
        const alreadyReceived = selectedParcels.filter(p => p.status === 'verified');

        if (alreadyReceived.length > 0) {
            const confirmed = await confirm({
                title: `Some parcels already received`,
                message: `${alreadyReceived.length} of ${selectedIds.size} selected parcel(s) are already marked as received. Do you want to continue with the remaining ${selectedIds.size - alreadyReceived.length} parcel(s)?`,
                confirmText: "Continue",
                cancelText: "Cancel",
                confirmVariant: "warning",
            });

            if (!confirmed) return;

            // remove received
            const pendingIds = selectedParcels
                .filter(p => p.status !== 'verified')
                .map(p => p.id);

            if (pendingIds.length === 0) {
                toast.info('No pending parcels to receive');
                return;
            }

            // update selected
            setSelectedIds(new Set(pendingIds));

            // continue receive
            await processReceive(pendingIds);
            return;
        }

        // all pending
        const confirmed = await confirm({
            title: `Receive ${selectedIds.size} Parcels`,
            message: `Are you sure you want to mark ${selectedIds.size} selected parcel(s) as received? This will move them to the receiving queue.`,
            confirmText: `Receive ${selectedIds.size}`,
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;
        await processReceive(Array.from(selectedIds));
    };

    const processReceive = async (ids: number[]) => {
        setIsReceivingBatch(true);
        const toastId = toast.loading(`Processing ${ids.length} parcels...`);

        try {
            const currentUserId = user.getUserId();
            const result = await receiveMultipleParcels(ids, currentUserId || undefined);

            if (!result.success) {
                toast.error(result.error || 'Failed to receive parcels', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            toast.success(`Successfully received ${result.data?.received || ids.length} parcels`, {
                id: toastId,
                duration: 3000,
            });

            onBatchReceive?.(ids);
            setSelectedIds(new Set());
            onRefresh?.();
        } catch (error) {
            console.error('Error receiving parcels:', error);
            toast.error('Failed to receive parcels', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsReceivingBatch(false);
        }
    };

    const handleDeleteParcel = async (id: number) => {
        if (deletingId || isDeletingBatch) return;

        const targetParcel = initialParcels.find(p => p.id === id);
        const isOfflineScan = targetParcel?.status === 'not_synced' || id < 0;

        const confirmed = await confirm({
            title: isOfflineScan ? "Discard Offline Scan" : "Delete Parcel",
            message: isOfflineScan
                ? "Are you sure you want to remove this offline scan from your local list?"
                : "Are you sure you want to delete this parcel? This action cannot be undone.",
            confirmText: isOfflineScan ? "Discard" : "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setDeletingId(id);

        if (isOfflineScan) {
            onDelete?.(id);
            if (selectedIds.has(id)) {
                const nextSelected = new Set(selectedIds);
                nextSelected.delete(id);
                setSelectedIds(nextSelected);
            }
            toast.success('Offline scan discarded');
            setDeletingId(null);
            return;
        }

        const toastId = toast.loading('Removing parcel...');

        try {
            const result = await deleteParcel(id);

            if (!result.success) {
                toast.error(result.error || 'Failed to remove parcel', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            toast.success('Parcel removed successfully', {
                id: toastId,
                duration: 3000,
            });

            onDelete?.(id);
            if (selectedIds.has(id)) {
                const nextSelected = new Set(selectedIds);
                nextSelected.delete(id);
                setSelectedIds(nextSelected);
            }
            onRefresh?.();
        } catch (error) {
            console.error('Error removing parcel:', error);
            toast.error('Failed to remove parcel', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleFetchMockSingle = async (parcel: Parcel) => {
        if (fetchingId || isFetchingBatch || !isOnline) return;
        setFetchingId(parcel.id);
        try {
            await onFetchMockData?.([parcel]);
        } finally {
            setFetchingId(null);
        }
    };

    const handleAddInQueueSingle = async (parcel: Parcel) => {
        if (addingInQueueId || isAddingInQueueBatch || !isOnline) return;
        setAddingInQueueId(parcel.id);
        try {
            await onAddInQueue?.([parcel]);
        } finally {
            setAddingInQueueId(null);
        }
    };

    const duplicateCount = duplicateBarcodes.size;

    const selectedParcels = initialParcels.filter(p => selectedIds.has(p.id));
    const notSyncedSelected = selectedParcels.filter(p => p.status === 'not_synced');
    const pendingSelectedCount = selectedParcels.filter(p => p.status === 'pending').length;
    const canReceive = pendingSelectedCount > 0;

    const scrollToFirstDuplicate = () => {
        const firstDuplicate = initialParcels.find(p => duplicateBarcodes.has(p.barcode));
        if (firstDuplicate) {
            const element = document.getElementById(`row-${firstDuplicate.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
            {duplicateCount > 0 && (
                <div className="px-4 py-3 bg-rose-50/80 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium">
                        <i className="fas fa-exclamation-triangle text-rose-500 dark:text-rose-400 shrink-0"></i>
                        <span>{duplicateCount} duplicate barcode(s) detected</span>
                        <span className="text-[11px] text-rose-500/80 dark:text-rose-400/70 font-normal hidden sm:inline">
                            (Rows with duplicate barcodes are highlighted)
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={scrollToFirstDuplicate}
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline transition-colors shrink-0 cursor-pointer"
                    >
                        <i className="fas fa-arrow-down mr-1"></i>
                        View duplicates
                    </button>
                </div>
            )}

            {/* bulk actions */}
            <BulkActionsToolbar
                selectedCount={selectedIds.size}
                itemLabel="parcels"
                singleItemLabel="parcel"
                floating={false}
                additionalInfo={
                    notSyncedSelected.length > 0 ? (
                        <span className="text-amber-300 text-xs font-medium ml-1">
                            ({notSyncedSelected.length} not synced)
                        </span>
                    ) : (
                        pendingSelectedCount > 0 && pendingSelectedCount < selectedIds.size && (
                            <span className="text-pink-200 dark:text-pink-300 text-xs font-normal ml-1">
                                ({pendingSelectedCount} pending, {selectedIds.size - pendingSelectedCount} already received)
                            </span>
                        )
                    )
                }
                actions={[
                    {
                        label: `Fetch Data (${notSyncedSelected.length})`,
                        icon: 'fa-database',
                        onClick: async () => {
                            if (notSyncedSelected.length === 0 || !isOnline) return;
                            setIsFetchingBatch(true);
                            try {
                                await onFetchMockData?.(notSyncedSelected);
                            } finally {
                                setIsFetchingBatch(false);
                            }
                        },
                        variant: 'warning',
                        isLoading: isFetchingBatch,
                        disabled: !isOnline || isDeletingBatch || isReceivingBatch || isAddingInQueueBatch,
                        show: notSyncedSelected.length > 0,
                        mobileLabel: 'Fetch Data',
                    },
                    {
                        label: `Add in Queue (${notSyncedSelected.length})`,
                        icon: 'fa-inbox',
                        onClick: async () => {
                            if (notSyncedSelected.length === 0 || !isOnline) return;
                            setIsAddingInQueueBatch(true);
                            try {
                                await onAddInQueue?.(notSyncedSelected);
                                setSelectedIds(new Set());
                            } finally {
                                setIsAddingInQueueBatch(false);
                            }
                        },
                        variant: 'success',
                        isLoading: isAddingInQueueBatch,
                        disabled: !isOnline || isDeletingBatch || isReceivingBatch || isFetchingBatch,
                        show: notSyncedSelected.length > 0,
                        mobileLabel: 'Add in Queue',
                    },
                    {
                        label: `Receive Selected ${pendingSelectedCount > 0 ? `(${pendingSelectedCount})` : ''}`,
                        icon: 'fa-check-double',
                        onClick: handleBatchReceive,
                        variant: 'success',
                        isLoading: isReceivingBatch,
                        disabled: isDeletingBatch || !canReceive,
                        show: canReceive && notSyncedSelected.length === 0,
                        mobileLabel: 'Receive',
                    },
                    {
                        label: 'Delete Selected',
                        icon: 'fa-trash',
                        onClick: handleBatchDelete,
                        variant: 'danger',
                        isLoading: isDeletingBatch,
                        disabled: isReceivingBatch || isFetchingBatch || isAddingInQueueBatch,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedIds(new Set())}
            />

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800">
                {/* select all mobile */}
                <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <label className={`flex items-center gap-2.5 select-none ${selectableParcels.length === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
                        <input
                            type="checkbox"
                            checked={allSelected}
                            disabled={selectableParcels.length === 0}
                            onChange={handleSelectAll}
                            className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500/20 accent-pink-500 ${
                                selectableParcels.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            Select All Deletable
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                            {selectableParcels.length} / {initialParcels.length}
                        </span>
                    </label>
                    {selectedIds.size > 0 && (
                        <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-100 dark:border-pink-900/40 px-2.5 py-1 rounded-full">
                            {selectedIds.size} selected
                        </span>
                    )}
                </div>

                <table className="table-pro w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    disabled={selectableParcels.length === 0}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={handleSelectAll}
                                    title={selectableParcels.length === 0 ? "No deletable parcels scanned by you" : "Select all deletable parcels"}
                                    className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500 focus:ring-2 accent-pink-500 ${
                                        selectableParcels.length === 0 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'
                                    }`}
                                />
                            </th>
                            <th className="w-12 text-center">#</th>
                            <th>Barcode</th>
                            <th>Tracking</th>
                            <th>Sender</th>
                            <th>Customer</th>
                            <th>Customer Number</th>
                            <th>Destination</th>
                            <th>Region</th>
                            <th>Courier</th>
                            <th>Status</th>
                            <th className="text-right! min-w-[140px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                        {initialParcels.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-14 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fas fa-box-open text-xl"></i>
                                        </div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No parcels found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Try adjusting your search query or active filter parameters</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            initialParcels.map((parcel, index) => {
                                const isSelected = selectedIds.has(parcel.id);
                                const isDeletable = canDeleteParcel(parcel);
                                const isNotSynced = parcel.status === 'not_synced';

                                return (
                                    <tr
                                        key={parcel.id}
                                        id={`row-${parcel.id}`}
                                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${
                                            isSelected
                                                ? 'bg-pink-50/40 dark:bg-pink-950/20'
                                                : isNotSynced
                                                    ? 'bg-slate-50/60 dark:bg-slate-800/30'
                                                    : ''
                                        }`}
                                    >
                                        <td data-label="Select" className="py-3 px-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={!isDeletable}
                                                onChange={() => isDeletable && handleSelect(parcel)}
                                                title={isDeletable ? `Select parcel ${parcel.barcode}` : "You can only select and delete parcels scanned by you"}
                                                className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500/20 accent-pink-500 ${
                                                    isDeletable ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'
                                                }`}
                                            />
                                        </td>
                                        <td data-label="#" className="py-3 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                            {(page - 1) * 10 + index + 1}
                                        </td>
                                        <td data-label="Barcode" className="py-3 px-4 font-mono text-[11px] font-medium text-slate-800 dark:text-slate-200">
                                            <span className="flex items-center gap-1.5 flex-wrap">
                                                <span>{parcel.barcode || '—'}</span>
                                                {isNotSynced && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                        OFFLINE
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td data-label="Tracking" className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                            {parcel.tracking_number || '—'}
                                        </td>
                                        <td data-label="Sender" className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                            {parcel.sender_name || (isNotSynced ? <span className="text-slate-400 italic font-mono text-[10px]">Click Fetch Data</span> : '—')}
                                        </td>
                                        <td data-label="Customer" className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                            {parcel.customer_name || (isNotSynced ? <span className="text-slate-400 italic font-mono text-[10px]">Click Fetch Data</span> : '—')}
                                        </td>
                                        <td data-label="Customer Number" className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                            {parcel.customer_number || '—'}
                                        </td>
                                        <td data-label="Destination" className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                            {parcel.destination || '—'}
                                        </td>
                                        <td data-label="Region" className="py-3 px-4">
                                            <StatusBadge tone="neutral" size="xs">
                                                {parcel.region || '—'}
                                            </StatusBadge>
                                        </td>
                                        <td data-label="Courier" className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                            {parcel.courier || (isNotSynced ? <span className="text-slate-400 italic font-mono text-[10px]">Click Fetch Data</span> : '—')}
                                        </td>
                                        <td data-label="Status" className="py-3 px-4">
                                            {isNotSynced ? (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 whitespace-nowrap">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                        Not Synced
                                                    </span>
                                                    {parcel.is_fetched && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 whitespace-nowrap">
                                                            <i className="fas fa-check text-[8px]"></i>
                                                            Data Fetched
                                                        </span>
                                                    )}
                                                </div>
                                            ) : parcel.status === 'verified' ? (
                                                <StatusBadge tone="emerald" dot size="xs">
                                                    Verified
                                                </StatusBadge>
                                            ) : (
                                                <StatusBadge tone="amber" dot size="xs">
                                                    Pending
                                                </StatusBadge>
                                            )}
                                        </td>
                                        <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap min-w-[140px]">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {isNotSynced ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFetchMockSingle(parcel)}
                                                            disabled={fetchingId === parcel.id || isFetchingBatch || !isOnline}
                                                            title={!isOnline ? "Connect to internet to fetch mock data" : "Fetch details from mock third-party parcels"}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            <i className={`fas ${fetchingId === parcel.id ? 'fa-spinner fa-spin' : 'fa-database'} text-[10px]`}></i>
                                                            <span>Fetch</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddInQueueSingle(parcel)}
                                                            disabled={addingInQueueId === parcel.id || isAddingInQueueBatch || !isOnline}
                                                            title={!isOnline ? "Connect to internet to insert into receiving queue" : "Add this parcel into receiving_queue database table"}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white border border-emerald-600 dark:border-emerald-500 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            <i className={`fas ${addingInQueueId === parcel.id ? 'fa-spinner fa-spin' : 'fa-inbox'} text-[10px]`}></i>
                                                            <span>Queue</span>
                                                        </button>
                                                    </>
                                                ) : null}

                                                <CrudActionButton
                                                    action="delete"
                                                    ariaLabel={isNotSynced ? "Discard offline scan" : "Delete parcel"}
                                                    title={isNotSynced ? "Discard offline scan" : (isDeletable ? "Delete" : "You can only delete parcels scanned by you")}
                                                    disabled={(!isDeletable && !isNotSynced) || deletingId === parcel.id || isDeletingBatch}
                                                    onClick={() => (isDeletable || isNotSynced) && handleDeleteParcel(parcel.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalItems > 0 && (
                <div className="border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <TablePagination
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={10}
                        onPageChange={onPageChange}
                        isLoading={isLoading}
                    />
                </div>
            )}
        </div>
    );
}