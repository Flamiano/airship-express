// client component orchestrator connecting hook state to header, cards, dock, tables, and modals
'use client';

import React from 'react';
import { useDocuments } from './hooks/useDocuments';
import { DocumentsHeader } from './components/common/DocumentsHeader';
import { DocumentsStatsCards } from './components/common/DocumentsStatsCards';
import { CategoryDock } from './components/common/CategoryDock';
import { DocumentsTable } from './components/tables/DocumentsTable';
import { ActivityHistoryTable } from './components/tables/ActivityHistoryTable';
import { DocumentUploadModal } from './components/modals/DocumentUploadModal';
import { DocumentEditModal } from './components/modals/DocumentEditModal';
import { DocumentPreviewModal } from './components/modals/DocumentPreviewModal';
import { DocumentAttachFileModal } from './components/modals/DocumentAttachFileModal';

export default function DocumentsContentWrapper() {
    const {
        documents,
        suppliers,
        activities,
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
        activityFilter,
        setActivityFilter,
        activitySearch,
        setActivitySearch,
        activityPage,
        setActivityPage,
        totalActivities,
        activitiesPerPage,
        userName,
        userEmail,
        userRole,
        archiveCount,
        activityDateFrom,
        setActivityDateFrom,
        activityDateTo,
        setActivityDateTo,
        selectedDocIds,
        setSelectedDocIds,
        selectedActivityIds,
        setSelectedActivityIds,
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
        deleteSelectedActivities,
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
        toggleSelectAllActivities,
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

            {/* category & document type dock filter */}
            <CategoryDock
                categoryFilter={categoryFilter}
                typeFilter={typeFilter}
                totalFiles={totalFiles}
                totalPhotos={totalPhotos}
                documents={documents}
                onSelectCategory={(cat) => {
                    setCategoryFilter(cat);
                    setTypeFilter("");
                    setCurrentPage(1);
                }}
                onSelectType={(type) => {
                    setTypeFilter(typeFilter === type ? "" : type);
                    setCategoryFilter("");
                    setCurrentPage(1);
                }}
            />

            {/* documents table */}
            <DocumentsTable
                documents={documents}
                loading={loading}
                refreshing={refreshing}
                suppliers={suppliers}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                typeFilter={typeFilter}
                onTypeFilterChange={(val) => {
                    setTypeFilter(val);
                    setCurrentPage(1);
                }}
                extensionFilter={extensionFilter}
                onExtensionFilterChange={(val) => {
                    setExtensionFilter(val);
                    setCurrentPage(1);
                }}
                supplierFilter={supplierFilter}
                onSupplierFilterChange={(val) => {
                    setSupplierFilter(val);
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
                onViewDocument={handleViewDocument}
                onEditDocument={handleEditDocument}
                onDownloadDocument={downloadFile}
                onDeleteDocument={handleDelete}
                onAttachFile={openAttachModal}
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            {/* activity history table */}
            <ActivityHistoryTable
                activities={activities}
                activitySearch={activitySearch}
                onActivitySearchChange={setActivitySearch}
                activityFilter={activityFilter}
                onActivityFilterChange={setActivityFilter}
                activityDateFrom={activityDateFrom}
                onActivityDateFromChange={setActivityDateFrom}
                activityDateTo={activityDateTo}
                onActivityDateToChange={setActivityDateTo}
                onResetFilters={() => {
                    setActivitySearch("");
                    setActivityFilter("");
                    setActivityDateFrom("");
                    setActivityDateTo("");
                    setActivityPage(1);
                    setSelectedActivityIds(new Set());
                }}
                selectedActivityIds={selectedActivityIds}
                onToggleSelectActivity={(id) => {
                    const newSelected = new Set(selectedActivityIds);
                    if (newSelected.has(id)) {
                        newSelected.delete(id);
                    } else {
                        newSelected.add(id);
                    }
                    setSelectedActivityIds(newSelected);
                }}
                onToggleSelectAll={toggleSelectAllActivities}
                onDeleteSelected={deleteSelectedActivities}
                onClearSelection={() => setSelectedActivityIds(new Set())}
                activityPage={activityPage}
                totalActivities={totalActivities}
                activitiesPerPage={activitiesPerPage}
                onPageChange={setActivityPage}
            />

            {/* edit modal */}
            <DocumentEditModal
                isOpen={isEditModalOpen}
                editingDoc={editingDoc}
                editPreviewLoading={editPreviewLoading}
                editPreviewUrl={editPreviewUrl}
                suppliers={suppliers}
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
                userName={userName}
                userRole={userRole}
                maxFiles={maxFilesPerTransaction}
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
        </div>
    );
}
