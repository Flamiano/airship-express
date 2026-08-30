'use client';

import Cards from '@/app/(supplyChain)/components/global/Cards';

interface StatsCardsProps {
    totalItems: number;
    availableItems?: number;
    lowStockItems: number;
    outOfStockItems: number;
}

export function StatsCards({ totalItems, availableItems, lowStockItems, outOfStockItems }: StatsCardsProps) {
    const safeAvailableItems = availableItems ?? Math.max(0, totalItems - lowStockItems - outOfStockItems);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-visible">
            <Cards
                frontIcon="fas fa-boxes mr-1"
                header="Total Items"
                data={totalItems.toLocaleString()}
                arrow="fas fa-arrow-up mr-1"
                description="Inventory items"
                backBg="bg-ink dark:bg-accent"
                backHeader="Total Inventory"
                backIcon="fas fa-boxes"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`Total of ${totalItems} items in inventory.\n\n📦 All items across all categories and statuses.`}
                tooltip="Click the card to see more details"
            />

            <Cards
                frontIcon="fas fa-check-circle mr-1"
                header="In Stock"
                data={safeAvailableItems.toLocaleString()}
                arrow="fas fa-arrow-up mr-1"
                description="Optimal level"
                backBg="bg-ink dark:bg-accent"
                backHeader="In Stock Items"
                backIcon="fas fa-check-circle"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`${safeAvailableItems} items are adequately stocked.\n\n Ready for fulfillment and operations.`}
                tooltip="Click the card to see more details"
                frontTextColor="text-emerald-600 dark:text-emerald-400"
                descriptionTextColor="text-emerald-600 dark:text-emerald-400"
            />

            <Cards
                frontIcon="fas fa-exclamation-triangle mr-1"
                header="Low Stock"
                data={lowStockItems.toLocaleString()}
                arrow="fas fa-arrow-up mr-1"
                description="Need restock"
                backBg="bg-ink dark:bg-accent"
                backHeader="Low Stock Items"
                backIcon="fas fa-exclamation-triangle"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`${lowStockItems} items are below minimum stock levels.\n\n⚠️ These items need immediate attention.\n\n🔍 Check inventory to review stock levels.`}
                tooltip="Click the card to see more details"
                frontTextColor="text-amber-600 dark:text-amber-400"
                descriptionTextColor="text-amber-600 dark:text-amber-400"
            />

            <Cards
                frontIcon="fas fa-times-circle mr-1"
                header="Out of Stock"
                data={outOfStockItems.toLocaleString()}
                arrow="fas fa-arrow-down mr-1"
                description="Unavailable"
                backBg="bg-ink dark:bg-accent"
                backHeader="Out of Stock Items"
                backIcon="fas fa-times-circle"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`${outOfStockItems} items are currently out of stock.\n\n🛑 These items need restocking immediately.\n\n🔍 Check inventory to reorder.`}
                tooltip="Click the card to see more details"
                frontTextColor="text-red-600 dark:text-red-400"
                descriptionTextColor="text-red-600 dark:text-red-400"
            />
        </div>
    );
}