'use client';

import Cards from '../../../../components/global/Cards';
import { CardsSkeleton } from '../../../../components/ui/SkeletonLoader';

interface StatsCardsProps {
    totalItems?: number;
    availableItems?: number;
    lowStockItems: number;
    outOfStockItems: number;
    isLoading?: boolean;
    showTotal?: boolean;
    onStatusClick?: (status: string) => void;
    activeStatus?: string;
}

export function StatsCards({
    totalItems,
    availableItems,
    lowStockItems,
    outOfStockItems,
    isLoading = false,
    showTotal = false,
    onStatusClick,
    activeStatus = 'all',
}: StatsCardsProps) {
    if (isLoading) {
        return (
            <CardsSkeleton
                count={showTotal ? 4 : 3}
                className={showTotal ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4" : "grid-cols-1 sm:grid-cols-3 gap-4"}
            />
        );
    }

    const safeAvailableItems = availableItems ?? Math.max(0, (totalItems || 0) - lowStockItems - outOfStockItems);

    return (
        <div className={`grid gap-4 overflow-visible ${showTotal ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {showTotal && totalItems !== undefined && (
                <div className={`rounded-2xl transition-all duration-200 ${activeStatus === 'all' ? 'ring-2 ring-pink-500/50 shadow-md' : ''}`}>
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
                        tooltip="View all items"
                        onActionClick={onStatusClick ? () => onStatusClick('all') : undefined}
                        actionLabel="Show All"
                        badge={`${totalItems} Total`}
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />
                </div>
            )}

            <div className={`rounded-2xl transition-all duration-200 ${activeStatus === 'available' ? 'ring-2 ring-emerald-500/70 shadow-md' : ''}`}>
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
                    backDescription={`${safeAvailableItems} items are adequately stocked.\n\n Ready for fulfillment and operations.\n\n📦 Meets or exceeds safety buffer.`}
                    tooltip={activeStatus === 'available' ? "Filter active (click to reset)" : "Filter In Stock items"}
                    onActionClick={onStatusClick ? () => onStatusClick(activeStatus === 'available' ? 'all' : 'available') : undefined}
                    actionLabel={activeStatus === 'available' ? "Clear Filter" : "Filter"}
                    badge={`${safeAvailableItems} In Stock`}
                    frontTextColor="text-emerald-600 dark:text-emerald-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            <div className={`rounded-2xl transition-all duration-200 ${activeStatus === 'low-stock' ? 'ring-2 ring-amber-500/70 shadow-md' : ''}`}>
                <Cards
                    frontIcon="fas fa-triangle-exclamation mr-1"
                    header="Low Stock"
                    data={lowStockItems.toLocaleString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Need restock"
                    backBg="bg-ink dark:bg-accent"
                    backHeader="Low Stock Items"
                    backIcon="fas fa-triangle-exclamation"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${lowStockItems} items are below minimum stock levels.\n\n These items need immediate attention.\n\n🔍 Check inventory or submit requisition.`}
                    tooltip={activeStatus === 'low-stock' ? "Filter active (click to reset)" : "Filter Low Stock items"}
                    onActionClick={onStatusClick ? () => onStatusClick(activeStatus === 'low-stock' ? 'all' : 'low-stock') : undefined}
                    actionLabel={activeStatus === 'low-stock' ? "Clear Filter" : "Filter"}
                    badge={lowStockItems > 0 ? `${lowStockItems} Alert` : '0 Alert'}
                    frontTextColor="text-amber-600 dark:text-amber-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            <div className={`rounded-2xl transition-all duration-200 ${activeStatus === 'out-of-stock' ? 'ring-2 ring-rose-500/70 shadow-md' : ''}`}>
                <Cards
                    frontIcon="fas fa-circle-xmark mr-1"
                    header="Out of Stock"
                    data={outOfStockItems.toLocaleString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Unavailable"
                    backBg="bg-ink dark:bg-accent"
                    backHeader="Out of Stock Items"
                    backIcon="fas fa-circle-xmark"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${outOfStockItems} items are currently out of stock.\n\n🛑 Immediate restock required to prevent shortages.\n\n🔍 Check inventory to reorder.`}
                    tooltip={activeStatus === 'out-of-stock' ? "Filter active (click to reset)" : "Filter Out of Stock items"}
                    onActionClick={onStatusClick ? () => onStatusClick(activeStatus === 'out-of-stock' ? 'all' : 'out-of-stock') : undefined}
                    actionLabel={activeStatus === 'out-of-stock' ? "Clear Filter" : "Filter"}
                    badge={outOfStockItems > 0 ? `${outOfStockItems} Depleted` : '0 Depleted'}
                    frontTextColor="text-rose-600 dark:text-rose-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>
        </div>
    );
}