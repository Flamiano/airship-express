'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, ShieldCheck, RefreshCw, X, Radio } from 'lucide-react';
import { AppButton } from '../../../(supplyChain)/components/ui/AppButton';
import { supabase } from '../../../(supplyChain)/lib/services/client/supabase';

interface LoginQueueModalProps {
    isOpen: boolean;
    role?: string;
    initialPosition?: number;
    initialActiveUsers?: number;
    maxCapacity?: number;
    onRetry: () => void;
    onClose: () => void;
}

export default function LoginQueueModal({
    isOpen,
    role = '',
    initialPosition = 1,
    initialActiveUsers = 1,
    maxCapacity = 1,
    onRetry,
    onClose,
}: LoginQueueModalProps) {
    const [position, setPosition] = useState(initialPosition);
    const [activeCount, setActiveCount] = useState(initialActiveUsers);
    const [currentMaxCapacity, setCurrentMaxCapacity] = useState(maxCapacity);
    const [isChecking, setIsChecking] = useState(false);
    const isRetryingRef = useRef(false);

    useEffect(() => {
        setPosition(initialPosition);
        setActiveCount(initialActiveUsers);
        setCurrentMaxCapacity(maxCapacity);
        isRetryingRef.current = false;
    }, [initialPosition, initialActiveUsers, maxCapacity, isOpen]);

    const checkStatus = useCallback(async () => {
        if (isRetryingRef.current) return;
        try {
            setIsChecking(true);
            const queryRole = role ? `?role=${encodeURIComponent(role)}` : '';
            const res = await fetch(`/api/supplyChain/queue-status${queryRole}`);
            if (res.ok) {
                const data = await res.json();
                if (role && data.roleActive !== undefined && data.roleSlots !== undefined) {
                    setActiveCount(data.roleActive);
                    setCurrentMaxCapacity(data.roleSlots);
                } else {
                    setActiveCount(data.totalActive || 0);
                    if (data.maxCapacity) setCurrentMaxCapacity(data.maxCapacity);
                }

                if (data.available && !isRetryingRef.current) {
                    isRetryingRef.current = true;
                    // Slot opened up in real-time! Auto-login immediately
                    onRetry();
                    return;
                }
                if (data.queuedCount !== undefined) {
                    setPosition(Math.max(1, data.queuedCount));
                }
            }
        } catch (err) {
            console.error('Error checking queue status:', err);
        } finally {
            setIsChecking(false);
        }
    }, [role, onRetry]);

    // Supabase Realtime: instantly trigger check and auto-login when someone logs out or settings change
    useEffect(() => {
        if (!isOpen) return;

        // Run initial check immediately
        checkStatus();

        const channel = supabase
            .channel(`login_queue_realtime_${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sessions',
                },
                () => {
                    checkStatus();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sc_system_settings',
                },
                () => {
                    checkStatus();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, checkStatus]);

    if (!isOpen) return null;

    const fillPercent = Math.min(100, Math.round((activeCount / Math.max(1, currentMaxCapacity)) * 100));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="w-full max-w-md bg-[#f0f3f8] dark:bg-[#181924] rounded-3xl border border-white/80 dark:border-[#2b2d3c] shadow-[12px_12px_32px_rgba(166,175,195,0.45),-12px_-12px_32px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_36px_rgba(0,0,0,0.85)] p-6 sm:p-7 relative overflow-hidden"
                >
                    {/* close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* header icon with pulse */}
                    <div className="flex flex-col items-center text-center space-y-4 pt-2">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                                <Users className="w-8 h-8" />
                            </div>
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] font-bold text-white">
                                    !
                                </span>
                            </span>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {role ? `${role} Slots at Full Capacity` : 'System at Full Capacity'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {role ? `All active ${role.toLowerCase()} slots are currently occupied.` : 'Maximum concurrent capacity reached.'}
                            </p>
                        </div>
                    </div>

                    {/* queue status card */}
                    <div className="my-6 p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/70 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] space-y-3.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                Your Queue Position
                            </span>
                            <span className="font-bold font-mono text-sm px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                #{position}
                            </span>
                        </div>

                        {/* Capacity meter */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{role ? `${role} Slots` : 'Active Users'}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                                    {activeCount} / {currentMaxCapacity} ({fillPercent}%)
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500 rounded-full"
                                    style={{ width: `${fillPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Realtime Live Sync notice */}
                        <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                            <span>
                                <strong className="text-slate-700 dark:text-slate-200">Real-Time Sync:</strong> You will be automatically logged in the millisecond a spot opens.
                            </span>
                        </div>
                    </div>

                    {/* Live Realtime Radar status (No countdown) */}
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300 mb-5 py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="font-medium text-[11px]">
                            Live queue connected • Auto-logging in on spot release
                        </span>
                        {isChecking && (
                            <RefreshCw className="w-3 h-3 animate-spin text-emerald-500 ml-1" />
                        )}
                    </div>

                    {/* action buttons */}
                    <div className="flex items-center gap-3">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            className="w-1/2"
                            onClick={onClose}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            type="button"
                            variant="primary"
                            size="md"
                            className="w-1/2"
                            disabled={isChecking}
                            onClick={checkStatus}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                            <span>Check Spot Now</span>
                        </AppButton>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
