// client orchestrator connecting suppliers hook with presentation tables and modals

"use client";

import React from "react";
import { useSuppliers } from "./hooks/useSuppliers";
import { SuppliersHeader } from "./components/common/SuppliersHeader";
import { SuppliersStatsCards } from "./components/common/SuppliersStatsCards";
import { SuppliersCharts } from "./components/charts/SuppliersCharts";
import { SupplierDirectoryTable } from "./components/tables/SupplierDirectoryTable";
import { RecentPurchaseHistoryTable } from "./components/tables/RecentPurchaseHistoryTable";
import { ContractsAndSupplierDocumentsTab } from "./components/tables/ContractsAndSupplierDocumentsTab";
import { SupplierMeetingsTab } from "./components/tables/SupplierMeetingsTab";
import { SupplierViewModal } from "./components/modals/SupplierViewModal";
import { SupplierEditModal } from "./components/modals/SupplierEditModal";
import { PurchaseOrderDetailModal } from "./components/modals/PurchaseOrderDetailModal";
import { SupplierActivityDetailModal } from "./components/modals/SupplierActivityDetailModal";
import { SupplierCategoryDetailModal } from "./components/modals/SupplierCategoryDetailModal";
import { SupplierAccountModal } from "./components/modals/SupplierAccountModal";
import { SupplierMessageModal } from "./components/modals/SupplierMessageModal";
import { ITEMS_PER_PAGE, PO_ITEMS_PER_PAGE, Supplier } from "./types";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Info, Video } from "lucide-react";

export default function SuppliersContentWrapper() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const parseTabParam = (tabStr: string | null): "registered" | "documents" | "meetings" => {
        if (!tabStr) return "registered";
        const normalized = tabStr.toLowerCase().trim();
        if (
            normalized === "documents" ||
            normalized === "contracts" ||
            normalized === "supplier-documents" ||
            normalized === "contracts-documents" ||
            normalized === "docs"
        ) {
            return "documents";
        }
        if (
            normalized === "meetings" ||
            normalized === "meeting" ||
            normalized === "schedule" ||
            normalized === "supplier-meetings"
        ) {
            return "meetings";
        }
        return "registered";
    };

    const urlTab = searchParams.get("tab");
    const [activeTab, setActiveTab] = React.useState<"registered" | "documents" | "meetings">(() => parseTabParam(urlTab));
    const [isTabSwitching, setIsTabSwitching] = React.useState(false);
    const [activeMeetingsCount, setActiveMeetingsCount] = React.useState<number>(0);

    // Synchronize active tab
    React.useEffect(() => {
        const resolvedTab = parseTabParam(urlTab);
        if (resolvedTab !== activeTab) {
            setActiveTab(resolvedTab);
            if (resolvedTab === "registered") {
                setIsTabSwitching(true);
                setTimeout(() => {
                    setIsTabSwitching(false);
                }, 200);
            }
        }
    }, [urlTab, activeTab]);

    const {
        suppliers,
        potentialCount,
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
        unreadMessageCounts,
        totalUnreadMessages,
        markSupplierMessagesAsRead,
        fetchSuppliers,
        redrawCharts,
        handleAddSupplier,
        handleUpdateSupplier,
        handleDeleteSupplier,
        handleBulkDelete,
        handleToggleSelect,
        handleSelectAll,
        handleToggleActive,
        handleViewPurchaseOrder,
    } = useSuppliers();

    const [showAccountModal, setShowAccountModal] = React.useState(false);
    const [accountSupplier, setAccountSupplier] = React.useState<Supplier | null>(null);

    const [showMessageModal, setShowMessageModal] = React.useState(false);
    const [messageSupplier, setMessageSupplier] = React.useState<Supplier | null>(null);

    // Smooth tab switching handler that updates the ?tab= URL param
    const handleTabChange = (tab: "registered" | "documents" | "meetings") => {
        if (tab === activeTab) return;
        setActiveTab(tab);

        // Update URL query parameter seamlessly without full page reload
        try {
            const currentParams = new URLSearchParams(searchParams.toString());
            currentParams.set("tab", tab);
            const updatedUrl = `${pathname}?${currentParams.toString()}`;
            window.history.replaceState(null, "", updatedUrl);
        } catch {
            // fallback
        }

        if (tab === "registered") {
            setIsTabSwitching(true);
            setTimeout(() => {
                setIsTabSwitching(false);
                redrawCharts();
            }, 250);
        }
    };

    // Trigger chart redraw whenever activeTab becomes registered
    React.useEffect(() => {
        if (activeTab === "registered" && !isLoading) {
            const timer = setTimeout(() => {
                redrawCharts();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTab, isLoading, redrawCharts]);

    const isRegisteredLoading = isLoading || isTabSwitching;

    return (
        <div className="main-shell bgCard">
            <div className="p-6 space-y-6 fade-in">
                {/* page header */}
                <SuppliersHeader
                    totalSuppliers={suppliers.length}
                    activeSuppliers={activeSuppliers}
                    selectedCount={selectedSuppliers.size}
                    totalUnreadMessages={totalUnreadMessages}
                    onBulkDelete={handleBulkDelete}
                />

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-fit flex-wrap sm:flex-nowrap relative z-10">
                    <button
                        type="button"
                        onClick={() => handleTabChange("registered")}
                        className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 relative cursor-pointer active:scale-95 ${
                            activeTab === "registered"
                                ? "bg-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.4)]"
                                : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]"
                        }`}
                    >
                        <i className="fa-solid fa-building text-xs" />
                        <span>Registered Suppliers</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                activeTab === "registered"
                                    ? "bg-white text-pink-600 shadow-sm"
                                    : "bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400"
                            }`}
                        >
                            {suppliers.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange("documents")}
                        className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 relative cursor-pointer active:scale-95 ${
                            activeTab === "documents"
                                ? "bg-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.4)]"
                                : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]"
                        }`}
                    >
                        <i className="fa-solid fa-file-contract text-xs" />
                        <span>Contracts &amp; Supplier Documents</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange("meetings")}
                        className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 relative cursor-pointer active:scale-95 ${
                            activeTab === "meetings"
                                ? "bg-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.4)]"
                                : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]"
                        }`}
                    >
                        <Video className="w-3.5 h-3.5 text-inherit" />
                        <span>Supplier Meetings</span>
                        {activeMeetingsCount > 0 && (
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                    activeTab === "meetings"
                                        ? "bg-white text-pink-600 shadow-sm"
                                        : "bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400"
                                }`}
                            >
                                {activeMeetingsCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab 1: Registered Suppliers View */}
                {activeTab === "registered" && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                        {/* statistics cards */}
                        <SuppliersStatsCards
                            isLoading={isRegisteredLoading}
                            activeSuppliers={activeSuppliers}
                            totalSuppliers={suppliers.length}
                            supplierStats={supplierStats}
                            topSupplier={topSupplier}
                            topCategory={topCategory}
                        />

                        {/* visual charts */}
                        <SuppliersCharts
                            isLoading={isRegisteredLoading}
                            suppliersCount={suppliers.length}
                            purchaseOrdersCount={purchaseOrders.length}
                            activityChartRef={activityChartRef}
                            categoryChartRef={categoryChartRef}
                            onRedraw={redrawCharts}
                        />

                        {/* supplier directory table */}
                        <SupplierDirectoryTable
                            isLoading={isRegisteredLoading}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            categoryFilter={categoryFilter}
                            setCategoryFilter={setCategoryFilter}
                            categories={categories}
                            filteredSuppliers={filteredSuppliers}
                            paginatedSuppliers={paginatedSuppliers}
                            selectedSuppliers={selectedSuppliers}
                            unreadMessageCounts={unreadMessageCounts}
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
                            onMessageSupplier={(supplier) => {
                                setMessageSupplier(supplier);
                                setShowMessageModal(true);
                                if (supplier?.id) {
                                    markSupplierMessagesAsRead(supplier.id);
                                }
                            }}
                            onManageAccount={(supplier) => {
                                setAccountSupplier(supplier);
                                setShowAccountModal(true);
                            }}
                        />

                        {/* recent purchase history table (view only) */}
                        <RecentPurchaseHistoryTable
                            isLoading={isRegisteredLoading}
                            purchaseOrders={purchaseOrders}
                            paginatedPurchaseOrders={paginatedPurchaseOrders}
                            currentPOPage={currentPOPage}
                            POTotalPages={POTotalPages}
                            POItemsPerPage={PO_ITEMS_PER_PAGE}
                            setCurrentPOPage={setCurrentPOPage}
                            onViewPurchaseOrder={handleViewPurchaseOrder}
                        />
                    </div>
                )}

                {/* Tab 2: Contracts & Supplier Documents */}
                {activeTab === "documents" && (
                    <div className="animate-in fade-in duration-150">
                        <ContractsAndSupplierDocumentsTab
                            registeredSuppliers={suppliers}
                            onRefresh={fetchSuppliers}
                        />
                    </div>
                )}

                {/* Tab 3: Supplier Meetings */}
                {activeTab === "meetings" && (
                    <div className="animate-in fade-in duration-150">
                        <SupplierMeetingsTab
                            suppliers={suppliers}
                            onMeetingCountChange={setActiveMeetingsCount}
                        />
                    </div>
                )}
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

            {/* supplier account modal */}
            <SupplierAccountModal
                isOpen={showAccountModal}
                supplier={accountSupplier}
                onClose={() => {
                    setShowAccountModal(false);
                    setAccountSupplier(null);
                }}
            />

            {/* supplier message modal */}
            <SupplierMessageModal
                isOpen={showMessageModal}
                supplier={messageSupplier}
                onMessagesRead={markSupplierMessagesAsRead}
                onClose={() => {
                    setShowMessageModal(false);
                    setMessageSupplier(null);
                }}
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
