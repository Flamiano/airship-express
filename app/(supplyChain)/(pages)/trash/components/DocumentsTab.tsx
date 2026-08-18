'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { BulkActionsToolbar } from '@/app/(supplyChain)/components/global/BulkActionsToolbar';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { sanitizeSearch, sanitizeText, sanitizeNumber } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import Cards from '@/app/(supplyChain)/components/global/Cards';

interface ArchivedDocument {
    id: string;
    title: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    category: string;
    document_type: string;
    supplier: string | null;
    po_number: string | null;
    parcel_batch: string | null;
    uploaded_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    deleted_at: string;
    deleted_by: string;
    original_id: string;
    role: string | null;
    session_id: string | null;
}

const ITEMS_PER_PAGE = 10;

export function DocumentsTab() {
    const { confirm } = useConfirm();

    const [archivedDocuments, setArchivedDocuments] = useState<ArchivedDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [docTypeFilter, setDocTypeFilter] = useState('all');
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [docPage, setDocPage] = useState(1);
    const [docTotalPages, setDocTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedDocSearchTerm = useDebounce(docSearchTerm, 300);

    // Fetch archived documents
    const fetchArchivedDocuments = useCallback(async () => {
        setDocsLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents_archive')
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) throw error;

            const transformedData: ArchivedDocument[] = (data || []).map((doc: any) => ({
                id: doc.id,
                title: sanitizeText(doc.title || doc.file_name || 'Untitled'),
                file_name: sanitizeText(doc.file_name),
                file_size: sanitizeNumber(doc.file_size),
                file_type: sanitizeText(doc.file_type),
                storage_path: sanitizeText(doc.storage_path || ''),
                category: sanitizeText(doc.category || 'documents'),
                document_type: sanitizeText(doc.document_type || 'Other'),
                supplier: doc.supplier ? sanitizeText(doc.supplier) : null,
                po_number: doc.po_number ? sanitizeText(doc.po_number) : null,
                parcel_batch: doc.parcel_batch ? sanitizeText(doc.parcel_batch) : null,
                uploaded_by: doc.uploaded_by ? sanitizeText(doc.uploaded_by) : null,
                notes: doc.notes ? sanitizeText(doc.notes) : null,
                created_at: doc.created_at,
                updated_at: doc.updated_at,
                version: sanitizeNumber(doc.version || 1),
                deleted_at: doc.deleted_at || new Date().toISOString(),
                deleted_by: sanitizeText(doc.deleted_by || 'Unknown'),
                original_id: doc.original_id || doc.id,
                role: doc.role ? sanitizeText(doc.role) : null,
                session_id: doc.session_id ? sanitizeText(doc.session_id) : null,
            }));

            setArchivedDocuments(transformedData);
            setDocTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived documents:', error);
            toast.error('Failed to load archived documents');
        } finally {
            setDocsLoading(false);
        }
    }, []);

    // Restore document
    const handleRestoreDocument = async (doc: ArchivedDocument) => {
        const confirmed = await confirm({
            title: 'Restore Document',
            message: `Are you sure you want to restore "${sanitizeText(doc.title)}" to active documents?`,
            confirmText: 'Restore Document',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setDocsLoading(true);
            try {
                const { error: insertError } = await supabase
                    .from('documents')
                    .insert({
                        id: doc.original_id,
                        title: doc.title,
                        file_name: doc.file_name,
                        file_size: doc.file_size,
                        file_type: doc.file_type,
                        storage_path: doc.storage_path,
                        category: doc.category,
                        document_type: doc.document_type,
                        supplier: doc.supplier,
                        po_number: doc.po_number,
                        parcel_batch: doc.parcel_batch,
                        uploaded_by: doc.uploaded_by,
                        notes: doc.notes,
                        version: doc.version,
                        created_at: doc.created_at,
                        updated_at: new Date().toISOString(),
                        role: doc.role,
                        session_id: doc.session_id,
                    });

                if (insertError) throw insertError;

                const { error: deleteError } = await supabase
                    .from('documents_archive')
                    .delete()
                    .eq('id', doc.id);

                if (deleteError) throw deleteError;

                setArchivedDocuments(prev => prev.filter(d => d.id !== doc.id));
                setDocTotalPages(Math.ceil((archivedDocuments.length - 1) / ITEMS_PER_PAGE));
                setSelectedDocIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(doc.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(doc.title)}" restored successfully`);
            } catch (error) {
                console.error('Restore error:', error);
                toast.error('Failed to restore document');
            } finally {
                setDocsLoading(false);
            }
        }
    };

    // Delete document permanently
    const handleDeleteDocumentPermanently = async (doc: ArchivedDocument) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete "${sanitizeText(doc.title)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setDocsLoading(true);
            try {
                const { error: deleteError } = await supabase
                    .from('documents_archive')
                    .delete()
                    .eq('id', doc.id);

                if (deleteError) throw deleteError;

                if (doc.storage_path) {
                    const { error: storageError } = await supabase.storage
                        .from('documents')
                        .remove([doc.storage_path]);

                    if (storageError) {
                        console.error('Storage delete error:', storageError);
                        toast.warning('Document deleted from archive but file may still exist in storage');
                    }
                }

                setArchivedDocuments(prev => prev.filter(d => d.id !== doc.id));
                setDocTotalPages(Math.ceil((archivedDocuments.length - 1) / ITEMS_PER_PAGE));
                setSelectedDocIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(doc.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(doc.title)}" permanently deleted`);

                await fetchArchivedDocuments();
            } catch (error) {
                console.error('Delete error:', error);
                toast.error('Failed to delete document');
            } finally {
                setDocsLoading(false);
            }
        }
    };

    // Bulk operations
    const handleBulkRestoreDocuments = async () => {
        if (selectedDocIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedDocIds.size} Documents`,
            message: `Are you sure you want to restore ${selectedDocIds.size} document(s) to active documents?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setDocsLoading(true);
            try {
                const docsToRestore = archivedDocuments.filter(d => selectedDocIds.has(d.id));
                for (const doc of docsToRestore) {
                    const { error: insertError } = await supabase
                        .from('documents')
                        .insert({
                            id: doc.original_id,
                            title: doc.title,
                            file_name: doc.file_name,
                            file_size: doc.file_size,
                            file_type: doc.file_type,
                            storage_path: doc.storage_path,
                            category: doc.category,
                            document_type: doc.document_type,
                            supplier: doc.supplier,
                            po_number: doc.po_number,
                            parcel_batch: doc.parcel_batch,
                            uploaded_by: doc.uploaded_by,
                            notes: doc.notes,
                            version: doc.version,
                            created_at: doc.created_at,
                            updated_at: new Date().toISOString(),
                            role: doc.role,
                            session_id: doc.session_id,
                        });

                    if (insertError) throw insertError;

                    await supabase
                        .from('documents_archive')
                        .delete()
                        .eq('id', doc.id);
                }

                setArchivedDocuments(prev => prev.filter(d => !selectedDocIds.has(d.id)));
                setDocTotalPages(Math.ceil((archivedDocuments.length - selectedDocIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedDocIds.size} document(s) restored successfully!`);
                setSelectedDocIds(new Set());
            } catch (error) {
                toast.error('Failed to restore documents');
                console.error(error);
            } finally {
                setDocsLoading(false);
            }
        }
    };

    const handleBulkDeleteDocuments = async () => {
        if (selectedDocIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedDocIds.size} Documents Permanently`,
            message: `Are you sure you want to permanently delete ${selectedDocIds.size} document(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setDocsLoading(true);
            try {
                const docsToDelete = archivedDocuments.filter(d => selectedDocIds.has(d.id));
                let storageErrors = 0;

                for (const doc of docsToDelete) {
                    const { error: deleteError } = await supabase
                        .from('documents_archive')
                        .delete()
                        .eq('id', doc.id);

                    if (deleteError) throw deleteError;

                    if (doc.storage_path) {
                        const { error: storageError } = await supabase.storage
                            .from('documents')
                            .remove([doc.storage_path]);

                        if (storageError) {
                            console.error('Storage delete error:', storageError);
                            storageErrors++;
                        }
                    }
                }

                setArchivedDocuments(prev => prev.filter(d => !selectedDocIds.has(d.id)));
                setDocTotalPages(Math.ceil((archivedDocuments.length - selectedDocIds.size) / ITEMS_PER_PAGE));
                setSelectedDocIds(new Set());

                if (storageErrors > 0) {
                    toast.warning(`${selectedDocIds.size - storageErrors} document(s) deleted, but ${storageErrors} file(s) may still exist in storage`);
                } else {
                    toast.success(`${selectedDocIds.size} document(s) permanently deleted.`);
                }

                await fetchArchivedDocuments();
            } catch (error) {
                toast.error('Failed to delete documents');
                console.error(error);
            } finally {
                setDocsLoading(false);
            }
        }
    };

    // Utility functions
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

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDocSearchTerm(sanitizeSearch(e.target.value));
    };

    // Filtered data
    const filteredDocuments = useMemo(() => {
        const search = sanitizeSearch(debouncedDocSearchTerm);
        return archivedDocuments.filter(doc => {
            const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase()) ||
                doc.file_name.toLowerCase().includes(search.toLowerCase()) ||
                (doc.supplier && doc.supplier.toLowerCase().includes(search.toLowerCase())) ||
                (doc.po_number && doc.po_number.toLowerCase().includes(search.toLowerCase()));
            const matchesType = docTypeFilter === 'all' || doc.document_type === docTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [archivedDocuments, debouncedDocSearchTerm, docTypeFilter]);

    // Get paginated data
    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    const paginatedDocuments = getPaginatedData(filteredDocuments, docPage);

    // Document types for filter
    const docTypes = useMemo(() => ['all', ...Array.from(new Set(archivedDocuments.map(doc => doc.document_type)))], [archivedDocuments]);

    // Selection state
    const isAllDocsSelected = filteredDocuments.length > 0 && selectedDocIds.size === filteredDocuments.length;

    // Update total pages
    useEffect(() => {
        setDocTotalPages(Math.max(1, Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE)));
        if (docPage > Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE)) {
            setDocPage(1);
        }
    }, [filteredDocuments.length, docPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedDocuments();
    }, []);

    return (
        <div className="space-y-4 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Cards
                    frontIcon="fa-solid fa-file-archive"
                    header="Total Archived"
                    data={String(archivedDocuments.length)}
                    arrow="fa-solid fa-folder-open"
                    description="Documents in storage"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Archived Documents"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total Archived: ${archivedDocuments.length} document(s)\nStorage size: ${formatFileSize(archivedDocuments.reduce((sum, d) => sum + (d.file_size || 0), 0))}`}
                    tooltip="View document details"
                    frontTextColor="text-pink-500 dark:text-pink-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />

                <Cards
                    frontIcon="fa-solid fa-tags"
                    header="Document Types"
                    data={String(Math.max(0, docTypes.length - 1))}
                    arrow="fa-solid fa-layer-group"
                    description="Distinct classifications"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Classifications"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Types: ${docTypes.filter(t => t !== 'all').join(', ') || 'None'}`}
                    tooltip="View document categories"
                    frontTextColor="text-indigo-500 dark:text-indigo-400"
                    descriptionTextColor="text-indigo-600 dark:text-indigo-400"
                />

                <Cards
                    frontIcon="fa-solid fa-database"
                    header="Total Size"
                    data={formatFileSize(archivedDocuments.reduce((sum, d) => sum + (d.file_size || 0), 0))}
                    arrow="fa-solid fa-hard-drive"
                    description="Storage allocated"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Storage Details"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total Size: ${formatFileSize(archivedDocuments.reduce((sum, d) => sum + (d.file_size || 0), 0))}\nAcross ${archivedDocuments.length} files`}
                    tooltip="View storage allocation"
                    frontTextColor="text-blue-500 dark:text-blue-400"
                    descriptionTextColor="text-blue-600 dark:text-blue-400"
                />
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-2xl dark:shadow-black/40 p-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            placeholder="Search title, file name, supplier, or PO..."
                            value={docSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            value={docTypeFilter}
                            onChange={(e) => setDocTypeFilter(e.target.value)}
                        >
                            {docTypes.map(type => (
                                <option key={type} value={type} className="dark:bg-slate-900">
                                    {type === 'all' ? 'All Types' : type}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(docSearchTerm || docTypeFilter !== 'all' || selectedDocIds.size > 0) && (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            onClick={() => {
                                setDocSearchTerm('');
                                setDocTypeFilter('all');
                                setSelectedDocIds(new Set());
                            }}
                        >
                            <i className="fas fa-rotate-left text-[11px]"></i>
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            <BulkActionsToolbar
                selectedCount={selectedDocIds.size}
                itemLabel="documents"
                singleItemLabel="document"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestoreDocuments,
                        variant: 'success',
                        isLoading: docsLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeleteDocuments,
                        variant: 'danger',
                        isLoading: docsLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedDocIds(new Set())}
            />

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-2xl dark:shadow-black/40 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="overflow-x-auto relative">
                    {docsLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllDocsSelected}
                                onChange={() => {
                                    if (isAllDocsSelected) {
                                        setSelectedDocIds(new Set());
                                    } else {
                                        setSelectedDocIds(new Set(filteredDocuments.map(doc => doc.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredDocuments.length}</span>
                        </label>
                        {selectedDocIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedDocIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                                <th className="w-10 text-center py-3 px-4">
                                    <input
                                        type="checkbox"
                                        checked={isAllDocsSelected}
                                        onChange={() => {
                                            if (isAllDocsSelected) {
                                                setSelectedDocIds(new Set());
                                            } else {
                                                setSelectedDocIds(new Set(filteredDocuments.map(doc => doc.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th className="py-3 px-4">Title / File</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-4">Size</th>
                                <th className="py-3 px-4">Supplier</th>
                                <th className="py-3 px-4">PO Number</th>
                                <th className="py-3 px-4">Role</th>
                                <th className="py-3 px-4">Deleted By</th>
                                <th className="py-3 px-4">Deleted At</th>
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                            {paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                                                <i className="fas fa-file-excel text-xl text-pink-500 dark:text-pink-400"></i>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">No archived documents found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedDocuments.map((doc) => {
                                    const isSelected = selectedDocIds.has(doc.id);
                                    return (
                                        <tr
                                            key={doc.id}
                                            className={`transition-all duration-150 group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected
                                                ? 'bg-pink-50/30 dark:bg-pink-950/20'
                                                : ''
                                                }`}
                                        >
                                            <td data-label="Select" className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSelected = new Set(selectedDocIds);
                                                        if (newSelected.has(doc.id)) newSelected.delete(doc.id);
                                                        else newSelected.add(doc.id);
                                                        setSelectedDocIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                />
                                            </td>
                                            <td data-label="Title / File" className="py-3 px-4">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">{doc.title}</div>
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{doc.file_name}</div>
                                                {doc.notes && (
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 italic truncate max-w-[220px]" title={doc.notes}>
                                                        <i className="fas fa-sticky-note text-amber-500 dark:text-amber-400 text-[10px]"></i>
                                                        <span>{doc.notes}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td data-label="Type" className="py-3 px-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/40">
                                                    {doc.document_type}
                                                </span>
                                            </td>
                                            <td data-label="Size" className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                                                {formatFileSize(doc.file_size)}
                                            </td>
                                            <td data-label="Supplier" className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {doc.supplier || <span className="text-slate-300 dark:text-slate-700">—</span>}
                                            </td>
                                            <td data-label="PO Number" className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                                {doc.po_number || <span className="text-slate-300 dark:text-slate-700">—</span>}
                                            </td>
                                            <td data-label="Role" className="py-3 px-4 whitespace-nowrap">
                                                {doc.role ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold ${doc.role === 'Admin'
                                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/40'
                                                        : doc.role === 'Manager'
                                                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60'
                                                        }`}>
                                                        {doc.role}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700">—</span>
                                                )}
                                            </td>
                                            <td data-label="Deleted By" className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                                                {doc.deleted_by}
                                            </td>
                                            <td data-label="Deleted At" className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                {formatDate(doc.deleted_at)}
                                            </td>
                                            <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleRestoreDocument(doc)}
                                                        disabled={docsLoading}
                                                        title="Restore Document"
                                                    >
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                        <span>Restore</span>
                                                    </button>
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleDeleteDocumentPermanently(doc)}
                                                        disabled={docsLoading}
                                                        title="Delete Permanently"
                                                    >
                                                        <i className="fas fa-trash-can text-[10px]"></i>
                                                        <span>Delete</span>
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

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {paginatedDocuments.length > 0 ? ((docPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(docPage * ITEMS_PER_PAGE, filteredDocuments.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredDocuments.length}
                        </span> documents
                    </span>
                    <Pagination
                        currentPage={docPage}
                        totalPages={docTotalPages}
                        onPageChange={setDocPage}
                    />
                </div>
            </div>
        </div>
    );
}