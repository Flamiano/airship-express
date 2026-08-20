"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { ParcelRow } from "../../server/incoming/ParcelRow";
import { TablePagination } from "./TablePagination";
import { deleteMultipleParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/delete";
import { receiveMultipleParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/parcels";
import { BulkActionsToolbar } from "@/app/(supplyChain)/components/global/BulkActionsToolbar";

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
    status: 'pending' | 'verified' | 'rejected';
}

interface IncomingTableProps {
    initialParcels: Parcel[];
    onDelete?: (id: number) => void;
    onBatchDelete?: (ids: number[]) => void;
    onBatchReceive?: (ids: number[]) => void;
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
    onRefresh,
    page = 1,
    totalPages = 1,
    totalItems = 0,
    onPageChange,
    isLoading = false,
}: IncomingTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeletingBatch, setIsDeletingBatch] = useState(false);
    const [isReceivingBatch, setIsReceivingBatch] = useState(false);
    const { confirm } = useConfirm();

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

    const handleSelectAll = () => {
        if (selectedIds.size === initialParcels.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(initialParcels.map(p => p.id)));
        }
    };

    const handleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
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
            const result = await deleteMultipleParcels(idsToDelete);

            if (!result.success) {
                toast.error(result.error || 'Failed to delete parcels', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            toast.success(`Successfully deleted ${result.data?.deleted || selectedIds.size} parcels`, {
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

        // Check if any selected parcels are already received
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

            // Remove already received parcels from selection
            const pendingIds = selectedParcels
                .filter(p => p.status !== 'verified')
                .map(p => p.id);

            if (pendingIds.length === 0) {
                toast.info('No pending parcels to receive');
                return;
            }

            // Update selectedIds to only pending ones
            setSelectedIds(new Set(pendingIds));

            // Continue with receive
            await processReceive(pendingIds);
            return;
        }

        // All selected are pending
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
            const result = await receiveMultipleParcels(ids);

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

    const handleDeleteParcel = (id: number) => {
        onDelete?.(id);
    };

    const allSelected = initialParcels.length > 0 && selectedIds.size === initialParcels.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < initialParcels.length;
    const duplicateCount = duplicateBarcodes.size;

    const selectedParcels = initialParcels.filter(p => selectedIds.has(p.id));
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
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

            {/* Bulk Actions Toolbar */}
            <BulkActionsToolbar
                selectedCount={selectedIds.size}
                itemLabel="parcels"
                singleItemLabel="parcel"
                floating={false}
                additionalInfo={
                    pendingSelectedCount > 0 && pendingSelectedCount < selectedIds.size && (
                        <span className="text-pink-200 dark:text-pink-300 text-xs font-normal ml-1">
                            ({pendingSelectedCount} pending, {selectedIds.size - pendingSelectedCount} already received)
                        </span>
                    )
                }
                actions={[
                    {
                        label: `Receive Selected ${pendingSelectedCount > 0 ? `(${pendingSelectedCount})` : ''}`,
                        icon: 'fa-check-double',
                        onClick: handleBatchReceive,
                        variant: 'success',
                        isLoading: isReceivingBatch,
                        disabled: isDeletingBatch || !canReceive,
                        show: canReceive,
                        mobileLabel: 'Receive',
                    },
                    {
                        label: 'Delete Selected',
                        icon: 'fa-trash',
                        onClick: handleBatchDelete,
                        variant: 'danger',
                        isLoading: isDeletingBatch,
                        disabled: isReceivingBatch,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedIds(new Set())}
            />

            <div className="overflow-x-auto bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800">
                {/* Mobile Select All Bar - Visible only on mobile */}
                <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500"
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            Select All
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
                            {initialParcels.length}
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
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                            <th className="w-10 text-center py-3 px-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500 focus:ring-2 cursor-pointer accent-pink-500"
                                />
                            </th>
                            <th className="w-12 text-center py-3 px-3">#</th>
                            <th className="py-3 px-4">Barcode</th>
                            <th className="py-3 px-4">Tracking</th>
                            <th className="py-3 px-4">Sender</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Customer Number</th>
                            <th className="py-3 px-4">Destination</th>
                            <th className="py-3 px-4">Region</th>
                            <th className="py-3 px-4">Courier</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                        {initialParcels.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fas fa-box-open text-xl"></i>
                                        </div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">No parcels found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            initialParcels.map((parcel, index) => {
                                const isSelected = selectedIds.has(parcel.id);
                                return (
                                    <tr
                                        key={parcel.id}
                                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${isSelected ? 'bg-pink-50/40 dark:bg-pink-950/20' : ''
                                            }`}
                                    >
                                        <td data-label="Select" className="py-3 px-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelect(parcel.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500"
                                            />
                                        </td>
                                        <td data-label="#" className="py-3 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                            {(page - 1) * 10 + index + 1}
                                        </td>
                                        <td data-label="Barcode" className="py-3 px-4 font-mono text-[11px] font-medium text-slate-800 dark:text-slate-200">
                                            {parcel.barcode || '—'}
                                        </td>
                                        <td data-label="Tracking" className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                            {parcel.tracking_number || '—'}
                                        </td>
                                        <td data-label="Sender" className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                            {parcel.sender_name || '—'}
                                        </td>
                                        <td data-label="Customer" className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                            {parcel.customer_name || '—'}
                                        </td>
                                        <td data-label="Customer Number" className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                            {parcel.customer_number || '—'}
                                        </td>
                                        <td data-label="Destination" className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                            {parcel.destination || '—'}
                                        </td>
                                        <td data-label="Region" className="py-3 px-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                {parcel.region || '—'}
                                            </span>
                                        </td>
                                        <td data-label="Courier" className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                            {parcel.courier || '—'}
                                        </td>
                                        <td data-label="Status" className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                Pending
                                            </span>
                                        </td>
                                        <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleDeleteParcel(parcel.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete"
                                                >
                                                    <i className="fas fa-trash text-xs"></i>
                                                </button>
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