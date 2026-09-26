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

import { trashCache } from '../utils/trashCache';
import { TrashRetentionBadge } from './TrashRetentionBadge';

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

    const [archivedDocuments, setArchivedDocuments] = useState<ArchivedDocument[]>(() => {
        return trashCache.get<ArchivedDocument>('documents') || [];
    });
    const [docsLoading, setDocsLoading] = useState<boolean>(() => {
        return !trashCache.get('documents');
    });
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [docTypeFilter, setDocTypeFilter] = useState('all');
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [docPage, setDocPage] = useState(1);
    const [docTotalPages, setDocTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedDocSearchTerm = useDebounce(docSearchTerm, 300);

    // fetch docs
    const fetchArchivedDocuments = useCallback(async (force = false) => {
        const cached = trashCache.get<ArchivedDocument>('documents');
        if (cached && !force && !trashCache.isStale('documents')) {
            setArchivedDocuments(cached);
            setDocTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
            setDocsLoading(false);
            return;
        }

        // only show skeleton if we have no data at all to display
        if (!cached || cached.length === 0) {
            setDocsLoading(true);
        }

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

            trashCache.set('documents', transformedData);
            setArchivedDocuments(transformedData);
            setDocTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived documents:', error);
            toast.error('Failed to load archived documents');
        } finally {
            setDocsLoading(false);
        }
    }, []);

    // restore doc
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

                trashCache.removeItem('documents', doc.id);
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

    // delete doc
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

                trashCache.removeItem('documents', doc.id);
                setArchivedDocuments(prev => prev.filter(d => d.id !== doc.id));
                setDocTotalPages(Math.ceil((archivedDocuments.length - 1) / ITEMS_PER_PAGE));
                setSelectedDocIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(doc.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(doc.title)}" permanently deleted`);

                await fetchArchivedDocuments(true);
            } catch (error) {
                console.error('Delete error:', error);
                toast.error('Failed to delete document');
            } finally {
                setDocsLoading(false);
            }
        }
    };

    // bulk ops
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

                trashCache.removeItems('documents', selectedDocIds);
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

                trashCache.removeItems('documents', selectedDocIds);
                setArchivedDocuments(prev => prev.filter(d => !selectedDocIds.has(d.id)));
                setDocTotalPages(Math.ceil((archivedDocuments.length - selectedDocIds.size) / ITEMS_PER_PAGE));
                setSelectedDocIds(new Set());

                if (storageErrors > 0) {
                    toast.warning(`${selectedDocIds.size - storageErrors} document(s) deleted, but ${storageErrors} file(s) may still exist in storage`);
                } else {
                    toast.success(`${selectedDocIds.size} document(s) permanently deleted.`);
                }

                await fetchArchivedDocuments(true);
            } catch (error) {
                toast.error('Failed to delete documents');
                console.error(error);
            } finally {
                setDocsLoading(false);
            }
        }
    };

    // utils
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

    // filtered
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

    // paginated
    const paginatedDocuments = useMemo(() => {
        const startIndex = (docPage - 1) * ITEMS_PER_PAGE;
        return filteredDocuments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredDocuments, docPage]);

    const docTypes = useMemo(() => ['all', ...Array.from(new Set(archivedDocuments.map(doc => doc.document_type)))], [archivedDocuments]);

    // selection
    const isAllDocsSelected = filteredDocuments.length > 0 && selectedDocIds.size === filteredDocuments.length;

    // total pages
    useEffect(() => {
        setDocTotalPages(Math.max(1, Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE)));
        if (docPage > Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE)) {
            setDocPage(1);
        }
    }, [filteredDocuments.length, docPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedDocuments();

        const unsubscribe = trashCache.subscribe((key, action) => {
            if (!key || key === 'documents') {
                if (action === 'force-refresh' || action === 'invalidate') {
                    fetchArchivedDocuments(true);
                } else {
                    const cached = trashCache.get<ArchivedDocument>('documents');
                    if (cached) {
                        setArchivedDocuments(cached);
                        setDocTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
                    }
                }
            }
        });

        return unsubscribe;
    }, [fetchArchivedDocuments]);

    return (
        <div className="space-y-4 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            {/* stats */}
            {docsLoading && archivedDocuments.length === 0 ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
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
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
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
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-handshake"
                        header="Linked Suppliers"
                        data={String(new Set(archivedDocuments.map(d => d.supplier).filter(Boolean)).size)}
                        arrow="fa-solid fa-building"
                        description="Associated suppliers"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Supplier Links"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Suppliers: ${Array.from(new Set(archivedDocuments.map(d => d.supplier).filter(Boolean))).join(', ') || 'None'}`}
                        tooltip="View associated suppliers"
                        frontTextColor="text-amber-500 dark:text-amber-400"
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
                            placeholder="Search title, file name, supplier, or PO..."
                            value={docSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                            value={docTypeFilter}
                            onChange={(e) => setDocTypeFilter(e.target.value)}
                        >
                            {docTypes.map(type => (
                                <option key={type} value={type} className="dark:bg-[#1c1d25]">
                                    {type === 'all' ? 'All Types' : type}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(docSearchTerm || docTypeFilter !== 'all' || selectedDocIds.size > 0) && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="xs"
                            onClick={() => {
                                setDocSearchTerm('');
                                setDocTypeFilter('all');
                                setSelectedDocIds(new Set());
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

            {/* table */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
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
                                <th className="py-3 px-4">Deleted At & Auto-Purge</th>
                                <th className="text-right! py-3 px-4 w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                            {docsLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'text', width: 'w-48' },
                                        { type: 'badge' },
                                        { type: 'text' },
                                        { type: 'text' },
                                        { type: 'text' },
                                        { type: 'badge' },
                                        { type: 'avatar-text', subtext: false },
                                        { type: 'date' },
                                        { type: 'actions', align: 'right', width: 'w-[130px]' },
                                    ]}
                                />
                            ) : paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-trash-can text-2xl text-pink-500 dark:text-pink-400"></i>
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No archived documents found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Try adjusting your filters or search terms</p>
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
                                            <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-between md:justify-center w-full">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const newSelected = new Set(selectedDocIds);
                                                                if (newSelected.has(doc.id)) newSelected.delete(doc.id);
                                                                else newSelected.add(doc.id);
                                                                setSelectedDocIds(newSelected);
                                                            }}
                                                            aria-label={`Select ${doc.title}`}
                                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                        />
                                                        <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                    </label>
                                                    <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60">
                                                        DOC-{doc.id.substring(0, 8)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td data-label="Title / File" className="py-3 px-4">
                                                <div className="text-right sm:text-left min-w-0 max-w-[220px] sm:max-w-none ml-auto sm:ml-0">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug truncate" title={doc.title}>{doc.title}</div>
                                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate" title={doc.file_name}>{doc.file_name}</div>
                                                    {doc.notes && (
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-0.5 truncate" title={doc.notes}>
                                                            "{doc.notes}"
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Type" className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex justify-end sm:justify-start">
                                                    <StatusBadge tone="pink" size="xs">
                                                        {doc.document_type}
                                                    </StatusBadge>
                                                </div>
                                            </td>
                                            <td data-label="Size" className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium text-right sm:text-left">
                                                {formatFileSize(doc.file_size)}
                                            </td>
                                            <td data-label="Supplier" className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-right sm:text-left">
                                                <span className="truncate max-w-[150px] inline-block ml-auto sm:ml-0" title={doc.supplier || ''}>
                                                    {doc.supplier || <span className="text-slate-300 dark:text-slate-700">—</span>}
                                                </span>
                                            </td>
                                            <td data-label="PO Number" className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                                <div className="flex justify-end sm:justify-start">
                                                    {doc.po_number ? (
                                                        <StatusBadge tone="pink" size="xs">
                                                            <span className="font-mono">{doc.po_number}</span>
                                                        </StatusBadge>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Role" className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex justify-end sm:justify-start">
                                                    {doc.role ? (
                                                        <StatusBadge
                                                            tone={
                                                                doc.role === 'Admin'
                                                                    ? 'purple'
                                                                    : doc.role === 'Manager'
                                                                        ? 'indigo'
                                                                        : 'neutral'
                                                            }
                                                            size="xs"
                                                        >
                                                            {doc.role}
                                                        </StatusBadge>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Deleted By" className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium text-right sm:text-left">
                                                <span className="truncate max-w-[120px] inline-block ml-auto sm:ml-0" title={doc.deleted_by}>{doc.deleted_by}</span>
                                            </td>
                                            <td data-label="Deleted At & Auto-Purge" className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                <div className="flex flex-col gap-1 items-end sm:items-start text-right sm:text-left">
                                                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{formatDate(doc.deleted_at)}</span>
                                                    <TrashRetentionBadge deletedAt={doc.deleted_at} />
                                                </div>
                                            </td>
                                            <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap sm:w-[130px] sm:min-w-[130px] w-full">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <CrudActionButton
                                                        action="restore"
                                                        ariaLabel={`Restore document ${doc.title}`}
                                                        title="Restore Document"
                                                        disabled={docsLoading}
                                                        onClick={() => handleRestoreDocument(doc)}
                                                    />
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete document ${doc.title} permanently`}
                                                        title="Delete Permanently"
                                                        disabled={docsLoading}
                                                        onClick={() => handleDeleteDocumentPermanently(doc)}
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