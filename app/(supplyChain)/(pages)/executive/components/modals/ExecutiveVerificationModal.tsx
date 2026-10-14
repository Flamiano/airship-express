'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Eye, EyeOff, ShieldAlert, ShieldCheck, Loader2, X } from 'lucide-react';
import { user } from '../../../../lib/services/Class/user';

interface ExecutiveVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportTitle?: string;
    onSuccess: (token: string) => void;
}

export const ExecutiveVerificationModal: React.FC<ExecutiveVerificationModalProps> = ({
    isOpen,
    onClose,
    reportTitle = 'Confidential Report',
    onSuccess,
}) => {
    const [mounted, setMounted] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError(null);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Handle countdown timer if locked out
    useEffect(() => {
        let timer: any = null;
        if (remainingSeconds > 0) {
            timer = setInterval(() => {
                setRemainingSeconds((prev) => {
                    if (prev <= 1) {
                        setIsLocked(false);
                        setError(null);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [remainingSeconds]);

    // Keyboard handlers (Escape to close)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape' && !isLoading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, onClose]);

    if (!isOpen || !mounted) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLocked || isLoading) return;

        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
            setError('Please enter your Executive account password.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const sessionToken = user.getSessionToken() || 
                                 (typeof window !== 'undefined' ? (localStorage.getItem('session_token') || localStorage.getItem('sc_session_token')) : '') || '';

            const res = await fetch('/api/executive/reports/verify-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': sessionToken,
                },
                body: JSON.stringify({ password: trimmedPassword }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data.success) {
                if (res.status === 429 || data.locked) {
                    setIsLocked(true);
                    setRemainingSeconds(data.retryAfter || 60);
                    setError(data.error || 'Too many failed verification attempts. Please wait before trying again.');
                } else {
                    setError(data.error || 'Verification failed. Please check your Executive password.');
                }
                return;
            }

            // Success: pass token to parent
            setPassword('');
            setError(null);
            onSuccess(data.verificationToken);
        } catch (err: any) {
            setError('A network error occurred. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-x border-b border-t-0 border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Shield icon & Title */}
                    <div className="flex items-center gap-3.5 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center border border-pink-200 dark:border-pink-900/50 text-[#EC4899] shadow-sm">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                Executive Verification Required
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Protected confidential supply chain report
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mt-3.5 mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Accessing <span className="font-semibold text-slate-800 dark:text-slate-100">{reportTitle}</span> requires re-authenticating your Executive identity. Please enter your account password to decrypt and view confidential figures.
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div 
                            className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
                            role="alert"
                        >
                            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                            <div className="flex-1">
                                <p className="font-medium">{error}</p>
                                {isLocked && remainingSeconds > 0 && (
                                    <p className="mt-1 font-mono text-[11px] text-rose-800 dark:text-rose-200">
                                        Retry available in: {remainingSeconds}s
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Verification Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label 
                                htmlFor="executive-password-input" 
                                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                            >
                                Executive Password
                            </label>
                            <div className="relative">
                                <input
                                    id="executive-password-input"
                                    ref={inputRef}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    disabled={isLoading || isLocked}
                                    autoComplete="current-password"
                                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EC4899] focus:border-transparent transition-all pr-10 disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading || isLocked}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Security notice */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Verification token expires automatically after 15 minutes of inactivity.</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || isLocked || !password.trim()}
                                className="flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl text-white bg-[#EC4899] hover:bg-[#db2777] active:scale-[0.98] shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <span>Verify & Open Report</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};
