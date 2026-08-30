'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { BulkActionsToolbar } from '@/app/(supplyChain)/components/global/BulkActionsToolbar';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { sanitizeSearch, sanitizeText } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import Cards from '@/app/(supplyChain)/components/global/Cards';
import { CardsSkeleton, TableRowsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';

interface ArchivedSupplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string;
    deleted_by: string;
    deletion_reason: string | null;
    original_id: number;
}

const ITEMS_PER_PAGE = 10;

export function SuppliersTab() {
    const { confirm } = useConfirm();

    const [archivedSuppliers, setArchivedSuppliers] = useState<ArchivedSupplier[]>([]);
    const [supplierLoading, setSupplierLoading] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [supplierCategoryFilter, setSupplierCategoryFilter] = useState('all');
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set());
    const [supplierPage, setSupplierPage] = useState(1);
    const [supplierTotalPages, setSupplierTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedSupplierSearchTerm = useDebounce(supplierSearchTerm, 300);

    const fetchArchivedSuppliers = useCallback(async () => {
        setSupplierLoading(true);
        try {
            const { data, error } = await supabase
                .from('suppliers_archive')
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) throw error;

            const transformedData: ArchivedSupplier[] = (data || []).map((supplier: any) => ({
                id: supplier.id,
                name: sanitizeText(supplier.name),
                category: sanitizeText(supplier.category),
                contact_person: sanitizeText(supplier.contact_person),
                phone: sanitizeText(supplier.phone),
                email: sanitizeText(supplier.email),
                location: sanitizeText(supplier.location),
                products: supplier.products ? sanitizeText(supplier.products) : null,
                notes: supplier.notes ? sanitizeText(supplier.notes) : null,
                is_active: supplier.is_active ?? true,
                created_at: supplier.created_at,
                updated_at: supplier.updated_at,
                deleted_at: supplier.deleted_at || new Date().toISOString(),
                deleted_by: sanitizeText(supplier.deleted_by || 'Unknown'),
                deletion_reason: supplier.deletion_reason ? sanitizeText(supplier.deletion_reason) : null,
                original_id: supplier.original_id || supplier.id,
            }));

            setArchivedSuppliers(transformedData);
            setSupplierTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived suppliers:', error);
            toast.error('Failed to load archived suppliers');
        } finally {
            setSupplierLoading(false);
        }
    }, []);

    const handleRestoreSupplier = async (supplier: ArchivedSupplier) => {
        const confirmed = await confirm({
            title: 'Restore Supplier',
            message: `Are you sure you want to restore "${sanitizeText(supplier.name)}" to active suppliers?`,
            confirmText: 'Restore',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setSupplierLoading(true);
            try {
                const { error: insertError } = await supabase
                    .from('suppliers')
                    .insert({
                        id: supplier.original_id,
                        name: supplier.name,
                        category: supplier.category,
                        contact_person: supplier.contact_person,
                        phone: supplier.phone,
                        email: supplier.email,
                        location: supplier.location,
                        products: supplier.products,
                        notes: supplier.notes,
                        is_active: supplier.is_active,
                        created_at: supplier.created_at,
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) throw insertError;

                const { error: deleteError } = await supabase
                    .from('suppliers_archive')
                    .delete()
                    .eq('id', supplier.id);

                if (deleteError) throw deleteError;

                setArchivedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
                setSupplierTotalPages(Math.ceil((archivedSuppliers.length - 1) / ITEMS_PER_PAGE));
                setSelectedSupplierIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(supplier.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(supplier.name)}" restored successfully`);
            } catch (error) {
                toast.error('Failed to restore supplier');
                console.error(error);
            } finally {
                setSupplierLoading(false);
            }
        }
    };

    const handleDeleteSupplierPermanently = async (supplier: ArchivedSupplier) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete "${sanitizeText(supplier.name)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setSupplierLoading(true);
            try {
                const { error } = await supabase
                    .from('suppliers_archive')
                    .delete()
                    .eq('id', supplier.id);

                if (error) throw error;

                setArchivedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
                setSupplierTotalPages(Math.ceil((archivedSuppliers.length - 1) / ITEMS_PER_PAGE));
                setSelectedSupplierIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(supplier.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(supplier.name)}" permanently deleted`);
            } catch (error) {
                toast.error('Failed to delete supplier');
                console.error(error);
            } finally {
                setSupplierLoading(false);
            }
        }
    };

    const handleBulkRestoreSuppliers = async () => {
        if (selectedSupplierIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedSupplierIds.size} Suppliers`,
            message: `Are you sure you want to restore ${selectedSupplierIds.size} supplier(s) to active?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setSupplierLoading(true);
            try {
                const suppliersToRestore = archivedSuppliers.filter(s => selectedSupplierIds.has(s.id));
                for (const supplier of suppliersToRestore) {
                    const { error: insertError } = await supabase
                        .from('suppliers')
                        .insert({
                            id: supplier.original_id,
                            name: supplier.name,
                            category: supplier.category,
                            contact_person: supplier.contact_person,
                            phone: supplier.phone,
                            email: supplier.email,
                            location: supplier.location,
                            products: supplier.products,
                            notes: supplier.notes,
                            is_active: supplier.is_active,
                            created_at: supplier.created_at,
                            updated_at: new Date().toISOString(),
                        });

                    if (insertError) throw insertError;

                    await supabase
                        .from('suppliers_archive')
                        .delete()
                        .eq('id', supplier.id);
                }

                setArchivedSuppliers(prev => prev.filter(s => !selectedSupplierIds.has(s.id)));
                setSupplierTotalPages(Math.ceil((archivedSuppliers.length - selectedSupplierIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedSupplierIds.size} supplier(s) restored successfully!`);
                setSelectedSupplierIds(new Set());
            } catch (error) {
                toast.error('Failed to restore suppliers');
                console.error(error);
            } finally {
                setSupplierLoading(false);
            }
        }
    };

    const handleBulkDeleteSuppliers = async () => {
        if (selectedSupplierIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedSupplierIds.size} Suppliers Permanently`,
            message: `Are you sure you want to permanently delete ${selectedSupplierIds.size} supplier(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setSupplierLoading(true);
            try {
                for (const supplierId of selectedSupplierIds) {
                    await supabase
                        .from('suppliers_archive')
                        .delete()
                        .eq('id', supplierId);
                }

                setArchivedSuppliers(prev => prev.filter(s => !selectedSupplierIds.has(s.id)));
                setSupplierTotalPages(Math.ceil((archivedSuppliers.length - selectedSupplierIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedSupplierIds.size} supplier(s) permanently deleted.`);
                setSelectedSupplierIds(new Set());
            } catch (error) {
                toast.error('Failed to delete suppliers');
                console.error(error);
            } finally {
                setSupplierLoading(false);
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

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSupplierSearchTerm(sanitizeSearch(e.target.value));
    };

    const filteredSuppliers = useMemo(() => {
        const search = sanitizeSearch(debouncedSupplierSearchTerm);
        return archivedSuppliers.filter(supplier => {
            const matchesSearch = supplier.name.toLowerCase().includes(search.toLowerCase()) ||
                supplier.contact_person.toLowerCase().includes(search.toLowerCase()) ||
                supplier.email.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = supplierCategoryFilter === 'all' || supplier.category === supplierCategoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [archivedSuppliers, debouncedSupplierSearchTerm, supplierCategoryFilter]);

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    const paginatedSuppliers = getPaginatedData(filteredSuppliers, supplierPage);
    const supplierCategories = useMemo(() => ['all', ...Array.from(new Set(archivedSuppliers.map(s => s.category)))], [archivedSuppliers]);
    const isAllSuppliersSelected = filteredSuppliers.length > 0 && selectedSupplierIds.size === filteredSuppliers.length;

    useEffect(() => {
        setSupplierTotalPages(Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE)));
        if (supplierPage > Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE)) {
            setSupplierPage(1);
        }
    }, [filteredSuppliers.length, supplierPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedSuppliers();
    }, []);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            {/* stats */}
            {supplierLoading && archivedSuppliers.length === 0 ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-handshake"
                        header="Total Archived"
                        data={String(archivedSuppliers.length)}
                        arrow="fa-solid fa-folder-open"
                        description="Suppliers"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Archived Suppliers"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Archived: ${archivedSuppliers.length} supplier(s)`}
                        tooltip="View supplier archive"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-pink-600 dark:text-pink-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-tags"
                        header="Categories"
                        data={String(Math.max(0, supplierCategories.length - 1))}
                        arrow="fa-solid fa-layer-group"
                        description="Distinct categories"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Supplier Categories"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Categories: ${supplierCategories.filter(c => c !== 'all').join(', ') || 'None'}`}
                        tooltip="View supplier categories"
                        frontTextColor="text-indigo-500 dark:text-indigo-400"
                        descriptionTextColor="text-indigo-600 dark:text-indigo-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-circle-exclamation"
                        header="Status"
                        data="Inactive"
                        arrow="fa-solid fa-ban"
                        description="All archived are inactive"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Status Info"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription="All archived suppliers are marked as inactive until restored."
                        tooltip="View status explanation"
                        frontTextColor="text-amber-500 dark:text-amber-400"
                        descriptionTextColor="text-amber-600 dark:text-amber-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-location-dot"
                        header="Locations"
                        data={String(new Set(archivedSuppliers.map(s => s.location).filter(Boolean)).size)}
                        arrow="fa-solid fa-map-pin"
                        description="Distinct locations"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Supplier Locations"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Locations: ${Array.from(new Set(archivedSuppliers.map(s => s.location).filter(Boolean))).join(', ') || 'None'}`}
                        tooltip="View location details"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />
                </div>
            )}

            {/* filter */}
            <div className="bg-white dark:bg-[#1c1d25] rounded-2xl border border-slate-200/90 dark:border-[#353746] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            className="w-full bg-slate-50/80 dark:bg-[#2a2a2e] border border-slate-200/90 dark:border-[#353746] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#23242e] focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            placeholder="Search supplier name, code, contact, or email..."
                            value={supplierSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            value={supplierCategoryFilter}
                            onChange={(e) => setSupplierCategoryFilter(e.target.value)}
                        >
                            {supplierCategories.map(cat => (
                                <option key={cat} value={cat} className="dark:bg-slate-900">
                                    {cat === 'all' ? 'All Categories' : cat}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(supplierSearchTerm || supplierCategoryFilter !== 'all' || selectedSupplierIds.size > 0) && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="xs"
                            onClick={() => {
                                setSupplierSearchTerm('');
                                setSupplierCategoryFilter('all');
                                setSelectedSupplierIds(new Set());
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
                selectedCount={selectedSupplierIds.size}
                itemLabel="suppliers"
                singleItemLabel="supplier"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestoreSuppliers,
                        variant: 'success',
                        isLoading: supplierLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeleteSuppliers,
                        variant: 'danger',
                        isLoading: supplierLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedSupplierIds(new Set())}
            />

            {/* table */}
            <div className="bg-white dark:bg-[#1c1d25] rounded-2xl border border-slate-200/90 dark:border-[#353746] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.7)] transition-all duration-200">
                <div className="overflow-x-auto relative">
                    {supplierLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllSuppliersSelected}
                                onChange={() => {
                                    if (isAllSuppliersSelected) {
                                        setSelectedSupplierIds(new Set());
                                    } else {
                                        setSelectedSupplierIds(new Set(filteredSuppliers.map(s => s.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredSuppliers.length}</span>
                        </label>
                        {selectedSupplierIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedSupplierIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro">
                        <thead>
                            <tr>
                                <th className="w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSuppliersSelected}
                                        onChange={() => {
                                            if (isAllSuppliersSelected) {
                                                setSelectedSupplierIds(new Set());
                                            } else {
                                                setSelectedSupplierIds(new Set(filteredSuppliers.map(s => s.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Contact Person</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Location</th>
                                <th>Deleted By</th>
                                <th>Deleted At</th>
                                <th className="text-right! w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supplierLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'text', width: 'w-36' },
                                        { type: 'badge' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'text', width: 'w-28' },
                                        { type: 'text', width: 'w-40' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'avatar-text', subtext: false },
                                        { type: 'date' },
                                        { type: 'actions', align: 'right', width: 'w-[130px]' },
                                    ]}
                                />
                            ) : paginatedSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-trash-can text-xl"></i>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">No archived suppliers found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedSuppliers.map((supplier) => {
                                    const isSelected = selectedSupplierIds.has(supplier.id);
                                    return (
                                        <tr
                                            key={supplier.id}
                                            className={`transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSelected = new Set(selectedSupplierIds);
                                                        if (newSelected.has(supplier.id)) newSelected.delete(supplier.id);
                                                        else newSelected.add(supplier.id);
                                                        setSelectedSupplierIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                {supplier.name}
                                            </td>
                                            <td data-label="Category" className="py-3 px-4">
                                                <StatusBadge tone="pink" size="xs">
                                                    <span className="capitalize">{supplier.category}</span>
                                                </StatusBadge>
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                                {supplier.contact_person}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                                {supplier.phone}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {supplier.email}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {supplier.location}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {supplier.deleted_by}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                {formatDate(supplier.deleted_at)}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <CrudActionButton
                                                        action="restore"
                                                        ariaLabel={`Restore supplier ${supplier.name}`}
                                                        title="Restore Supplier"
                                                        disabled={supplierLoading}
                                                        onClick={() => handleRestoreSupplier(supplier)}
                                                    />
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete supplier ${supplier.name} permanently`}
                                                        title="Delete Permanently"
                                                        disabled={supplierLoading}
                                                        onClick={() => handleDeleteSupplierPermanently(supplier)}
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
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {paginatedSuppliers.length > 0 ? ((supplierPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(supplierPage * ITEMS_PER_PAGE, filteredSuppliers.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredSuppliers.length}
                        </span> suppliers
                    </span>
                    <Pagination
                        currentPage={supplierPage}
                        totalPages={supplierTotalPages}
                        onPageChange={setSupplierPage}
                    />
                </div>
            </div>
        </div>
    );
}