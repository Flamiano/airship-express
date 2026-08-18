
import { Metadata } from 'next';
import { Suspense } from 'react';
import InventoryClient from './InventoryContentWrapper';
import { PageSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'Warehouse Inventory | Supply Chain Management',
    description: 'Manage warehouse inventory items, stock levels, and parcels'
};

export default function InventoryPage() {
    return (
        <Suspense
            fallback={
                <PageSkeleton />
            }
        >
            <SessionGuard requiredRole={['Admin', 'Manager', 'Employee', 'Operator', 'Executive']}>
                <InventoryClient />
            </SessionGuard>
        </Suspense>
    );
}