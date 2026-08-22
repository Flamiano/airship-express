"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { sanitizeBarcode } from "@/app/(supplyChain)/components/global/sanitize";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import BarcodeScanner from "@/app/(supplyChain)/(pages)/warehousing/components/client/outgoing/BarcodeScanner";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { Send } from "lucide-react";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    destination: string | null;
    courier: string | null;
    courier_id: number | null;
    status: string;
    created_at: string;
    bulk_qr_code?: string | null;
    driver_name?: string | null;
}

interface Courier {
    id: number;
    code: string;
    name: string;
}

const DRIVERS = [
    "Juan Dela Cruz",
    "Maria Santos",
    "Pedro Reyes",
    "Ana Lopez",
    "Ramon Garcia",
    "Liza Fernandez",
    "Michael Tan",
    "Sarah Lim",
];

export default function OutgoingPanel({ isVisible = true }) {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [barcode, setBarcode] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkQrCode, setBulkQrCode] = useState<string | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string>("");
    const [showScanner, setShowScanner] = useState(false);
    const [stats, setStats] = useState({ total: 0 });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [bulkScannedCount, setBulkScannedCount] = useState(0);
    const limit = 10;
    const inputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    useEffect(() => {
        if (isListening && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isListening]);

    useEffect(() => {
        if (isVisible && isListening && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isVisible, isListening]);

    useEffect(() => {
        const fetchCouriers = async () => {
            const { data } = await supabase
                .from('couriers')
                .select('id, code, name')
                .eq('is_active', true)
                .order('name');
            if (data) setCouriers(data);
        };
        fetchCouriers();
    }, []);

    const getCourierDisplay = (courierName: string | null, courierId: number | null) => {
        if (courierName) return courierName;
        if (courierId) {
            const courier = couriers.find(c => c.id === courierId);
            return courier ? courier.name : 'Unknown';
        }
        return 'N/A';
    };

    const getCourierColor = (courierName: string | null) => {
        const colors: Record<string, string> = {
            'J&T Express': 'text-pink-600',
            'Shopee Xpress': 'text-indigo-600',
            'LBC Express': 'text-purple-600',
            'GrabExpress': 'text-teal-600',
            'DHL': 'text-yellow-600',
            'FedEx': 'text-blue-600',
        };
        return colors[courierName || ''] || 'text-slate-600';
    };

    const fetchParcels = useCallback(async () => {
        try {
            setLoading(true);

            const offset = (page - 1) * limit;

            let query = supabase
                .from('parcels')
                .select('*', { count: 'exact' })
                .eq('status', 'ready_for_pickup')
                .order('created_at', { ascending: false });

            if (bulkQrCode) {
                query = query.eq('bulk_qr_code', bulkQrCode);
            }

            if (selectedDriver) {
                query = query.eq('driver_name', selectedDriver);
            }

            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            setParcels(data || []);
            setTotalPages(Math.ceil((count || 0) / limit));
            setStats({
                total: count || 0,
            });

        } catch (error) {
            console.error('Error fetching parcels:', error);
            toast.error('Failed to load outgoing parcels');
            setParcels([]);
            setStats({ total: 0 });
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [bulkQrCode, selectedDriver, page, limit]);

    useEffect(() => {
        fetchParcels();
    }, [fetchParcels]);

    const processBarcode = async (barcodeValue: string) => {
        const sanitized = sanitizeBarcode(barcodeValue);
        if (!sanitized || isScanning) return;

        setIsScanning(true);
        const toastId = toast.loading('Processing barcode...');

        try {
            if (sanitized.startsWith('BULK-')) {
                const { data: bulkParcels, error: bulkError } = await supabase
                    .from('parcels')
                    .select('*')
                    .eq('bulk_qr_code', sanitized)
                    .neq('status', 'picked_up')
                    .neq('status', 'delivered');

                if (bulkError) throw bulkError;

                if (!bulkParcels || bulkParcels.length === 0) {
                    toast.warning(`No parcels found with bulk QR: ${sanitized}`, {
                        id: toastId,
                        duration: 3000,
                    });
                    setIsScanning(false);
                    setBarcode("");
                    if (isListening && inputRef.current) {
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }
                    return;
                }

                const bulkIds = bulkParcels.map(p => p.id);
                const updateData: any = {
                    status: 'ready_for_pickup',
                    updated_at: new Date().toISOString(),
                };

                if (selectedDriver) {
                    updateData.driver_name = selectedDriver;
                }

                const { error: updateError } = await supabase
                    .from('parcels')
                    .update(updateData)
                    .in('id', bulkIds);

                if (updateError) throw updateError;

                setBulkQrCode(sanitized);
                setBulkScannedCount(bulkParcels.length);

                toast.success(`Bulk scan complete! ${bulkParcels.length} parcels marked as ready for pickup${selectedDriver ? ` for ${selectedDriver}` : ''}`, {
                    id: toastId,
                    duration: 4000,
                });

                setBarcode("");
                await fetchParcels();
                setIsScanning(false);

                if (isListening && inputRef.current) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                }
                return;
            }

            const { data: parcel, error: findError } = await supabase
                .from('parcels')
                .select('*')
                .eq('barcode', sanitized)
                .maybeSingle();

            if (findError) {
                console.error('Find error:', findError);
                throw findError;
            }

            if (!parcel) {
                toast.error('Parcel not found', {
                    id: toastId,
                    duration: 3000,
                });
                setIsScanning(false);
                setBarcode("");
                if (isListening && inputRef.current) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                }
                return;
            }

            if (parcel.status === 'picked_up' || parcel.status === 'delivered') {
                toast.warning('Parcel already dispatched', {
                    id: toastId,
                    duration: 3000,
                });
                setIsScanning(false);
                setBarcode("");
                if (isListening && inputRef.current) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                }
                return;
            }

            if (parcel.status !== 'ready_for_pickup') {
                const updateData: any = {
                    status: 'ready_for_pickup',
                    updated_at: new Date().toISOString(),
                };

                if (selectedDriver) {
                    updateData.driver_name = selectedDriver;
                }

                const { error: updateError } = await supabase
                    .from('parcels')
                    .update(updateData)
                    .eq('id', parcel.id);

                if (updateError) {
                    console.error('Update error:', updateError);
                    throw updateError;
                }

                toast.success(`Parcel ${parcel.barcode} marked as ready for pickup${selectedDriver ? ` for ${selectedDriver}` : ''}`, {
                    id: toastId,
                    duration: 2000,
                });
            } else {
                toast.info(`Parcel ${parcel.barcode} already ready for pickup`, {
                    id: toastId,
                    duration: 2000,
                });
            }

            setBarcode("");
            await fetchParcels();

            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }

        } catch (error) {
            console.error('Error processing barcode:', error);
            toast.error('Failed to process barcode', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        } finally {
            setIsScanning(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isListening) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (barcode.trim()) {
                processBarcode(barcode);
            }
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            return;
        }

        if (e.key.length === 1 && !/[a-zA-Z0-9-_]/.test(e.key)) {
            e.preventDefault();
            return;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isListening) return;
        const sanitized = sanitizeBarcode(e.target.value);
        setBarcode(sanitized);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!isListening) {
            e.preventDefault();
            return;
        }
        const pastedText = e.clipboardData?.getData('text') || '';
        const sanitized = sanitizeBarcode(pastedText);
        setBarcode(sanitized);
        e.preventDefault();
    };

    const handleStartListening = () => {
        setIsListening(true);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
        toast.info('Scanner ready - scan barcodes', { duration: 2000 });
    };

    const handleStopListening = () => {
        setIsListening(false);
        setBarcode("");
        toast.info('Scanner paused', { duration: 2000 });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === parcels.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(parcels.map(p => p.id)));
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

    const handleDispatchAll = async () => {
        const idsToDispatch = selectedIds.size > 0
            ? Array.from(selectedIds)
            : parcels.map(p => p.id);

        if (idsToDispatch.length === 0) {
            toast.warning('No parcels to dispatch');
            return;
        }

        const confirmed = await confirm({
            title: `Dispatch ${idsToDispatch.length} Parcels`,
            message: `Are you sure you want to dispatch ${idsToDispatch.length} parcel(s)? This will change status to "picked_up".`,
            confirmText: `Dispatch ${idsToDispatch.length}`,
            cancelText: "Cancel",
            confirmVariant: "warning",
        });

        if (!confirmed) return;

        const toastId = toast.loading(`Dispatching ${idsToDispatch.length} parcels...`);

        try {
            const updateData: any = {
                status: 'picked_up',
                updated_at: new Date().toISOString()
            };

            if (selectedDriver) {
                updateData.driver_name = selectedDriver;
            }

            const { error } = await supabase
                .from('parcels')
                .update(updateData)
                .in('id', idsToDispatch);

            if (error) {
                console.error('Dispatch error:', error);
                throw error;
            }

            toast.success(`Successfully dispatched ${idsToDispatch.length} parcels${selectedDriver ? ` to ${selectedDriver}` : ''}`, {
                id: toastId,
                duration: 3000,
            });

            setSelectedIds(new Set());
            await fetchParcels();

            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }

        } catch (error) {
            console.error('Error dispatching parcels:', error);
            toast.error('Failed to dispatch parcels', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        }
    };

    const handleRemoveFromReady = async (parcelId: number, barcode: string) => {
        const confirmed = await confirm({
            title: "Remove from Ready",
            message: `Remove ${barcode} from ready list? It will go back to "received" status.`,
            confirmText: "Remove",
            cancelText: "Cancel",
            confirmVariant: "warning",
        });

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('parcels')
                .update({
                    status: 'received',
                    updated_at: new Date().toISOString(),
                    driver_name: null
                })
                .eq('id', parcelId);

            if (error) {
                console.error('Remove error:', error);
                throw error;
            }

            toast.success(`Parcel ${barcode} moved back to received`);
            await fetchParcels();

            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }

        } catch (error) {
            console.error('Error removing parcel:', error);
            toast.error('Failed to remove parcel from ready list');
        }
    };

    const handleBatchRemove = async () => {
        if (selectedIds.size === 0) {
            toast.warning('Please select at least one parcel to remove');
            return;
        }

        const confirmed = await confirm({
            title: `Remove ${selectedIds.size} Parcels from Ready`,
            message: `Are you sure you want to remove ${selectedIds.size} selected parcel(s) from ready list? They will go back to "received" status.`,
            confirmText: `Remove ${selectedIds.size}`,
            cancelText: "Cancel",
            confirmVariant: "warning",
        });

        if (!confirmed) return;

        const toastId = toast.loading(`Removing ${selectedIds.size} parcels from ready list...`);

        try {
            const { error } = await supabase
                .from('parcels')
                .update({
                    status: 'received',
                    updated_at: new Date().toISOString(),
                    driver_name: null
                })
                .in('id', Array.from(selectedIds));

            if (error) {
                console.error('Remove error:', error);
                throw error;
            }

            toast.success(`Successfully removed ${selectedIds.size} parcels from ready list`, {
                id: toastId,
                duration: 3000,
            });

            setSelectedIds(new Set());
            await fetchParcels();

            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }

        } catch (error) {
            console.error('Error removing parcels:', error);
            toast.error('Failed to remove parcels from ready list', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        }
    };

    const handleSingleDispatch = async (parcelId: number, barcode: string) => {
        const confirmed = await confirm({
            title: "Dispatch Parcel",
            message: `Dispatch ${barcode}?`,
            confirmText: "Dispatch",
            cancelText: "Cancel",
            confirmVariant: "warning",
        });

        if (!confirmed) return;

        try {
            const updateData: any = {
                status: 'picked_up',
                updated_at: new Date().toISOString()
            };

            if (selectedDriver) {
                updateData.driver_name = selectedDriver;
            }

            const { error } = await supabase
                .from('parcels')
                .update(updateData)
                .eq('id', parcelId);

            if (error) {
                console.error('Dispatch error:', error);
                throw error;
            }

            toast.success(`Parcel ${barcode} dispatched${selectedDriver ? ` to ${selectedDriver}` : ''}`);
            await fetchParcels();

            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }

        } catch (error) {
            console.error('Error dispatching parcel:', error);
            toast.error('Failed to dispatch parcel');
        }
    };

    const clearBulkFilter = () => {
        setBulkQrCode(null);
        setBulkScannedCount(0);
        toast.info('Showing all ready parcels', { duration: 2000 });
        fetchParcels();
        if (isListening && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const clearDriverFilter = () => {
        setSelectedDriver("");
        toast.info('Driver filter cleared', { duration: 2000 });
        if (isListening && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            if (isListening && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    const allSelected = parcels.length > 0 && selectedIds.size === parcels.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < parcels.length;

    const renderStatusBadge = (status: string) => {
        const toneMap: Record<string, 'emerald' | 'purple' | 'blue' | 'indigo' | 'neutral'> = {
            'ready_for_pickup': 'emerald',
            'picked_up': 'purple',
            'received': 'blue',
            'in_transit': 'indigo',
            'delivered': 'emerald',
        };
        const labelMap: Record<string, string> = {
            'ready_for_pickup': 'Ready for pickup',
            'picked_up': 'Picked up',
            'received': 'Received',
            'in_transit': 'In transit',
            'delivered': 'Delivered',
        };
        const tone = toneMap[status] || 'neutral';
        const label = labelMap[status] || status.replace(/_/g, ' ');
        return (
            <StatusBadge tone={tone} dot size="xs">
                {label}
            </StatusBadge>
        );
    };

    const hasActiveFilter = bulkQrCode !== null || selectedDriver !== "";

    return (
        <div
            data-panel="outgoing"
            className={`p-4 sm:p-6 space-y-4 sm:space-y-6 ${isVisible ? '' : 'hidden'}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 ring-1 ring-pink-500/10 dark:ring-pink-500/20 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                            </svg>
                        </span>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Outgoing Dispatch
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-slate-700 dark:text-slate-300">Batch #P-2408</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-700 dark:text-slate-300">Operator: {user.getName()}</span>

                        {bulkQrCode && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 rounded-md">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                <span>{bulkQrCode}</span>
                                <span className="font-semibold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">
                                    {bulkScannedCount} parcels
                                </span>
                                <button
                                    onClick={clearBulkFilter}
                                    className="p-0.5 text-blue-500 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors cursor-pointer"
                                    title="Clear filter"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        )}

                        {selectedDriver && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 rounded-md">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>{selectedDriver}</span>
                                <button
                                    onClick={clearDriverFilter}
                                    className="p-0.5 text-emerald-500 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded transition-colors cursor-pointer"
                                    title="Clear driver"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        )}

                        {!hasActiveFilter && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                                <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                Showing all ready parcels
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {selectedIds.size > 0 && (
                        <AppButton
                            type="button"
                            variant="warning"
                            size="md"
                            onClick={handleBatchRemove}
                            disabled={selectedIds.size === 0}
                        >
                            <i className="fas fa-arrow-rotate-left text-xs" />
                            <span>Remove ({selectedIds.size})</span>
                        </AppButton>
                    )}

                    <AppButton
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleDispatchAll}
                        disabled={parcels.length === 0}
                    >
                        <i className="fas fa-paper-plane text-xs" />
                        <span>{selectedIds.size > 0 ? `Dispatch (${selectedIds.size})` : 'Dispatch All'}</span>
                    </AppButton>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-all">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fas fa-user-tie text-pink-500 dark:text-pink-400"></i>
                    Assign Driver:
                </label>

                <div className="relative">
                    <select
                        value={selectedDriver}
                        onChange={(e) => {
                            setSelectedDriver(e.target.value);
                            setPage(1);
                            toast.info(`Driver selected: ${e.target.value || 'None'}`, { duration: 2000 });
                            if (isListening && inputRef.current) {
                                setTimeout(() => inputRef.current?.focus(), 100);
                            }
                        }}
                        className="appearance-none bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/80 rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer min-w-[160px]"
                    >
                        <option value="" className="dark:bg-slate-900 text-slate-400">No driver assigned</option>
                        {DRIVERS.map((driver) => (
                            <option key={driver} value={driver} className="dark:bg-slate-900 dark:text-slate-200">
                                {driver}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {selectedDriver && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        Active: {selectedDriver}
                    </span>
                )}

                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                    <i className="fas fa-info-circle"></i>
                    <span>Assigned to scanned or dispatched parcels</span>
                </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-none p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-900 dark:text-slate-100">
                <div className="lg:col-span-2 space-y-4">
                    <div className="space-y-1.5">
                        <label
                            htmlFor="outgoing-barcode"
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                            <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            Barcode / Tracking Number
                        </label>

                        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                            <div className="relative flex-1">
                                <input
                                    ref={inputRef}
                                    id="outgoing-barcode"
                                    type="text"
                                    value={barcode}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    readOnly={!isListening}
                                    className={`w-full h-11 border rounded-xl pl-3.5 pr-28 text-sm font-mono transition-all focus:outline-none focus:ring-2 ${isListening
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-emerald-500 ring-2 ring-emerald-500/20 focus:border-emerald-500'
                                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                        }`}
                                    placeholder={isListening ? "Scanning barcodes..." : "Click Start to enable scanning"}
                                    disabled={isScanning}
                                    autoFocus
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />

                                <span
                                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors ${isListening
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                                            }`}
                                    />
                                    {isListening ? (isScanning ? 'processing...' : 'listening') : 'paused'}
                                </span>
                            </div>

                            <div className="flex shrink-0 gap-2.5">
                                <AppButton
                                    type="button"
                                    variant={isListening ? "warning" : "success"}
                                    size="lg"
                                    onClick={isListening ? handleStopListening : handleStartListening}
                                >
                                    {isListening ? (
                                        <i className="fas fa-pause text-xs" />
                                    ) : (
                                        <i className="fas fa-play text-xs" />
                                    )}
                                    <span>{isListening ? 'Pause' : 'Start'}</span>
                                </AppButton>

                                <AppButton
                                    type="button"
                                    variant="pink"
                                    size="lg"
                                    onClick={() => setShowScanner(true)}
                                >
                                    <i className="fas fa-camera text-xs" />
                                    <span>Camera</span>
                                </AppButton>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {!isListening && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 rounded-md font-medium">
                                    <svg className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Click <strong className="font-semibold">Start</strong> to enable scanning mode
                                </span>
                            )}

                            {selectedDriver && isListening && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 rounded-md font-medium">
                                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Assigning to: <strong className="font-semibold">{selectedDriver}</strong>
                                </span>
                            )}

                            {bulkQrCode ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 rounded-md font-medium">
                                    <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    Bulk QR: <strong className="font-mono">{bulkQrCode}</strong> ({bulkScannedCount} parcels)
                                </span>
                            ) : (
                                isListening && (
                                    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                                        <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                        Showing all ready parcels
                                    </span>
                                )
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="flex items-center gap-1">
                                1. Scan barcode to mark <span className="font-semibold text-slate-700 dark:text-slate-300 ml-1">Ready</span>
                            </span>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                            <span className="flex items-center gap-1 text-pink-600 dark:text-pink-400 font-medium">
                                2. Dispatch (Picked up)
                            </span>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                Bulk QR format: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300">BULK-XXXX</code>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:flex lg:flex-col lg:justify-center">
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-xl flex flex-col justify-between">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                            Total
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                            {stats.total}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm dark:shadow-none overflow-hidden text-slate-900 dark:text-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold select-none">
                            <tr>
                                <th className="p-3.5 pl-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={(input) => {
                                            if (input) {
                                                input.indeterminate = someSelected;
                                            }
                                        }}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500/20 focus:ring-2 cursor-pointer transition-colors"
                                    />
                                </th>
                                <th className="p-3.5 w-10 text-slate-400 dark:text-slate-500">#</th>
                                <th className="p-3.5">Barcode</th>
                                <th className="p-3.5">Tracking</th>
                                <th className="p-3.5">Courier</th>
                                <th className="p-3.5">Destination</th>
                                <th className="p-3.5">Driver</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 pr-4 text-right! w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <svg className="w-6 h-6 text-pink-500 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Loading parcels...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : parcels.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-slate-600 dark:text-slate-200 font-semibold text-sm">No parcels ready for pickup</p>
                                                <p className="text-slate-400 dark:text-slate-400 text-xs mt-0.5">
                                                    {bulkQrCode ? `No parcels found with bulk QR: ${bulkQrCode}` : 'Scan barcodes to mark parcels as ready'}
                                                </p>
                                            </div>
                                            {bulkQrCode && (
                                                <button
                                                    onClick={clearBulkFilter}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/50 text-pink-600 dark:text-pink-400 font-semibold text-xs transition-colors cursor-pointer"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Show all parcels
                                                </button>
                                            )}
                                            {selectedDriver && !bulkQrCode && (
                                                <button
                                                    onClick={clearDriverFilter}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-semibold text-xs transition-colors cursor-pointer"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Clear driver filter
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                parcels.map((parcel, index) => {
                                    const isSelected = selectedIds.has(parcel.id);
                                    return (
                                        <tr
                                            key={parcel.id}
                                            className={`transition-colors ${isSelected
                                                ? 'bg-pink-50/40 dark:bg-pink-950/20 hover:bg-pink-50/70 dark:hover:bg-pink-950/35'
                                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                                                }`}
                                        >
                                            <td className="p-3.5 pl-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelect(parcel.id)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500/20 focus:ring-2 cursor-pointer transition-colors"
                                                />
                                            </td>
                                            <td className="p-3.5 font-bold text-slate-400 dark:text-slate-500">{index + 1}</td>
                                            <td className="p-3.5">
                                                <div className="inline-flex items-center gap-1.5 font-mono text-slate-900 dark:text-slate-100 font-semibold">
                                                    <span>{parcel.barcode}</span>
                                                    {parcel.bulk_qr_code && (
                                                        <span
                                                            className="inline-flex items-center p-1 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50"
                                                            title={`Bulk QR: ${parcel.bulk_qr_code}`}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{parcel.tracking_number}</td>
                                            <td className="p-3.5">
                                                <StatusBadge
                                                    tone="pink"
                                                    icon={<i className="fas fa-truck text-[10px]" />}
                                                    size="xs"
                                                >
                                                    {getCourierDisplay(parcel.courier, parcel.courier_id)}
                                                </StatusBadge>
                                            </td>
                                            <td className="p-3.5 text-slate-600 dark:text-slate-300">{parcel.destination || 'N/A'}</td>
                                            <td className="p-3.5">
                                                {parcel.driver_name ? (
                                                    <StatusBadge
                                                        tone="emerald"
                                                        icon={<i className="fas fa-id-badge text-[10px]" />}
                                                        size="xs"
                                                    >
                                                        {parcel.driver_name}
                                                    </StatusBadge>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="p-3.5">
                                                {renderStatusBadge(parcel.status)}
                                            </td>
                                            <td className="p-3.5 pr-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <CrudActionButton
                                                        action="custom"
                                                        icon={Send}
                                                        label="Dispatch"
                                                        title="Dispatch (Picked Up)"
                                                        ariaLabel={`Dispatch parcel ${parcel.barcode}`}
                                                        onClick={() => handleSingleDispatch(parcel.id, parcel.barcode)}
                                                    />
                                                    <CrudActionButton
                                                        action="restore"
                                                        label="Revert"
                                                        title="Move back to received"
                                                        ariaLabel={`Move parcel ${parcel.barcode} back to received`}
                                                        onClick={() => handleRemoveFromReady(parcel.id, parcel.barcode)}
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

                <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Showing {parcels.length} of {stats.total} parcel(s) ready for pickup</span>
                        {bulkQrCode && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
                                filtered by bulk QR
                            </span>
                        )}
                        {selectedDriver && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
                                filtered by driver
                            </span>
                        )}
                        {!hasActiveFilter && (
                            <span className="text-slate-400 dark:text-slate-500">(all ready parcels)</span>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => handlePageChange(page - 1)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Prev
                            </button>

                            <span className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-xs font-bold shadow-sm shadow-pink-500/20">
                                {page}
                            </span>

                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => handlePageChange(page + 1)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                                Next
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs transition-all hover:bg-slate-50"
                    onClick={() => {
                        fetchParcels();
                        if (isListening && inputRef.current) {
                            setTimeout(() => inputRef.current?.focus(), 100);
                        }
                    }}
                >
                    <i className="fas fa-sync-alt mr-1"></i> Refresh
                </button>
            </div>

            <BarcodeScanner
                isOpen={showScanner}
                onScan={processBarcode}
                onClose={() => {
                    setShowScanner(false);
                    if (isListening && inputRef.current) {
                        setTimeout(() => inputRef.current?.focus(), 200);
                    }
                }}
            />
        </div>
    );
}