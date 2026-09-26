// client orchestrator connecting suppliers hook with presentation tables and modals

"use client";

import React from "react";
import { useSuppliers } from "./hooks/useSuppliers";
import { SuppliersHeader } from "./components/common/SuppliersHeader";
import { SuppliersStatsCards } from "./components/common/SuppliersStatsCards";
import { SuppliersCharts } from "./components/charts/SuppliersCharts";
import { SupplierDirectoryTable } from "./components/tables/SupplierDirectoryTable";
import { RecentPurchaseHistoryTable } from "./components/tables/RecentPurchaseHistoryTable";
import { SupplierViewModal } from "./components/modals/SupplierViewModal";
import { SupplierAddModal } from "./components/modals/SupplierAddModal";
import { SupplierEditModal } from "./components/modals/SupplierEditModal";
import { PurchaseOrderDetailModal } from "./components/modals/PurchaseOrderDetailModal";
import { SupplierActivityDetailModal } from "./components/modals/SupplierActivityDetailModal";
import { SupplierCategoryDetailModal } from "./components/modals/SupplierCategoryDetailModal";
import { ITEMS_PER_PAGE, PO_ITEMS_PER_PAGE } from "./types";

export default function SuppliersContentWrapper() {
    const {
        suppliers,
        purchaseOrders,
        isLoading,
        searchTerm,
        setSearchTerm,
        categoryFilter,
        setCategoryFilter,
        categories,
        selectedSupplier,
        setSelectedSupplier,
        showModal,
        setShowModal,
        showNewSupplierModal,
        setShowNewSupplierModal,
        showEditSupplierModal,
        setShowEditSupplierModal,
        isSubmitting,
        selectedSuppliers,
        setSelectedSuppliers,
        editingSupplier,
        setEditingSupplier,
        showActivityDetailModal,
        setShowActivityDetailModal,
        showCategoryDetailModal,
        setShowCategoryDetailModal,
        selectedChartData,
        currentPOPage,
        setCurrentPOPage,
        currentPage,
        setCurrentPage,
        newSupplier,
        setNewSupplier,
        selectedPurchaseOrder,
        showPurchaseOrderModal,
        setShowPurchaseOrderModal,
        activityChartRef,
        categoryChartRef,
        filteredSuppliers,
        totalPages,
        paginatedSuppliers,
        activeSuppliers,
        paginatedPurchaseOrders,
        POTotalPages,
        topSupplier,
        topCategory,
        supplierStats,
        handleAddSupplier,
        handleUpdateSupplier,
        handleDeleteSupplier,
        handleBulkDelete,
        handleToggleSelect,
        handleSelectAll,
        handleToggleActive,
        handleViewPurchaseOrder,
    } = useSuppliers();

    return (
        <div className="main-shell bgCard">
            <div className="p-6 space-y-6 fade-in">
                {/* page header */}
                <SuppliersHeader
                    totalSuppliers={suppliers.length}
                    activeSuppliers={activeSuppliers}
                    selectedCount={selectedSuppliers.size}
                    onBulkDelete={handleBulkDelete}
                    onNewSupplier={() => setShowNewSupplierModal(true)}
                />

                {/* statistics cards */}
                <SuppliersStatsCards
                    isLoading={isLoading}
                    activeSuppliers={activeSuppliers}
                    totalSuppliers={suppliers.length}
                    supplierStats={supplierStats}
                    topSupplier={topSupplier}
                    topCategory={topCategory}
                />

                {/* visual charts */}
                <SuppliersCharts
                    isLoading={isLoading}
                    suppliersCount={suppliers.length}
                    purchaseOrdersCount={purchaseOrders.length}
                    activityChartRef={activityChartRef}
                    categoryChartRef={categoryChartRef}
                    onAddSupplier={() => setShowNewSupplierModal(true)}
                />

                {/* supplier directory table */}
                <SupplierDirectoryTable
                    isLoading={isLoading}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    categories={categories}
                    filteredSuppliers={filteredSuppliers}
                    paginatedSuppliers={paginatedSuppliers}
                    selectedSuppliers={selectedSuppliers}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={ITEMS_PER_PAGE}
                    setCurrentPage={setCurrentPage}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    onBulkDelete={handleBulkDelete}
                    onClearSelection={() => setSelectedSuppliers(new Set())}
                    onToggleActive={handleToggleActive}
                    onViewSupplier={(supplier) => {
                        setSelectedSupplier(supplier);
                        setShowModal(true);
                    }}
                    onEditSupplier={(supplier) => {
                        setEditingSupplier({ ...supplier });
                        setShowEditSupplierModal(true);
                    }}
                    onDeleteSupplier={handleDeleteSupplier}
                />

                {/* recent purchase history table (view only) */}
                <RecentPurchaseHistoryTable
                    isLoading={isLoading}
                    purchaseOrders={purchaseOrders}
                    paginatedPurchaseOrders={paginatedPurchaseOrders}
                    currentPOPage={currentPOPage}
                    POTotalPages={POTotalPages}
                    POItemsPerPage={PO_ITEMS_PER_PAGE}
                    setCurrentPOPage={setCurrentPOPage}
                    onViewPurchaseOrder={handleViewPurchaseOrder}
                />
            </div>

            {/* view supplier modal */}
            <SupplierViewModal
                isOpen={showModal}
                supplier={selectedSupplier}
                purchaseOrders={purchaseOrders}
                onClose={() => setShowModal(false)}
                onEdit={(supplier) => {
                    setEditingSupplier({ ...supplier });
                    setShowEditSupplierModal(true);
                }}
                onDelete={handleDeleteSupplier}
            />

            {/* add supplier modal */}
            <SupplierAddModal
                isOpen={showNewSupplierModal}
                isSubmitting={isSubmitting}
                categories={categories}
                newSupplier={newSupplier}
                setNewSupplier={setNewSupplier}
                onClose={() => setShowNewSupplierModal(false)}
                onSubmit={handleAddSupplier}
            />

            {/* edit supplier modal */}
            <SupplierEditModal
                isOpen={showEditSupplierModal}
                isSubmitting={isSubmitting}
                editingSupplier={editingSupplier}
                categories={categories}
                setEditingSupplier={setEditingSupplier}
                onClose={() => {
                    setShowEditSupplierModal(false);
                    setEditingSupplier(null);
                }}
                onSubmit={handleUpdateSupplier}
            />

            {/* purchase order detail modal */}
            <PurchaseOrderDetailModal
                isOpen={showPurchaseOrderModal}
                purchaseOrder={selectedPurchaseOrder}
                onClose={() => setShowPurchaseOrderModal(false)}
            />

            {/* activity chart detail modal */}
            <SupplierActivityDetailModal
                isOpen={showActivityDetailModal}
                chartData={selectedChartData}
                purchaseOrders={purchaseOrders}
                onClose={() => setShowActivityDetailModal(false)}
            />

            {/* category chart detail modal */}
            <SupplierCategoryDetailModal
                isOpen={showCategoryDetailModal}
                chartData={selectedChartData}
                purchaseOrders={purchaseOrders}
                onClose={() => setShowCategoryDetailModal(false)}
            />
        </div>
    );
}
