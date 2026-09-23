'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogIn,
    Loader2,
    Eye,
    EyeOff,
    KeyRound,
    AlertTriangle,
    ArrowLeft,
    RotateCcw,
    CheckCircle2,
    Lock,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { maskEmail } from '../services/scAuthService';

const isUUID = (str?: string | null): boolean => {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

const formatId = (id?: string | null): string => {
    if (!id) return '';
    const trimmed = id.trim();
    if (isUUID(trimmed)) {
        return trimmed.slice(0, 8) + '...';
    }
    return trimmed;
};

interface RememberedPasswordModalProps {
    showRememberedPasswordModal: boolean;
    selectedEmployee: any;
    rememberedPassword: string;
    setRememberedPassword: (v: string) => void;
    isLoggingInWithRemembered: boolean;
    getRoleColor: (role: string) => string;
    handleVerifyRememberedPassword: () => Promise<boolean | string | void> | boolean | string | void;
    setShowRememberedPasswordModal: (v: boolean) => void;
}

type ModalViewMode = 'login' | 'forgot_otp' | 'reset_password' | 'success';

export default function RememberedPasswordModal({
    showRememberedPasswordModal,
    selectedEmployee,
    rememberedPassword,
    setRememberedPassword,
    isLoggingInWithRemembered,
    getRoleColor,
    handleVerifyRememberedPassword,
    setShowRememberedPasswordModal,
}: RememberedPasswordModalProps) {
    // view state
    const [viewMode, setViewMode] = useState<ModalViewMode>('login');

    // visibility toggles
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // lockout states
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [remainingLockoutSeconds, setRemainingLockoutSeconds] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);

    // forgot password & reset states
    const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '', '', '']);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resetToken, setResetToken] = useState<string | null>(null);

    // reset password inputs
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    // helper keys for local storage
    const getLockoutKey = (email: string) => `remembered_login_lockout_${email.toLowerCase()}`;
    const getAttemptsKey = (email: string) => `remembered_login_attempts_${email.toLowerCase()}`;
    const getOtpCooldownKey = (email: string) => `forgot_otp_cooldown_${email.toLowerCase()}`;

    // get remaining otp cooldown seconds from local storage
    const getRemainingOtpCooldown = (email?: string): number => {
        if (!email) return 0;
        const cooldownUntilStr = localStorage.getItem(getOtpCooldownKey(email));
        if (!cooldownUntilStr) return 0;

        const cooldownUntil = parseInt(cooldownUntilStr, 10);
        const now = Date.now();
        if (cooldownUntil > now) {
            return Math.ceil((cooldownUntil - now) / 1000);
        }

        // cooldown expired
        localStorage.removeItem(getOtpCooldownKey(email));
        return 0;
    };

    // sync lockout state from local storage
    const checkLockout = () => {
        if (!selectedEmployee?.email) return;

        const email = selectedEmployee.email;
        const lockoutUntilStr = localStorage.getItem(getLockoutKey(email));

        if (lockoutUntilStr) {
            const lockoutUntil = parseInt(lockoutUntilStr, 10);
            const now = Date.now();

            if (lockoutUntil > now) {
                const remaining = Math.ceil((lockoutUntil - now) / 1000);
                setIsLockedOut(true);
                setRemainingLockoutSeconds(remaining);
                return;
            } else {
                // expired lockout
                localStorage.removeItem(getLockoutKey(email));
                localStorage.removeItem(getAttemptsKey(email));
                setIsLockedOut(false);
                setRemainingLockoutSeconds(0);
                setFailedAttempts(0);
            }
        } else {
            setIsLockedOut(false);
            setRemainingLockoutSeconds(0);
        }

        const storedAttempts = localStorage.getItem(getAttemptsKey(email));
        if (storedAttempts) {
            setFailedAttempts(parseInt(storedAttempts, 10) || 0);
        } else {
            setFailedAttempts(0);
        }
    };

    // check lockout whenever modal opens or selected employee changes
    useEffect(() => {
        if (showRememberedPasswordModal && selectedEmployee) {
            checkLockout();
            setShowPassword(false);
            setViewMode('login');
        }
    }, [showRememberedPasswordModal, selectedEmployee]);

    // countdown interval for lockout
    useEffect(() => {
        if (!isLockedOut || !selectedEmployee?.email) return;

        const interval = setInterval(() => {
            const email = selectedEmployee.email;
            const lockoutUntilStr = localStorage.getItem(getLockoutKey(email));

            if (lockoutUntilStr) {
                const lockoutUntil = parseInt(lockoutUntilStr, 10);
                const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);

                if (remaining <= 0) {
                    localStorage.removeItem(getLockoutKey(email));
                    localStorage.removeItem(getAttemptsKey(email));
                    setIsLockedOut(false);
                    setRemainingLockoutSeconds(0);
                    setFailedAttempts(0);
                    toast.success('Wait time finished. You can now try logging in again.');
                } else {
                    setRemainingLockoutSeconds(remaining);
                }
            } else {
                setIsLockedOut(false);
                setRemainingLockoutSeconds(0);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isLockedOut, selectedEmployee]);

    // countdown interval for otp resend synced with local storage
    useEffect(() => {
        if (!selectedEmployee?.email) return;

        const syncCooldown = () => {
            const remaining = getRemainingOtpCooldown(selectedEmployee.email);
            setResendCooldown(remaining);
        };

        syncCooldown();
        const interval = setInterval(syncCooldown, 1000);

        return () => clearInterval(interval);
    }, [selectedEmployee]);

    // format seconds to mm:ss
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // handle login button click with lockout management
    const handleLoginSubmit = async () => {
        if (isLockedOut) {
            toast.error(`Form is temporarily disabled. Please wait ${formatTime(remainingLockoutSeconds)}.`);
            return;
        }

        if (!rememberedPassword.trim()) {
            toast.error('Please enter your password');
            return;
        }

        const email = selectedEmployee.email;
        const result = await handleVerifyRememberedPassword();

        if (result === 'queued') {
            // Password was correct, but user is placed in the concurrency queue
            return;
        }

        if (result === false) {
            // increment failed attempts
            const newAttempts = failedAttempts + 1;

            if (newAttempts >= 3) {
                const lockoutUntil = Date.now() + 120 * 1000; // 2 minutes
                localStorage.setItem(getLockoutKey(email), lockoutUntil.toString());
                localStorage.removeItem(getAttemptsKey(email));

                setIsLockedOut(true);
                setRemainingLockoutSeconds(120);
                setFailedAttempts(3);
                setRememberedPassword('');
                toast.error('Too many failed attempts. Form disabled for 2 minutes.');
            } else {
                localStorage.setItem(getAttemptsKey(email), newAttempts.toString());
                setFailedAttempts(newAttempts);
                const remaining = 3 - newAttempts;
                toast.error(`Invalid password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 2-minute lockout.`);
            }
        } else if (result === true) {
            // clear attempts and lockout on success
            localStorage.removeItem(getLockoutKey(email));
            localStorage.removeItem(getAttemptsKey(email));
            setIsLockedOut(false);
            setFailedAttempts(0);
        }
    };

    // request otp for forgot password
    const handleRequestOtp = async (auto = false) => {
        if (!selectedEmployee?.email) return;

        const email = selectedEmployee.email;
        const remaining = getRemainingOtpCooldown(email);
        if (remaining > 0) {
            setResendCooldown(remaining);
            toast.error(`Please wait ${remaining}s before requesting another verification code.`);
            return;
        }

        setIsSendingOtp(true);
        try {
            const res = await fetch('/api/supplyChain/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_otp',
                    email: selectedEmployee.email,
                    employeeName: selectedEmployee.display_name,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429 && data.remainingSeconds) {
                    const cooldownUntil = Date.now() + data.remainingSeconds * 1000;
                    localStorage.setItem(getOtpCooldownKey(email), cooldownUntil.toString());
                    setResendCooldown(data.remainingSeconds);
                }
                throw new Error(data.message || 'Failed to send OTP code');
            }

            // store 60 second cooldown in local storage
            const cooldownUntil = Date.now() + 60 * 1000;
            localStorage.setItem(getOtpCooldownKey(email), cooldownUntil.toString());
            setResendCooldown(60);
            setOtpCode(['', '', '', '', '', '']);
            toast.success('6-digit verification code sent to your email.');

            if (!auto) {
                setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send OTP');
        } finally {
            setIsSendingOtp(false);
        }
    };

    // start forgot password flow
    const handleStartForgotPassword = () => {
        // block if temporarily disabled
        if (isLockedOut) {
            toast.error(`Form is temporarily disabled. Please wait ${formatTime(remainingLockoutSeconds)}.`);
            return;
        }

        setViewMode('forgot_otp');
        setOtpCode(['', '', '', '', '', '']);
        setResetToken(null);
        setNewPassword('');
        setConfirmPassword('');

        const email = selectedEmployee?.email;
        const remaining = getRemainingOtpCooldown(email);
        if (remaining > 0) {
            setResendCooldown(remaining);
            toast.info(`A verification code was already sent. Please wait ${remaining}s before requesting a new code.`);
        } else {
            handleRequestOtp(true);
        }
    };

    // handle otp input change
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otpCode];
        newOtp[index] = value.slice(-1);
        setOtpCode(newOtp);

        if (value && index < 5) {
            otpInputsRef.current[index + 1]?.focus();
        }
    };

    // handle otp keydown
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputsRef.current[index - 1]?.focus();
        }
    };

    // handle otp paste
    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        if (/^\d{6}$/.test(pastedData)) {
            const digits = pastedData.split('');
            setOtpCode(digits);
            otpInputsRef.current[5]?.focus();
        }
    };

    // verify otp code
    const handleVerifyOtp = async () => {
        const fullOtp = otpCode.join('');
        if (fullOtp.length !== 6) {
            toast.error('Please enter all 6 digits of the verification code.');
            return;
        }

        setIsVerifyingOtp(true);
        try {
            const res = await fetch('/api/supplyChain/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify_otp',
                    email: selectedEmployee.email,
                    otp: fullOtp,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Invalid verification code');
            }

            setResetToken(data.resetToken);
            toast.success('Code verified successfully.');
            setViewMode('reset_password');
        } catch (err: any) {
            toast.error(err.message || 'Verification failed');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    // password security criteria checks: 6+ chars, uppercase, lowercase, number
    const passwordChecks = {
        length: newPassword.length >= 6,
        uppercase: /[A-Z]/.test(newPassword),
        lowercase: /[a-z]/.test(newPassword),
        number: /[0-9]/.test(newPassword),
    };

    const isPasswordValid = Object.values(passwordChecks).every(Boolean);
    const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

    // confirm password reset
    const handleResetPasswordSubmit = async () => {
        if (!isPasswordValid) {
            toast.error('Password does not meet all security requirements.');
            return;
        }

        if (!doPasswordsMatch) {
            toast.error('Passwords do not match.');
            return;
        }

        setIsResettingPassword(true);
        try {
            const res = await fetch('/api/supplyChain/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'confirm_reset',
                    email: selectedEmployee.email,
                    resetToken,
                    newPassword,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to reset password');
            }

            // clear lockout and attempts on successful reset
            if (selectedEmployee?.email) {
                localStorage.removeItem(getLockoutKey(selectedEmployee.email));
                localStorage.removeItem(getAttemptsKey(selectedEmployee.email));
            }
            setIsLockedOut(false);
            setFailedAttempts(0);
            setRemainingLockoutSeconds(0);

            // set new password into state ready for login
            setRememberedPassword(newPassword);

            toast.success('Password updated successfully!');
            setViewMode('success');
        } catch (err: any) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setIsResettingPassword(false);
        }
    };

    // return to login view
    const handleReturnToLogin = () => {
        setViewMode('login');
        setOtpCode(['', '', '', '', '', '']);
        setResetToken(null);
        setNewPassword('');
        setConfirmPassword('');
        checkLockout();
    };

    // modal close handler
    const handleClose = () => {
        setShowRememberedPasswordModal(false);
        setRememberedPassword('');
        setViewMode('login');
    };

    return (
        <AnimatePresence>
            {showRememberedPasswordModal && selectedEmployee && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-none my-auto overflow-hidden"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            {/* view 1: remembered password login */}
                            {viewMode === 'login' && (
                                <>
                                    <div className="text-center mb-5 sm:mb-6">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <LogIn className="text-emerald-600 dark:text-emerald-400" size={26} />
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage">
                                            Login as {selectedEmployee.display_name}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Enter your password to continue
                                        </p>
                                    </div>

                                    {/* account info card */}
                                    <div className="mb-4 p-3.5 sm:p-4 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl border border-white/40 dark:border-white/[0.06]">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Account</p>
                                        <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base mt-0.5">
                                            {selectedEmployee.display_name}
                                        </p>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-all">
                                            {maskEmail(selectedEmployee.email)}
                                        </p>
                                        {(selectedEmployee.employee_id || selectedEmployee.id) && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                                ID: {formatId(selectedEmployee.employee_id || selectedEmployee.id)}
                                            </p>
                                        )}
                                        {(() => {
                                            const hasDept = selectedEmployee.department && selectedEmployee.department.toLowerCase().trim() !== selectedEmployee.role?.toLowerCase().trim();
                                            const hasPos = selectedEmployee.position && selectedEmployee.position.toLowerCase().trim() !== selectedEmployee.role?.toLowerCase().trim() && selectedEmployee.position.toLowerCase().trim() !== selectedEmployee.department?.toLowerCase().trim();

                                            if (!hasDept && !hasPos) return null;
                                            return (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {hasDept && selectedEmployee.department}
                                                    {hasDept && hasPos && ' • '}
                                                    {hasPos && selectedEmployee.position}
                                                </p>
                                            );
                                        })()}
                                        <span className={`inline-block mt-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg shadow-[2px_2px_5px_rgba(0,0,0,0.08)] ${getRoleColor(selectedEmployee.role)}`}>
                                            {selectedEmployee.role}
                                        </span>
                                    </div>

                                    {/* lockout banner if locked out */}
                                    {isLockedOut && (
                                        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3 animate-pulse">
                                            <ShieldAlert size={20} className="shrink-0 text-rose-500 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                    Form Temporarily Disabled
                                                </p>
                                                <p className="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                                                    Too many failed attempts. Please wait{' '}
                                                    <strong className="font-mono font-extrabold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
                                                        {formatTime(remainingLockoutSeconds)}
                                                    </strong>{' '}
                                                    before trying again.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* failed attempts warning (before lockout) */}
                                    {!isLockedOut && failedAttempts > 0 && (
                                        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                                            <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                                            <span>
                                                Invalid password. <strong>{3 - failedAttempts} attempt{3 - failedAttempts === 1 ? '' : 's'} remaining</strong> before 2-minute lockout.
                                            </span>
                                        </div>
                                    )}

                                    {/* password input with view password toggle */}
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                                                    Password
                                                </label>
                                                <button
                                                    type="button"
                                                    disabled={isLockedOut}
                                                    onClick={handleStartForgotPassword}
                                                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline disabled:hover:text-emerald-600 dark:disabled:hover:text-emerald-400 cursor-pointer"
                                                    title={isLockedOut ? `Disabled (${formatTime(remainingLockoutSeconds)})` : "Forgot password?"}
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={rememberedPassword}
                                                    disabled={isLockedOut || isLoggingInWithRemembered}
                                                    onChange={(e) => setRememberedPassword(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !isLockedOut) {
                                                            handleLoginSubmit();
                                                        }
                                                    }}
                                                    className="w-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-emerald-500/40 rounded-xl pl-3.5 pr-11 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    placeholder={isLockedOut ? `Disabled (${formatTime(remainingLockoutSeconds)})` : "Enter your password"}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    disabled={isLockedOut}
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={showPassword ? "Hide password" : "View password"}
                                                    aria-label={showPassword ? "Hide password" : "View password"}
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-3.5 text-center text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        This is a remembered session. Your password is required for security.
                                    </p>
                                </>
                            )}

                            {/* view 2: forgot password otp verification */}
                            {viewMode === 'forgot_otp' && (
                                <>
                                    <div className="text-center mb-5">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <KeyRound className="text-emerald-600 dark:text-emerald-400" size={24} />
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage">
                                            Verify Your Identity
                                        </h3>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                            A 6-digit verification code was sent to <strong className="text-slate-800 dark:text-slate-200 font-semibold">{maskEmail(selectedEmployee.email)}</strong>
                                        </p>
                                    </div>

                                    {/* 6-digit otp input boxes */}
                                    <div className="mb-5">
                                        <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-3" onPaste={handleOtpPaste}>
                                            {otpCode.map((digit, index) => (
                                                <input
                                                    key={index}
                                                    ref={(el) => {
                                                        otpInputsRef.current[index] = el;
                                                    }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                    disabled={isVerifyingOtp}
                                                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-transparent focus:border-emerald-500/50 rounded-xl text-slate-900 dark:text-white outline-none transition-all"
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-center mt-3 text-xs text-slate-500 dark:text-slate-400">
                                            {resendCooldown > 0 ? (
                                                <span>Resend code in <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{resendCooldown}s</strong></span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestOtp(false)}
                                                    disabled={isSendingOtp}
                                                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                >
                                                    <RotateCcw size={13} className={isSendingOtp ? "animate-spin" : ""} />
                                                    <span>{isSendingOtp ? 'Sending...' : 'Resend Code'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* view 3: reset password form */}
                            {viewMode === 'reset_password' && (
                                <>
                                    <div className="text-center mb-5">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <Lock className="text-emerald-600 dark:text-emerald-400" size={24} />
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage">
                                            Set New Password
                                        </h3>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Create a secure new password for your account
                                        </p>
                                    </div>

                                    <div className="space-y-3.5 mb-4">
                                        {/* new password input */}
                                        <div>
                                            <label className="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="At least 6 characters"
                                                    className="w-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-emerald-500/40 rounded-xl pl-3.5 pr-11 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* confirm password input */}
                                        <div>
                                            <label className="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                                                Confirm New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Re-enter your new password"
                                                    className="w-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-emerald-500/40 rounded-xl pl-3.5 pr-11 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* security checklist */}
                                        <div className="p-3 bg-[#EAF0F6] dark:bg-[#13161F] rounded-xl border border-white/40 dark:border-white/[0.06] space-y-1.5 text-[11px]">
                                            <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                                Password Security Requirements:
                                            </p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.length ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${passwordChecks.length ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>✓</span>
                                                    <span>6+ Characters</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.uppercase ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${passwordChecks.uppercase ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>✓</span>
                                                    <span>Uppercase (A-Z)</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.lowercase ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${passwordChecks.lowercase ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>✓</span>
                                                    <span>Lowercase (a-z)</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.number ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] ${passwordChecks.number ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>✓</span>
                                                    <span>Number (0-9)</span>
                                                </div>
                                            </div>
                                            {confirmPassword.length > 0 && (
                                                <p className={`mt-1 font-semibold ${doPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                    {doPasswordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* view 4: success confirmation */}
                            {viewMode === 'success' && (
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={36} />
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage">
                                        Password Reset Successful!
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
                                        Your password has been updated and any temporary lockout has been lifted. You can now log in securely.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* neumorphic modal footer actions */}
                        <div className="shrink-0 border-t border-white/60 dark:border-white/[0.08] p-4 sm:p-5 bg-[#EEF2F6] dark:bg-[#161A23] flex gap-3">
                            {viewMode === 'login' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="flex-1 px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLoginSubmit}
                                        disabled={isLockedOut || isLoggingInWithRemembered || !rememberedPassword.trim()}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-medium shadow-[4px_4px_10px_rgba(16,185,129,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                                    >
                                        {isLoggingInWithRemembered ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Verifying...
                                            </>
                                        ) : isLockedOut ? (
                                            <>
                                                <Lock size={16} />
                                                Locked ({formatTime(remainingLockoutSeconds)})
                                            </>
                                        ) : (
                                            <>
                                                <LogIn size={16} />
                                                Login
                                            </>
                                        )}
                                    </button>
                                </>
                            )}

                            {viewMode === 'forgot_otp' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleReturnToLogin}
                                        disabled={isVerifyingOtp}
                                        className="px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08] flex items-center gap-1.5"
                                    >
                                        <ArrowLeft size={14} />
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleVerifyOtp}
                                        disabled={isVerifyingOtp || otpCode.some(d => !d)}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-medium shadow-[4px_4px_10px_rgba(16,185,129,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                                    >
                                        {isVerifyingOtp ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Verifying...
                                            </>
                                        ) : (
                                            'Verify Code'
                                        )}
                                    </button>
                                </>
                            )}

                            {viewMode === 'reset_password' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleReturnToLogin}
                                        disabled={isResettingPassword}
                                        className="px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08] flex items-center gap-1.5"
                                    >
                                        <ArrowLeft size={14} />
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetPasswordSubmit}
                                        disabled={isResettingPassword || !isPasswordValid || !doPasswordsMatch}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-medium shadow-[4px_4px_10px_rgba(16,185,129,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                                    >
                                        {isResettingPassword ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Resetting...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </button>
                                </>
                            )}

                            {viewMode === 'success' && (
                                <button
                                    type="button"
                                    onClick={handleReturnToLogin}
                                    className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-medium shadow-[4px_4px_10px_rgba(16,185,129,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                                >
                                    <LogIn size={16} />
                                    Continue to Login
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
