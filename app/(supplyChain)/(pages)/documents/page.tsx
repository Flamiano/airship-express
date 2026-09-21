// server page component providing metadata, session protection, and fallback skeleton
import { Metadata } from 'next';
import { Suspense } from 'react';
import DocumentsContentWrapper from './DocumentsContentWrapper';
import { PageSkeleton } from '../../components/ui/SkeletonLoader';
import { SessionGuard } from '../../components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'Document Tracking & Logistics Records | Supply Chain Management',
    description: 'Centralized evidence repository for daily operations, receipts, and audit trail',
};

export default function DocumentsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <SessionGuard requiredRole={['Admin', 'Manager', 'Employee', 'Executive']}>
                <DocumentsContentWrapper />
            </SessionGuard>
        </Suspense>
    );
}