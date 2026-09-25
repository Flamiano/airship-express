'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { calculateGrabbableCollision } from '../../lib/grabbablePhysics';
import { Wifi, WifiOff, RefreshCw, AlertCircle, X, GripVertical, Minus, Maximize2 } from 'lucide-react';
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
    const pathname = usePathname();
    const isWarehousing = pathname?.includes('/warehousing');
    const [isOnline, setIsOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'none'>('good');
    const [isDragging, setIsDragging] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const dragConstraintsRef = useRef<HTMLDivElement>(null);
    const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    const toastShownRef = useRef<{ offline: boolean; online: boolean }>({ offline: false, online: false });
    const isOfflineRef = useRef(false);

    // track drag motion
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // check network connectivity
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

    const hasDraggedRef = useRef(false);
    const [dragBounds, setDragBounds] = useState({ top: -800, bottom: 8, left: -8, right: 1200 });

    // Update screen boundaries on resize or minimization change
    useEffect(() => {
        const updateBounds = () => {
            if (typeof window !== 'undefined') {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                setDragBounds({
                    top: -(vh - 24 - 48 - 16),
                    bottom: 8,
                    left: -8,
                    right: Math.max(20, vw - 24 - (isMinimized ? 44 : 185) - 16),
                });
            }
        };
        updateBounds();
        window.addEventListener('resize', updateBounds);
        return () => window.removeEventListener('resize', updateBounds);
    }, [isMinimized]);

    // load saved position and minimization state, clamped to screen bounds
    useEffect(() => {
        try {
            const savedPosition = localStorage.getItem('offlineIndicatorPosition');
            if (savedPosition) {
                const pos = JSON.parse(savedPosition);
                if (typeof pos.x === 'number' && Number.isFinite(pos.x) && typeof pos.y === 'number' && Number.isFinite(pos.y)) {
                    const clampedX = Math.min(Math.max(pos.x, dragBounds.left), dragBounds.right);
                    const clampedY = Math.min(Math.max(pos.y, dragBounds.top), dragBounds.bottom);
                    const clampedPos = { x: clampedX, y: clampedY };
                    setPosition(clampedPos);
                    x.set(clampedX);
                    y.set(clampedY);
                    setIsPositioned(true);
                    localStorage.setItem('offlineIndicatorPosition', JSON.stringify(clampedPos));
                }
            }
            const savedMinimized = localStorage.getItem('offlineIndicatorMinimized');
            if (savedMinimized !== null) {
                setIsMinimized(savedMinimized === 'true');
            }
        } catch (e) {
            // ignore
        }
    }, [x, y, dragBounds]);

    const savePosition = useCallback((newX: number, newY: number) => {
        const pos = { x: newX, y: newY };
        setPosition(pos);
        try {
            localStorage.setItem('offlineIndicatorPosition', JSON.stringify(pos));
        } catch (e) {
            // ignore
        }
        setIsPositioned(true);
    }, []);

    const toggleMinimized = useCallback((e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (hasDraggedRef.current) return;

        setIsMinimized((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('offlineIndicatorMinimized', String(next));
            } catch (err) {
                // ignore
            }
            return next;
        });
    }, []);

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
        hasDraggedRef.current = true;
    }, []);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
        setTimeout(() => {
            hasDraggedRef.current = false;
        }, 120);

        let currentX = Math.min(Math.max(x.get(), dragBounds.left), dragBounds.right);
        let currentY = Math.min(Math.max(y.get(), dragBounds.top), dragBounds.bottom);
        x.set(currentX);
        y.set(currentY);
        savePosition(currentX, currentY);

        // Check collision with AI Robot Head
        const robotEl = document.getElementById('grabbable-ai-robot');
        const offlineEl = document.getElementById('grabbable-offline-indicator');
        const collision = calculateGrabbableCollision(robotEl, offlineEl);

        if (collision?.collided) {
            const newX = Math.min(Math.max(currentX + collision.offlinePush.x, dragBounds.left), dragBounds.right);
            const newY = Math.min(Math.max(currentY + collision.offlinePush.y, dragBounds.top), dragBounds.bottom);
            animate(x, newX, { type: 'spring', stiffness: 360, damping: 22 });
            animate(y, newY, { type: 'spring', stiffness: 360, damping: 22 });
            savePosition(newX, newY);

            // Notify AI robot to wobble, bounce, and show its speech bubble
            window.dispatchEvent(new CustomEvent('supplychain:grabbable-bounce', {
                detail: { source: 'offline', push: collision.robotPush }
            }));
        }
    }, [x, y, dragBounds, savePosition]);

    // Listen for external bounce when AI Robot is dragged into the offline indicator
    useEffect(() => {
        const handleExternalBounce = (e: Event) => {
            const customEvent = e as CustomEvent<{ source: string; push: { x: number; y: number } }>;
            if (customEvent.detail?.source === 'robot') {
                const newX = Math.min(Math.max(x.get() + customEvent.detail.push.x, dragBounds.left), dragBounds.right);
                const newY = Math.min(Math.max(y.get() + customEvent.detail.push.y, dragBounds.top), dragBounds.bottom);
                animate(x, newX, { type: 'spring', stiffness: 360, damping: 22 });
                animate(y, newY, { type: 'spring', stiffness: 360, damping: 22 });
                savePosition(newX, newY);
            }
        };
        window.addEventListener('supplychain:grabbable-bounce', handleExternalBounce);
        return () => window.removeEventListener('supplychain:grabbable-bounce', handleExternalBounce);
    }, [x, y, dragBounds, savePosition]);

    // disable background interaction & scroll when offline (except on warehousing where offline scanning is active)
    useEffect(() => {
        if (!isOnline && !isWarehousing) {
            document.body.classList.add('is-offline');
            document.documentElement.classList.add('is-offline');
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';

            // Stop Lenis smooth scrolling if present
            const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
            if (lenis && typeof lenis.stop === 'function') {
                lenis.stop();
            }

            // Strictly intercept and prevent mouse wheel scrolling anywhere in the background
            const handleWheel = (e: WheelEvent) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('.offline-banner-container')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
            };

            // Strictly intercept and prevent touch scroll gestures
            const handleTouchMove = (e: TouchEvent) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('.offline-banner-container')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
            };

            // Strictly prevent keyboard scroll commands (Arrow keys, Space, PageUp/Down, Home/End)
            const handleKeyDown = (e: KeyboardEvent) => {
                const scrollKeys = ['Space', 'PageUp', 'PageDown', 'End', 'Home', 'ArrowUp', 'ArrowDown'];
                if (scrollKeys.includes(e.code) || [32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('input, textarea, select')) {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }
            };

            window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
            window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
            window.addEventListener('keydown', handleKeyDown, { passive: false, capture: true });

            return () => {
                document.body.classList.remove('is-offline');
                document.documentElement.classList.remove('is-offline');
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';

                if (lenis && typeof lenis.start === 'function') {
                    lenis.start();
                }

                window.removeEventListener('wheel', handleWheel, { capture: true });
                window.removeEventListener('touchmove', handleTouchMove, { capture: true });
                window.removeEventListener('keydown', handleKeyDown, { capture: true });
            };
        } else {
            document.body.classList.remove('is-offline');
            document.documentElement.classList.remove('is-offline');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';

            const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
            if (lenis && typeof lenis.start === 'function') {
                lenis.start();
            }
        }
    }, [isOnline, isWarehousing]);

    // continuous network check
    const checkConnection = useCallback(async () => {
        if (!isMountedRef.current) return;

        const connected = await checkConnectivity();

        if (!isMountedRef.current) return;

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
        } else {
            if (wasOffline) {
                setShowBanner(false);
                setConnectionQuality('good');
                isOfflineRef.current = false;

                if (showToast && !toastShownRef.current.online) {
                    toastShownRef.current.online = true;
                }
            }
            const offlineDuration = Date.now() - (wasOffline ? Date.now() - 1000 : Date.now());
            if (offlineDuration > 30000) {
                setConnectionQuality('poor');
            }
        }
    }, [wasOffline, showToast, checkConnectivity]);

    // listen for network events
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
    }, [checkConnection, autoReconnect, reconnectInterval, isOnline, showToast, checkConnectivity]);

    // update auto reconnect timer
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

    return (
        <>
            {/* Offline Shield Overlay - Intercepts and completely disables background interaction (disabled on warehousing so operators can scan offline) */}
            <AnimatePresence>
                {!isOnline && !isWarehousing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="offline-shield-overlay fixed inset-0 z-[999] pointer-events-auto touch-none select-none"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowBanner(true);
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onWheel={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <div
                            className={`absolute inset-0 bg-slate-900/30 dark:bg-black/50 transition-all duration-500 ${blurAmount > 0 ? 'backdrop-blur-sm' : ''}`}
                            style={blurAmount > 0 ? { backdropFilter: `blur(${blurAmount}px)`, WebkitBackdropFilter: `blur(${blurAmount}px)` } : undefined}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Offline Neumorphic Floating Island Banner */}
            <AnimatePresence>
                {(showBanner || !isOnline) && (
                    <motion.div
                        initial={{ y: -80, opacity: 0, scale: 0.98 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -80, opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="offline-banner-container fixed top-3 sm:top-5 left-3 right-3 sm:left-6 sm:right-6 max-w-5xl mx-auto z-[1000] pointer-events-auto"
                        style={{ transform: 'translateZ(0)' }}
                    >
                        <div className={`w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 backdrop-blur-xl border transition-all duration-300 ${!isOnline
                            ? 'bg-[#ebf0f7]/95 dark:bg-[#14151e]/95 border-rose-300/80 dark:border-rose-900/60 shadow-[6px_6px_16px_rgba(166,175,195,0.45),-6px_-6px_16px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.8),-2px_-2px_10px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            : 'bg-[#ebf0f7]/95 dark:bg-[#14151e]/95 border-emerald-300/80 dark:border-emerald-900/60 shadow-[6px_6px_16px_rgba(166,175,195,0.45),-6px_-6px_16px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.8),-2px_-2px_10px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            }`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">

                                {/* Left Content: Icon + Status Information */}
                                <div className="flex items-start sm:items-center gap-3.5 w-full sm:w-auto">
                                    {/* Neumorphic Inset Icon Well */}
                                    <div className={`relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border shrink-0 ${!isOnline
                                        ? 'bg-[#e4ebf5] dark:bg-[#111218] border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)]'
                                        : 'bg-[#e4ebf5] dark:bg-[#111218] border-emerald-200/80 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)]'
                                        }`}>
                                        <div className={`absolute -inset-1 rounded-2xl blur-xs opacity-40 animate-pulse ${!isOnline ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                        {!isOnline ? (
                                            <WifiOff className="h-5 w-5 stroke-[2.25] relative z-10" />
                                        ) : (
                                            <Wifi className="h-5 w-5 stroke-[2.25] relative z-10" />
                                        )}
                                    </div>

                                    {/* Text Content & Badges */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className={`text-sm sm:text-base font-bold tracking-tight ${!isOnline ? 'text-rose-950 dark:text-rose-100' : 'text-emerald-950 dark:text-emerald-100'}`}>
                                                {!isOnline ? 'You are offline' : 'Back Online!'}
                                            </h4>

                                            {!isOnline && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e4ebf5] dark:bg-[#111218] text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)]">
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600 dark:bg-rose-400"></span>
                                                    </span>
                                                    No Connection
                                                </span>
                                            )}

                                            {isOnline && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e4ebf5] dark:bg-[#111218] text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)]">
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600 dark:bg-emerald-400"></span>
                                                    </span>
                                                    Connected
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs sm:text-sm mt-0.5 leading-relaxed font-medium text-slate-600 dark:text-slate-300">
                                            {!isOnline
                                                ? (isWarehousing
                                                    ? 'Offline mode active: You can continue scanning. Parcels will be stored locally as "Not Synced".'
                                                    : 'Network connectivity paused. Changes will sync once reconnected.')
                                                : 'Your connection has been restored. All systems fully operational.'
                                            }
                                        </p>

                                        {!isOnline && connectionQuality === 'poor' && (
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                                Connection appears weak or unstable
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right Content: Neumorphic Action Buttons */}
                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-200/60 dark:border-white/[0.06]">
                                    {!isOnline && (
                                        <button
                                            onClick={handleManualReconnect}
                                            disabled={isReconnecting}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 bg-[#ebf0f7] dark:bg-[#181926] border border-white/80 dark:border-white/[0.08] rounded-2xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] hover:shadow-[1.5px_1.5px_4px_rgba(166,175,195,0.3),-1.5px_-1.5px_4px_rgba(255,255,255,0.8)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4)] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.8)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {isReconnecting ? (
                                                <>
                                                    <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-rose-600 dark:text-rose-400" />
                                                    <span>Reconnecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600 dark:text-rose-400" />
                                                    <span>Retry Connection</span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowBanner(false)}
                                        className="w-9 h-9 rounded-2xl flex items-center justify-center bg-[#ebf0f7] dark:bg-[#181926] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_8px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.3)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4)] dark:active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.8)] active:scale-95 text-slate-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all cursor-pointer"
                                        aria-label="Dismiss banner"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Children with total offline shielding (disabled on warehousing) */}
            <div
                aria-hidden={!isOnline && !isWarehousing}
                className={`transition-all duration-300 ${!isOnline && !isWarehousing ? 'pointer-events-none select-none filter blur-[1px]' : ''}`}
                style={{ pointerEvents: !isOnline && !isWarehousing ? 'none' : 'auto' }}
            >
                {children}
            </div>

            {/* Draggable Neumorphic Status Indicator */}
            <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
                {/* Offline Status Indicator */}
                <AnimatePresence>
                    {!isOnline && !showBanner && (
                        <motion.div
                            ref={indicatorRef}
                            layout
                            drag
                            dragMomentum={true}
                            dragElastic={0.15}
                            dragTransition={{ power: 0.12, timeConstant: 220, bounceStiffness: 280, bounceDamping: 24 }}
                            dragConstraints={dragConstraintsRef}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            style={{ x, y }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileDrag={{ scale: 1.02 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                            className={`offline-indicator fixed bottom-6 right-6 pointer-events-auto cursor-grab active:cursor-grabbing select-none group transition-shadow duration-300 ${isDragging ? 'z-[1001]' : ''}`}
                            onClick={() => {
                                if (!isDragging) setShowBanner(true);
                            }}
                        >
                            {isMinimized ? (
                                /* Minimized Neumorphic Offline Indicator - Matte */
                                <div
                                    className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#151620] border border-white/80 dark:border-white/[0.08] shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.75),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.8)] dark:hover:shadow-[3px_3px_10px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] transition-all duration-300 relative group/btn"
                                    title="Offline - Click to expand / reconnect"
                                >
                                    <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleMinimized}
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ebf0f7] dark:bg-[#1a1b26] border border-white/80 dark:border-[#2a2b38] text-slate-500 dark:text-slate-400 hover:text-rose-600 shadow-xs flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity cursor-pointer"
                                        title="Expand"
                                    >
                                        <Maximize2 className="h-2.5 w-2.5" />
                                    </button>
                                </div>
                            ) : (
                                /* Full Neumorphic Offline Indicator - Matte */
                                <div className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 bg-[#ebf0f7] dark:bg-[#151620] border border-white/80 dark:border-white/[0.08] rounded-2xl shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.75),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[3px_3px_8px_rgba(166,175,195,0.35),-3px_-3px_8px_rgba(255,255,255,0.8)] dark:hover:shadow-[3px_3px_10px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] transition-all duration-300">
                                    <div className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 rounded">
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="relative flex h-2 w-2 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 tracking-tight leading-none">Offline</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5">tap to reconnect</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleMinimized}
                                        className="ml-1 p-1 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                                        title="Minimize indicator"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Online Status Indicator */}
                <AnimatePresence>
                    {isOnline && !showBanner && (
                        <motion.div
                            ref={indicatorRef}
                            id="grabbable-offline-indicator"
                            layout
                            drag
                            dragConstraints={dragBounds}
                            dragMomentum={true}
                            dragElastic={0.12}
                            dragTransition={{ power: 0.12, timeConstant: 220, bounceStiffness: 280, bounceDamping: 24 }}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            style={{ x, y }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileDrag={{ scale: 1.02 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                            className="fixed bottom-6 left-6 z-50 pointer-events-auto cursor-grab active:cursor-grabbing select-none touch-none group transition-shadow duration-300"
                        >
                            {isMinimized ? (
                                /* Minimized Neumorphic Online Indicator - Matte */
                                <div
                                    onClick={toggleMinimized}
                                    className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#151620] border border-white/80 dark:border-white/[0.08] shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.75),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.8)] dark:hover:shadow-[3px_3px_10px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4)] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.8)] transition-all duration-300 relative group/btn cursor-pointer"
                                    title="Online - Click to expand"
                                >
                                    <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ebf0f7] dark:bg-[#1a1b26] border border-white/80 dark:border-[#2a2b38] text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 shadow-xs flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity">
                                        <Maximize2 className="h-2.5 w-2.5" />
                                    </div>
                                </div>
                            ) : (
                                /* Full Neumorphic Online Indicator - Matte */
                                <div className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 bg-[#ebf0f7] dark:bg-[#151620] border border-white/80 dark:border-white/[0.08] rounded-2xl shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.75),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[3px_3px_8px_rgba(166,175,195,0.35),-3px_-3px_8px_rgba(255,255,255,0.8)] dark:hover:shadow-[3px_3px_10px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] transition-all duration-300">
                                    {/* Tactile Grip */}
                                    <div className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 rounded">
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </div>

                                    {/* Clean Pulse Dot */}
                                    <div className="relative flex h-2 w-2 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>

                                    {/* Status Label */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight leading-none">Online</span>
                                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 leading-none">Live</span>
                                    </div>

                                    {/* Minimize Button */}
                                    <button
                                        type="button"
                                        onClick={toggleMinimized}
                                        className="ml-1 p-1 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.08] transition-colors cursor-pointer active:scale-95"
                                        title="Minimize indicator"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
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