// supplier statistics metric cards component

"use client";

import React from "react";
import Cards from "../../../../components/global/Cards";
import { CardsSkeleton } from "../../../../components/ui/SkeletonLoader";
import { Supplier, SupplierStats } from "../../types";

interface SuppliersStatsCardsProps {
    isLoading: boolean;
    activeSuppliers: number;
    totalSuppliers: number;
    supplierStats: SupplierStats;
    topSupplier: (Supplier & { orderCount: number; totalSpent: number }) | null;
    topCategory: string;
}

export function SuppliersStatsCards({
    isLoading,
    activeSuppliers,
    totalSuppliers,
    supplierStats,
    topSupplier,
    topCategory,
}: SuppliersStatsCardsProps) {
    if (isLoading) {
        return <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4" />;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Cards
                frontIcon="fas fa-building mr-1"
                header="Active Suppliers"
                data={activeSuppliers.toString()}
                arrow="fas fa-arrow-up mr-1"
                description="Total active suppliers"
                backHeader="Supplier Stats"
                headerTextColor="text-slate-400"
                backDescription={`Total suppliers: ${totalSuppliers}, Active: ${activeSuppliers}`}
                tooltip="View all suppliers"
                tooltipLink="#supplierTableId"
                badge={`${activeSuppliers} Active`}
            />
            <Cards
                frontIcon="fas fa-shopping-cart mr-1"
                header="Total Purchases"
                data={supplierStats.totalOrders.toString()}
                arrow="fas fa-arrow-up mr-1"
                description="Orders placed"
                backHeader="Order Stats"
                headerTextColor="text-slate-400"
                backDescription="Total purchase orders placed across all suppliers"
                tooltip="View all purchase orders"
                tooltipLink="/purchase-order"
                badge={`${supplierStats.totalOrders} Total`}
            />
            <Cards
                frontIcon="fas fa-trophy mr-1"
                header="Top Supplier"
                data={supplierStats.topSupplierName}
                arrow="fas fa-arrow-up mr-1"
                description={`${supplierStats.topSupplierOrders} orders`}
                backHeader="Top Supplier Details"
                headerTextColor="text-slate-200"
                backDescription={topSupplier ? `${topSupplier.category} - ${topSupplier.location}` : "No suppliers yet"}
                tooltip="View supplier details"
                tooltipLink={topSupplier ? `/supplier/${topSupplier.id}` : "#"}
                badge={topSupplier ? "Top" : "No Data"}
            />
            <Cards
                frontIcon="fas fa-tags mr-1"
                header="Top Category"
                data={topCategory}
                arrow="fas fa-arrow-up mr-1"
                description="Most common supplier type"
                backHeader="Category Breakdown"
                headerTextColor="text-slate-200"
                backDescription={`${topCategory} is the most common supplier category`}
                tooltip="View category details"
                tooltipLink="#"
                badge={topCategory || "N/A"}
            />
        </div>
    );
}
