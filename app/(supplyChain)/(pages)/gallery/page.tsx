// server page component providing metadata, session protection, and fallback skeleton
import { Metadata } from 'next';
import { Suspense } from 'react';
import GalleryContentWrapper from './GalleryContentWrapper';
import { PageSkeleton } from '../../components/ui/SkeletonLoader';
import { SessionGuard } from '../../components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'Media Gallery | Supply Chain Management',
    description: 'Browse and preview uploaded receipts, proof of delivery photos, and operational documents',
};

export default function GalleryPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <SessionGuard requiredRole={['Admin', 'Manager', 'Staff', 'Employee', 'Executive']}>
                <GalleryContentWrapper />
            </SessionGuard>
        </Suspense>
    );
}
