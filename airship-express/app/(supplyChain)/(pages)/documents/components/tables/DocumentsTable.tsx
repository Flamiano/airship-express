// documents data table with search, filters, bulk actions, and pagination
'use client';

import React from 'react';
import { Document, Supplier } from '../../types';
import { getFileIcon, getFileColor, formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { BulkActionsToolbar } from "../../../../components/global/BulkActionsToolbar";
import { TableContentLoader } from "../../../../components/global/Loader";
import { TableRowsSkeleton } from "../../../../components/ui/SkeletonLoader";
import { Pagination } from "../../../../components/global/pagination";
import { CrudActionButton } from "../../../../components/ui/CrudActionButton";

interface DocumentsTableProps {
    documents: Document[];
    loading: boolean;
    refreshing: boolean;
    suppliers: Supplier[];
    searchTerm: string;
    onSearchChange: (val: string) => void;
    typeFilter: string;
    onTypeFilterChange: (val: string) => void;
    extensionFilter: string;
    onExtensionFilterChange: (val: string) => void;
    supplierFilter: string;
    onSupplierFilterChange: (val: string) => void;
    dateFrom: string;
    onDateFromChange: (val: string) => void;
    dateTo: string;
    onDateToChange: (val: string) => void;
    onClearFilters: () => void;
    onRefresh: () => void;
    selectedDocIds: Set<string>;
    onToggleSelectDoc: (id: string) => void;
    onToggleSelectAll: () => void;
    isDownloading: boolean;
    isBulkDeleting: boolean;
    onDownloadSelected: () => void;
    onDeleteSelected: () => void;
    onClearSelection: () => void;
    onViewDocument: (doc: Document) => void;
    onEditDocument: (doc: Document) => void;
    onDownloadDocument: (doc: Document) => void;
    onDeleteDocument: (doc: Document) => void;
    onAttachFile?: (doc: Document) => void;
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

export function DocumentsTable({
    documents,
    loading,
    refreshing,
    suppliers,
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    extensionFilter,
    onExtensionFilterChange,
    supplierFilter,
    onSupplierFilterChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    onClearFilters,
    onRefresh,
    selectedDocIds,
    onToggleSelectDoc,
    onToggleSelectAll,
    isDownloading,
    isBulkDeleting,
    onDownloadSelected,
    onDeleteSelected,
    onClearSelection,
    onViewDocument,
    onEditDocument,
    onDownloadDocument,
    onDeleteDocument,
    onAttachFile,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange
}: DocumentsTableProps) {
    return (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col">
            {/* filter bar */}
            <div className="flex-shrink-0 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-2.5">
                        <div className="relative w-full sm:w-64">
                            <i
                                className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none"
                                aria-hidden="true"
                            ></i>
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                aria-label="Search files"
                                placeholder="Search files..."
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                            />
                        </div>

                        <select
                            value={typeFilter}
                            onChange={(e) => onTypeFilterChange(e.target.value)}
                            aria-label="Filter by document type"
                            className="w-full sm:w-auto bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3 py-2 text-xs text-slate-900 dark:text-white transition-all cursor-pointer focus:outline-none focus:border-pink-500"
                        >
                            <option value="">All Types</option>
                            <option value="Official Receipt">Official Receipt</option>
                            <option value="Invoice">Invoice</option>
                            <option value="Delivery Receipt">Delivery Receipt</option>
                            <option value="Parcel Condition">Parcel Condition</option>
                            <option value="Courier Handover">Courier Handover</option>
                            <option value="Vehicle Maintenance">Vehicle Maintenance</option>
                        </select>

                        <select
                            value={extensionFilter}
                            onChange={(e) => onExtensionFilterChange(e.target.value)}
                            aria-label="Filter by file extension"
                            className="w-full sm:w-auto bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3 py-2 text-xs text-slate-900 dark:text-white transition-all cursor-pointer focus:outline-none focus:border-pink-500"
                        >
                            <option value="">All Extensions</option>
                            <option value="jpg">.jpg / .jpeg</option>
                            <option value="png">.png</option>
                            <option value="pdf">.pdf</option>
                            <option value="word">.doc / .docx (Word)</option>
                            <option value="excel">.xls / .xlsx (Excel)</option>
                        </select>

                        <select
                            value={supplierFilter}
                            onChange={(e) => onSupplierFilterChange(e.target.value)}
                            aria-label="Filter by supplier"
                            className="w-full sm:w-auto bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3 py-2 text-xs text-slate-900 dark:text-white transition-all cursor-pointer focus:outline-none focus:border-pink-500"
                        >
                            <option value="">All Suppliers</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </select>

                        <div className="flex w-full sm:w-auto items-center justify-between gap-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] p-1">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => onDateFromChange(e.target.value)}
                                aria-label="Date From"
                                title="Date From"
                                className="w-full sm:w-auto border-0 bg-transparent px-2 py-1 text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none"
                            />
                            <span aria-hidden="true" className="text-[10px] font-bold text-slate-400 uppercase select-none">
                                to
                            </span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => onDateToChange(e.target.value)}
                                aria-label="Date To"
                                title="Date To"
                                className="w-full sm:w-auto border-0 bg-transparent px-2 py-1 text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 dark:border-slate-800/80 pt-2 lg:border-t-0 lg:pt-0">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onClearFilters}
                            title="Reset filters"
                        >
                            <i className="fas fa-filter-circle-xmark text-xs" />
                            <span>Reset</span>
                        </AppButton>

                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onRefresh}
                            title="Refresh list"
                        >
                            <i className="fas fa-rotate text-xs" />
                        </AppButton>
                    </div>
                </div>
            </div>

            {selectedDocIds.size > 0 && (
                <BulkActionsToolbar
                    selectedCount={selectedDocIds.size}
                    itemLabel="files"
                    singleItemLabel="file"
                    actions={[
                        {
                            label: 'Download',
                            icon: 'fa-download',
                            onClick: onDownloadSelected,
                            variant: 'primary',
                            isLoading: isDownloading,
                            disabled: isBulkDeleting,
                            mobileLabel: 'Download',
                        },
                        {
                            label: 'Delete',
                            icon: 'fa-trash-can',
                            onClick: onDeleteSelected,
                            variant: 'danger',
                            isLoading: isBulkDeleting,
                            disabled: isDownloading,
                            mobileLabel: 'Delete',
                        },
                    ]}
                    onClear={onClearSelection}
                />
            )}

            {/* scrollable table container */}
            <div className="flex-1 overflow-y-auto md:max-h-[500px] relative rounded-2xl bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.2)]">
                <div className="md:hidden flex items-center justify-between p-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 rounded-t-xl">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={documents.length > 0 && selectedDocIds.size === documents.length}
                            onChange={onToggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-600 bg-transparent"
                        />
                        <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold">
                            Select All ({documents.length})
                        </span>
                    </label>
                    <span className="text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800">
                        {selectedDocIds.size} selected
                    </span>
                </div>
                <div className="overflow-x-auto">
                    {refreshing && <TableContentLoader />}

                    <table className="table-pro p-1 w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="w-10 text-center! py-3 px-3">
                                    <input
                                        type="checkbox"
                                        checked={documents.length > 0 && selectedDocIds.size === documents.length}
                                        onChange={onToggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-600 bg-transparent"
                                    />
                                </th>
                                <th className="w-12 text-center! py-3 px-3">Format</th>
                                <th className="py-3 px-4">Document Title</th>
                                <th className="py-3 px-4">Category</th>
                                <th className="py-3 px-4">Price</th>
                                <th className="py-3 px-4">Size</th>
                                <th className="py-3 px-4">Supplier</th>
                                <th className="py-3 px-4">Date Uploaded</th>
                                <th className="text-right! py-3 px-4 w-[190px] min-w-[190px]">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80 text-xs">
                            {loading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'badge', width: 'w-12', align: 'center' },
                                        { type: 'avatar-text', subtext: true },
                                        { type: 'badge' },
                                        { type: 'text' },
                                        { type: 'text' },
                                        { type: 'text' },
                                        { type: 'date' },
                                        { type: 'actions', align: 'right', width: 'w-[190px]' },
                                    ]}
                                />
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-center p-4">
                                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-3 transition-transform duration-300 hover:scale-105">
                                                <i className="fas fa-folder-open text-2xl"></i>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No documents found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                documents.map((doc) => {
                                    const isSelected = selectedDocIds.has(doc.id);
                                    const isPending = doc.file_type === 'pending' || !doc.storage_path || doc.file_size === 0;

                                    return (
                                        <tr
                                            key={doc.id}
                                            onClick={() => isPending ? (onAttachFile ? onAttachFile(doc) : onEditDocument(doc)) : onViewDocument(doc)}
                                            className={`hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer ${isSelected ? 'bg-pink-500/10 dark:bg-pink-500/20' : ''}`}
                                        >
                                            <td data-label="Select" className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-between md:justify-center w-full">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => onToggleSelectDoc(doc.id)}
                                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-600 bg-transparent"
                                                        />
                                                        <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select File</span>
                                                    </label>
                                                    <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60">
                                                        DOC-{doc.id.substring(0, 8)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td data-label="Format" className="py-3 px-3">
                                                <div className="flex justify-end md:justify-center w-full">
                                                    {isPending ? (
                                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm border bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-700" title="Pending Attachment">
                                                            <i className="fas fa-paperclip animate-pulse"></i>
                                                        </div>
                                                    ) : (
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border ${getFileColor(doc.file_type)}`}>
                                                            <i className={`fas ${getFileIcon(doc.file_type)}`}></i>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Document Title" className="py-3 px-4">
                                                <div className="text-right sm:text-left min-w-0 max-w-[220px] sm:max-w-none ml-auto sm:ml-0">
                                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                                        <span className="font-semibold text-slate-900 dark:text-white truncate" title={doc.title}>
                                                            {doc.title}
                                                        </span>
                                                        {isPending && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                                                No File Attached
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">ID: {doc.id.substring(0, 8)}</div>

                                                    {/* po link inline display */}
                                                    {(doc.purchase_orders || doc.purchase_id || doc.po_number) && (
                                                        <div className="flex items-center justify-end sm:justify-start gap-1.5 flex-wrap mt-1">
                                                            <StatusBadge tone="pink" icon="fas fa-file-invoice" size="xs">
                                                                <span>PO #{doc.purchase_orders?.po_number || doc.po_number}</span>
                                                            </StatusBadge>
                                                            {doc.purchase_orders?.status && (
                                                                <StatusBadge tone="neutral" size="xs">
                                                                    {doc.purchase_orders.status}
                                                                </StatusBadge>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* force insert audit flag */}
                                                    {doc.force_inserted_by && (
                                                        <div className="mt-1 flex justify-end sm:justify-start">
                                                            <StatusBadge tone="amber" icon="fas fa-triangle-exclamation" size="xs">
                                                                <span>⚠ Forced by {doc.force_user_name || 'Admin'}</span>
                                                            </StatusBadge>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="Category" className="py-3 px-4">
                                                <div className="flex justify-end sm:justify-start">
                                                    <StatusBadge tone="pink" size="xs">
                                                        {doc.document_type}
                                                    </StatusBadge>
                                                </div>
                                            </td>
                                            <td data-label="Price" className="py-3 px-4 text-slate-900 dark:text-white font-medium text-right sm:text-left font-mono">
                                                {doc.Price || (doc as any)["Price"] ? (
                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                        ₱{doc.Price || (doc as any)["Price"]}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td data-label="Size" className="py-3 px-4 text-slate-900 dark:text-white font-medium text-right sm:text-left">
                                                {isPending ? (
                                                    <span className="text-amber-600 dark:text-amber-400 text-xs italic">Pending</span>
                                                ) : (
                                                    formatFileSize(doc.file_size)
                                                )}
                                            </td>
                                            <td data-label="Supplier" className="py-3 px-4 text-slate-900 dark:text-white text-right sm:text-left">
                                                <span className="truncate max-w-[180px] sm:max-w-none inline-block" title={doc.supplier || doc.purchase_orders?.supplier_name || ''}>
                                                    {doc.supplier || doc.purchase_orders?.supplier_name || <span className="text-slate-400">—</span>}
                                                </span>
                                            </td>
                                            <td data-label="Date Uploaded" className="py-3 px-4 text-slate-400 whitespace-nowrap text-right sm:text-left">
                                                {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap sm:w-[190px] sm:min-w-[190px] w-full" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                                                    {isPending && onAttachFile && (
                                                        <AppButton
                                                            type="button"
                                                            variant="primary"
                                                            size="xs"
                                                            onClick={() => onAttachFile(doc)}
                                                            title="Attach File to this Document"
                                                            className="text-xs px-2.5 py-1"
                                                        >
                                                            <i className="fas fa-paperclip text-[11px]"></i>
                                                            <span className="hidden sm:inline">Attach</span>
                                                        </AppButton>
                                                    )}
                                                    {!isPending && (
                                                        <CrudActionButton
                                                            action="view"
                                                            ariaLabel={`View ${doc.title}`}
                                                            title="View File"
                                                            onClick={() => onViewDocument(doc)}
                                                        />
                                                    )}
                                                    <CrudActionButton
                                                        action="edit"
                                                        ariaLabel={`Edit metadata for ${doc.title}`}
                                                        title="Edit Metadata"
                                                        onClick={() => onEditDocument(doc)}
                                                    />
                                                    {!isPending && (
                                                        <CrudActionButton
                                                            action="download"
                                                            ariaLabel={`Download ${doc.title}`}
                                                            title="Download File"
                                                            onClick={() => onDownloadDocument(doc)}
                                                        />
                                                    )}
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete ${doc.title}`}
                                                        title="Delete File"
                                                        onClick={() => onDeleteDocument(doc)}
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
            </div>

            {/* pagination */}
            {totalPages > 0 && (
                <div className="flex-shrink-0 pagination-container-class pt-4 mt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                        Showing <span className="font-semibold text-slate-900 dark:text-white">
                            {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                        </span> to{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {Math.min(currentPage * itemsPerPage, totalItems)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> files
                    </span>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </div>
    );
}
