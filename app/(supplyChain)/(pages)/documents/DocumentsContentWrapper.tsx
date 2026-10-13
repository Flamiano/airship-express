// client component orchestrator connecting hook state to header, cards, dock, tables, and modals
'use client';

import React from 'react';
import { useDocuments } from './hooks/useDocuments';
import { DocumentsHeader } from './components/common/DocumentsHeader';
import { DocumentsStatsCards } from './components/common/DocumentsStatsCards';
import { CategoryDock } from './components/common/CategoryDock';
import { DocumentsTable } from './components/tables/DocumentsTable';
import { SupplierCardsGrid } from './components/suppliers/SupplierCardsGrid';
import { SupplierDocumentsGallery } from './components/gallery/SupplierDocumentsGallery';
import { DocumentUploadModal } from './components/modals/DocumentUploadModal';
import { DocumentEditModal } from './components/modals/DocumentEditModal';
import { DocumentPreviewModal } from './components/modals/DocumentPreviewModal';
import { DocumentAttachFileModal } from './components/modals/DocumentAttachFileModal';
import { SearchDocumentWithPhotoModal } from './components/modals/SearchDocumentWithPhotoModal';

export default function DocumentsContentWrapper() {
    const [isPhotoSearchModalOpen, setIsPhotoSearchModalOpen] = React.useState(false);
    const {
        documents,
        suppliers,
        purchaseOrders,
        loading,
        refreshing,
        searchTerm,
        setSearchTerm,
        typeFilter,
        setTypeFilter,
        extensionFilter,
        setExtensionFilter,
        categoryFilter,
        setCategoryFilter,
        supplierFilter,
        setSupplierFilter,
        selectedSupplier,
        handleSelectSupplier,
        galleryViewMode,
        setGalleryViewMode,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        currentPage,
        setCurrentPage,
        totalPages,
        totalItems,
        itemsPerPage,
        selectedFiles,
        setSelectedFiles,
        uploadProgress,
        selectedDoc,
        setSelectedDoc,
        isUploadModalOpen,
        setIsUploadModalOpen,
        isPreviewModalOpen,
        setIsPreviewModalOpen,
        isEditModalOpen,
        setIsEditModalOpen,
        isAttachModalOpen,
        setIsAttachModalOpen,
        attachTargetDoc,
        openAttachModal,
        ocrWarning,
        isUploading,
        editingDoc,
        setEditingDoc,
        previewUrl,
        setPreviewUrl,
        previewLoading,
        editPreviewUrl,
        setEditPreviewUrl,
        editPreviewLoading,
        userName,
        userEmail,
        userRole,
        archiveCount,
        selectedDocIds,
        setSelectedDocIds,
        isDownloading,
        isBulkDeleting,
        totalFiles,
        totalPhotos,
        dropZoneRef,
        fetchDocuments,
        downloadFile,
        handleDelete,
        downloadSelectedFiles,
        deleteSelectedDocuments,
        handleUpload,
        handleConfirmForceUpload,
        handleUpdate,
        handleViewDocument,
        handleEditDocument,
        clearAllFilters,
        handleFileSelect,
        removeFile,
        clearAllSelectedFiles,
        maxFilesPerTransaction,
        toggleSelectAllDocuments,
    } = useDocuments();

    return (
        <div className="p-6 space-y-6 bgCard dark:bg-ink/90">
            {/* page header */}
            <DocumentsHeader
                userName={userName}
                userEmail={userEmail}
                onOpenUpload={() => setIsUploadModalOpen(true)}
            />

            {/* metric overview cards */}
            <DocumentsStatsCards
                loading={loading}
                totalFiles={totalFiles}
                totalPhotos={totalPhotos}
                archiveCount={archiveCount}
            />

            {/* main view: initial supplier cards or selected supplier gallery */}
            {!selectedSupplier ? (
                <SupplierCardsGrid
                    suppliers={suppliers}
                    loading={loading}
                    totalFiles={totalFiles}
                    totalPhotos={totalPhotos}
                    onSelectSupplier={handleSelectSupplier}
                    onOpenUpload={() => setIsUploadModalOpen(true)}
                    onOpenPhotoSearch={() => setIsPhotoSearchModalOpen(true)}
                />
            ) : (
                <SupplierDocumentsGallery
                    supplier={selectedSupplier}
                    suppliers={suppliers}
                    documents={documents}
                    loading={loading}
                    refreshing={refreshing}
                    viewMode={galleryViewMode}
                    onViewModeChange={setGalleryViewMode}
                    onBack={() => handleSelectSupplier(null)}
                    onOpenUpload={() => setIsUploadModalOpen(true)}
                    onOpenPhotoSearch={() => setIsPhotoSearchModalOpen(true)}
                    onViewDocument={handleViewDocument}
                    onEditDocument={handleEditDocument}
                    onDownloadDocument={downloadFile}
                    onDeleteDocument={handleDelete}
                    onAttachFile={openAttachModal}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    typeFilter={typeFilter}
                    onTypeFilterChange={(val) => {
                        setTypeFilter(val);
                        setCurrentPage(1);
                    }}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={(val) => {
                        setCategoryFilter(val);
                        setCurrentPage(1);
                    }}
                    extensionFilter={extensionFilter}
                    onExtensionFilterChange={(val) => {
                        setExtensionFilter(val);
                        setCurrentPage(1);
                    }}
                    dateFrom={dateFrom}
                    onDateFromChange={(val) => {
                        setDateFrom(val);
                        setCurrentPage(1);
                    }}
                    dateTo={dateTo}
                    onDateToChange={(val) => {
                        setDateTo(val);
                        setCurrentPage(1);
                    }}
                    onClearFilters={clearAllFilters}
                    onRefresh={() => fetchDocuments(false)}
                    selectedDocIds={selectedDocIds}
                    onToggleSelectDoc={(id) => {
                        const newSelected = new Set(selectedDocIds);
                        if (newSelected.has(id)) {
                            newSelected.delete(id);
                        } else {
                            newSelected.add(id);
                        }
                        setSelectedDocIds(newSelected);
                    }}
                    onToggleSelectAll={toggleSelectAllDocuments}
                    isDownloading={isDownloading}
                    isBulkDeleting={isBulkDeleting}
                    onDownloadSelected={downloadSelectedFiles}
                    onDeleteSelected={deleteSelectedDocuments}
                    onClearSelection={() => setSelectedDocIds(new Set())}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            )}


            {/* edit modal */}
            <DocumentEditModal
                isOpen={isEditModalOpen}
                editingDoc={editingDoc}
                editPreviewLoading={editPreviewLoading}
                editPreviewUrl={editPreviewUrl}
                suppliers={suppliers}
                purchaseOrders={purchaseOrders}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingDoc(null);
                    setEditPreviewUrl(null);
                }}
                onSubmit={handleUpdate}
                onDownloadFile={downloadFile}
            />

            {/* preview modal */}
            <DocumentPreviewModal
                isOpen={isPreviewModalOpen}
                selectedDoc={selectedDoc}
                previewLoading={previewLoading}
                previewUrl={previewUrl}
                onClose={() => {
                    setIsPreviewModalOpen(false);
                    setSelectedDoc(null);
                    setPreviewUrl(null);
                }}
                onDownload={downloadFile}
            />

            {/* upload modal */}
            <DocumentUploadModal
                isOpen={isUploadModalOpen}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                selectedFiles={selectedFiles}
                suppliers={suppliers}
                purchaseOrders={purchaseOrders}
                userName={userName}
                userRole={userRole}
                maxFiles={maxFilesPerTransaction}
                defaultSupplier={selectedSupplier && selectedSupplier.id !== 0 ? selectedSupplier.name : undefined}
                dropZoneRef={dropZoneRef}
                onClose={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFiles([]);
                }}
                onFileSelect={handleFileSelect}
                onRemoveFile={removeFile}
                onClearAllFiles={clearAllSelectedFiles}
                onSubmit={handleUpload}
                ocrWarning={ocrWarning}
                onConfirmForceUpload={handleConfirmForceUpload}
            />

            {/* attach file to pending document modal */}
            <DocumentAttachFileModal
                isOpen={isAttachModalOpen}
                document={attachTargetDoc}
                userRole={userRole}
                onClose={() => {
                    setIsAttachModalOpen(false);
                }}
                onAttachSuccess={async () => {
                    await fetchDocuments(false);
                }}
            />

            {/* search document with photo modal */}
            <SearchDocumentWithPhotoModal
                isOpen={isPhotoSearchModalOpen}
                onClose={() => setIsPhotoSearchModalOpen(false)}
                onViewDocument={handleViewDocument}
                onApplySearchTerm={(term) => {
                    setSearchTerm(term);
                    setCurrentPage(1);
                }}
                onSelectSupplier={(supplierName) => {
                    const found = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
                    if (found) {
                        handleSelectSupplier(found);
                    }
                }}
            />
        </div>
    );
}
