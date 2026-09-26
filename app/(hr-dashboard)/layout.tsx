'use client';

import { useHRAccess } from '@/app/(hr-dashboard)/hooks/HRAccess';
import Loader from '@/app/components/Loader';
import ToastProvider from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import { InactivityProvider } from '@/app/(hr-dashboard)/(sessionTimeout)/providers/InactivityProvider';
import { SESSION_INACTIVITY_MINUTES } from '@/lib/hr-dashboard/constants/session';

export default function HRDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isLoading, isAuthorized } = useHRAccess();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <ToastProvider position="top-right" maxToasts={5}>
            <InactivityProvider timeoutMinutes={SESSION_INACTIVITY_MINUTES}>
                {children}
            </InactivityProvider>
        </ToastProvider>
    );
}