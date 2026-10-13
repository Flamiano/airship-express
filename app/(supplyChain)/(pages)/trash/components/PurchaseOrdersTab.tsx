'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { supabase } from '../../../lib/services/client/supabase';
import { BulkActionsToolbar } from '../../../components/global/BulkActionsToolbar';
import { useDebounce } from '../../../hooks/useDebounce';
import { sanitizeSearch, sanitizeText, sanitizeNumber } from '../../../components/global/sanitize';
import { Pagination } from '../../../components/global/pagination';
import { TableContentLoader } from '../../../components/global/Loader';
import Cards from '../../../components/global/Cards';
import { CardsSkeleton, TableRowsSkeleton } from '../../../components/ui/SkeletonLoader';
import { CrudActionButton } from '../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AppButton } from '../../../components/ui/AppButton';
import { SearchableDropdown, SearchableDropdownOption } from '../../../components/ui/SearchableDropdown';
import { trashCache } from '../utils/trashCache';
import { TrashRetentionBadge } from './TrashRetentionBadge';
import {
    ArchivedPurchaseOrderViewModal,
    type ArchivedPurchaseOrder,
} from './ArchivedPurchaseOrderViewModal';

const ITEMS_PER_PAGE = 10;
const formatCurrency = (amount: number) => `₱${(amount || 0).toLocaleString()}`;

const formatArchivedPurchaseOrder = (po: any): ArchivedPurchaseOrder => ({
    id: po.id,
    po_number: sanitizeText(po.po_number),
    request_id: po.request_id,
    supplier_id: po.supplier_id ? sanitizeNumber(po.supplier_id) : null,
    supplier_name: sanitizeText(po.supplier_name),
    total_amount: sanitizeNumber(po.total_amount || 0),
    status: sanitizeText(po.status || 'Draft'),
    delivery_date: po.delivery_date,
    notes: po.notes ? sanitizeText(po.notes) : null,
    items: po.items || [],
    created_by: po.created_by ? sanitizeText(po.created_by) : null,
    created_at: po.created_at,
    updated_at: po.updated_at,
    deleted_at: po.deleted_at || new Date().toISOString(),
    deleted_by: sanitizeText(po.deleted_by || 'Unknown'),
    deletion_reason: po.deletion_reason ? sanitizeText(po.deletion_reason) : null,
    original_id: po.original_id || po.id,
    paid: Boolean(po.paid),
    fully_received: Boolean(po.fully_received),
    paid_verified_at: po.paid_verified_at,
    paid_verified_by: po.paid_verified_by,
    force_updated_by: po.force_updated_by,
    force_updated_at: po.force_updated_at,
    force_reason: po.force_reason ? sanitizeText(po.force_reason) : null,
    admin_approval: sanitizeText(po.admin_approval || 'Pending'),
    admin_approved_at: po.admin_approved_at,
    admin_approved_by: po.admin_approved_by,
    financial_approval: sanitizeText(po.financial_approval || 'Pending'),
    financial_approved_at: po.financial_approved_at,
    financial_approved_by: po.financial_approved_by,
    delivery_location: po.delivery_location ? sanitizeText(po.delivery_location) : null,
    payment_terms: po.payment_terms ? sanitizeText(po.payment_terms) : null,
    terms_and_conditions: po.terms_and_conditions ? sanitizeText(po.terms_and_conditions) : null,
    subtotal: sanitizeNumber(po.subtotal || 0),
    discount: sanitizeNumber(po.discount || 0),
    tax_rate: sanitizeNumber(po.tax_rate || 0),
    tax_amount: sanitizeNumber(po.tax_amount || 0),
    shipping_fee: sanitizeNumber(po.shipping_fee || 0),
    category: po.category ? sanitizeText(po.category) : null,
    suppliers_qoutation_bid: po.suppliers_qoutation_bid ? sanitizeNumber(po.suppliers_qoutation_bid) : null,
});

export function PurchaseOrdersTab() {
    const { confirm } = useConfirm();

    const [archivedPurchaseOrders, setArchivedPurchaseOrders] = useState<ArchivedPurchaseOrder[]>(() => {
        return trashCache.get<ArchivedPurchaseOrder>('purchase_orders') || [];
    });
    const [poLoading, setPoLoading] = useState<boolean>(() => {
        return !trashCache.get('purchase_orders');
    });
    const [poSearchTerm, setPoSearchTerm] = useState('');
    const [poStatusFilter, setPoStatusFilter] = useState('all');
    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
    const [poPage, setPoPage] = useState(1);
    const [poTotalPages, setPoTotalPages] = useState(1);
    const [selectedViewPo, setSelectedViewPo] = useState<ArchivedPurchaseOrder | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedPoSearchTerm = useDebounce(poSearchTerm, 300);

    const fetchArchivedPurchaseOrders = useCallback(async (force = false) => {
        const cached = trashCache.get<ArchivedPurchaseOrder>('purchase_orders');
        if (cached && !force && !trashCache.isStale('purchase_orders')) {
            setArchivedPurchaseOrders(cached);
            setPoTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
            setPoLoading(false);
            return;
        }

        if (!cached || cached.length === 0) {
            setPoLoading(true);
        }

        try {
            const { data, error } = await supabase
                .from('purchase_orders_archive')
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) throw error;

            const transformedData: ArchivedPurchaseOrder[] = (data || []).map(formatArchivedPurchaseOrder);

            trashCache.set('purchase_orders', transformedData);
            setArchivedPurchaseOrders(transformedData);
            setPoTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived purchase orders:', error);
            toast.error('Failed to load archived purchase orders');
        } finally {
            setPoLoading(false);
        }
    }, []);

    const handleRestorePurchaseOrder = async (po: ArchivedPurchaseOrder) => {
        const confirmed = await confirm({
            title: 'Restore Purchase Order',
            message: `Are you sure you want to restore "${sanitizeText(po.po_number)}" to active purchase orders?`,
            confirmText: 'Restore',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                // Check if an active purchase order with the same po_number already exists
                const { data: existingActive } = await supabase
                    .from('purchase_orders')
                    .select('id, po_number')
                    .eq('po_number', po.po_number)
                    .maybeSingle();

                if (existingActive) {
                    setPoLoading(false);
                    const shouldOverwrite = await confirm({
                        title: 'Active Purchase Order Already Exists',
                        message: `An active purchase order with PO Number "${sanitizeText(po.po_number)}" is already active in Procurement/Purchase Orders.\n\nDo you want to overwrite the active purchase order with this archived record?`,
                        confirmText: 'Overwrite Active',
                        cancelText: 'Cancel',
                        confirmVariant: 'warning'
                    });

                    if (!shouldOverwrite) {
                        toast.info(`Restore cancelled: active purchase order "${sanitizeText(po.po_number)}" already exists.`);
                        return;
                    }

                    setPoLoading(true);
                    const { error: updateError } = await supabase
                        .from('purchase_orders')
                        .update({
                            request_id: po.request_id,
                            supplier_id: po.supplier_id,
                            supplier_name: po.supplier_name,
                            total_amount: po.total_amount,
                            status: po.status,
                            delivery_date: po.delivery_date,
                            notes: po.notes,
                            items: po.items,
                            created_by: po.created_by,
                            paid: po.paid ?? false,
                            fully_received: po.fully_received ?? false,
                            admin_approval: po.admin_approval,
                            financial_approval: po.financial_approval,
                            delivery_location: po.delivery_location,
                            payment_terms: po.payment_terms,
                            terms_and_conditions: po.terms_and_conditions,
                            subtotal: po.subtotal,
                            discount: po.discount,
                            tax_rate: po.tax_rate,
                            tax_amount: po.tax_amount,
                            shipping_fee: po.shipping_fee,
                            category: po.category,
                            suppliers_qoutation_bid: po.suppliers_qoutation_bid,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existingActive.id);

                    if (updateError) throw updateError;

                    const { error: deleteError } = await supabase
                        .from('purchase_orders_archive')
                        .delete()
                        .eq('id', po.id);

                    if (deleteError) throw deleteError;

                    trashCache.removeItem('purchase_orders', po.id);
                    setArchivedPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
                    setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - 1) / ITEMS_PER_PAGE));
                    setSelectedPoIds(prev => {
                        const updated = new Set(prev);
                        updated.delete(po.id);
                        return updated;
                    });
                    toast.success(`Active purchase order "${sanitizeText(po.po_number)}" updated with archived details`);
                    return;
                }

                const { error: insertError } = await supabase
                    .from('purchase_orders')
                    .insert({
                        id: po.original_id,
                        po_number: po.po_number,
                        request_id: po.request_id,
                        supplier_id: po.supplier_id,
                        supplier_name: po.supplier_name,
                        total_amount: po.total_amount,
                        status: po.status,
                        delivery_date: po.delivery_date,
                        notes: po.notes,
                        items: po.items,
                        created_by: po.created_by,
                        paid: po.paid ?? false,
                        fully_received: po.fully_received ?? false,
                        admin_approval: po.admin_approval,
                        financial_approval: po.financial_approval,
                        delivery_location: po.delivery_location,
                        payment_terms: po.payment_terms,
                        terms_and_conditions: po.terms_and_conditions,
                        subtotal: po.subtotal,
                        discount: po.discount,
                        tax_rate: po.tax_rate,
                        tax_amount: po.tax_amount,
                        shipping_fee: po.shipping_fee,
                        category: po.category,
                        suppliers_qoutation_bid: po.suppliers_qoutation_bid,
                        created_at: po.created_at,
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) {
                    if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
                        toast.error(`Cannot restore: An active purchase order with PO Number "${sanitizeText(po.po_number)}" already exists.`);
                        return;
                    }
                    throw insertError;
                }

                const { error: deleteError } = await supabase
                    .from('purchase_orders_archive')
                    .delete()
                    .eq('id', po.id);

                if (deleteError) throw deleteError;

                trashCache.removeItem('purchase_orders', po.id);
                setArchivedPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - 1) / ITEMS_PER_PAGE));
                setSelectedPoIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(po.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(po.po_number)}" restored successfully`);
            } catch (error: any) {
                if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
                    toast.error(`Cannot restore: An active purchase order with PO Number "${sanitizeText(po.po_number)}" already exists.`);
                } else {
                    toast.error('Failed to restore purchase order');
                }
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleDeletePurchaseOrderPermanently = async (po: ArchivedPurchaseOrder) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete "${sanitizeText(po.po_number)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                const { error } = await supabase
                    .from('purchase_orders_archive')
                    .delete()
                    .eq('id', po.id);

                if (error) throw error;

                trashCache.removeItem('purchase_orders', po.id);
                setArchivedPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - 1) / ITEMS_PER_PAGE));
                setSelectedPoIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(po.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(po.po_number)}" permanently deleted`);
            } catch (error) {
                toast.error('Failed to delete purchase order');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleBulkRestorePurchaseOrders = async () => {
        if (selectedPoIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedPoIds.size} Purchase Orders`,
            message: `Are you sure you want to restore ${selectedPoIds.size} purchase order(s) to active?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                const posToRestore = archivedPurchaseOrders.filter(po => selectedPoIds.has(po.id));
                const allPoNumbers = posToRestore.map(p => p.po_number).filter(Boolean);

                // Check which PO numbers already exist in active purchase orders
                const { data: existingActiveList } = await supabase
                    .from('purchase_orders')
                    .select('po_number')
                    .in('po_number', allPoNumbers);

                const activePoNumbers = new Set((existingActiveList || []).map(p => p.po_number));
                const seenInBatch = new Set<string>();
                const successfullyRestoredIds = new Set<string>();
                const skippedConflictPos: string[] = [];

                for (const po of posToRestore) {
                    if (activePoNumbers.has(po.po_number) || seenInBatch.has(po.po_number)) {
                        skippedConflictPos.push(po.po_number);
                        continue;
                    }

                    const { error: insertError } = await supabase
                        .from('purchase_orders')
                        .insert({
                            id: po.original_id,
                            po_number: po.po_number,
                            request_id: po.request_id,
                            supplier_id: po.supplier_id,
                            supplier_name: po.supplier_name,
                            total_amount: po.total_amount,
                            status: po.status,
                            delivery_date: po.delivery_date,
                            notes: po.notes,
                            items: po.items,
                            created_by: po.created_by,
                            paid: po.paid ?? false,
                            fully_received: po.fully_received ?? false,
                            admin_approval: po.admin_approval,
                            financial_approval: po.financial_approval,
                            delivery_location: po.delivery_location,
                            payment_terms: po.payment_terms,
                            terms_and_conditions: po.terms_and_conditions,
                            subtotal: po.subtotal,
                            discount: po.discount,
                            tax_rate: po.tax_rate,
                            tax_amount: po.tax_amount,
                            shipping_fee: po.shipping_fee,
                            category: po.category,
                            suppliers_qoutation_bid: po.suppliers_qoutation_bid,
                            created_at: po.created_at,
                            updated_at: new Date().toISOString(),
                        });

                    if (insertError) {
                        console.error('Insert error for PO:', po.po_number, insertError);
                        skippedConflictPos.push(po.po_number);
                        continue;
                    }

                    await supabase
                        .from('purchase_orders_archive')
                        .delete()
                        .eq('id', po.id);

                    seenInBatch.add(po.po_number);
                    successfullyRestoredIds.add(po.id);
                }

                if (successfullyRestoredIds.size > 0) {
                    trashCache.removeItems('purchase_orders', successfullyRestoredIds);
                    setArchivedPurchaseOrders(prev => prev.filter(po => !successfullyRestoredIds.has(po.id)));
                    setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - successfullyRestoredIds.size) / ITEMS_PER_PAGE));
                    toast.success(`${successfullyRestoredIds.size} purchase order(s) restored successfully!`);
                }

                if (skippedConflictPos.length > 0) {
                    toast.warning(
                        `Skipped ${skippedConflictPos.length} purchase order(s) because an active PO already exists: ${skippedConflictPos.join(', ')}`,
                        { duration: 7000 }
                    );
                }

                setSelectedPoIds(new Set());
            } catch (error) {
                toast.error('Failed to restore purchase orders');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleBulkDeletePurchaseOrders = async () => {
        if (selectedPoIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedPoIds.size} Purchase Orders Permanently`,
            message: `Are you sure you want to permanently delete ${selectedPoIds.size} purchase order(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                for (const poId of selectedPoIds) {
                    await supabase
                        .from('purchase_orders_archive')
                        .delete()
                        .eq('id', poId);
                }

                trashCache.removeItems('purchase_orders', selectedPoIds);
                setArchivedPurchaseOrders(prev => prev.filter(po => !selectedPoIds.has(po.id)));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - selectedPoIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedPoIds.size} purchase order(s) permanently deleted.`);
                setSelectedPoIds(new Set());
            } catch (error) {
                toast.error('Failed to delete purchase orders');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const formatDate = (dateString: string) => {
        if (!isMounted) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = useCallback((status: string) => {
        const sanitizedStatus = sanitizeText(status);
        const toneMap: Record<string, 'neutral' | 'indigo' | 'purple' | 'pink' | 'rose'> = {
            'Draft': 'neutral',
            'Sent': 'indigo',
            'Confirmed': 'purple',
            'Delivered': 'pink',
            'Cancelled': 'rose',
        };
        const tone = toneMap[sanitizedStatus] || 'neutral';
        return (
            <StatusBadge tone={tone} dot size="xs">
                {sanitizedStatus.charAt(0).toUpperCase() + sanitizedStatus.slice(1).replace(/_/g, ' ')}
            </StatusBadge>
        );
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPoSearchTerm(sanitizeSearch(e.target.value));
    };

    const filteredPurchaseOrders = useMemo(() => {
        const search = sanitizeSearch(debouncedPoSearchTerm);
        return archivedPurchaseOrders.filter(po => {
            const matchesSearch = po.po_number.toLowerCase().includes(search.toLowerCase()) ||
                po.supplier_name.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = poStatusFilter === 'all' || po.status === poStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [archivedPurchaseOrders, debouncedPoSearchTerm, poStatusFilter]);

    const paginatedPurchaseOrders = useMemo(() => {
        const startIndex = (poPage - 1) * ITEMS_PER_PAGE;
        return filteredPurchaseOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredPurchaseOrders, poPage]);

    const poStatuses = useMemo(() => ['all', ...Array.from(new Set(archivedPurchaseOrders.map(po => po.status)))], [archivedPurchaseOrders]);
    const statusOptions: SearchableDropdownOption[] = useMemo(() => {
        return poStatuses
            .filter(status => status !== 'all')
            .map(status => ({
                value: status,
                label: status.charAt(0).toUpperCase() + status.slice(1),
                icon: 'fas fa-info-circle',
            }));
    }, [poStatuses]);
    const isAllPoSelected = filteredPurchaseOrders.length > 0 && selectedPoIds.size === filteredPurchaseOrders.length;

    useEffect(() => {
        setPoTotalPages(Math.max(1, Math.ceil(filteredPurchaseOrders.length / ITEMS_PER_PAGE)));
        if (poPage > Math.ceil(filteredPurchaseOrders.length / ITEMS_PER_PAGE)) {
            setPoPage(1);
        }
    }, [filteredPurchaseOrders.length, poPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedPurchaseOrders();

        // Realtime subscription for purchase_orders_archive
        const channelName = `realtime_trash_po_tab_${Date.now()}`;
        const poChannel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'purchase_orders_archive' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newPo = formatArchivedPurchaseOrder(payload.new);
                        setArchivedPurchaseOrders(prev => {
                            if (prev.some(p => p.id === newPo.id)) return prev;
                            const updated = [newPo, ...prev];
                            trashCache.set('purchase_orders', updated);
                            return updated;
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedPo = formatArchivedPurchaseOrder(payload.new);
                        setArchivedPurchaseOrders(prev => {
                            const updated = prev.map(p => p.id === updatedPo.id ? updatedPo : p);
                            trashCache.set('purchase_orders', updated);
                            return updated;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old?.id;
                        if (deletedId) {
                            setArchivedPurchaseOrders(prev => {
                                const updated = prev.filter(p => p.id !== deletedId);
                                trashCache.set('purchase_orders', updated);
                                return updated;
                            });
                            setSelectedPoIds(prev => {
                                if (prev.has(deletedId)) {
                                    const updated = new Set(prev);
                                    updated.delete(deletedId);
                                    return updated;
                                }
                                return prev;
                            });
                        }
                    }
                }
            )
            .subscribe();

        const unsubscribe = trashCache.subscribe((key, action) => {
            if (!key || key === 'purchase_orders') {
                if (action === 'force-refresh' || action === 'invalidate') {
                    fetchArchivedPurchaseOrders(true);
                } else {
                    const cached = trashCache.get<ArchivedPurchaseOrder>('purchase_orders');
                    if (cached) {
                        setArchivedPurchaseOrders(cached);
                        setPoTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
                    }
                }
            }
        });

        return () => {
            supabase.removeChannel(poChannel);
            unsubscribe();
        };
    }, [fetchArchivedPurchaseOrders]);

    return (
        <div className="space-y-4 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            {/* stats */}
            {poLoading && archivedPurchaseOrders.length === 0 ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-file-invoice"
                        header="Total Archived"
                        data={String(archivedPurchaseOrders.length)}
                        arrow="fa-solid fa-folder-open"
                        description="POs in storage"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Archived POs"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Archived: ${archivedPurchaseOrders.length} PO(s)\nTotal value: ${formatCurrency(archivedPurchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0))}`}
                        tooltip="View PO details"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-peso-sign"
                        header="Total Value"
                        data={formatCurrency(archivedPurchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0))}
                        arrow="fa-solid fa-wallet"
                        description="Combined value"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Value Details"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Combined Value: ${formatCurrency(archivedPurchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0))}\nAcross ${archivedPurchaseOrders.length} orders`}
                        tooltip="View total amount"
                        frontTextColor="text-emerald-500 dark:text-emerald-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-handshake"
                        header="Suppliers"
                        data={String(new Set(archivedPurchaseOrders.map(p => p.supplier_name)).size)}
                        arrow="fa-solid fa-building"
                        description="Distinct suppliers"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Supplier Info"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Suppliers: ${Array.from(new Set(archivedPurchaseOrders.map(p => p.supplier_name))).join(', ') || 'None'}`}
                        tooltip="View suppliers involved"
                        frontTextColor="text-indigo-500 dark:text-indigo-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-clock-rotate-left"
                        header="Avg. Value"
                        data={formatCurrency(archivedPurchaseOrders.length > 0 ? archivedPurchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0) / archivedPurchaseOrders.length : 0)}
                        arrow="fa-solid fa-calculator"
                        description="Per purchase order"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Averages"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Average Order Value: ${formatCurrency(archivedPurchaseOrders.length > 0 ? archivedPurchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0) / archivedPurchaseOrders.length : 0)}`}
                        tooltip="View averages"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />
                </div>
            )}

            {/* filter */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                            placeholder="Search PO number or supplier..."
                            value={poSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <SearchableDropdown
                        value={poStatusFilter}
                        onChange={(val) => setPoStatusFilter(val || 'all')}
                        options={statusOptions}
                        placeholder="All Statuses"
                        allOptionLabel="All Statuses"
                        searchPlaceholder="Search status..."
                        icon="fas fa-info-circle"
                        className="min-w-[150px]"
                        title="Filter by status"
                        emptyValue="all"
                        align="right"
                    />
                    {(poSearchTerm || poStatusFilter !== 'all' || selectedPoIds.size > 0) && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="xs"
                            onClick={() => {
                                setPoSearchTerm('');
                                setPoStatusFilter('all');
                                setSelectedPoIds(new Set());
                            }}
                        >
                            <i className="fas fa-rotate-left text-[11px]" />
                            <span>Reset Filters</span>
                        </AppButton>
                    )}
                </div>
            </div>

            {/* actions */}
            <BulkActionsToolbar
                selectedCount={selectedPoIds.size}
                itemLabel="purchase orders"
                singleItemLabel="purchase order"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestorePurchaseOrders,
                        variant: 'success',
                        isLoading: poLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeletePurchaseOrders,
                        variant: 'danger',
                        isLoading: poLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedPoIds(new Set())}
            />

            {/* table */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
                <div className="overflow-x-auto relative">
                    {poLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllPoSelected}
                                onChange={() => {
                                    if (isAllPoSelected) {
                                        setSelectedPoIds(new Set());
                                    } else {
                                        setSelectedPoIds(new Set(filteredPurchaseOrders.map(po => po.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredPurchaseOrders.length}</span>
                        </label>
                        {selectedPoIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedPoIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                                <th className="w-10 text-center py-3 px-4">
                                    <input
                                        type="checkbox"
                                        checked={isAllPoSelected}
                                        onChange={() => {
                                            if (isAllPoSelected) {
                                                setSelectedPoIds(new Set());
                                            } else {
                                                setSelectedPoIds(new Set(filteredPurchaseOrders.map(po => po.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th className="py-3 px-4">PO Number</th>
                                <th className="py-3 px-4">Supplier</th>
                                <th className="py-3 px-4">Total Amount</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Deleted By</th>
                                <th className="py-3 px-4">Deleted At & Auto-Purge</th>
                                <th className="text-right! py-3 px-4 w-[160px] min-w-[160px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                            {poLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'text', width: 'w-40' },
                                        { type: 'currency' },
                                        { type: 'badge' },
                                        { type: 'avatar-text', subtext: false },
                                        { type: 'date' },
                                        { type: 'actions', align: 'right', width: 'w-[160px]' },
                                    ]}
                                />
                            ) : paginatedPurchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-trash-can text-2xl text-pink-500 dark:text-pink-400"></i>
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No archived purchase orders found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPurchaseOrders.map((po) => {
                                    const isSelected = selectedPoIds.has(po.id);
                                    return (
                                        <tr
                                            key={po.id}
                                            className={`transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                }`}
                                        >
                                            <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-start md:justify-center w-full">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const newSelected = new Set(selectedPoIds);
                                                                if (newSelected.has(po.id)) newSelected.delete(po.id);
                                                                else newSelected.add(po.id);
                                                                setSelectedPoIds(newSelected);
                                                            }}
                                                            aria-label={`Select ${po.po_number}`}
                                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                        />
                                                        <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                    </label>
                                                </div>
                                            </td>
                                            <td data-label="PO Number" className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedViewPo(po)}
                                                    className="truncate max-w-[140px] inline-block text-left hover:text-pink-600 dark:hover:text-pink-400 hover:underline transition-colors cursor-pointer"
                                                    title="Click to view details"
                                                >
                                                    {po.po_number}
                                                </button>
                                            </td>
                                            <td data-label="Supplier" className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                                                <span className="truncate max-w-[180px] inline-block" title={po.supplier_name}>{po.supplier_name}</span>
                                            </td>
                                            <td data-label="Total Amount" className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                                                <span className="truncate max-w-[140px] inline-block">{formatCurrency(po.total_amount)}</span>
                                            </td>
                                            <td data-label="Status" className="py-3 px-4">
                                                {getStatusBadge(po.status)}
                                            </td>
                                            <td data-label="Deleted By" className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                                                <span className="truncate max-w-[130px] inline-block" title={po.deleted_by}>{po.deleted_by}</span>
                                            </td>
                                            <td data-label="Deleted At & Auto-Purge" className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{formatDate(po.deleted_at)}</span>
                                                    <TrashRetentionBadge deletedAt={po.deleted_at} />
                                                </div>
                                            </td>
                                            <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap w-[160px] min-w-[160px]">
                                                <div className="flex items-center justify-end gap-2">
                                                    <CrudActionButton
                                                        action="view"
                                                        ariaLabel={`View purchase order ${po.po_number}`}
                                                        title="View Details"
                                                        onClick={() => setSelectedViewPo(po)}
                                                    />
                                                    <CrudActionButton
                                                        action="restore"
                                                        ariaLabel={`Restore purchase order ${po.po_number}`}
                                                        title="Restore Purchase Order"
                                                        disabled={poLoading}
                                                        onClick={() => handleRestorePurchaseOrder(po)}
                                                    />
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete purchase order ${po.po_number} permanently`}
                                                        title="Delete Permanently"
                                                        disabled={poLoading}
                                                        onClick={() => handleDeletePurchaseOrderPermanently(po)}
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

                {/* pagination */}
                <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {paginatedPurchaseOrders.length > 0 ? ((poPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(poPage * ITEMS_PER_PAGE, filteredPurchaseOrders.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredPurchaseOrders.length}
                        </span> orders
                    </span>
                    <Pagination
                        currentPage={poPage}
                        totalPages={poTotalPages}
                        onPageChange={setPoPage}
                    />
                </div>
            </div>

            {/* View Full Archived Purchase Order Modal */}
            <ArchivedPurchaseOrderViewModal
                isOpen={!!selectedViewPo}
                onClose={() => setSelectedViewPo(null)}
                po={selectedViewPo}
                onRestore={async (p) => {
                    await handleRestorePurchaseOrder(p);
                    setSelectedViewPo(null);
                }}
                onPermanentDelete={async (p) => {
                    await handleDeletePurchaseOrderPermanently(p);
                    setSelectedViewPo(null);
                }}
            />
        </div>
    );
}