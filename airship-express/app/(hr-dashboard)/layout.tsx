'use client';

import { useHRAccess } from './hooks/HRAccess';
import Loader from '@/app/components/Loader';
import ToastProvider from './(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import { InactivityProvider } from './(sessionTimeout)/providers/InactivityProvider';

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
            <InactivityProvider timeoutMinutes={5}>
                {children}
            </InactivityProvider>
        </ToastProvider>
    );
}