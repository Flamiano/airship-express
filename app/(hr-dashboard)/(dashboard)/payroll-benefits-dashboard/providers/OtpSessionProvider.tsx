'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
} from 'react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface OtpSessionState {
    active: boolean;
    scope: string | null;
    secondsLeft: number;
    isChecking: boolean;
    unlock: (scope?: string, secondsLeft?: number) => void;
    lock: () => Promise<void>;
    refresh: () => Promise<void>;
}

const DEFAULT_SESSION_SECONDS = 5 * 60;

const OtpSessionContext = createContext<OtpSessionState | null>(null);

export function OtpSessionProvider({ children }: { children: React.ReactNode }) {
    const { fetchData: fetchSession, deleteData: clearRemoteSession } = useApi(
        '/payroll-benefits-dashboard/api/otp/session'
    );

    const [active, setActive] = useState(false);
    const [scope, setScope] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isChecking, setIsChecking] = useState(true);

    const startedAtRef = useRef<number | null>(null);
    const durationRef = useRef<number>(0);
    const isUnlockingRef = useRef(false);

    const applySession = useCallback((secs: number, scopeVal: string) => {
        const safeSecs =
            Number.isFinite(secs) && secs > 0 ? Math.floor(secs) : DEFAULT_SESSION_SECONDS;

        startedAtRef.current = Date.now();
        durationRef.current = safeSecs;
        isUnlockingRef.current = true;
        setActive(true);
        setScope(scopeVal);
        setSecondsLeft(safeSecs);
        setTimeout(() => {
            isUnlockingRef.current = false;
        }, 500);
    }, []);

    const clearLocal = useCallback(() => {
        startedAtRef.current = null;
        durationRef.current = 0;
        setActive(false);
        setScope(null);
        setSecondsLeft(0);
    }, []);

    const refresh = useCallback(async () => {
        if (isUnlockingRef.current) return;
        try {
            const res: any = await fetchSession();
            if (res?.active) {
                applySession(res.seconds_left || 0, res.scope || 'all');
            } else {
                clearLocal();
            }
        } catch {
            clearLocal();
        } finally {
            setIsChecking(false);
        }
    }, [fetchSession, applySession, clearLocal]);

    useEffect(() => {
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!active) return;
        const interval = setInterval(() => {
            const elapsed = startedAtRef.current
                ? Math.floor((Date.now() - startedAtRef.current) / 1000)
                : 0;
            const remaining = Math.max(0, durationRef.current - elapsed);
            setSecondsLeft(remaining);
            if (remaining === 0) {
                clearLocal();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [active, clearLocal]);

    const unlock = useCallback(
        (scopeVal?: string, secs?: number) => {
            const safeSecs =
                Number.isFinite(secs) && (secs ?? 0) > 0
                    ? Math.floor(secs as number)
                    : DEFAULT_SESSION_SECONDS;
            const finalScope = scopeVal || 'all';
            applySession(safeSecs, finalScope);
        },
        [applySession]
    );

    const lock = useCallback(async () => {
        try {
            await clearRemoteSession('');
        } catch {
            // ignore
        }
        clearLocal();
    }, [clearRemoteSession, clearLocal]);

    const value = useMemo(
        () => ({ active, scope, secondsLeft, isChecking, unlock, lock, refresh }),
        [active, scope, secondsLeft, isChecking, unlock, lock, refresh]
    );

    return (
        <OtpSessionContext.Provider value={value}>
            {children}
        </OtpSessionContext.Provider>
    );
}

export function useOtpSessionContext() {
    const ctx = useContext(OtpSessionContext);
    if (!ctx) {
        throw new Error('useOtpSessionContext must be used inside OtpSessionProvider');
    }
    return ctx;
}