// app/(auth)/scAuth/modals/WaitingForApprovalModal.tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Loader2, Monitor, ArrowRight, X } from 'lucide-react';
import Portal from '../../../(supplyChain)/components/client/Portal';

interface WaitingForApprovalModalProps {
    isOpen: boolean;
    onCancel: () => void;
    userEmail: string;
    userDisplayName?: string;
}

export function WaitingForApprovalModal({
    isOpen,
    onCancel,
    userEmail,
    userDisplayName,
}: WaitingForApprovalModalProps) {
    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-md bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden"
                >
                    {/* Header bar */}
                    <div className="p-6 pb-4 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Concurrent Session Detected
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Awaiting authorization from active device
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-8 h-8 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-300/50 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5 text-center">
                        <div className="relative flex items-center justify-center py-4">
                            <div className="w-20 h-20 rounded-3xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200 dark:border-slate-800 shadow-none flex items-center justify-center text-amber-500">
                                <Monitor className="w-10 h-10 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-24 h-24 rounded-full border-2 border-dashed border-amber-500/30 animate-spin" style={{ animationDuration: '6s' }} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                A prompt has been sent to your currently active session.
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                                The logged-in device must click <span className="font-bold text-emerald-600 dark:text-emerald-400">Approve</span> to transfer access to this device.
                            </p>
                        </div>

                        {/* Status chip */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                            <span>Waiting for response from other device…</span>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full py-2.5 px-4 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-none text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                Cancel Sign In
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </Portal>
    );
}
