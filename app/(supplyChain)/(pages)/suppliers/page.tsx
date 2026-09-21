// server component entry point for suppliers and vendor management

import { Metadata } from 'next';
import { Suspense } from 'react';
import { SessionGuard } from '../../components/server/SessionGuard';
import { PageSkeleton } from '../../components/ui/SkeletonLoader';
import SuppliersContentWrapper from './SuppliersContentWrapper';

export const metadata: Metadata = {
    title: 'Suppliers & Vendors | Supply Chain Management',
    description: 'Track supplier purchases, order frequency, and spending patterns.',
};

export default function SuppliersPage() {
    return (
        <SessionGuard requiredRole={['Admin', 'Manager', 'Executive']}>
            <Suspense fallback={<PageSkeleton />}>
                <SuppliersContentWrapper />
            </Suspense>
        </SessionGuard>
    );
}
