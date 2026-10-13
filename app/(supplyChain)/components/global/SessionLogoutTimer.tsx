'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, AlertCircle, ShieldCheck, X, Shield, Building2 } from 'lucide-react';
import { settingsService } from '../../lib/services/settingsService';
import { user } from '../../lib/services/Class/user';

const INACTIVITY_STORAGE_KEY = 'sc_last_activity_time';

interface SessionLogoutTimerProps {
    compact?: boolean;
    className?: string;
}

export const SessionLogoutTimer: React.FC<SessionLogoutTimerProps> = ({ compact = false, className = '' }) => {
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const [shiftRemainingSeconds, setShiftRemainingSeconds] = useState<number | null>(null);
    const [allowedTimeEnd, setAllowedTimeEnd] = useState<string | null>(null);
    const [isLow, setIsLow] = useState<boolean>(false);
    const [isCritical, setIsCritical] = useState<boolean>(false);
    const [timeoutEnabled, setTimeoutEnabled] = useState<boolean>(true);
    const [userRole, setUserRole] = useState<string>('User');
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastActivityRef = useRef<number>(Date.now());

    // Calculate remaining seconds until allowed_time_end
    const calculateShiftSeconds = useCallback((endTimeStr: string | null): number | null => {
        if (!endTimeStr) return null;
        const clean = endTimeStr.trim();
        const parts = clean.split(':');
        if (parts.length < 2) return null;
        const endH = parseInt(parts[0], 10);
        const endM = parseInt(parts[1], 10);
        if (isNaN(endH) || isNaN(endM)) return null;

        const now = new Date();
        const target = new Date();
        target.setHours(endH, endM, 0, 0);

        const diffMs = target.getTime() - now.getTime();
        return Math.floor(diffMs / 1000);
    }, []);

    // Close popover on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const isExempt = (roleName: string) => {
        const r = (roleName || '').toLowerCase().trim();
        return ['admin', 'executive'].includes(r);
    };

    useEffect(() => {
        const currentRole = user.getRole();
        setUserRole(currentRole || 'User');
        const endTime = user.getAllowedTimeEnd() || (isExempt(currentRole) ? null : '23:59');
        setAllowedTimeEnd(endTime);

        // Initial setup from storage
        try {
            const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
            if (stored) {
                const parsed = parseInt(stored, 10);
                if (!isNaN(parsed) && parsed > 0) {
                    lastActivityRef.current = parsed;
                }
            } else {
                localStorage.setItem(INACTIVITY_STORAGE_KEY, Date.now().toString());
            }
        } catch {}

        // Listen for activity events to reset countdown
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        const onActivity = () => {
            const now = Date.now();
            lastActivityRef.current = now;
        };

        events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

        const handleStorage = (e: StorageEvent) => {
            if (e.key === INACTIVITY_STORAGE_KEY && e.newValue) {
                const remoteTime = parseInt(e.newValue, 10);
                if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
                    lastActivityRef.current = remoteTime;
                }
            }
            if (e.key === 'user_allowed_time_end' || e.key === 'user_role') {
                const updatedRole = user.getRole();
                setUserRole(updatedRole || 'User');
                setAllowedTimeEnd(user.getAllowedTimeEnd() || (isExempt(updatedRole) ? null : '23:59'));
            }
        };
        window.addEventListener('storage', handleStorage);

        // Update timer every second
        const interval = setInterval(() => {
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
            } catch {}

            const role = user.getRole();
            setUserRole(role || 'User');
            const endT = user.getAllowedTimeEnd() || (isExempt(role) ? null : '23:59');
            setAllowedTimeEnd(endT);

            const shiftSec = calculateShiftSeconds(endT);
            setShiftRemainingSeconds(shiftSec);

            const timeoutMs = settingsService.getInactivityTimeoutMs();
            if (timeoutMs >= Number.MAX_SAFE_INTEGER) {
                setTimeoutEnabled(false);
                setRemainingSeconds(null);
                return;
            }

            setTimeoutEnabled(true);
            const elapsed = Date.now() - latestActivity;
            const remainingMs = Math.max(0, timeoutMs - elapsed);
            const remSec = Math.floor(remainingMs / 1000);

            setRemainingSeconds(remSec);
            setIsLow(remSec <= 60 && remSec > 15);
            setIsCritical(remSec <= 15);
        }, 1000);

        return () => {
            events.forEach(e => window.removeEventListener(e, onActivity));
            window.removeEventListener('storage', handleStorage);
            clearInterval(interval);
        };
    }, [calculateShiftSeconds]);

    // Format seconds into hh:mm:ss or mm:ss
    const formatTime = (totalSeconds: number | null) => {
        if (totalSeconds === null) return '--:--';
        if (totalSeconds <= 0) return '00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // Format 24h string to 12h readable time
    const format12H = (time24: string | null) => {
        if (!time24) return '';
        const parts = time24.split(':');
        if (parts.length < 2) return time24;
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    const roleLower = (userRole || '').toLowerCase().trim();
    const isAdmin = roleLower === 'admin';
    const isExecutive = roleLower === 'executive';
    const isExemptRole = isAdmin || isExecutive;
    const isShiftEnded = shiftRemainingSeconds !== null && shiftRemainingSeconds <= 0 && !isExemptRole;
    const isShiftLow = shiftRemainingSeconds !== null && shiftRemainingSeconds > 0 && shiftRemainingSeconds <= 300 && !isExemptRole;

    const sessionTitle = isAdmin
        ? 'Administrator Session'
        : isExecutive
        ? 'Executive Session'
        : 'Shift & Session Timer';

    const sessionSubtitle = isAdmin
        ? 'Full Administrator Access (No shift limits)'
        : isExecutive
        ? 'Executive Access (No shift limits)'
        : 'Active Shift Schedule';

    return (
        <div ref={containerRef} className="relative inline-flex items-center">
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                onMouseEnter={() => setIsOpen(true)}
                aria-label={sessionTitle}
                title={sessionTitle}
                className={`relative group flex items-center justify-center h-9 w-9 rounded-full transition-all duration-200 select-none cursor-pointer active:scale-95 border ${
                    isCritical || isShiftEnded
                        ? 'bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 shadow-[0_0_12px_rgba(244,63,94,0.35)] animate-pulse'
                        : isLow || isShiftLow
                        ? 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                        : isAdmin
                        ? 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                        : isExecutive
                        ? 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                        : 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                } ${className}`}
            >
                {isCritical || isShiftEnded ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 animate-bounce shrink-0" />
                ) : isAdmin ? (
                    <Shield className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" />
                ) : isExecutive ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                    <Clock className={`w-4 h-4 shrink-0 ${isLow || isShiftLow ? 'text-amber-500 animate-pulse' : 'text-pink-500 dark:text-pink-400'}`} />
                )}

                {/* Status indicator dot */}
                <span
                    className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                        isCritical || isShiftEnded
                            ? 'bg-rose-500 ring-2 ring-rose-300/40 animate-ping'
                            : isLow || isShiftLow
                            ? 'bg-amber-500 ring-2 ring-amber-300/40'
                            : isAdmin
                            ? 'bg-pink-500'
                            : isExecutive
                            ? 'bg-emerald-500'
                            : 'bg-pink-500'
                    }`}
                />
            </button>

            {/* Interactive Floating Tooltip / Popover */}
            {isOpen && (
                <div 
                    onMouseEnter={() => setIsOpen(true)}
                    className="absolute top-full right-0 mt-2 z-50 pointer-events-auto min-w-[220px] max-w-[280px] p-3.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.08] shadow-[12px_12px_28px_rgba(166,175,195,0.45),-12px_-12px_28px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_32px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150 text-left"
                >
                    {/* Header with Title and Close X Button */}
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {isAdmin ? (
                                <Shield className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" />
                            ) : isExecutive ? (
                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : isCritical || isShiftEnded ? (
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            ) : (
                                <Clock className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {sessionTitle}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            className="w-6 h-6 rounded-full bg-[#e2e9f3] dark:bg-[#1e1f2c] hover:bg-[#d5e0ee] dark:hover:bg-[#282a3a] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 border border-white/80 dark:border-white/[0.08] shadow-[1px_1px_3px_rgba(166,175,195,0.35),-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[1px_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                            title="Close"
                            aria-label="Close tooltip"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="space-y-2 text-[11px]">
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                            {sessionSubtitle}
                        </p>

                        {!isExemptRole && allowedTimeEnd && (
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 bg-[#e4ebf5] dark:bg-[#12131b] px-2.5 py-1.5 rounded-xl border border-white/50 dark:border-white/[0.04]">
                                <span className="font-medium">Shift Ends ({format12H(allowedTimeEnd)}):</span>
                                <span className={`font-mono font-bold ${isShiftEnded ? 'text-rose-500' : isShiftLow ? 'text-amber-500' : 'text-pink-600 dark:text-pink-400'}`}>
                                    {isShiftEnded ? 'Expired' : formatTime(shiftRemainingSeconds)}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 bg-[#e4ebf5] dark:bg-[#12131b] px-2.5 py-1.5 rounded-xl border border-white/50 dark:border-white/[0.04]">
                            <span className="font-medium">Inactivity Logout:</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                {timeoutEnabled ? formatTime(remainingSeconds) : 'Disabled'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
