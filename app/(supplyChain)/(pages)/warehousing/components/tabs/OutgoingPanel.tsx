"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import { sanitizeBarcode } from "../../../../components/global/sanitize";
import { useConfirm } from "../../../../components/ui/ConfirmModal";
import BarcodeScanner from "../client/outgoing/BarcodeScanner";
import { useUserRole } from "../../../../components/global/UnauthorizedEmptyState";
import { user } from "../../../../lib/services/Class/user";
import { CrudActionButton } from "../../../../components/ui/CrudActionButton";
import { AppButton } from "../../../../components/ui/AppButton";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { TableRowsSkeleton } from "../../../../components/ui/SkeletonLoader";
import { Pagination } from "../../../../components/global/pagination";
import { Send, X, Check, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    destination: string | null;
    courier: string | null;
    courier_id: number | null;
    city?: string | null;
    status: string;
    created_at: string;
    bulk_qr_code?: string | null;
    bulk_qr_city?: string | null;
    bulk_qr_courier?: string | null;
    driver_name?: string | null;
    scanned_by?: string | null;
}

interface Courier {
    id: number;
    code: string;
    name: string;
}

const FALLBACK_DRIVERS = [
    "MAGAT, ROSANT CARLO",
    "MANAAY, ANTHONY",
    "MELENCION, JAMES",
    "NUEVAS, KENNETH",
];

export default function OutgoingPanel({ isVisible = true }) {
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');
    const { role: userRole, userId: currentUserId, isPrivileged, isLoaded } = useUserRole();
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [barcode, setBarcode] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [isListening, setIsListening] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkQrCode, setBulkQrCode] = useState<string | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string>("");
    const [driverList, setDriverList] = useState<string[]>(FALLBACK_DRIVERS);
    const [driverEmailMap, setDriverEmailMap] = useState<Record<string, string>>({});
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [driverSearchTerm, setDriverSearchTerm] = useState("");
    const [debouncedDriverSearch, setDebouncedDriverSearch] = useState("");
    const [isDriverDebouncing, setIsDriverDebouncing] = useState(false);
    const [driverPage, setDriverPage] = useState(1);
    const [mounted, setMounted] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [stats, setStats] = useState({ total: 0 });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [bulkScannedCount, setBulkScannedCount] = useState(0);
    const limit = 10;
    const driversPerPage = 4;
    const inputRef = useRef<HTMLInputElement>(null);
    const driverSelectRef = useRef<HTMLSelectElement>(null);
    const { confirm } = useConfirm();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Debounce driver search input
    useEffect(() => {
        if (!driverSearchTerm) {
            setDebouncedDriverSearch("");
            setIsDriverDebouncing(false);
            return;
        }
        setIsDriverDebouncing(true);
        const timer = setTimeout(() => {
            setDebouncedDriverSearch(driverSearchTerm);
            setIsDriverDebouncing(false);
        }, 250);
        return () => clearTimeout(timer);
    }, [driverSearchTerm]);

    // Filter and paginate drivers
    const filteredDrivers = useMemo(() => {
        const query = debouncedDriverSearch.toLowerCase().trim();
        if (!query) return driverList;
        return driverList.filter(d => d.toLowerCase().includes(query));
    }, [driverList, debouncedDriverSearch]);

    // Reset driverPage when search changes
    useEffect(() => {
        setDriverPage(1);
    }, [debouncedDriverSearch]);

    const totalDriverPages = Math.max(1, Math.ceil(filteredDrivers.length / driversPerPage));
    const displayedDrivers = useMemo(() => {
        const startIndex = (driverPage - 1) * driversPerPage;
        return filteredDrivers.slice(startIndex, startIndex + driversPerPage);
    }, [filteredDrivers, driverPage, driversPerPage]);

    const handleOpenDriverSelect = () => {
        setShowDriverModal(true);
    };

    const handleSelectDriverFromModal = (driver: string) => {
        setSelectedDriver(driver);
        setShowDriverModal(false);
        setPage(1);
        toast.success(`Driver selected: ${driver}`, { duration: 2500 });
        if (isListening && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    };

    // Auto-focus input when tab is outgoing and scanner is listening
    useEffect(() => {
        if ((currentTab === 'outgoing' || isVisible) && isListening && !isScanning && !showScanner && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentTab, isVisible, isListening, isScanning, showScanner]);

    // Keep focus when window gains focus
    useEffect(() => {
        const handleWindowFocus = () => {
            if ((currentTab === 'outgoing' || isVisible) && isListening && !isScanning && !showScanner && inputRef.current) {
                inputRef.current?.focus();
            }
        };
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [currentTab, isVisible, isListening, isScanning, showScanner]);

    useEffect(() => {
        const fetchCouriers = async () => {
            try {
                const res = await fetch('/api/couriers');
                if (res.ok) {
                    const data = await res.json();
                    setCouriers(data);
                }
            } catch (err) {
                console.warn('Failed to load couriers from /api/couriers:', err);
            }
        };
        fetchCouriers();
    }, []);

    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                const { data, error } = await supabase
                    .from('mock_employees')
                    .select('id, display_name, email, position, department, role');

                if (!error && data && data.length > 0) {
                    const drivers = data.filter((emp: any) => {
                        const pos = (emp.position || '').toLowerCase();
                        const dept = (emp.department || '').toLowerCase();
                        const role = (emp.role || '').toLowerCase();
                        return (
                            pos.includes('rider') ||
                            pos.includes('driver') ||
                            pos.includes('drop-off') ||
                            pos.includes('pick-up') ||
                            dept.includes('rider') ||
                            dept.includes('driver') ||
                            role.includes('rider') ||
                            role.includes('driver')
                        );
                    });

                    const emailMap: Record<string, string> = {};
                    const driverNames = drivers
                        .map((emp: any) => {
                            const name = (emp.display_name || '').trim();
                            if (name && emp.email) {
                                emailMap[name] = emp.email.trim();
                            }
                            return name;
                        })
                        .filter(Boolean);

                    setDriverEmailMap(emailMap);

                    if (driverNames.length > 0) {
                        const uniqueDrivers = Array.from(new Set([...driverNames, ...FALLBACK_DRIVERS]));
                        setDriverList(uniqueDrivers);
                    }
                }
            } catch (err) {
                console.warn('Failed to load drivers from mock_employees:', err);
            }
        };
        fetchDrivers();
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

    const fetchParcels = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }

            const offset = (page - 1) * limit;

            let query = supabase
                .from('parcels')
                .select('*', { count: 'exact' })
                .eq('status', 'ready_for_pickup')
                .order('created_at', { ascending: false });

            if (!isPrivileged && currentUserId) {
                query = query.eq('scanned_by', currentUserId);
            }

            if (bulkQrCode) {
                query = query.or(`bulk_qr_code.eq.${bulkQrCode},bulk_qr_city.eq.${bulkQrCode},bulk_qr_courier.eq.${bulkQrCode}`);
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
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [bulkQrCode, selectedDriver, page, limit, isPrivileged, currentUserId]);

    useEffect(() => {
        fetchParcels(true);

        const subscription = supabase
            .channel('outgoing_tab_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'parcels',
            }, () => {
                fetchParcels(false);
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchParcels, isLoaded]);

    const processBarcode = async (barcodeValue: string) => {
        const sanitized = sanitizeBarcode(barcodeValue);
        if (!sanitized || isScanning) return;

        if (!selectedDriver) {
            toast.warning('Please select a Driver before scanning parcels.');
            handleOpenDriverSelect();
            setBarcode("");
            return;
        }

        setIsScanning(true);
        const toastId = toast.loading('Processing barcode...');

        try {
            if (sanitized.startsWith('BULK-')) {
                const { data: bulkParcels, error: bulkError } = await supabase
                    .from('parcels')
                    .select('*')
                    .or(`bulk_qr_code.eq.${sanitized},bulk_qr_city.eq.${sanitized},bulk_qr_courier.eq.${sanitized}`)
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
                await fetchParcels(false);
                setIsScanning(false);

                if (isListening && inputRef.current) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                }
                return;
            }

            const { data: parcel, error: findError } = await supabase
                .from('parcels')
                .select('*')
                .or(`barcode.eq.${sanitized},tracking_number.eq.${sanitized}`)
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

                const { data: updatedData, error: updateError } = await supabase
                    .from('parcels')
                    .update(updateData)
                    .eq('id', parcel.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Update error:', updateError);
                    throw updateError;
                }

                // Add to table instantly without full refresh
                const updatedParcel = updatedData || { ...parcel, ...updateData };
                setParcels(prev => {
                    const withoutCurrent = prev.filter(p => p.id !== parcel.id);
                    return [updatedParcel, ...withoutCurrent];
                });
                setStats(prev => ({ total: prev.total + (parcel.status !== 'ready_for_pickup' ? 1 : 0) }));

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
            await fetchParcels(false);

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
            if (!selectedDriver) {
                toast.warning('Please select a Driver before scanning parcels.');
                handleOpenDriverSelect();
                return;
            }
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
        if (!selectedDriver) {
            toast.warning('Please select a Driver before scanning parcels.');
            handleOpenDriverSelect();
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

            const dispatchedParcelsData = parcels.filter(p => idsToDispatch.includes(p.id));
            const currentDispatcherName = user.getName() || 'Warehouse Staff';
            const currentDispatcherEmail = user.getEmail() || 'supplychain.airshipexpress@gmail.com';
            const currentDispatcherRole = user.getRole() || 'Staff';

            // Send dispatch manifest email with Excel attachment via Brevo and insert in-app notifications
            try {
                fetch('/api/supplyChain/dispatch-manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        driverName: selectedDriver || 'Assigned Driver',
                        driverEmail: selectedDriver ? driverEmailMap[selectedDriver] : undefined,
                        parcelIds: idsToDispatch,
                        parcels: dispatchedParcelsData,
                        dispatcherName: currentDispatcherName,
                        dispatcherEmail: currentDispatcherEmail,
                        dispatcherRole: currentDispatcherRole
                    })
                }).then(async res => {
                    const data = await res.json();
                    if (data.success) {
                        if (data.recipients && data.recipients.length > 0) {
                            toast.success(`Manifest emailed to driver (${data.recipients.join(', ')})`, { duration: 4000 });
                        } else {
                            toast.info(`Manifest generated & notification dispatched`, { duration: 3000 });
                        }
                    }
                }).catch(err => {
                    console.warn('Dispatch manifest email notification error:', err);
                });
            } catch (emailErr) {
                console.warn('Could not trigger dispatch manifest email:', emailErr);
            }

            toast.success(`Successfully dispatched ${idsToDispatch.length} parcels${selectedDriver ? ` to ${selectedDriver}` : ''}`, {
                id: toastId,
                duration: 3000,
            });

            setSelectedIds(new Set());
            await fetchParcels(false);

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
            await fetchParcels(false);

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
            await fetchParcels(false);

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

            const singleParcel = parcels.find(p => p.id === parcelId) || { id: parcelId, barcode };
            const currentDispatcherName = user.getName() || 'Warehouse Staff';
            const currentDispatcherEmail = user.getEmail() || 'supplychain.airshipexpress@gmail.com';
            const currentDispatcherRole = user.getRole() || 'Staff';

            // Send dispatch manifest email with Excel attachment via Brevo and insert in-app notifications
            try {
                fetch('/api/supplyChain/dispatch-manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        driverName: selectedDriver || 'Assigned Driver',
                        driverEmail: selectedDriver ? driverEmailMap[selectedDriver] : undefined,
                        parcelIds: [parcelId],
                        parcels: [singleParcel],
                        dispatcherName: currentDispatcherName,
                        dispatcherEmail: currentDispatcherEmail,
                        dispatcherRole: currentDispatcherRole
                    })
                }).then(async res => {
                    const data = await res.json();
                    if (data.success) {
                        if (data.recipients && data.recipients.length > 0) {
                            toast.success(`Manifest emailed to driver (${data.recipients.join(', ')})`, { duration: 3500 });
                        } else {
                            toast.info(`Manifest generated & notification dispatched`, { duration: 3000 });
                        }
                    }
                }).catch(err => {
                    console.warn('Single dispatch manifest email notification error:', err);
                });
            } catch (emailErr) {
                console.warn('Could not trigger dispatch manifest email:', emailErr);
            }

            toast.success(`Parcel ${barcode} dispatched${selectedDriver ? ` to ${selectedDriver}` : ''}`);
            await fetchParcels(false);

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
        fetchParcels(false);
        if (isListening && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const clearDriverFilter = () => {
        setSelectedDriver("");
        toast.info('Driver filter cleared', { duration: 2000 });
        fetchParcels(false);
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

            <div className={`flex flex-wrap items-center gap-3 p-4 bg-[#f0f3f8] dark:bg-[#191a24] rounded-2xl border transition-all ${
                !selectedDriver
                    ? 'border-amber-400/80 dark:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'border-white/80 dark:border-[#2c2d3c] shadow-[4px_4px_10px_rgba(166,175,195,0.3),-4px_-4px_10px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5),-2px_-2px_6px_rgba(255,255,255,0.03)]'
            }`}>
                <label htmlFor="assign-driver-select" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fas fa-truck text-pink-500 dark:text-pink-400"></i>
                    Assign Driver:
                </label>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            ref={driverSelectRef}
                            id="assign-driver-select"
                            value={selectedDriver}
                            onChange={(e) => {
                                setSelectedDriver(e.target.value);
                                setPage(1);
                                if (e.target.value) {
                                    toast.success(`Driver selected: ${e.target.value}`, { duration: 2000 });
                                } else {
                                    toast.info('Driver filter cleared', { duration: 2000 });
                                }
                                if (isListening && inputRef.current) {
                                    setTimeout(() => inputRef.current?.focus(), 100);
                                }
                            }}
                            className={`appearance-none bg-[#ebf0f7] dark:bg-[#14151c] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] transition-all cursor-pointer min-w-[200px] border ${
                                !selectedDriver
                                    ? 'border-amber-500/80 dark:border-amber-500/70 ring-2 ring-amber-500/20'
                                    : 'border-slate-200/60 dark:border-slate-800'
                            }`}
                        >
                            <option value="" className="dark:bg-slate-900 text-slate-400">-- Select Driver --</option>
                            {driverList.map((driver) => (
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

                    <button
                        type="button"
                        onClick={handleOpenDriverSelect}
                        className="px-2.5 py-2 bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Browse & Select Driver"
                    >
                        <i className="fas fa-list text-[11px] text-pink-500" />
                        <span>Browse</span>
                    </button>
                </div>

                {!selectedDriver ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-300/80 dark:border-amber-800/60 text-xs font-bold text-amber-700 dark:text-amber-400 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Driver required before scanning
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        Driver: {selectedDriver}
                    </span>
                )}

                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1 font-medium">
                    <i className="fas fa-info-circle"></i>
                    <span>Driver assigned to outgoing parcels</span>
                </span>
            </div>

            <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-900 dark:text-slate-100">
                <div className="lg:col-span-2 space-y-4">
                    {!selectedDriver && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                            <div className="flex items-center gap-2.5">
                                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                                    <i className="fas fa-exclamation-triangle text-xs" />
                                </span>
                                <div className="text-xs">
                                    <strong className="font-semibold block">Driver Selection Required Before Scanning</strong>
                                    <span className="text-amber-700/90 dark:text-amber-400/90 text-[11px]">
                                        Please assign a Driver above before scanning outgoing parcels.
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenDriverSelect}
                                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <i className="fas fa-truck text-xs" />
                                <span>Select Driver</span>
                            </button>
                        </div>
                    )}

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
                                <i
                                    className={`fas fa-barcode absolute left-3.5 top-1/2 -translate-y-1/2 text-sm transition-colors ${
                                        !selectedDriver ? 'text-amber-500' : isListening ? 'text-emerald-500' : 'text-slate-400'
                                    }`}
                                    aria-hidden="true"
                                />
                                <input
                                    ref={inputRef}
                                    id="outgoing-barcode"
                                    type="text"
                                    value={barcode}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    readOnly={!isListening || isScanning}
                                    className={`w-full rounded-2xl border py-3 pl-10 pr-28 text-sm font-mono text-slate-800 dark:text-slate-200 transition-all outline-hidden bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] ${
                                        !selectedDriver
                                            ? 'border-amber-400/80 dark:border-amber-500/70 focus:border-amber-500'
                                            : isListening
                                                ? 'border-emerald-500/80 dark:border-emerald-600/80'
                                                : 'border-slate-300/60 dark:border-slate-800/60'
                                    } ${isScanning ? 'cursor-wait opacity-75' : ''}`}
                                    placeholder={
                                        !selectedDriver
                                            ? "Select a Driver before scanning..."
                                            : isListening
                                                ? "Scan barcode or type and press Enter..."
                                                : "Click Start to enable scanning mode"
                                    }
                                    disabled={isScanning}
                                    autoFocus
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />

                                <span
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-colors ${
                                        !selectedDriver
                                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/80 dark:border-amber-800/60'
                                            : isListening
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            !selectedDriver
                                                ? 'bg-amber-500 animate-pulse'
                                                : isListening
                                                    ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                                                    : 'bg-slate-400 dark:bg-slate-500'
                                        }`}
                                    />
                                    {!selectedDriver ? 'driver required' : isListening ? (isScanning ? 'processing...' : 'listening') : 'paused'}
                                </span>
                            </div>

                            <div className="flex shrink-0 gap-2.5">
                                <button
                                    type="button"
                                    onClick={isListening ? handleStopListening : handleStartListening}
                                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] active:scale-95 cursor-pointer ${
                                        isListening
                                            ? 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-amber-600 dark:text-amber-400 border border-white/70 dark:border-[#2a2b38] hover:border-amber-300'
                                            : 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border border-emerald-400/80 shadow-[0_4px_14px_rgba(16,185,129,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.5)]'
                                    }`}
                                >
                                    {isListening ? (
                                        <i className="fas fa-pause text-xs" />
                                    ) : (
                                        <i className="fas fa-play text-xs" />
                                    )}
                                    <span>{isListening ? 'Pause' : 'Start'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!selectedDriver) {
                                            toast.warning('Please select a Driver before opening camera scanner.');
                                            handleOpenDriverSelect();
                                            return;
                                        }
                                        setShowScanner(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer"
                                >
                                    <i className="fas fa-camera text-xs" />
                                    <span>Camera</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {!isListening && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-amber-700 dark:text-amber-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-full font-bold shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)]">
                                    <svg className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Click <strong className="font-semibold">Start</strong> to enable scanning mode
                                </span>
                            )}

                            {selectedDriver && isListening && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-emerald-700 dark:text-emerald-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-full font-bold shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)]">
                                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Assigning to: <strong className="font-semibold">{selectedDriver}</strong>
                                </span>
                            )}

                            {bulkQrCode ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-blue-700 dark:text-blue-400 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-full font-bold shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)]">
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

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
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
                    <div className="bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                            {stats.total}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] overflow-hidden text-slate-900 dark:text-slate-100">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="table-pro w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={(input) => {
                                            if (input) {
                                                input.indeterminate = someSelected;
                                            }
                                        }}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-transparent text-pink-500 focus:ring-pink-500/20 focus:ring-2 cursor-pointer transition-colors accent-pink-500"
                                    />
                                </th>
                                <th className="w-10 text-center">#</th>
                                <th>Barcode</th>
                                <th>Tracking</th>
                                <th>Courier</th>
                                <th>Destination</th>
                                <th>Driver</th>
                                <th>Status</th>
                                <th className="text-right! w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'mono', width: 'w-10' },
                                        { type: 'mono', width: 'w-36' },
                                        { type: 'mono', width: 'w-36' },
                                        { type: 'badge' },
                                        { type: 'text', width: 'w-36' },
                                        { type: 'badge' },
                                        { type: 'badge' },
                                        { type: 'actions', align: 'right', width: 'w-[130px]' },
                                    ]}
                                />
                            ) : parcels.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-0">
                                        <div className="w-full py-16 px-6 sm:px-12 bg-[#f0f3f8] dark:bg-[#191a24] border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col items-center justify-center text-center">
                                            <div className="w-full max-w-xl space-y-4">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] text-emerald-600 dark:text-emerald-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_3px_3px_7px_rgba(166,175,195,0.4),inset_-3px_-3px_7px_rgba(255,255,255,0.95)] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.06)] mx-auto animate-in zoom-in duration-300">
                                                    <Send className="w-7 h-7" />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <h4 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                        {bulkQrCode 
                                                            ? 'No Parcels for Bulk QR' 
                                                            : selectedDriver 
                                                            ? 'No Parcels for Driver' 
                                                            : 'No Outgoing Parcels Ready'}
                                                    </h4>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-md mx-auto">
                                                        {bulkQrCode 
                                                            ? `No parcels found matching bulk QR code: ${bulkQrCode}.` 
                                                            : selectedDriver 
                                                            ? `No pickup parcels currently assigned to ${selectedDriver}.` 
                                                            : 'Scan or enter a barcode above to prepare parcels for courier pickup and carrier dispatch.'}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                                    {bulkQrCode && (
                                                        <button
                                                            type="button"
                                                            onClick={clearBulkFilter}
                                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-800 dark:text-slate-200 border border-white/80 dark:border-[#2a2b38] font-bold text-xs shadow-[4px_4px_9px_rgba(166,175,195,0.35),-4px_-4px_9px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[2px_2px_4px_rgba(166,175,195,0.5),-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                                        >
                                                            <i className="fas fa-undo-alt text-xs" />
                                                            <span>Show All Parcels</span>
                                                        </button>
                                                    )}
                                                    {selectedDriver && !bulkQrCode && (
                                                        <button
                                                            type="button"
                                                            onClick={clearDriverFilter}
                                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-800 dark:text-slate-200 border border-white/80 dark:border-[#2a2b38] font-bold text-xs shadow-[4px_4px_9px_rgba(166,175,195,0.35),-4px_-4px_9px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[2px_2px_4px_rgba(166,175,195,0.5),-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                                        >
                                                            <i className="fas fa-times text-xs" />
                                                            <span>Clear Driver Filter</span>
                                                        </button>
                                                    )}
                                                    {!bulkQrCode && !selectedDriver && (
                                                        <button
                                                            type="button"
                                                            onClick={() => fetchParcels(true)}
                                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/80 dark:border-[#2a2b38] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold shadow-[4px_4px_9px_rgba(166,175,195,0.35),-4px_-4px_9px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[2px_2px_4px_rgba(166,175,195,0.5),-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                                        >
                                                            <i className="fas fa-sync-alt text-xs" />
                                                            <span>Refresh Outgoing</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
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
                                            <td data-label="Select" className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelect(parcel.id)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500/20 focus:ring-2 cursor-pointer transition-colors"
                                                />
                                            </td>
                                            <td data-label="#" className="text-center font-bold text-slate-400 dark:text-slate-500">{index + 1}</td>
                                            <td data-label="Barcode">
                                                <div className="flex flex-col gap-1">
                                                    <div className="inline-flex items-center gap-1.5 font-mono text-slate-900 dark:text-slate-100 font-semibold">
                                                        <span>{parcel.barcode}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {parcel.bulk_qr_code && (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 text-[10px] font-mono font-medium"
                                                                title={`Global Bulk QR: ${parcel.bulk_qr_code}`}
                                                            >
                                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                                </svg>
                                                                <span>{parcel.bulk_qr_code}</span>
                                                            </span>
                                                        )}
                                                        {parcel.bulk_qr_city && (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/50 text-[10px] font-mono font-medium"
                                                                title={`City Bulk QR: ${parcel.bulk_qr_city}`}
                                                            >
                                                                <i className="fas fa-city text-[8px]" />
                                                                <span>{parcel.bulk_qr_city}</span>
                                                            </span>
                                                        )}
                                                        {parcel.bulk_qr_courier && (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50 text-[10px] font-mono font-medium"
                                                                title={`Courier Bulk QR: ${parcel.bulk_qr_courier}`}
                                                            >
                                                                <i className="fas fa-truck-fast text-[8px]" />
                                                                <span>{parcel.bulk_qr_courier}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Tracking" className="font-mono text-slate-500 dark:text-slate-400">{parcel.tracking_number}</td>
                                            <td data-label="Courier">
                                                <StatusBadge
                                                    tone="pink"
                                                    icon={<i className="fas fa-truck text-[10px]" />}
                                                    size="xs"
                                                >
                                                    {getCourierDisplay(parcel.courier, parcel.courier_id)}
                                                </StatusBadge>
                                            </td>
                                            <td data-label="Destination" className="text-slate-600 dark:text-slate-300">{parcel.destination || 'N/A'}</td>
                                            <td data-label="Driver">
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
                                            <td data-label="Status">
                                                {renderStatusBadge(parcel.status)}
                                            </td>
                                            <td data-label="Actions" className="text-right whitespace-nowrap w-[130px] min-w-[130px]">
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

                <div className="flex-shrink-0 pagination-container-class p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
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

                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
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

            {/* Driver Selection Modal via Portal */}
            {showDriverModal && mounted && createPortal(
                <div 
                    className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowDriverModal(false);
                    }}
                >
                    <div className="bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-[8px_8px_30px_rgba(0,0,0,0.35)] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-white/60 dark:border-white/[0.06] flex items-center justify-between bg-[#EEF2F6] dark:bg-[#161A23]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-500/20">
                                    <i className="fas fa-truck text-sm" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-bricolage">
                                        Assign Driver
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                        Select a driver before scanning or dispatching
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDriverModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Input with Debounce Indicator */}
                        <div className="p-3.5 border-b border-white/60 dark:border-white/[0.06] bg-[#EEF2F6] dark:bg-[#161A23]">
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                    {isDriverDebouncing ? (
                                        <Loader2 size={15} className="animate-spin text-pink-500" />
                                    ) : (
                                        <Search size={15} />
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search driver by name..."
                                    value={driverSearchTerm}
                                    onChange={(e) => setDriverSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 text-xs bg-[#EAF0F6] dark:bg-[#13161F] border border-slate-200/60 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] transition-all"
                                    autoFocus
                                />
                                {driverSearchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setDriverSearchTerm("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>
                                    {filteredDrivers.length} driver{filteredDrivers.length === 1 ? '' : 's'} available
                                </span>
                                {totalDriverPages > 1 && (
                                    <span>
                                        Page {driverPage} of {totalDriverPages}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Paginated Driver List */}
                        <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
                            {displayedDrivers.map((driver) => {
                                const isSelected = selectedDriver === driver;
                                return (
                                    <button
                                        key={driver}
                                        type="button"
                                        onClick={() => handleSelectDriverFromModal(driver)}
                                        className={`w-full text-left p-3.5 rounded-2xl transition-all border flex items-center justify-between gap-3 cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#E2ECF6] dark:bg-[#192233] border-pink-500/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06)]'
                                                : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] hover:bg-[#E5EBF2] dark:hover:bg-[#151821] border-white/70 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.4)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                                                isSelected ? 'bg-pink-500 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                            }`}>
                                                <i className="fas fa-truck text-xs" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{driver}</div>
                                                <div className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">Drop-Off Pick-Up Driver</div>
                                            </div>
                                        </div>

                                        {isSelected ? (
                                            <span className="shrink-0 text-xs text-pink-600 dark:text-pink-400 font-bold flex items-center gap-1 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-pink-500/20">
                                                <Check size={14} />
                                                <span>Selected</span>
                                            </span>
                                        ) : (
                                            <span className="shrink-0 text-[11px] px-3 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold shadow-sm transition-all">
                                                Assign
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            {filteredDrivers.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400">
                                    No drivers found matching &quot;{driverSearchTerm}&quot;
                                </div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {totalDriverPages > 1 && (
                            <div className="px-4 py-2 border-t border-white/60 dark:border-white/[0.06] bg-[#EEF2F6] dark:bg-[#161A23] flex items-center justify-between">
                                <button
                                    type="button"
                                    disabled={driverPage <= 1}
                                    onClick={() => setDriverPage(p => Math.max(1, p - 1))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                                        driverPage <= 1
                                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                                            : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'
                                    }`}
                                >
                                    <ChevronLeft size={14} />
                                    <span>Previous</span>
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalDriverPages }, (_, i) => i + 1).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setDriverPage(p)}
                                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                driverPage === p
                                                    ? 'bg-pink-500 text-white shadow-sm'
                                                    : 'bg-slate-200/70 dark:bg-slate-800/70 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    disabled={driverPage >= totalDriverPages}
                                    onClick={() => setDriverPage(p => Math.min(totalDriverPages, p + 1))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                                        driverPage >= totalDriverPages
                                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                                            : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'
                                    }`}
                                >
                                    <span>Next</span>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-3.5 border-t border-white/60 dark:border-white/[0.06] bg-[#EEF2F6] dark:bg-[#161A23] flex items-center justify-between">
                            {selectedDriver ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedDriver("");
                                        setShowDriverModal(false);
                                        toast.info("Driver selection cleared");
                                    }}
                                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                    Clear Driver
                                </button>
                            ) : <div />}
                            <button
                                type="button"
                                onClick={() => setShowDriverModal(false)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}