'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import Loader from '../../components/global/Loader';
import Custom404 from '../global/Custom404';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
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
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of total inactivity
const INACTIVITY_WARNING_MS = 10 * 1000; // 10 seconds warning countdown before auto-logout
const ACTIVITY_THROTTLE_MS = 1000; // 1 second throttle for activity storage sync
const INACTIVITY_STORAGE_KEY = 'sc_last_activity_time';
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
        }
        catch (e) { }
        try {
            document.cookie = `session_backup=${JSON.stringify(backup)}; path=/; max-age=300`;
        }
        catch (e) { }
    }
    catch (error) {
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
            }
            catch (e) {
                continue;
            }
        }
        if (!backup || !backup.session_token)
            return false;
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
            if (backup.user_role)
                localStorage.setItem('user_role', backup.user_role);
            if (backup.user_name)
                localStorage.setItem('user_name', backup.user_name);
            if (backup.user_email)
                localStorage.setItem('user_email', backup.user_email);
            if (backup.user_agent)
                localStorage.setItem('user_agent', backup.user_agent);
            if (backup.user_ip)
                localStorage.setItem('user_ip', backup.user_ip);
            if (backup.session_expires)
                localStorage.setItem('session_expires', backup.session_expires);
            if (backup.user_id)
                localStorage.setItem('user_id', backup.user_id);
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
    }
    catch (error) {
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
                }
                catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Error deactivating session:', error);
        return false;
    }
};
function NotFoundPage() {
    return <Custom404 isFullScreen={true} />;
}
function OfflinePage() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isRetrying, setIsRetrying] = useState(false);

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

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            if (navigator.onLine) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                await fetch('https://www.google.com/favicon.ico', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                toast.success('Connection restored! Reloading...');
                window.location.reload();
            } else {
                toast.error('Still offline. Please check your connection.');
            }
        } catch {
            toast.error('Network unreachable. Please check your connection.');
        } finally {
            setIsRetrying(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#f0f3f8] dark:bg-[#14151c] transition-colors">
            <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.08] shadow-[12px_12px_32px_rgba(166,175,195,0.45),-12px_-12px_32px_rgba(255,255,255,0.95),inset_0_1px_2px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_38px_rgba(0,0,0,0.85),-6px_-6px_22px_rgba(255,255,255,0.03),inset_0_1px_1.5px_rgba(255,255,255,0.06)] text-center relative overflow-hidden">
                {/* Neumorphic Inset Well for Icon */}
                <div className="relative w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-[#ebf0f7] dark:bg-[#14151c] border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 shadow-[inset_3px_3px_7px_rgba(166,175,195,0.4),inset_-3px_-3px_7px_rgba(255,255,255,0.95)] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.7),inset_-1px_-1px_4px_rgba(255,255,255,0.04)]">
                    <div className="absolute -inset-1 rounded-3xl blur-xs bg-rose-500/20 dark:bg-rose-500/10 animate-pulse pointer-events-none" />
                    <WifiOff className="w-9 h-9 stroke-[2.2] relative z-10" />
                </div>

                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                    You&apos;re Offline
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-7 leading-relaxed font-medium">
                    Please check your internet connection. Your session will resume automatically once connection is restored.
                </p>

                {/* Sunken Neumorphic Status Card */}
                <div className="bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl p-4 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] mb-7">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span className="uppercase tracking-wider text-[11px] font-bold">Network Status</span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e4ebf5] dark:bg-[#101117] text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/30 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-400"></span>
                            </span>
                            Disconnected
                        </span>
                    </div>
                </div>

                {/* Neumorphic Tactile Retry Button */}
                <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-rose-600 dark:text-rose-400 bg-[#ebf0f7] dark:bg-[#181926] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.65),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:hover:shadow-[2px_2px_8px_rgba(0,0,0,0.6)] active:shadow-[inset_2px_2px_5px_rgba(166,175,195,0.45),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.8)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>{isRetrying ? 'Checking Network...' : 'Retry Connection'}</span>
                </button>
            </div>
        </div>
    );
}
const checkDeviceBlocked = async (userId: string, userAgent: string, sessionToken: string): Promise<{
    blocked: boolean;
    reason?: string;
    device_name?: string;
}> => {
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
    }
    catch (error) {
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
    const [blockedWarning, setBlockedWarning] = useState<{
        show: boolean;
        countdown: number;
    }>({ show: false, countdown: 5 });
    const [inactivityWarning, setInactivityWarning] = useState<{
        show: boolean;
        remainingSeconds: number;
    }>({ show: false, remainingSeconds: 10 });
    const lastActivityRef = useRef<number>(Date.now());
    const lastThrottleRef = useRef<number>(0);
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
                    }
                    else {
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
    const deactivateSession = useCallback(async (sessionToken: string | null, reason?: string, action?: string) => {
        try {
            const userAgent = navigator.userAgent;
            const isInactive = reason === 'user_inactive' || action === 'INACTIVITY_TIMEOUT';
            const payload = {
                session_token: sessionToken,
                reason: reason || 'User logged out',
                action: action || (isInactive ? 'INACTIVITY_TIMEOUT' : 'LOGOUT'),
                description: isInactive ? 'Session ended: user inactive' : 'User logged out',
            };

            if (sessionToken) {
                await deactivateSessionInDB(sessionToken);
                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-token': sessionToken,
                        'User-Agent': userAgent,
                    },
                    body: JSON.stringify(payload),
                });
                return;
            }
            const cookieToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('session_token='))
                ?.split('=')[1];
            if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && cookieToken !== '') {
                payload.session_token = cookieToken;
                await deactivateSessionInDB(cookieToken);
                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-token': cookieToken,
                        'User-Agent': userAgent,
                    },
                    body: JSON.stringify(payload),
                });
                return;
            }
            await fetch('/api/supplyChain/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': userAgent,
                },
                body: JSON.stringify(payload),
            });
        }
        catch (error) {
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
        localStorage.removeItem(INACTIVITY_STORAGE_KEY);
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
            }
            else {
                setTimeout(() => {
                    hasShownInvalidToastRef.current = false;
                    isLoggingOutRef.current = false;
                }, 1000);
            }
        }
    }, [getSessionToken, deactivateSession, clearSessionData, router]);

    const handleInactivityLogout = useCallback(async () => {
        if (isLoggingOutRef.current) return;
        isLoggingOutRef.current = true;

        setInactivityWarning({ show: false, remainingSeconds: 0 });

        const token = getSessionToken();
        try {
            await deactivateSession(token, 'user_inactive', 'INACTIVITY_TIMEOUT');
        } catch (e) {
            console.error('Error during inactivity logout:', e);
        }

        clearSessionData();
        try {
            sessionStorage.setItem('sc_inactive_logout', 'true');
        } catch (e) {}

        toast.error('Session ended, user inactive', {
            duration: 5000,
            position: 'top-center',
            id: 'session-ended-inactive',
        });

        if (isMountedRef.current) {
            setGuardState('denied');
            setTimeout(() => {
                router.push('/scAuth?reason=inactive');
                setTimeout(() => {
                    isLoggingOutRef.current = false;
                }, 100);
            }, 300);
        }
    }, [getSessionToken, deactivateSession, clearSessionData, router]);

    const recordUserActivity = useCallback(() => {
        const now = Date.now();
        lastActivityRef.current = now;

        setInactivityWarning(prev => {
            if (prev.show) {
                return { show: false, remainingSeconds: 10 };
            }
            return prev;
        });

        if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
            lastThrottleRef.current = now;
            try {
                localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
            } catch (e) {}
        }
    }, []);

    // set initial activity time
    useEffect(() => {
        const now = Date.now();
        lastActivityRef.current = now;
        try {
            const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
            if (!stored) {
                localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
            }
        } catch (e) {}
    }, []);

    // activity listeners and inactivity checker
    useEffect(() => {
        if (guardState !== 'authorized') return;

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
        const handleEvent = () => recordUserActivity();

        events.forEach(event => {
            window.addEventListener(event, handleEvent, { passive: true });
        });

        const handleStorage = (e: StorageEvent) => {
            if (e.key === INACTIVITY_STORAGE_KEY && e.newValue) {
                const remoteTime = parseInt(e.newValue, 10);
                if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
                    lastActivityRef.current = remoteTime;
                    setInactivityWarning(prev => {
                        if (prev.show) {
                            return { show: false, remainingSeconds: 10 };
                        }
                        return prev;
                    });
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        const checkInterval = setInterval(() => {
            if (isBlockedRef.current || isLoggingOutRef.current || guardState !== 'authorized') {
                return;
            }

            let latestActivity = lastActivityRef.current;
            try {
                const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
                if (stored) {
                    const parsed = parseInt(stored, 10);
                    if (!isNaN(parsed) && parsed > latestActivity) {
                        latestActivity = parsed;
                        lastActivityRef.current = parsed;
                    }
                }
            } catch (e) {}

            const elapsed = Date.now() - latestActivity;
            const remainingMs = INACTIVITY_TIMEOUT_MS - elapsed;

            if (remainingMs <= 0) {
                handleInactivityLogout();
            } else if (remainingMs <= INACTIVITY_WARNING_MS) {
                const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
                setInactivityWarning({
                    show: true,
                    remainingSeconds: remainingSec,
                });
            } else {
                setInactivityWarning(prev => {
                    if (prev.show) return { show: false, remainingSeconds: 10 };
                    return prev;
                });
            }
        }, 1000);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleEvent);
            });
            window.removeEventListener('storage', handleStorage);
            clearInterval(checkInterval);
        };
    }, [guardState, recordUserActivity, handleInactivityLogout]);
    const handleDeviceBlocked = useCallback(async (userId: string, userAgent: string, reason?: string) => {
        if (isBlockedRef.current || isLoggingOutRef.current)
            return;
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
        if (isBlockedRef.current || isLoggingOutRef.current)
            return true;
        if (isSamePage && lastCheck && (now - lastCheck) < CACHE_DURATION)
            return true;
        if (isCheckingRef.current)
            return true;
        if (!navigator.onLine)
            return true;
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
            if (isBlockedRef.current || isLoggingOutRef.current)
                return;
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
                    }
                    else {
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
                }
                else {
                    setGuardState('authorized');
                }
                return;
            }
            if (shouldSkipCheck())
                return;
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
            }
            catch (error) {
                console.error('Session check error:', error);
                if (!navigator.onLine) {
                    setGuardState('offline');
                }
                else {
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
            }
            finally {
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
            if (isBlockedRef.current || isLoggingOutRef.current || guardState !== 'authorized')
                return;
            const sessionToken = getSessionToken();
            if (!sessionToken) {
                if (pathname !== '/scAuth') {
                    handleInvalidSession('Session expired. Please login again.', true);
                }
            }
        };
        const interval = setInterval(revalidate, TAMPER_POLL_INTERVAL);
        const onVisibility = () => { if (document.visibilityState === 'visible')
            revalidate(); };
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
        return <Loader onComplete={handleLoaderComplete}/>;
    }
    if (guardState === 'checking') {
        return (<Loader onComplete={handleLoaderComplete}/>);
    }
    if (inactivityWarning.show) {
        return (
            <>
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl shadow-[12px_12px_32px_rgba(166,175,195,0.45),-12px_-12px_32px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_38px_rgba(0,0,0,0.85)] p-8 text-center border border-white/80 dark:border-white/[0.08] animate-in fade-in zoom-in duration-200">
                        <div className="relative w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-[#ebf0f7] dark:bg-[#14151c] text-amber-500 shadow-[inset_3px_3px_6px_rgba(166,175,195,0.35),inset_-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6)]">
                            <Clock className="w-8 h-8 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                            You are inactive
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                            You are inactive, automatic logout in <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-base">{inactivityWarning.remainingSeconds}s</span>
                        </p>
                        <div className="bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl p-4 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] mb-6 space-y-2">
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                                <span>Automatic logout in</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-sm">
                                    {inactivityWarning.remainingSeconds}s
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-amber-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${((10 - inactivityWarning.remainingSeconds) / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={recordUserActivity}
                                className="flex-1 py-3 px-5 bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-pink-200 dark:shadow-none cursor-pointer"
                            >
                                Stay Logged In
                            </button>
                            <button
                                onClick={handleInactivityLogout}
                                className="py-3 px-5 bg-[#ebf0f7] dark:bg-[#181926] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
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
    if (blockedWarning.show) {
        return (<>
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border border-red-100 animate-in fade-in zoom-in duration-200">
                        <div className="relative flex items-center justify-center w-16 h-16 bg-red-100/80 text-red-600 rounded-2xl mx-auto mb-6 ring-8 ring-red-50">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
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
                                <div className="bg-red-600 h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${((5 - blockedWarning.countdown) / 5) * 100}%` }}/>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button onClick={() => {
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
            }} className="w-full py-3 px-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-red-200">
                                Logout Now
                            </button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'none' }}>{children}</div>
            </>);
    }
    if (guardState === 'denied') {
        return <NotFoundPage />;
    }
    if (guardState !== 'authorized') {
        return (<div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                    <p className="mt-2 text-sm text-slate-600">Loading...</p>
                </div>
            </div>);
    }
    return <>{children}</>;
}
