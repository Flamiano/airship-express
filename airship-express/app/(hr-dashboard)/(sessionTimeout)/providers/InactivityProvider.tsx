'use client';

import { useState, useCallback, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useInactivityTimer } from '../../hooks/useInactivityTimer';
import InactivityWarningModal from '../components/InactivityWarningModal';
import { useToast } from '../../(dashboard)/payroll-benefits-dashboard/components/ui/Toast';

interface InactivityProviderProps {
    children: ReactNode;
    timeoutMinutes?: number;
}

export function InactivityProvider({
    children,
    timeoutMinutes = 5,
}: InactivityProviderProps) {
    const [showWarning, setShowWarning] = useState(false);
    const pathname = usePathname();
    const toast = useToast();

    const handleWarning = useCallback(() => {
        setShowWarning(true);
        toast.showWarning(
            'Your session will expire soon. Click "Stay Active" to continue.',
            'Session Expiring'
        );
    }, [toast]);

    const handleLogout = useCallback(() => {
        setShowWarning(false);
        toast.showInfo('You have been logged out due to inactivity.', 'Session Ended');
    }, [toast]);

    const { resetTimer, logout, getTimeRemaining } = useInactivityTimer({
        timeoutMinutes,
        warningMinutes: 0.5,
        onWarning: handleWarning,
        onLogout: handleLogout,
        enabled: true,
    });

    const handleStayActive = useCallback(() => {
        setShowWarning(false);
        resetTimer();
        toast.showInfo('Session extended successfully.', 'Session Extended');
    }, [resetTimer, toast]);

    // Reset timer on any route change (this is the key fix)
    useEffect(() => {
        if (pathname) {
            resetTimer();
        }
    }, [pathname, resetTimer]);

    // Reset timer on visibility change (user comes back to tab)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                resetTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [resetTimer]);

    return (
        <>
            {children}
            <InactivityWarningModal
                isOpen={showWarning}
                onStayActive={handleStayActive}
                onLogout={logout}
                timeRemaining={30}
            />
        </>
    );
}