'use client';
import { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import Loader from '../../components/global/Loader';
import Custom404 from '../global/Custom404';
import Portal from '../client/Portal';
import { WifiOff, RefreshCw, Clock, Monitor, ShieldAlert, Check, X, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { user } from '../../lib/services/Class/user';
import { settingsService } from '../../lib/services/settingsService';
import { supabase } from '../../lib/services/client/supabase';

const SessionGuardContext = createContext<boolean>(false);
const globalDismissedChallenges = new Set<string>();
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
interface SessionBackup {
    session_token: string;
    user_role?: string;
    user_name?: string;
    user_email?: string;
    user_agent?: string;
    user_ip?: string;
    session_expires?: string;
    user_id?: string;
    backed_up_at?: string;
    checksum?: string;
}
const VALID_ROLES = ['Superadmin', 'Executive', 'Admin', 'Purchase Officer', 'Operator', 'Supplier', 'Staff', 'Employee'];
const CACHE_DURATION = 60 * 1000;
const TAMPER_POLL_INTERVAL = 30 * 1000;
const OFFLINE_RETRY_DELAY = 5000;
const ACTIVITY_THROTTLE_MS = 1000;
const INACTIVITY_STORAGE_KEY = 'sc_last_activity_time';
const BACKUP_KEYS = {
    PRIMARY: 'session_backup',
};
type GuardState = 'loading' | 'checking' | 'authorized' | 'denied' | 'offline';
// backup current session data
const backupSessionData = () => {
    try {
        const sessionToken = user.getSessionToken();
        if (!sessionToken || sessionToken === 'null' || sessionToken === 'undefined' || sessionToken === '') {
            return;
        }
        const currentUser = user.getUser();
        const backup: SessionBackup = {
            session_token: sessionToken,
            user_role: currentUser.role || '',
            user_name: currentUser.name || '',
            user_email: currentUser.email || '',
            user_agent: currentUser.userAgent || '',
            user_ip: currentUser.ipAddress || '',
            session_expires: currentUser.expiresAt || '',
            user_id: currentUser.userId || '',
            backed_up_at: new Date().toISOString(),
            checksum: btoa(sessionToken + (currentUser.role || '') + (currentUser.email || '')),
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
        let backupData: string | null = null;
        let backup: SessionBackup | null = null;
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
        const currentToken = user.getSessionToken();
        if (!currentToken || currentToken === 'null' || currentToken === 'undefined' || currentToken === '') {
            if (backup.session_token) {
                user.setUser({
                    name: backup.user_name || '',
                    role: backup.user_role || '',
                    email: backup.user_email || '',
                    sessionToken: backup.session_token,
                    expiresAt: backup.session_expires || '',
                    userAgent: backup.user_agent || '',
                    ipAddress: backup.user_ip || '',
                    userId: backup.user_id || '',
                    rememberMe: true,
                });
                restored = true;
            }
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
                    const currentToken = user.getSessionToken();
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
    const isNestedSessionGuard = useContext(SessionGuardContext);
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
        totalWarningSeconds: number;
    }>({ show: false, remainingSeconds: 10, totalWarningSeconds: 10 });
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
    const hasShown10MinShiftToastRef = useRef<boolean>(false);
    const isLoggingOutRef = useRef<boolean>(false);
    const isMountedRef = useRef<boolean>(true);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isRestoringRef = useRef<boolean>(false);

    // Concurrent device login approval state
    const [loginApprovalPrompt, setLoginApprovalPrompt] = useState<{
        show: boolean;
        requestId: string;
        userAgent: string;
        ipAddress: string;
        isResponding: boolean;
        pendingDecision?: 'approve' | 'decline' | null;
        passwordModalOpen?: boolean;
    }>({
        show: false,
        requestId: '',
        userAgent: '',
        ipAddress: '',
        isResponding: false,
        pendingDecision: null,
        passwordModalOpen: false,
    });
    const [approvalPasswordInput, setApprovalPasswordInput] = useState('');
    const [approvalPasswordError, setApprovalPasswordError] = useState<string | null>(null);
    const [showApprovalPassword, setShowApprovalPassword] = useState(false);
    const dismissedChallengesRef = useRef<Set<string>>(new Set());
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
    // restore from backup or cookie on mount if needed
    useEffect(() => {
        const currentToken = user.getSessionToken();
        if (!currentToken || currentToken === 'null' || currentToken === 'undefined' || currentToken === '') {
            restoreSessionFromBackup();
        }
    }, []);
    // listen for storage changes across tabs
    useEffect(() => {
        const handleStorageClear = async (e: StorageEvent) => {
            if (e.key === 'session_token' && !e.newValue && e.oldValue) {
                if (!isRestoringRef.current) {
                    isRestoringRef.current = true;
                    restoreSessionFromBackup();
                    isRestoringRef.current = false;
                }
            }
        };
        window.addEventListener('storage', handleStorageClear);
        return () => {
            window.removeEventListener('storage', handleStorageClear);
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
        const sessionToken = user.getSessionToken();
        return !!(sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined' && sessionToken !== '');
    }, []);
    const clearSessionData = useCallback(() => {
        backupSessionData();
        user.clearUser();
        localStorage.removeItem(INACTIVITY_STORAGE_KEY);
        Object.values(BACKUP_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        sessionStorage.removeItem('session_backup');
        document.cookie = 'session_backup=; path=/; max-age=0';
    }, []);
    const getSessionToken = useCallback(() => {
        let token = user.getSessionToken();
        if (token && token !== 'null' && token !== 'undefined' && token !== '') {
            return token;
        }
        const restored = restoreSessionFromBackup();
        if (restored) {
            return user.getSessionToken();
        }
        const cookieMatch = document.cookie.match(/(?:session_token|sc_session_token)=([^;]+)/);
        const cookieToken = cookieMatch && cookieMatch[1] ? decodeURIComponent(cookieMatch[1].trim()) : null;
        if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && cookieToken !== '') {
            return cookieToken;
        }
        return null;
    }, []);
    const handleInvalidSession = useCallback(async (message: string, redirectToAuth: boolean = true, reason?: string, action?: string) => {
        if (hasShownInvalidToastRef.current || isLoggingOutRef.current) {
            return;
        }
        hasShownInvalidToastRef.current = true;
        isLoggingOutRef.current = true;

        const token = getSessionToken();
        const currentUser = user.getUser();

        try {
            if (token) {
                await deactivateSession(token, reason || 'session_invalidated', action || 'SESSION_EXPIRED');
            } else if (currentUser?.userId || currentUser?.email) {
                await fetch('/api/supplyChain/deactivate-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUser.userId,
                        email: currentUser.email,
                    }),
                });
            }
        } catch (e) {
            console.error('Error deactivating session in DB:', e);
        }

        clearSessionData();
        if (isMountedRef.current) {
            toast.error(message, { duration: 4000, position: 'top-right' });
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

        setInactivityWarning(prev => ({ ...prev, show: false, remainingSeconds: 0 }));

        const token = getSessionToken();
        try {
            await deactivateSession(token, 'user_inactive', 'INACTIVITY_TIMEOUT');
        } catch (e) {
            console.error('Error during inactivity logout:', e);
        }

        clearSessionData();
        try {
            sessionStorage.setItem('sc_inactive_logout', 'true');
        } catch (e) { }

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
                return { ...prev, show: false, remainingSeconds: prev.totalWarningSeconds || 10 };
            }
            return prev;
        });

        if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
            lastThrottleRef.current = now;
            try {
                localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
            } catch (e) { }
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
        } catch (e) { }
    }, []);

    // activity listeners and inactivity checker
    useEffect(() => {
        const isPublicRoute = 
            pathname === '/scAuth' || 
            pathname?.startsWith('/supplier-portal') || 
            pathname?.startsWith('/suppliers_page');
        if (isPublicRoute || guardState !== 'authorized') return;

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
                            return { ...prev, show: false, remainingSeconds: prev.totalWarningSeconds || 10 };
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
            } catch (e) { }

            const timeoutMs = settingsService.getInactivityTimeoutMs();
            const warningMs = settingsService.getInactivityWarningMs();

            // Check shift expiration and 10-minute warning for non-exempt roles
            const currentRole = user.getRole();
            if (currentRole && currentRole !== 'Admin' && currentRole !== 'Executive') {
                const allowedEnd = user.getAllowedTimeEnd();
                if (allowedEnd) {
                    const parts = allowedEnd.split(':');
                    if (parts.length >= 2) {
                        const endH = parseInt(parts[0], 10);
                        const endM = parseInt(parts[1], 10);
                        if (!isNaN(endH) && !isNaN(endM)) {
                            const now = new Date();
                            const shiftEnd = new Date();
                            shiftEnd.setHours(endH, endM, 0, 0);
                            const remainingShiftMs = shiftEnd.getTime() - now.getTime();
                            const h12 = endH % 12 || 12;
                            const ampm = endH >= 12 ? 'PM' : 'AM';
                            const formattedEnd = `${h12}:${parts[1]} ${ampm}`;

                            if (remainingShiftMs <= 0) {
                                handleInvalidSession(
                                    `Your scheduled access hours have ended (Shift ended at ${formattedEnd}). You have been logged out.`,
                                    true,
                                    'shift_ended',
                                    'SHIFT_SCHEDULE_END'
                                );
                                return;
                            } else if (remainingShiftMs <= 10 * 60 * 1000 && remainingShiftMs > 0) {
                                if (!hasShown10MinShiftToastRef.current) {
                                    hasShown10MinShiftToastRef.current = true;
                                    const minsLeft = Math.max(1, Math.ceil(remainingShiftMs / 60000));
                                    toast.warning(`Shift Ending Soon: Your shift ends in ${minsLeft} minute${minsLeft === 1 ? '' : 's'} (at ${formattedEnd}). Please save your active work before automatic logout.`, {
                                        duration: 12000,
                                        position: 'top-center',
                                        id: 'shift-10min-warning',
                                    });
                                }
                            }
                        }
                    }
                }
            }

            if (timeoutMs >= Number.MAX_SAFE_INTEGER) {
                // Inactivity timer is disabled in settings
                setInactivityWarning(prev => (prev.show ? { show: false, remainingSeconds: 10, totalWarningSeconds: 10 } : prev));
                return;
            }

            const elapsed = Date.now() - latestActivity;
            const remainingMs = timeoutMs - elapsed;

            if (remainingMs <= 0) {
                handleInactivityLogout();
            } else if (remainingMs <= warningMs) {
                const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
                const totalWarningSec = Math.max(1, Math.ceil(warningMs / 1000));
                setInactivityWarning({
                    show: true,
                    remainingSeconds: remainingSec,
                    totalWarningSeconds: totalWarningSec,
                });
            } else {
                setInactivityWarning(prev => {
                    if (prev.show) return { show: false, remainingSeconds: 10, totalWarningSeconds: 10 };
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
        const isPublicRoute = 
            pathname === '/scAuth' || 
            pathname?.startsWith('/supplier-portal') || 
            pathname?.startsWith('/suppliers_page');
        if (isPublicRoute)
            return true;
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
            const isPublicRoute = 
                pathname === '/scAuth' || 
                pathname?.startsWith('/supplier-portal') || 
                pathname?.startsWith('/suppliers_page');

            if (isPublicRoute) {
                setGuardState('authorized');
                return;
            }

            if (!navigator.onLine) {
                setGuardState('offline');
                return;
            }
            if (isBlockedRef.current || isLoggingOutRef.current)
                return;

            const sessionToken = getSessionToken();
            if (!sessionToken) {
                await handleInvalidSession('No session found. Please login again.', true);
                return;
            }
            if (shouldSkipCheck()) {
                const currentRole = user.getRole();
                if (currentRole && VALID_ROLES.includes(currentRole)) {
                    if (!settingsService.canAccessPage(currentRole, pathname, requiredRole)) {
                        setGuardState('denied');
                    } else if (guardState === 'denied') {
                        setGuardState('authorized');
                    }
                }
                return;
            }
            isCheckingRef.current = true;
            prevPathRef.current = pathname;
            try {
                const res = await fetch('/api/supplyChain/validate-session', {
                    credentials: 'include',
                    headers: {
                        'x-session-token': sessionToken,
                        'User-Agent': navigator.userAgent,
                        'X-Current-Path': pathname || '/',
                    }
                });
                lastCheckRef.current = Date.now();
                if (!res.ok) {
                    const data: AuthResponse = await res.json().catch(() => ({}));
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
                const userId = data.user?.id || user.getUserId();
                if (userId && !isBlockedRef.current && !isLoggingOutRef.current) {
                    const blockedResult = await checkDeviceBlocked(userId, userAgent, sessionToken);
                    if (blockedResult.blocked) {
                        await handleDeviceBlocked(userId, userAgent, blockedResult.reason);
                        return;
                    }
                }
                const userRole = data.user?.role || user.getRole();
                if (!userRole || !VALID_ROLES.includes(userRole)) {
                    await handleInvalidSession('Invalid user role. Please contact support.', true);
                    return;
                }
                if (data.user) {
                    const userData = data.user as any;
                    user.updateUser({
                        role: userData.role || userRole,
                        name: userData.display_name || user.getName(),
                        allowedTimeStart: userData.allowed_time_start,
                        allowedTimeEnd: userData.allowed_time_end,
                        allowedDays: userData.allowed_days,
                    });
                }
                if (!settingsService.canAccessPage(userRole, pathname, requiredRole)) {
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
    }, [router, requiredRole, pathname, hasValidLocalStorage, shouldSkipCheck, handleInvalidSession, clearSessionData, getSessionToken, handleDeviceBlocked, guardState]);

    // Synchronous immediate permission pre-check whenever route/role changes
    useEffect(() => {
        const isPublicRoute = 
            pathname === '/scAuth' || 
            pathname?.startsWith('/supplier-portal') || 
            pathname?.startsWith('/suppliers_page');
        if (isPublicRoute) {
            setGuardState('authorized');
            return;
        }

        const currentRole = user.getRole();
        if (currentRole && VALID_ROLES.includes(currentRole)) {
            if (!settingsService.canAccessPage(currentRole, pathname, requiredRole)) {
                setGuardState('denied');
            } else if (guardState === 'denied') {
                setGuardState('authorized');
            }
        }
    }, [pathname, requiredRole, guardState]);

    // Live settings subscriber to instantly re-check permissions when altered
    useEffect(() => {
        const isPublicRoute = 
            pathname === '/scAuth' || 
            pathname?.startsWith('/supplier-portal') || 
            pathname?.startsWith('/suppliers_page');
        if (isPublicRoute) return;

        const unsubscribe = settingsService.subscribe(() => {
            const currentUserRole = user.getRole();
            if (currentUserRole && VALID_ROLES.includes(currentUserRole)) {
                if (!settingsService.canAccessPage(currentUserRole, pathname, requiredRole)) {
                    setGuardState('denied');
                } else if (guardState === 'denied') {
                    setGuardState('authorized');
                }
            }
        });
        return () => unsubscribe();
    }, [pathname, requiredRole, guardState]);

    useEffect(() => {
        hasShownSessionClearedToastRef.current = false;
        hasShownInvalidToastRef.current = false;
    }, [pathname]);

    // Realtime Supabase listener: Instant device block & session termination
    useEffect(() => {
        if (guardState !== 'authorized') return;

        const currentSessionToken = getSessionToken();
        const currentUser = user.getUser();
        const currentUserId = currentUser?.userId || '';
        const currentEmail = (currentUser?.email || '').toLowerCase().trim();
        const currentUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

        const channelId = `session_guard_live_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'blocked_devices' },
                (payload) => {
                    if (isBlockedRef.current || isLoggingOutRef.current) return;
                    const newRecord = payload.new as any;
                    if (!newRecord || newRecord.status !== 'blocked') return;

                    const recordEmail = (newRecord.email || '').toLowerCase().trim();
                    const recordUserId = newRecord.user_id || '';
                    const recordUserAgent = newRecord.user_agent || '';

                    let isMatch = false;
                    if (recordUserId && currentUserId && recordUserId === currentUserId) {
                        isMatch = true;
                    } else if (recordEmail && currentEmail && recordEmail === currentEmail) {
                        isMatch = true;
                    } else if (recordUserAgent && currentUserAgent && recordUserAgent === currentUserAgent) {
                        if (!recordEmail || recordEmail === currentEmail) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        console.warn('[SessionGuard Realtime] Device blocked event received:', newRecord);
                        handleDeviceBlocked(currentUserId, currentUserAgent, newRecord.reason || 'Blocked by administrator');
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions' },
                (payload) => {
                    if (isBlockedRef.current || isLoggingOutRef.current) return;
                    const newRecord = payload.new as any;
                    const activeToken = getSessionToken();
                    const recordEmail = (newRecord?.email || '').toLowerCase().trim();

                    if (newRecord && ((activeToken && newRecord.session_token === activeToken) || (currentEmail && recordEmail === currentEmail))) {
                        if (newRecord.is_active === false || newRecord.is_allow === false) {
                            // If the user is currently logging out locally or has already cleared session, do nothing
                            if (isLoggingOutRef.current || !user.getSessionToken()) {
                                return;
                            }
                            const reasonMsg = newRecord.is_allow === false
                                ? 'Your login access has been disabled by an Administrator.'
                                : 'Your session has ended. Please login again.';
                            handleInvalidSession(reasonMsg, true);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [guardState, getSessionToken, handleDeviceBlocked, handleInvalidSession]);
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
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                revalidate();
        };
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

    // Concurrent device login approval polling (only run on outer-most SessionGuard)
    useEffect(() => {
        if (isNestedSessionGuard) return;
        if (guardState !== 'authorized') return;

        const currentUser = user.getUser();
        const currentUserId = currentUser?.userId || '';
        const currentEmail = currentUser?.email || '';

        if (!currentUserId && !currentEmail) return;

        const checkIncomingLoginChallenges = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (loginApprovalPrompt.show || isLoggingOutRef.current) return;
            try {
                const params = new URLSearchParams();
                if (currentUserId) params.set('userId', currentUserId);
                if (currentEmail) params.set('email', currentEmail);

                const res = await fetch(`/api/auth/concurrent-login/check-pending?${params.toString()}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.hasPending && data.challenge) {
                    const challengeId = data.challenge.requestId;
                    const isDismissed =
                        dismissedChallengesRef.current.has(challengeId) ||
                        globalDismissedChallenges.has(challengeId) ||
                        (typeof window !== 'undefined' && sessionStorage.getItem(`dismissed_challenge_${challengeId}`) === 'true');

                    if (isDismissed) {
                        return;
                    }
                    setLoginApprovalPrompt({
                        show: true,
                        requestId: challengeId,
                        userAgent: data.challenge.userAgent || 'Unknown Device',
                        ipAddress: data.challenge.ipAddress || 'Unknown IP',
                        isResponding: false,
                        pendingDecision: null,
                        passwordModalOpen: false,
                    });
                }
            } catch (err) {
                // Silently ignore background polling error
            }
        };

        const onVisibilityChange = () => {
            if (typeof document !== 'undefined' && !document.hidden) {
                checkIncomingLoginChallenges();
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        const pollTimer = setInterval(checkIncomingLoginChallenges, 10000);
        return () => {
            clearInterval(pollTimer);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
        };
    }, [guardState, loginApprovalPrompt.show, isNestedSessionGuard]);

    const handleDirectDecline = async () => {
        const reqId = loginApprovalPrompt.requestId;

        // If no requestId is present, dismiss immediately
        if (!reqId) {
            setLoginApprovalPrompt({
                show: false,
                requestId: '',
                userAgent: '',
                ipAddress: '',
                isResponding: false,
                pendingDecision: null,
                passwordModalOpen: false,
            });
            return;
        }

        // Show loading state on Decline button and lock buttons
        setLoginApprovalPrompt(prev => ({
            ...prev,
            isResponding: true,
            pendingDecision: 'decline',
        }));

        dismissedChallengesRef.current.add(reqId);
        globalDismissedChallenges.add(reqId);
        try {
            sessionStorage.setItem(`dismissed_challenge_${reqId}`, 'true');
        } catch {}

        try {
            const res = await fetch('/api/auth/concurrent-login/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: reqId,
                    approved: false,
                }),
            });
            if (res.ok) {
                toast.info('Login attempt from other device was declined.');
            } else {
                toast.error('Failed to notify system of decline.');
            }
        } catch (err) {
            console.error('Error declining login challenge:', err);
            toast.error('Network error while declining.');
        } finally {
            // Dismiss and close modal cleanly
            setLoginApprovalPrompt({
                show: false,
                requestId: '',
                userAgent: '',
                ipAddress: '',
                isResponding: false,
                pendingDecision: null,
                passwordModalOpen: false,
            });
        }
    };

    const handleInitiateDecision = (decision: 'approve' | 'decline') => {
        if (decision === 'decline') {
            handleDirectDecline();
            return;
        }
        setApprovalPasswordInput('');
        setApprovalPasswordError(null);
        setShowApprovalPassword(false);
        setLoginApprovalPrompt(prev => ({
            ...prev,
            pendingDecision: 'approve',
            passwordModalOpen: true,
        }));
    };

    const handleConfirmPasswordDecision = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!loginApprovalPrompt.requestId) return;

        if (!approvalPasswordInput.trim()) {
            setApprovalPasswordError('Please enter your password to confirm.');
            return;
        }

        setLoginApprovalPrompt(prev => ({ ...prev, isResponding: true }));
        setApprovalPasswordError(null);

        try {
            const res = await fetch('/api/auth/concurrent-login/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: loginApprovalPrompt.requestId,
                    approved: true,
                    password: approvalPasswordInput.trim(),
                }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                const errMsg = data.message || 'Incorrect password. Verification failed.';
                setApprovalPasswordError(errMsg);
                toast.error(errMsg);
                setLoginApprovalPrompt(prev => ({ ...prev, isResponding: false }));
                return;
            }

            toast.success('Access approved for other device. Logging you out...');
            setLoginApprovalPrompt({
                show: false,
                requestId: '',
                userAgent: '',
                ipAddress: '',
                isResponding: false,
                pendingDecision: null,
                passwordModalOpen: false,
            });
            // Log out current session
            const token = getSessionToken();
            if (token) {
                await deactivateSession(token, 'concurrent_login_transferred', 'CONCURRENT_LOGIN_TRANSFERRED');
            }
            clearSessionData();
            setGuardState('denied');
            router.push('/scAuth');
        } catch (err) {
            console.error('Error responding to login challenge:', err);
            setApprovalPasswordError('Failed to verify password. Please check your connection.');
            toast.error('Failed to submit response. Please try again.');
            setLoginApprovalPrompt(prev => ({ ...prev, isResponding: false }));
        }
    };

    // unload handling — ONLY back up session data, do NOT call logout
    // (sendBeacon to logout was incorrectly firing on every refresh/navigation,
    //  marking the session inactive in the DB and causing the user to get
    //  logged out on the next page load)
    useEffect(() => {
        const handleUnload = () => {
            backupSessionData();
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

    const isPublicRoute = 
        pathname === '/scAuth' || 
        pathname?.startsWith('/supplier-portal') || 
        pathname?.startsWith('/suppliers_page');

    if (isPublicRoute) {
        return <>{children}</>;
    }

    if (guardState === 'offline') {
        return <OfflinePage />;
    }
    if (showLoader && guardState === 'loading') {
        return <Loader onComplete={handleLoaderComplete} />;
    }
    if (guardState === 'checking') {
        return (<Loader onComplete={handleLoaderComplete} />);
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
                                    style={{
                                        width: `${Math.min(100, Math.max(0, (((inactivityWarning.totalWarningSeconds || 10) - inactivityWarning.remainingSeconds) / (inactivityWarning.totalWarningSeconds || 10)) * 100))}%`
                                    }}
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
                            <div className="bg-red-600 h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${((5 - blockedWarning.countdown) / 5) * 100}%` }} />
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
    return (
        <SessionGuardContext.Provider value={true}>
            {children}
            {!isNestedSessionGuard && loginApprovalPrompt.show && (
                <Portal>
                    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        {!loginApprovalPrompt.passwordModalOpen ? (
                            /* Step 1: Decision Modal (Approve or Decline) */
                            <div className="max-w-md w-full bg-[#ebf0f7] dark:bg-[#181926] rounded-3xl p-6 sm:p-8 text-center shadow-none border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                                <div className="relative flex items-center justify-center w-16 h-16 bg-amber-100/90 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl mx-auto mb-4 ring-8 ring-amber-50 dark:ring-amber-950/20">
                                    <ShieldAlert className="w-8 h-8 animate-pulse" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight mb-2">
                                    Someone Is Trying to Log In
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                                    Another device is attempting to sign in to your account. Do you want to approve this login and switch devices, or decline?
                                </p>

                                <div className="bg-white/80 dark:bg-[#11121a]/80 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 text-left mb-6 space-y-2.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
                                        <span className="font-mono truncate">{loginApprovalPrompt.userAgent}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <span>IP Address: <span className="font-mono text-slate-700 dark:text-slate-300">{loginApprovalPrompt.ipAddress}</span></span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">Action Required</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                                        You will be asked to verify your password if you choose to approve.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        disabled={loginApprovalPrompt.isResponding}
                                        onClick={handleDirectDecline}
                                        className="flex-1 py-3 px-4 bg-[#ebf0f7] dark:bg-[#1e202e] hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.98] text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-none disabled:opacity-50"
                                    >
                                        {loginApprovalPrompt.isResponding && loginApprovalPrompt.pendingDecision === 'decline' ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                                <span>Declining...</span>
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-4 h-4 text-red-500" />
                                                <span>Decline</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loginApprovalPrompt.isResponding}
                                        onClick={() => handleInitiateDecision('approve')}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-none disabled:opacity-50"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Approve</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Step 2: Password Verification Modal (Approve only) */
                            <form
                                onSubmit={handleConfirmPasswordDecision}
                                className="max-w-md w-full bg-[#ebf0f7] dark:bg-[#181926] rounded-3xl p-6 sm:p-8 text-center shadow-none border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
                            >
                                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 ring-8 bg-emerald-100/90 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-emerald-50 dark:ring-emerald-950/20">
                                    <Lock className="w-8 h-8" />
                                </div>

                                <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight mb-2">
                                    Verify Password to Approve Login
                                </h2>

                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                                    Please enter your password to authorize transferring your active session to the other device. You will be signed out.
                                </p>

                                <div className="text-left mb-5">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Your Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showApprovalPassword ? 'text' : 'password'}
                                            value={approvalPasswordInput}
                                            onChange={(e) => {
                                                setApprovalPasswordInput(e.target.value);
                                                setApprovalPasswordError(null);
                                            }}
                                            placeholder="Enter account password"
                                            autoFocus
                                            className="w-full px-4 py-3 pr-11 bg-white/90 dark:bg-[#10111a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApprovalPassword(!showApprovalPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            {showApprovalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {approvalPasswordError && (
                                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                                            {approvalPasswordError}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        disabled={loginApprovalPrompt.isResponding}
                                        onClick={() => setLoginApprovalPrompt(prev => ({ ...prev, passwordModalOpen: false, pendingDecision: null }))}
                                        className="flex-1 py-3 px-4 bg-[#ebf0f7] dark:bg-[#1e202e] hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.98] text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all border border-slate-300 dark:border-slate-700 cursor-pointer disabled:opacity-50 shadow-none"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loginApprovalPrompt.isResponding || !approvalPasswordInput.trim()}
                                        className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-none active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                                    >
                                        {loginApprovalPrompt.isResponding ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Confirm Approval
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </Portal>
            )}
        </SessionGuardContext.Provider>
    );
}
