'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock,
    Mail,
    X,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
} from 'lucide-react';

interface OtpVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    maskedEmail: string;
    role: string;
    displayName?: string;
    otpCode: string[];
    handleOtpChange: (index: number, value: string) => void;
    handleOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleOtpPaste: (e: React.ClipboardEvent) => void;
    onVerify: () => Promise<void>;
    onResend: () => Promise<void>;
    isVerifying: boolean;
    isResending: boolean;
    countdown: number;
    otpExpiresIn: number;
    otpError: string | null;
    otpSuccess: string | null;
    getRoleColor?: (role: string) => string;
    rememberMe?: boolean;
    setRememberMe?: (val: boolean) => void;
}

export default function OtpVerificationModal({
    isOpen,
    onClose,
    email,
    maskedEmail,
    role,
    displayName,
    otpCode,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    onVerify,
    onResend,
    isVerifying,
    isResending,
    countdown,
    otpExpiresIn,
    otpError,
    otpSuccess,
    getRoleColor,
    rememberMe,
    setRememberMe,
}: OtpVerificationModalProps) {
    if (!isOpen) return null;

    const defaultRoleColor = (r: string) => {
        const lower = (r || '').toLowerCase();
        if (lower.includes('superadmin') || lower.includes('super_admin') || lower.includes('executive')) {
            return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
        }
        if (lower.includes('admin') || lower.includes('administrator')) {
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
        }
        if (lower.includes('supplier')) {
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
        }
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    };

    const roleBadgeClass = getRoleColor ? getRoleColor(role) : defaultRoleColor(role);

    const isCodeComplete = otpCode.every(d => d.trim() !== '') && otpCode.join('').length === 6;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg md:max-w-xl max-h-[92vh] sm:max-h-[88vh] bg-[#EEF2F6] dark:bg-[#161A23] rounded-3xl shadow-[10px_10px_30px_rgba(0,0,0,0.25),-5px_-5px_20px_rgba(255,255,255,0.8)] dark:shadow-[10px_10px_35px_rgba(0,0,0,0.8),-5px_-5px_20px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.08] flex flex-col overflow-hidden z-10 transition-all"
                >
                    {/* Modal Header */}
                    <div className="border-b border-white/60 dark:border-white/[0.06] p-4 sm:p-6 flex justify-between items-center bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 transition-colors">
                        <div className="flex items-center gap-3 sm:gap-3.5">
                            <div className="p-2 sm:p-2.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-accent/20 text-accent shrink-0">
                                <Lock size={20} className="text-accent sm:w-[22px] sm:h-[22px]" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-bricolage tracking-tight">
                                    {role === 'Executive' || role === 'Superadmin'
                                        ? 'Executive Security Verification'
                                        : role === 'Admin'
                                            ? 'Admin Security Verification'
                                            : role === 'Supplier'
                                                ? 'Supplier Security Verification'
                                                : 'Security Code Verification'}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Two-Factor Authentication (MFA)
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isVerifying}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] transition-all p-2 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* OTP Verification Body */}
                    <div className="p-5 sm:p-8 bg-[#EEF2F6] dark:bg-[#161A23] text-slate-900 dark:text-white transition-colors flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                        <div>
                            <div className="text-center mb-6">
                                <div className="w-13 h-13 sm:w-15 sm:h-15 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                    {isVerifying ? (
                                        <Loader2 className="animate-spin text-accent" size={26} />
                                    ) : (
                                        <Mail className="text-accent" size={26} />
                                    )}
                                </div>
                                <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage tracking-tight">
                                    Verify Security Code
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    Enter the 6-digit verification code sent to
                                </p>
                                <p className="text-xs font-bold text-accent mt-0.5 tracking-tight break-all">
                                    {maskedEmail || email}
                                </p>
                                {displayName && (
                                    <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Account:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">{displayName}</span>
                                    </div>
                                )}
                            </div>

                            {otpSuccess && (
                                <div className="mb-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5 text-center">
                                    <CheckCircle size={14} className="shrink-0" />
                                    <span>{otpSuccess}</span>
                                </div>
                            )}

                            {otpError && (
                                <div className="mb-3 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center justify-center gap-1.5 text-center bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>{otpError}</span>
                                </div>
                            )}

                            {otpExpiresIn === 0 && otpCode.some(d => d) && !otpError && (
                                <div className="mb-3 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-center gap-1.5 text-center bg-rose-50/70 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200/80 dark:border-rose-900/40 animate-pulse">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>Inputted OTP is already expired. Please click Resend Code.</span>
                                </div>
                            )}

                            {/* 6 Digit Inputs */}
                            <div className="flex justify-center gap-2 sm:gap-3 my-5 sm:my-7">
                                {otpCode.map((digit, index) => (
                                    <input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        onPaste={index === 0 ? handleOtpPaste : undefined}
                                        className={`w-10 h-12 sm:w-13 sm:h-14 text-center text-lg sm:text-2xl font-bold rounded-2xl transition-all duration-150 outline-none
                                            ${otpError || (otpExpiresIn === 0 && digit)
                                                ? 'bg-rose-50/50 dark:bg-rose-950/30 border-2 border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-400'
                                                : digit
                                                    ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] border-2 border-accent text-slate-900 dark:text-white'
                                                    : 'bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-white/40 dark:border-white/[0.06] text-slate-900 dark:text-white hover:border-accent/40'
                                            }
                                            focus:border-accent focus:ring-2 focus:ring-accent/30
                                            disabled:opacity-50 disabled:cursor-not-allowed`}
                                        disabled={isVerifying}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>

                            {/* Timer */}
                            {otpExpiresIn > 0 ? (
                                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                                    <Clock size={14} className="text-amber-500 dark:text-amber-400 animate-pulse" />
                                    <span>
                                        Code expires in{' '}
                                        <strong className="text-amber-600 dark:text-amber-400 font-bold">
                                            {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, '0')}
                                        </strong>
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-3">
                                    <Clock size={14} />
                                    <span>OTP has expired. Please click <strong>Resend Code</strong>.</span>
                                </div>
                            )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="mt-4 pt-4 border-t border-white/60 dark:border-white/[0.06] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-center py-2 sm:py-0 cursor-pointer"
                                disabled={isVerifying}
                            >
                                ← Back
                            </button>

                            <div className="flex flex-col sm:flex-row gap-2.5">
                                <button
                                    type="button"
                                    onClick={onResend}
                                    disabled={countdown > 0 || isResending || isVerifying}
                                    className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] rounded-xl hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isResending ? (
                                        <>
                                            <Loader2 className="animate-spin text-muted dark:text-paper/60" size={14} />
                                            <span>Resending...</span>
                                        </>
                                    ) : countdown > 0 ? (
                                        <span>Resend in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
                                    ) : (
                                        <span>Resend Code</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={onVerify}
                                    disabled={isVerifying || !isCodeComplete}
                                    className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-semibold bg-accent hover:bg-accent-dark text-paper rounded-xl shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-accent/30"
                                >
                                    {isVerifying ? (
                                        <>
                                            <Loader2 className="animate-spin" size={14} />
                                            <span>Verifying...</span>
                                        </>
                                    ) : otpExpiresIn === 0 ? (
                                        <span>Code Expired</span>
                                    ) : (
                                        <span>Verify OTP</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
