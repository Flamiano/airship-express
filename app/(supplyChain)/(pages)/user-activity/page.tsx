import { Metadata } from 'next';
import { Suspense } from 'react';
import UserActivityClient from './UserActivityContentWrapper';
import { PageSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'User Activity & Device Management | Supply Chain Management',
    description: 'Monitor active user sessions, blocked devices, appeals, and system audit activities',
};

export default function UserActivityPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <SessionGuard requiredRole={['Admin']}>
                <UserActivityClient />
            </SessionGuard>
        </Suspense>
    );
}