'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, AlertCircle, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface OfflineDetectorProps {
    children?: React.ReactNode;
    showToast?: boolean;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    pingUrl?: string;
    pingTimeout?: number;
    blurAmount?: number;
}

export function OfflineDetector({
    children,
    showToast = true,
    autoReconnect = true,
    reconnectInterval = 30000,
    pingUrl = 'https://www.google.com/favicon.ico',
    pingTimeout = 5000,
    blurAmount = 4,
}: OfflineDetectorProps) {
    const [isOnline, setIsOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'none'>('good');
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const dragConstraintsRef = useRef<HTMLDivElement>(null);
    const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    const toastShownRef = useRef<{ offline: boolean; online: boolean }>({ offline: false, online: false });
    const isOfflineRef = useRef(false);

    // Motion values for drag
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Check connectivity
    const checkConnectivity = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), pingTimeout);

            await fetch(pingUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            return false;
        }
    }, [pingUrl, pingTimeout]);

    // Load saved position
    useEffect(() => {
        const savedPosition = localStorage.getItem('offlineIndicatorPosition');
        if (savedPosition) {
            try {
                const pos = JSON.parse(savedPosition);
                setPosition(pos);
                x.set(pos.x);
                y.set(pos.y);
                setIsPositioned(true);
            } catch (e) {
                // Ignore
            }
        }
    }, []);

    const savePosition = useCallback((newX: number, newY: number) => {
        const pos = { x: newX, y: newY };
        setPosition(pos);
        localStorage.setItem('offlineIndicatorPosition', JSON.stringify(pos));
        setIsPositioned(true);
    }, []);

    // Disable background interaction when offline
    useEffect(() => {
        if (!isOnline) {
            document.body.style.pointerEvents = 'none';
            document.body.style.userSelect = 'none';
            document.body.style.overflow = 'hidden';

            const bannerElement = document.querySelector('.offline-banner-container');
            if (bannerElement) {
                (bannerElement as HTMLElement).style.pointerEvents = 'auto';
            }
            const indicatorElement = document.querySelector('.offline-indicator');
            if (indicatorElement) {
                (indicatorElement as HTMLElement).style.pointerEvents = 'auto';
            }
        } else {
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
            document.body.style.overflow = '';
        };
    }, [isOnline]);

    // Continuous connectivity check
    const checkConnection = useCallback(async () => {
        if (!isMountedRef.current) return;

        const connected = await checkConnectivity();

        if (!isMountedRef.current) return;

        if (connected && !isOnline) {
            setIsOnline(true);
            setConnectionQuality('good');
            setShowBanner(false);
            isOfflineRef.current = false;

            setTimeout(() => {
                toastShownRef.current.offline = false;
            }, 2000);

            if (wasOffline) {
                setWasOffline(false);
                if (showToast && !toastShownRef.current.online) {
                    toastShownRef.current.online = true;
                    toast.success('Connection restored!', {
                        duration: 3000,
                        position: 'bottom-center',
                        id: 'online-toast',
                    });
                    setTimeout(() => {
                        toastShownRef.current.online = false;
                    }, 3000);
                }
            }
        } else if (!connected && isOnline) {
            setIsOnline(false);
            setWasOffline(true);
            setShowBanner(true);
            setConnectionQuality('none');
            isOfflineRef.current = true;

            setTimeout(() => {
                toastShownRef.current.online = false;
            }, 2000);

            if (showToast && !toastShownRef.current.offline) {
                toastShownRef.current.offline = true;
                toast.error('No internet connection', {
                    duration: 5000,
                    position: 'bottom-center',
                    id: 'offline-toast',
                });
            }
        } else if (!connected && !isOnline) {
            const offlineDuration = Date.now() - (wasOffline ? Date.now() - 1000 : Date.now());
            if (offlineDuration > 30000) {
                setConnectionQuality('poor');
            }
        }
    }, [isOnline, wasOffline, showToast, checkConnectivity]);

    // Listen for online/offline events
    useEffect(() => {
        isMountedRef.current = true;

        const handleOnline = () => {
            checkConnection();
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
            setShowBanner(true);
            setConnectionQuality('none');
            isOfflineRef.current = true;

            if (showToast && !toastShownRef.current.offline) {
                toastShownRef.current.offline = true;
                toast.error('No internet connection', {
                    duration: 5000,
                    position: 'bottom-center',
                    id: 'offline-toast',
                });
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const initialCheck = async () => {
            const connected = await checkConnectivity();
            if (isMountedRef.current) {
                setIsOnline(connected);
                if (!connected) {
                    setWasOffline(true);
                    setShowBanner(true);
                    setConnectionQuality('none');
                    isOfflineRef.current = true;

                    if (showToast && !toastShownRef.current.offline) {
                        toastShownRef.current.offline = true;
                        toast.error('No internet connection', {
                            duration: 5000,
                            position: 'bottom-center',
                            id: 'offline-toast',
                        });
                    }
                }
            }
        };
        initialCheck();

        const intervalId = setInterval(() => {
            checkConnection();
        }, 10000);

        if (autoReconnect && !isOnline) {
            if (reconnectTimerRef.current) {
                clearInterval(reconnectTimerRef.current);
            }
            reconnectTimerRef.current = setInterval(() => {
                if (!isOnline && isMountedRef.current) {
                    checkConnection();
                }
            }, reconnectInterval);
        }

        return () => {
            isMountedRef.current = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(intervalId);
            if (reconnectTimerRef.current) {
                clearInterval(reconnectTimerRef.current);
            }
            if (pingTimeoutRef.current) {
                clearTimeout(pingTimeoutRef.current);
            }
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
            document.body.style.overflow = '';
        };
    }, [checkConnection, autoReconnect, reconnectInterval, isOnline, showToast]);

    // Update auto reconnect timer
    useEffect(() => {
        if (autoReconnect && !isOnline) {
            if (reconnectTimerRef.current) {
                clearInterval(reconnectTimerRef.current);
            }
            reconnectTimerRef.current = setInterval(() => {
                if (!isOnline && isMountedRef.current) {
                    checkConnection();
                }
            }, reconnectInterval);
        } else if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        return () => {
            if (reconnectTimerRef.current) {
                clearInterval(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [isOnline, autoReconnect, reconnectInterval, checkConnection]);

    const handleManualReconnect = async () => {
        setIsReconnecting(true);
        try {
            const connected = await checkConnectivity();
            if (connected) {
                setIsOnline(true);
                setShowBanner(false);
                setWasOffline(false);
                setConnectionQuality('good');
                isOfflineRef.current = false;

                toast.success('Connection restored!', {
                    duration: 3000,
                    position: 'bottom-center',
                    id: 'manual-reconnect-toast',
                });
            } else {
                toast.error('Still offline', {
                    duration: 3000,
                    position: 'bottom-center',
                    id: 'manual-reconnect-fail-toast',
                });
            }
        } catch (error) {
            toast.error('Failed to connect', {
                duration: 3000,
                position: 'bottom-center',
                id: 'manual-reconnect-error-toast',
            });
        } finally {
            setIsReconnecting(false);
        }
    };

    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        const currentX = x.get();
        const currentY = y.get();
        savePosition(currentX, currentY);
    };

    const defaultPosition = isPositioned ? position : { x: 0, y: 0 };

    return (
        <>
            {/* Offline Overlay - Disables background interaction */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[999]"
                    >
                        <div
                            className="absolute inset-0 bg-black/5 backdrop-blur-sm transition-all duration-500"
                            style={{ backdropFilter: `blur(${blurAmount}px)` }}
                            onClick={() => setShowBanner(true)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Offline Banner */}
            <AnimatePresence>
                {(showBanner || !isOnline) && (
                    <motion.div
                        initial={{ y: -80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -80, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className={`offline-banner-container fixed top-0 left-0 right-0 z-[1000] pointer-events-auto ${!isOnline
                            ? 'bg-gradient-to-r from-red-50 via-red-100/80 to-red-50 border-b-2 border-red-400 shadow-lg shadow-red-200/50'
                            : 'bg-gradient-to-r from-emerald-50 via-emerald-100/80 to-emerald-50 border-b-2 border-emerald-400 shadow-lg shadow-emerald-200/50'
                            }`}
                        style={{ transform: 'translateZ(0)' }}
                    >
                        <div className={`w-full transition-all duration-300 border-b ${!isOnline
                            ? 'bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 dark:from-rose-950/40 dark:via-red-950/30 dark:to-orange-950/20 border-rose-200/80 dark:border-rose-900/50'
                            : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
                            }`}>
                            <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

                                    {/* Left Content: Icon + Status Information */}
                                    <div className="flex items-start sm:items-center gap-3.5 w-full sm:w-auto">
                                        {/* Icon Circle with Ambient Glow */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`absolute -inset-1 rounded-full blur-sm opacity-40 animate-pulse ${!isOnline ? 'bg-rose-500' : 'bg-emerald-500'
                                                }`} />
                                            <div className={`relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border shadow-sm ${!isOnline
                                                ? 'bg-rose-100 dark:bg-rose-900/60 border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400'
                                                : 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-700/50 text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                {!isOnline ? (
                                                    <WifiOff className="h-5 w-5 stroke-[2.25]" />
                                                ) : (
                                                    <Wifi className="h-5 w-5 stroke-[2.25]" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Text Content & Badges */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className={`text-sm sm:text-base font-semibold tracking-tight ${!isOnline ? 'text-rose-950 dark:text-rose-100' : 'text-emerald-950 dark:text-emerald-100'
                                                    }`}>
                                                    {!isOnline ? 'You are offline' : 'Back Online!'}
                                                </h4>

                                                {!isOnline && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-200/60 dark:border-rose-700/50">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600 dark:bg-rose-400"></span>
                                                        </span>
                                                        No Connection
                                                    </span>
                                                )}

                                                {isOnline && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-700/50">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600 dark:bg-emerald-400"></span>
                                                        </span>
                                                        Connected
                                                    </span>
                                                )}
                                            </div>

                                            <p className={`text-xs sm:text-sm mt-0.5 leading-relaxed ${!isOnline ? 'text-rose-800/90 dark:text-rose-200/80' : 'text-emerald-800/90 dark:text-emerald-200/80'
                                                }`}>
                                                {!isOnline
                                                    ? 'Some features may be unavailable. Please check your network connection.'
                                                    : 'Your connection has been restored. All systems fully operational.'
                                                }
                                            </p>

                                            {!isOnline && connectionQuality === 'poor' && (
                                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                                                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                                    Connection appears weak or unstable
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Content: Action Buttons */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-rose-200/40 dark:border-rose-900/30">
                                        {!isOnline && (
                                            <button
                                                onClick={handleManualReconnect}
                                                disabled={isReconnecting}
                                                className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-200 bg-white dark:bg-rose-950/80 hover:bg-rose-50 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded-lg transition-all shadow-xs hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                                            >
                                                {isReconnecting ? (
                                                    <>
                                                        <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-rose-600 dark:text-rose-400" />
                                                        <span className="hidden sm:inline">Reconnecting...</span>
                                                        <span className="sm:hidden">Retrying...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 dark:text-rose-400" />
                                                        <span className="hidden sm:inline">Retry Connection</span>
                                                        <span className="sm:hidden">Retry</span>
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setShowBanner(false)}
                                            className={`p-1.5 rounded-lg transition-colors ${!isOnline
                                                ? 'text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 hover:bg-rose-100/60 dark:hover:bg-rose-900/50'
                                                : 'text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/50'
                                                }`}
                                            aria-label="Dismiss banner"
                                        >
                                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Children with overlay protection */}
            <div style={{ pointerEvents: !isOnline ? 'none' : 'auto' }}>
                {children}
            </div>

            {/* Draggable Status Indicators */}
            <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-[1000]">
                {/* Offline Status Indicator */}
                <AnimatePresence>
                    {!isOnline && !showBanner && (
                        <motion.div
                            ref={indicatorRef}
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            dragConstraints={dragConstraintsRef}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            style={{ x, y }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className={`offline-indicator absolute pointer-events-auto cursor-grab active:cursor-grabbing group ${isDragging ? 'scale-105 shadow-2xl' : 'shadow-lg'
                                }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowBanner(true)}
                        >
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full shadow-red-200/30 backdrop-blur-sm hover:bg-red-100 transition-colors">
                                <div className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity">
                                    <GripVertical className="h-3 w-3 text-red-400" />
                                </div>
                                <div className="relative">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-75"></div>
                                </div>
                                <span className="text-xs font-medium text-red-700">Offline</span>
                                <span className="text-xs text-red-400">(tap to reconnect)</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Online Status Indicator */}
                <AnimatePresence>
                    {isOnline && !showBanner && (
                        <motion.div
                            ref={indicatorRef}
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            dragConstraints={dragConstraintsRef}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            style={{ x, y }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing group ${isDragging ? 'scale-105 shadow-2xl' : 'shadow-lg'
                                }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full shadow-emerald-200/30 backdrop-blur-sm">
                                <div className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity">
                                    <GripVertical className="h-3 w-3 text-emerald-400" />
                                </div>
                                <div className="relative">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                                </div>
                                <span className="text-xs font-medium text-emerald-700">Online</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

// Hook for checking online status
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                await fetch('https://www.google.com/favicon.ico', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                setIsOnline(true);
            } catch {
                setIsOnline(false);
            }
        };

        checkStatus();

        const interval = setInterval(checkStatus, 10000);

        const handleOnline = () => checkStatus();
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}