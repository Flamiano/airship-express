// supplier documents gallery component supporting grid, list, and table views with search, filters, and modals
'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Upload,
    LayoutGrid,
    List,
    Table as TableIcon,
    Search,
    Filter,
    FileText,
    Image as ImageIcon,
    HardDrive,
    User,
    Mail,
    Phone,
    MapPin,
    RefreshCw,
    X,
    FolderOpen,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Camera,
} from 'lucide-react';
import { Supplier, Document } from '../../types';
import { SupplierDocumentCard } from './SupplierDocumentCard';
import { SupplierDocumentListItem } from './SupplierDocumentListItem';
import { DocumentsTable } from '../tables/DocumentsTable';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { formatFileSize } from '../../utils/formatters';

export interface SupplierDocumentsGalleryProps {
    supplier: Supplier;
    suppliers: Supplier[];
    documents: Document[];
    loading?: boolean;
    refreshing?: boolean;
    viewMode: 'grid' | 'list' | 'table';
    onViewModeChange: (mode: 'grid' | 'list' | 'table') => void;
    onBack: () => void;
    onOpenUpload: () => void;
    onOpenPhotoSearch?: () => void;
    onViewDocument: (doc: Document) => void;
    onEditDocument: (doc: Document) => void;
    onDownloadDocument: (doc: Document) => void;
    onDeleteDocument: (doc: Document) => void;
    onAttachFile?: (doc: Document) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (cat: string) => void;
    extensionFilter: string;
    onExtensionFilterChange: (ext: string) => void;
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
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

export function SupplierDocumentsGallery({
    supplier,
    suppliers,
    documents,
    loading = false,
    refreshing = false,
    viewMode,
    onViewModeChange,
    onBack,
    onOpenUpload,
    onOpenPhotoSearch,
    onViewDocument,
    onEditDocument,
    onDownloadDocument,
    onDeleteDocument,
    onAttachFile,
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    categoryFilter,
    onCategoryFilterChange,
    extensionFilter,
    onExtensionFilterChange,
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
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
}: SupplierDocumentsGalleryProps) {
    const isAllSuppliers = supplier.id === 0 || supplier.name === 'All Suppliers';

    // compute counts for active view
    const documentFilesCount = useMemo(() => {
        return documents.filter((d) => d.category !== 'photos').length;
    }, [documents]);

    const photoFilesCount = useMemo(() => {
        return documents.filter((d) => d.category === 'photos').length;
    }, [documents]);

    const activeTotalBytes = useMemo(() => {
        return documents.reduce((sum, d) => sum + (d.file_size || 0), 0);
    }, [documents]);

    // quick document type filters
    const typePills = [
        { label: 'All Types', value: '' },
        { label: 'Delivery Receipts', value: 'delivery_receipt' },
        { label: 'Invoices', value: 'invoice' },
        { label: 'Purchase Orders', value: 'purchase_order' },
        { label: 'Proof of Delivery', value: 'proof_of_delivery' },
        { label: 'Quality Inspection', value: 'quality_inspection' },
        { label: 'Others', value: 'other' },
    ];

    const extensionPills = [
        { label: 'All Formats', value: '' },
        { label: 'PDF', value: 'pdf' },
        { label: 'Images (JPG/PNG)', value: 'jpg' },
        { label: 'Word (DOCX)', value: 'word' },
        { label: 'Excel (XLSX)', value: 'excel' },
    ];

    return (
        <div className="space-y-6">
            {/* back navigation & supplier header card */}
            <div className="p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_20px_rgba(166,175,195,0.35),-6px_-6px_20px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.7)] space-y-4">
                {/* top row: back button and action triggers */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-300 dark:hover:border-pink-800 transition-all shadow-[2px_2px_6px_rgba(166,175,195,0.3),-2px_-2px_6px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] cursor-pointer group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Back to Suppliers Overview</span>
                    </button>

                    {/* right view toggles and upload button */}
                    <div className="flex items-center gap-2.5">
                        {/* view mode toggle */}
                        <div className="p-1 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onViewModeChange('grid')}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    viewMode === 'grid'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Gallery Grid View"
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className="hidden sm:inline">Grid</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('list')}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    viewMode === 'list'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Gallery List View"
                            >
                                <List className="w-4 h-4" />
                                <span className="hidden sm:inline">List</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('table')}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    viewMode === 'table'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Detailed Table View"
                            >
                                <TableIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Table</span>
                            </button>
                        </div>

                        {/* upload button */}
                        <AppButton
                            type="button"
                            variant="pink"
                            size="sm"
                            onClick={onOpenUpload}
                            className="cursor-pointer"
                        >
                            <Upload className="w-4 h-4 mr-1.5" />
                            <span>Upload Document</span>
                        </AppButton>
                    </div>
                </div>

                {/* supplier banner details */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0 uppercase">
                            {isAllSuppliers ? <Building2 className="w-7 h-7" /> : supplier.name.substring(0, 2)}
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                                    {supplier.name}
                                </h2>
                                {supplier.category && (
                                    <StatusBadge tone="pink" size="xs">
                                        {supplier.category}
                                    </StatusBadge>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                {supplier.contact_person && (
                                    <span className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        {supplier.contact_person}
                                    </span>
                                )}
                                {supplier.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {supplier.location}
                                    </span>
                                )}
                                {supplier.email && (
                                    <span className="flex items-center gap-1 font-mono text-[11px]">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        {supplier.email}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* quick metrics badges */}
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <div className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800/80 text-center shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                {totalItems}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                Total Files
                            </span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800/80 text-center shrink-0">
                            <span className="text-xs font-bold text-pink-600 dark:text-pink-400 block">
                                {supplier.document_count || documentFilesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                Documents
                            </span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800/80 text-center shrink-0">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">
                                {supplier.photo_count || photoFilesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                Photos
                            </span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800/80 text-center shrink-0">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block font-mono">
                                {formatFileSize(supplier.total_size || activeTotalBytes)}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                Storage
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* filter and search bar for documents */}
            {viewMode !== 'table' && (
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_20px_rgba(166,175,195,0.35),-6px_-6px_20px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.7)] space-y-3.5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* search input and photo search button */}
                        <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Search documents, PO numbers, file names for ${supplier.name}...`}
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-pink-500/30 transition-all shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)]"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => onSearchChange('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {onOpenPhotoSearch && (
                                <button
                                    type="button"
                                    onClick={onOpenPhotoSearch}
                                    title="Search Document with Photo"
                                    aria-label="Search Document with Photo"
                                    className="px-3 sm:px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] hover:bg-[#e2eaf5] dark:bg-[#1e1f2c] dark:hover:bg-[#27293a] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] active:scale-95 transition-all flex items-center gap-2 text-xs font-bold shrink-0 cursor-pointer"
                                >
                                    <Camera className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                                    <span className="hidden sm:inline">Photo Search</span>
                                </button>
                            )}
                        </div>

                        {/* category filter buttons (All / Documents / Photos) */}
                        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shrink-0">
                            <button
                                type="button"
                                onClick={() => onCategoryFilterChange('')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    categoryFilter === ''
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                All Media
                            </button>
                            <button
                                type="button"
                                onClick={() => onCategoryFilterChange('documents')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'documents'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Documents</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onCategoryFilterChange('photos')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'photos'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Photos</span>
                            </button>
                        </div>
                    </div>

                    {/* secondary filter pills */}
                    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                                Type:
                            </span>
                            {typePills.map((p) => {
                                const isActive = typeFilter === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => onTypeFilterChange(p.value)}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                                            isActive
                                                ? 'bg-pink-500 text-white shadow-xs'
                                                : 'bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* format filter */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <select
                                value={extensionFilter}
                                onChange={(e) => onExtensionFilterChange(e.target.value)}
                                className="px-2.5 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                            >
                                {extensionPills.map((e) => (
                                    <option key={e.value} value={e.value}>
                                        {e.label}
                                    </option>
                                ))}
                            </select>

                            {(searchTerm || typeFilter || categoryFilter || extensionFilter || dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={onClearFilters}
                                    className="px-2.5 py-1 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* main content display based on viewMode */}
            {viewMode === 'table' ? (
                <DocumentsTable
                    documents={documents}
                    loading={loading}
                    refreshing={refreshing}
                    suppliers={suppliers}
                    searchTerm={searchTerm}
                    onSearchChange={onSearchChange}
                    typeFilter={typeFilter}
                    onTypeFilterChange={onTypeFilterChange}
                    extensionFilter={extensionFilter}
                    onExtensionFilterChange={onExtensionFilterChange}
                    supplierFilter={isAllSuppliers ? '' : supplier.name}
                    onSupplierFilterChange={() => {}}
                    dateFrom={dateFrom}
                    onDateFromChange={onDateFromChange}
                    dateTo={dateTo}
                    onDateToChange={onDateToChange}
                    onClearFilters={onClearFilters}
                    onRefresh={onRefresh}
                    selectedDocIds={selectedDocIds}
                    onToggleSelectDoc={onToggleSelectDoc}
                    onToggleSelectAll={onToggleSelectAll}
                    isDownloading={isDownloading}
                    isBulkDeleting={isBulkDeleting}
                    onDownloadSelected={onDownloadSelected}
                    onDeleteSelected={onDeleteSelected}
                    onClearSelection={onClearSelection}
                    onViewDocument={onViewDocument}
                    onEditDocument={onEditDocument}
                    onDownloadDocument={onDownloadDocument}
                    onDeleteDocument={onDeleteDocument}
                    onAttachFile={onAttachFile}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={onPageChange}
                />
            ) : viewMode === 'grid' ? (
                <>
                    {loading && documents.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-72 rounded-3xl bg-slate-200/50 dark:bg-slate-800/40" />
                            ))}
                        </div>
                    ) : documents.length > 0 ? (
                        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <AnimatePresence mode="popLayout">
                                {documents.map((doc, index) => (
                                    <motion.div
                                        key={doc.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.92, y: -8 }}
                                        transition={{
                                            duration: 0.25,
                                            ease: [0.25, 1, 0.5, 1],
                                            delay: Math.min(index * 0.02, 0.2),
                                        }}
                                    >
                                        <SupplierDocumentCard
                                            doc={doc}
                                            onPreview={onViewDocument}
                                            onDownload={onDownloadDocument}
                                            onEdit={onEditDocument}
                                            onDelete={(id, title) => onDeleteDocument({ id, title } as Document)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <div className="p-16 text-center rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-md space-y-3">
                            <FolderOpen className="w-12 h-12 mx-auto text-slate-400" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                No Documents Found
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                No documents match your filter criteria for {supplier.name}. You can upload new delivery receipts, invoices, or photos for this supplier now.
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <AppButton type="button" variant="pink" size="sm" onClick={onOpenUpload}>
                                    <Upload className="w-4 h-4 mr-1.5" />
                                    <span>Upload First Document</span>
                                </AppButton>
                                {(searchTerm || typeFilter || categoryFilter || extensionFilter) && (
                                    <AppButton type="button" variant="neutral" size="sm" onClick={onClearFilters}>
                                        <span>Reset Filters</span>
                                    </AppButton>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* list view */
                <>
                    {loading && documents.length === 0 ? (
                        <div className="space-y-3 animate-pulse">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-20 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40" />
                            ))}
                        </div>
                    ) : documents.length > 0 ? (
                        <motion.div layout className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {documents.map((doc, index) => (
                                    <motion.div
                                        key={doc.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{
                                            duration: 0.2,
                                            delay: Math.min(index * 0.015, 0.15),
                                        }}
                                    >
                                        <SupplierDocumentListItem
                                            doc={doc}
                                            onPreview={onViewDocument}
                                            onDownload={onDownloadDocument}
                                            onEdit={onEditDocument}
                                            onDelete={(id, title) => onDeleteDocument({ id, title } as Document)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <div className="p-16 text-center rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-md space-y-3">
                            <FolderOpen className="w-12 h-12 mx-auto text-slate-400" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                No Documents Found
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                No documents match your filter criteria for {supplier.name}.
                            </p>
                            <AppButton type="button" variant="pink" size="sm" onClick={onOpenUpload}>
                                <Upload className="w-4 h-4 mr-1.5" />
                                <span>Upload Document</span>
                            </AppButton>
                        </div>
                    )}
                </>
            )}

            {/* pagination controls for grid and list views */}
            {viewMode !== 'table' && totalPages > 1 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Page {currentPage} of {totalPages} ({totalItems} items)
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            className="p-2 rounded-xl text-xs font-bold bg-[#f0f3f8] dark:bg-[#191a24] border border-slate-200/60 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold px-3 py-1 bg-pink-500 text-white rounded-xl">
                            {currentPage}
                        </span>
                        <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                            className="p-2 rounded-xl text-xs font-bold bg-[#f0f3f8] dark:bg-[#191a24] border border-slate-200/60 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
