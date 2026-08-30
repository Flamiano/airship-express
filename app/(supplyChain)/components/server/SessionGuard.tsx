'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import Loader from '../../components/global/Loader';

interface SessionGuardProps {
    children: React.ReactNode;
    requiredRole?: string[];
}

interface AuthResponse {
    user?: {
        role?: string;
        id?: string;
    };
    session_cleared?: boolean;
}

const VALID_ROLES = ['Admin', 'Manager', 'Employee', 'Operator', 'Executive'];
const CACHE_DURATION = 60 * 1000;
const TAMPER_POLL_INTERVAL = 30 * 1000;
const OFFLINE_RETRY_DELAY = 5000;

const BACKUP_KEYS = {
    PRIMARY: 'session_backup',
};

type GuardState = 'loading' | 'checking' | 'authorized' | 'denied' | 'offline';

// backup current session data
const backupSessionData = () => {
    try {
        const sessionToken = localStorage.getItem('session_token');

        if (!sessionToken || sessionToken === 'null' || sessionToken === 'undefined' || sessionToken === '') {
            return;
        }

        const backup = {
            session_token: sessionToken,
            user_role: localStorage.getItem('user_role') || '',
            user_name: localStorage.getItem('user_name') || '',
            user_email: localStorage.getItem('user_email') || '',
            user_agent: localStorage.getItem('user_agent') || '',
            user_ip: localStorage.getItem('user_ip') || '',
            session_expires: localStorage.getItem('session_expires') || '',
            user_id: localStorage.getItem('user_id') || '',
            backed_up_at: new Date().toISOString(),
            checksum: btoa(sessionToken + (localStorage.getItem('user_role') || '') + (localStorage.getItem('user_email') || '')),
        };

        localStorage.setItem(BACKUP_KEYS.PRIMARY, JSON.stringify(backup));

        try {
            sessionStorage.setItem('session_backup', JSON.stringify(backup));
        } catch (e) { }

        try {
            document.cookie = `session_backup=${JSON.stringify(backup)}; path=/; max-age=300`;
        } catch (e) { }
    } catch (error) {
        console.error('Error backing up session:', error);
    }
};

// try to restore session from backup
const restoreSessionFromBackup = (): boolean => {
    try {
        let backupData = null;
        let backup = null;

        const backupLocations = [
            () => localStorage.getItem(BACKUP_KEYS.PRIMARY),
            () => sessionStorage.getItem('session_backup'),
            () => {
                const cookie = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('session_backup='));
                return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
            },
        ];

        for (const getBackup of backupLocations) {
            try {
                const data = getBackup();
                if (data) {
                    backupData = data;
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.session_token) {
                        backup = parsed;
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        if (!backup || !backup.session_token) return false;

        if (backup.checksum) {
            const expectedChecksum = btoa(backup.session_token + (backup.user_role || '') + (backup.user_email || ''));
            if (backup.checksum !== expectedChecksum) {
                console.warn('Backup checksum mismatch, data may be corrupted');
                return false;
            }
        }

        let restored = false;
        const currentToken = localStorage.getItem('session_token');

        if (!currentToken || currentToken === 'null' || currentToken === 'undefined' || currentToken === '') {
            if (backup.session_token) {
                localStorage.setItem('session_token', backup.session_token);
                restored = true;
            }
            if (backup.user_role) localStorage.setItem('user_role', backup.user_role);
            if (backup.user_name) localStorage.setItem('user_name', backup.user_name);
            if (backup.user_email) localStorage.setItem('user_email', backup.user_email);
            if (backup.user_agent) localStorage.setItem('user_agent', backup.user_agent);
            if (backup.user_ip) localStorage.setItem('user_ip', backup.user_ip);
            if (backup.session_expires) localStorage.setItem('session_expires', backup.session_expires);
            if (backup.user_id) localStorage.setItem('user_id', backup.user_id);

            document.cookie = `session_token=${backup.session_token}; path=/; max-age=${15 * 24 * 60 * 60}`;

            if (restored) {
                console.log('Session restored from backup');
                backupSessionData();
                toast.success('Session restored', {
                    duration: 3000,
                    position: 'top-right',
                    id: 'session-restored',
                });
            }
        }

        return restored;
    } catch (error) {
        console.error('Error restoring session from backup:', error);
        return false;
    }
};

// clean up old backups
const cleanupBackups = () => {
    try {
        const keys = Object.values(BACKUP_KEYS);
        for (const key of keys) {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    const currentToken = localStorage.getItem('session_token');
                    if (currentToken && parsed.session_token !== currentToken) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up backups:', error);
    }
};

const deactivateSessionInDB = async (sessionToken: string): Promise<boolean> => {
    try {
        const response = await fetch('/api/supplyChain/deactivate-session', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-session-token': sessionToken,
            },
            body: JSON.stringify({ sessionToken }),
        });

        if (response.ok) {
            console.log('Session deactivated in database');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deactivating session:', error);
        return false;
    }
};

function NotFoundPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.back();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center max-w-md w-full ">
                <div className="mb-6 inline-flex items-center justify-center p-4 bg-pink-50/80 rounded-2xl ring-8 ring-pink-50/50">
                    <svg className="w-12 h-12 text-pink-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <span className="inline-block px-3 py-1 bg-pink-50 text-pink-600 font-mono text-xs font-bold rounded-full mb-3 ring-1 ring-pink-500/10">
                        ERROR 404
                    </span>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                        Page not found
                    </h1>
                    <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        The page you&apos;re looking for doesn&apos;t exist or has been moved to another location.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-100 mb-8">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                    </span>
                    <span>Redirecting back in <strong className="font-bold text-slate-800">{countdown}s</strong></span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-pink-500/25 cursor-pointer"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
}

function OfflinePage() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            window.location.reload();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
            <div className="text-center max-w-md w-full">
                <div className="mb-6 inline-flex items-center justify-center p-4 bg-amber-50/80 rounded-2xl ring-8 ring-amber-50/50">
                    <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856a7.5 7.5 0 0113.788 0M2.838 7.897a9.75 9.75 0 0118.324 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75v.008" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">You&apos;re Offline</h2>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    Please check your internet connection. Your session will resume automatically when you&apos;re back online.
                </p>
                <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 mb-6">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                        <span>Status</span>
                        <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-red-600 font-bold">Offline</span>
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (navigator.onLine) {
                            window.location.reload();
                        } else {
                            toast.warning('Still offline. Please check your connection.');
                        }
                    }}
                    className="w-full py-3 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-amber-200"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}

const checkDeviceBlocked = async (userId: string, userAgent: string, sessionToken: string): Promise<{ blocked: boolean; reason?: string; device_name?: string }> => {
    try {
        const response = await fetch('/api/supplyChain/check-blocked-device', {
            method: 'GET',
            headers: {
                'user-id': userId,
                'user-agent': userAgent,
                'x-session-token': sessionToken,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('API error checking blocked device:', data.error);
            return { blocked: false };
        }

        return {
            blocked: data.blocked || false,
            reason: data.reason,
            device_name: data.device_name,
        };
    } catch (error) {
        console.error('Error checking blocked device:', error);
        return { blocked: false };
    }
};

export function SessionGuard({ children, requiredRole }: SessionGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const prevPathRef = useRef<string>('');
    const lastCheckRef = useRef<number>(0);
    const isCheckingRef = useRef<boolean>(false);
    const [guardState, setGuardState] = useState<GuardState>('loading');
    const [blockedWarning, setBlockedWarning] = useState<{ show: boolean; countdown: number }>({ show: false, countdown: 5 });
    const [showLoader, setShowLoader] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const blockedTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isBlockedRef = useRef<boolean>(false);
    const hasShownBlockedToastRef = useRef<boolean>(false);
    const hasShownLogoutToastRef = useRef<boolean>(false);
    const hasShownInvalidToastRef = useRef<boolean>(false);
    const hasShownSessionClearedToastRef = useRef<boolean>(false);
    const hasShownOfflineToastRef = useRef<boolean>(false);
    const isLoggingOutRef = useRef<boolean>(false);
    const isMountedRef = useRef<boolean>(true);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isRestoringRef = useRef<boolean>(false);

    // initial backup and cleanup
    useEffect(() => {
        cleanupBackups();
        backupSessionData();
    }, []);

    // periodic backup every 30s
    useEffect(() => {
        backupIntervalRef.current = setInterval(() => {
            backupSessionData();
        }, 30000);

        return () => {
            if (backupIntervalRef.current) {
                clearInterval(backupIntervalRef.current);
                backupIntervalRef.current = null;
            }
        };
    }, []);

    // backup on events
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                backupSessionData();
            }
        };

        const handleBeforeUnload = () => {
            backupSessionData();
        };

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'session_token' && !e.newValue) {
                backupSessionData();
            }
            if (['session_token', 'user_role', 'user_name', 'user_email', 'user_agent', 'user_ip'].includes(e.key || '')) {
                if (e.newValue) {
                    backupSessionData();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // try restore on mount if needed
    useEffect(() => {
        const currentToken = localStorage.getItem('session_token');
        if (!currentToken || currentToken === 'null' || currentToken === 'undefined' || currentToken === '') {
            const restored = restoreSessionFromBackup();
            if (restored) {
                lastCheckRef.current = 0;
                isCheckingRef.current = false;
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        }
    }, []);

    // listen for storage clearing
    useEffect(() => {
        const handleStorageClear = async (e: StorageEvent) => {
            if (e.key === 'session_token' && !e.newValue && e.oldValue) {
                if (!isRestoringRef.current) {
                    isRestoringRef.current = true;
                    const restored = restoreSessionFromBackup();
                    if (restored) {
                        toast.success('Session restored', {
                            duration: 3000,
                            position: 'top-right',
                            id: 'session-restored',
                        });
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } else {
                        lastCheckRef.current = 0;
                        isCheckingRef.current = false;
                    }
                    isRestoringRef.current = false;
                }
            }
        };

        window.addEventListener('storage', handleStorageClear);

        const checkInterval = setInterval(() => {
            const token = localStorage.getItem('session_token');
            if (!token || token === 'null' || token === 'undefined' || token === '') {
                const restored = restoreSessionFromBackup();
                if (restored) {
                    toast.success('Session restored', {
                        duration: 3000,
                        position: 'top-right',
                        id: 'session-restored-interval',
                    });
                }
            }
        }, 5000);

        return () => {
            window.removeEventListener('storage', handleStorageClear);
            clearInterval(checkInterval);
        };
    }, []);

    // online/offline handling
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (hasShownOfflineToastRef.current) {
                toast.success('Back online! Reconnecting...', {
                    duration: 3000,
                    position: 'top-right',
                });
                hasShownOfflineToastRef.current = false;
            }
            if (guardState === 'offline' || guardState === 'loading') {
                setGuardState('loading');
                lastCheckRef.current = 0;
                isCheckingRef.current = false;
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            if (!hasShownOfflineToastRef.current && guardState === 'authorized') {
                hasShownOfflineToastRef.current = true;
                toast.warning('You are offline. Some features may be unavailable.', {
                    duration: 5000,
                    position: 'top-right',
                    id: 'offline-warning',
                });
            }
            if (guardState === 'loading' || guardState === 'checking') {
                setGuardState('offline');
            }
        };

        if (!navigator.onLine) {
            hasShownOfflineToastRef.current = true;
            setGuardState('offline');
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [guardState]);

    const deactivateSession = useCallback(async (sessionToken: string | null) => {
        try {
            const userAgent = navigator.userAgent;

            if (sessionToken) {
                await deactivateSessionInDB(sessionToken);

                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'x-session-token': sessionToken,
                        'User-Agent': userAgent,
                    },
                });
                return;
            }

            const cookieToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('session_token='))
                ?.split('=')[1];

            if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && cookieToken !== '') {
                await deactivateSessionInDB(cookieToken);

                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'x-session-token': cookieToken,
                        'User-Agent': userAgent,
                    },
                });
                return;
            }

            await fetch('/api/supplyChain/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'User-Agent': userAgent,
                },
            });
        } catch (error) {
            console.error('Deactivate session error:', error);
        }
    }, []);

    const hasValidLocalStorage = useCallback(() => {
        const sessionToken = localStorage.getItem('session_token');
        return !!(sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined' && sessionToken !== '');
    }, []);

    const clearSessionData = useCallback(() => {
        backupSessionData();

        localStorage.removeItem('session_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_agent');
        localStorage.removeItem('user_ip');
        localStorage.removeItem('session_expires');
        localStorage.removeItem('logged_in_email');
        localStorage.removeItem('user_id');

        Object.values(BACKUP_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        sessionStorage.removeItem('session_backup');
        document.cookie = 'session_backup=; path=/; max-age=0';
        document.cookie = 'session_token=; path=/; max-age=0';
    }, []);

    const getSessionToken = useCallback(() => {
        let token = localStorage.getItem('session_token');
        if (token && token !== 'null' && token !== 'undefined' && token !== '') {
            return token;
        }

        const restored = restoreSessionFromBackup();
        if (restored) {
            return localStorage.getItem('session_token');
        }

        const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('session_token='))
            ?.split('=')[1];

        if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && cookieToken !== '') {
            return cookieToken;
        }

        return null;
    }, []);

    const handleInvalidSession = useCallback(async (message: string, redirectToAuth: boolean = true) => {
        if (hasShownInvalidToastRef.current || isLoggingOutRef.current) {
            return;
        }
        hasShownInvalidToastRef.current = true;
        isLoggingOutRef.current = true;

        const token = getSessionToken();
        await deactivateSession(token);
        clearSessionData();

        if (isMountedRef.current) {
            toast.error(message, { duration: 3000, position: 'top-right' });
            setGuardState('denied');

            if (redirectToAuth) {
                setTimeout(() => {
                    router.push('/scAuth');
                    setTimeout(() => {
                        hasShownInvalidToastRef.current = false;
                        isLoggingOutRef.current = false;
                    }, 100);
                }, 1000);
            } else {
                setTimeout(() => {
                    hasShownInvalidToastRef.current = false;
                    isLoggingOutRef.current = false;
                }, 1000);
            }
        }
    }, [getSessionToken, deactivateSession, clearSessionData, router]);

    const handleDeviceBlocked = useCallback(async (userId: string, userAgent: string, reason?: string) => {
        if (isBlockedRef.current || isLoggingOutRef.current) return;

        isBlockedRef.current = true;
        isLoggingOutRef.current = true;

        if (blockedTimerRef.current) {
            clearInterval(blockedTimerRef.current);
            blockedTimerRef.current = null;
        }

        if (!hasShownBlockedToastRef.current) {
            hasShownBlockedToastRef.current = true;
            toast.warning(`Device blocked: ${reason || 'Blocked by admin'}`, {
                duration: 5000,
                position: 'top-center',
                id: 'device-blocked-warning',
            });
        }

        setBlockedWarning({ show: true, countdown: 5 });

        let countdown = 5;
        blockedTimerRef.current = setInterval(() => {
            countdown--;
            setBlockedWarning({ show: true, countdown });

            if (countdown === 0) {
                if (blockedTimerRef.current) {
                    clearInterval(blockedTimerRef.current);
                    blockedTimerRef.current = null;
                }

                const token = getSessionToken();
                deactivateSession(token);
                clearSessionData();

                if (!hasShownLogoutToastRef.current) {
                    hasShownLogoutToastRef.current = true;
                    toast.error('Device blocked. You have been logged out.', {
                        duration: 5000,
                        position: 'top-center',
                        id: 'device-blocked-logout',
                    });
                }

                setTimeout(() => {
                    router.push('/scAuth');
                    setBlockedWarning({ show: false, countdown: 5 });
                    setTimeout(() => {
                        isBlockedRef.current = false;
                        hasShownBlockedToastRef.current = false;
                        hasShownLogoutToastRef.current = false;
                        isLoggingOutRef.current = false;
                    }, 100);
                }, 500);
            }
        }, 1000);
    }, [getSessionToken, deactivateSession, clearSessionData, router]);

    const shouldSkipCheck = useCallback(() => {
        const now = Date.now();
        const lastCheck = lastCheckRef.current;
        const isSamePage = prevPathRef.current === pathname;

        if (isBlockedRef.current || isLoggingOutRef.current) return true;
        if (isSamePage && lastCheck && (now - lastCheck) < CACHE_DURATION) return true;
        if (isCheckingRef.current) return true;
        if (!navigator.onLine) return true;

        return false;
    }, [pathname]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (blockedTimerRef.current) {
                clearInterval(blockedTimerRef.current);
                blockedTimerRef.current = null;
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            if (backupIntervalRef.current) {
                clearInterval(backupIntervalRef.current);
                backupIntervalRef.current = null;
            }
        };
    }, []);

    // main session check
    useEffect(() => {
        const checkSession = async () => {
            if (!navigator.onLine) {
                setGuardState('offline');
                return;
            }

            if (isBlockedRef.current || isLoggingOutRef.current) return;

            if (!hasValidLocalStorage()) {
                const cookieToken = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('session_token='))
                    ?.split('=')[1];

                if (!cookieToken || cookieToken === 'null' || cookieToken === 'undefined' || cookieToken === '') {
                    const restored = restoreSessionFromBackup();
                    if (restored) {
                        const restoredToken = localStorage.getItem('session_token');
                        if (restoredToken) {
                            lastCheckRef.current = 0;
                            isCheckingRef.current = false;
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    setGuardState('loading');
                                }
                            }, 100);
                            return;
                        }
                    }

                    if (pathname !== '/scAuth') {
                        await handleInvalidSession('No session found. Please login again.', true);
                    } else {
                        setGuardState('authorized');
                    }
                    return;
                }
                if (cookieToken) {
                    localStorage.setItem('session_token', cookieToken);
                    backupSessionData();
                }
            }

            const sessionToken = getSessionToken();
            if (!sessionToken) {
                if (pathname !== '/scAuth') {
                    await handleInvalidSession('No session found. Please login again.', true);
                } else {
                    setGuardState('authorized');
                }
                return;
            }

            if (shouldSkipCheck()) return;

            isCheckingRef.current = true;
            prevPathRef.current = pathname;

            try {
                const res = await fetch('/api/auth/check-authorization', {
                    credentials: 'include',
                    headers: {
                        'x-session-token': sessionToken,
                        'User-Agent': navigator.userAgent,
                        'X-Current-Path': pathname || '/',
                    }
                });

                lastCheckRef.current = Date.now();

                if (!res.ok) {
                    const data: AuthResponse = await res.json();
                    if (data.session_cleared) {
                        setGuardState('denied');
                        clearSessionData();
                        if (!hasShownSessionClearedToastRef.current) {
                            hasShownSessionClearedToastRef.current = true;
                            toast.error('Session cleared. Please login again.', {
                                duration: 3000,
                                position: 'top-right',
                                id: 'session-cleared',
                            });
                        }
                        setTimeout(() => router.push('/scAuth'), 1000);
                        return;
                    }
                    await handleInvalidSession('Session expired. Please login again.', true);
                    return;
                }

                const data: AuthResponse = await res.json();

                const userAgent = navigator.userAgent;
                const userId = data.user?.id || localStorage.getItem('user_id');

                if (userId && !isBlockedRef.current && !isLoggingOutRef.current) {
                    const blockedResult = await checkDeviceBlocked(userId, userAgent, sessionToken);
                    if (blockedResult.blocked) {
                        await handleDeviceBlocked(userId, userAgent, blockedResult.reason);
                        return;
                    }
                }

                const userRole = data.user?.role || localStorage.getItem('user_role');

                if (!userRole || !VALID_ROLES.includes(userRole)) {
                    await handleInvalidSession('Invalid user role. Please contact support.', true);
                    return;
                }

                if (data.user?.role) {
                    localStorage.setItem('user_role', data.user.role);
                }

                if (requiredRole && requiredRole.length > 0 && !requiredRole.includes(userRole)) {
                    setGuardState('denied');
                    return;
                }

                setGuardState('authorized');

            } catch (error) {
                console.error('Session check error:', error);
                if (!navigator.onLine) {
                    setGuardState('offline');
                } else {
                    if (isMountedRef.current) {
                        toast.error('Network error. Retrying...', {
                            duration: 3000,
                            position: 'top-right',
                        });
                        setGuardState('authorized');
                        if (retryTimeoutRef.current) {
                            clearTimeout(retryTimeoutRef.current);
                        }
                        retryTimeoutRef.current = setTimeout(() => {
                            lastCheckRef.current = 0;
                            isCheckingRef.current = false;
                            if (isMountedRef.current) {
                                setGuardState('loading');
                            }
                        }, OFFLINE_RETRY_DELAY);
                    }
                }
            } finally {
                isCheckingRef.current = false;
            }
        };

        checkSession();
    }, [router, requiredRole, pathname, hasValidLocalStorage, shouldSkipCheck, handleInvalidSession, clearSessionData, getSessionToken, handleDeviceBlocked]);

    useEffect(() => {
        hasShownSessionClearedToastRef.current = false;
        hasShownInvalidToastRef.current = false;
    }, [pathname]);

    // tamper polling
    useEffect(() => {
        const revalidate = () => {
            if (isBlockedRef.current || isLoggingOutRef.current || guardState !== 'authorized') return;
            const sessionToken = getSessionToken();
            if (!sessionToken) {
                if (pathname !== '/scAuth') {
                    handleInvalidSession('Session expired. Please login again.', true);
                }
            }
        };

        const interval = setInterval(revalidate, TAMPER_POLL_INTERVAL);
        const onVisibility = () => { if (document.visibilityState === 'visible') revalidate(); };

        window.addEventListener('storage', revalidate);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', revalidate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', revalidate);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', revalidate);
        };
    }, [guardState, getSessionToken, handleInvalidSession, pathname]);

    // unload handling
    useEffect(() => {
        const handleUnload = () => {
            backupSessionData();
            const token = getSessionToken();
            if (navigator.sendBeacon) {
                const formData = new FormData();
                if (token) {
                    formData.append('session_token', token);
                }
                navigator.sendBeacon('/api/supplyChain/logout', formData);
            }
        };
        window.addEventListener('pagehide', handleUnload);
        return () => window.removeEventListener('pagehide', handleUnload);
    }, []);

    const handleLoaderComplete = useCallback(() => {
        setShowLoader(false);
        if (guardState === 'loading') {
            setGuardState('checking');
        }
    }, [guardState]);

    if (guardState === 'offline') {
        return <OfflinePage />;
    }

    if (showLoader && guardState === 'loading') {
        return <Loader onComplete={handleLoaderComplete} />;
    }

    if (guardState === 'checking') {
        return (
            <Loader onComplete={handleLoaderComplete} />
        );
    }

    if (blockedWarning.show) {
        return (
            <>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border border-red-100 animate-in fade-in zoom-in duration-200">
                        <div className="relative flex items-center justify-center w-16 h-16 bg-red-100/80 text-red-600 rounded-2xl mx-auto mb-6 ring-8 ring-red-50">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Device Blocked</h2>
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            This device has been restricted by an administrator. You will be automatically signed out shortly.
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 space-y-2">
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                <span>Auto logout in</span>
                                <span className="text-red-600 font-bold font-mono text-sm">{blockedWarning.countdown}s</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-red-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${((5 - blockedWarning.countdown) / 5) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    if (blockedTimerRef.current) {
                                        clearInterval(blockedTimerRef.current);
                                        blockedTimerRef.current = null;
                                    }
                                    const token = getSessionToken();
                                    deactivateSession(token);
                                    clearSessionData();
                                    router.push('/scAuth');
                                    setBlockedWarning({ show: false, countdown: 5 });
                                    isBlockedRef.current = false;
                                    hasShownBlockedToastRef.current = false;
                                    hasShownLogoutToastRef.current = false;
                                    isLoggingOutRef.current = false;
                                }}
                                className="w-full py-3 px-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-red-200"
                            >
                                Logout Now
                            </button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'none' }}>{children}</div>
            </>
        );
    }

    if (guardState === 'denied') {
        return <NotFoundPage />;
    }

    if (guardState !== 'authorized') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    <p className="mt-2 text-sm text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}