'use client';

import { useState, useCallback, ReactNode, useEffect } from 'react';
import { useInactivityTimer } from '@/app/(hr-dashboard)/hooks/useInactivityTimer';
import InactivityWarningModal from '@/app/(hr-dashboard)/(sessionTimeout)/components/InactivityWarningModal';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    SESSION_INACTIVITY_MINUTES,
    SESSION_WARNING_SECONDS,
    SESSION_START_KEY,
} from '@/lib/hr-dashboard/constants/session';

interface InactivityProviderProps {
    children: ReactNode;
    timeoutMinutes?: number;
}

export function InactivityProvider({
    children,
    timeoutMinutes = SESSION_INACTIVITY_MINUTES,
}: InactivityProviderProps) {
    const [showWarning, setShowWarning] = useState(false);
    const [started, setStarted] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const check = () => {
            const key = localStorage.getItem(SESSION_START_KEY);
            const next = !!key;
            setStarted((prev) => (prev !== next ? next : prev));
        };
        check();
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleWarning = useCallback(() => {
        setShowWarning(true);
    }, []);

    const handleLogout = useCallback(
        (reason: 'inactivity' | 'absolute' | 'manual') => {
            setShowWarning(false);
            try {
                if (reason === 'absolute') {
                    toast.showInfo(
                        'You have reached the session time limit. Please sign in again.',
                        'Session Ended'
                    );
                } else if (reason === 'inactivity') {
                    toast.showInfo(
                        'You were signed out due to inactivity.',
                        'Session Ended'
                    );
                }
            } catch (err) {
                console.warn('toast failed', err);
            }
        },
        [toast]
    );
    
    const { resetTimer, logout } = useInactivityTimer({
        timeoutMinutes,
        warningSeconds: SESSION_WARNING_SECONDS,
        onWarning: handleWarning,
        onLogout: handleLogout,
        enabled: started,
    });

    const handleStayActive = useCallback(() => {
        setShowWarning(false);
        resetTimer();
    }, [resetTimer]);

    const handleLogoutNow = useCallback(() => {
        setShowWarning(false);
        logout();
    }, [logout]);

    return (
        <>
            {children}
            {started && (
                <InactivityWarningModal
                    isOpen={showWarning}
                    onStayActive={handleStayActive}
                    onLogout={handleLogoutNow}
                    timeRemaining={SESSION_WARNING_SECONDS}
                />
            )}
        </>
    );
}

export default InactivityProvider;