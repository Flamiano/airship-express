
import { Metadata } from 'next';
import { Suspense } from 'react';
import InventoryClient from './InventoryContentWrapper';
import { PageSkeleton } from '../../components/ui/SkeletonLoader';
import { SessionGuard } from '../../components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'Warehouse Inventory | Supply Chain Management',
    description: 'Manage warehouse inventory items and stock levels'
};

export default function InventoryPage() {
    return (
        <Suspense
            fallback={
                <PageSkeleton />
            }
        >
            <SessionGuard requiredRole={['Admin', 'Purchase Officer', 'Operator', 'Executive']}>
                <InventoryClient />
            </SessionGuard>
        </Suspense>
    );
}