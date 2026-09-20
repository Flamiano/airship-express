import { Metadata } from 'next';
import { Suspense } from 'react';
import SettingsContentWrapper from '@/app/(supplyChain)/(pages)/settings/SettingsContentWrapper';
import { PageSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';

export const metadata: Metadata = {
    title: 'System Settings & Access Controls | Supply Chain Management',
    description: 'Configure user inactivity timers, auto-logout warnings, and role-based page permissions',
};

export default function SettingsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <SessionGuard requiredRole={['Executive', 'Admin']}>
                <SettingsContentWrapper />
            </SessionGuard>
        </Suspense>
    );
}
