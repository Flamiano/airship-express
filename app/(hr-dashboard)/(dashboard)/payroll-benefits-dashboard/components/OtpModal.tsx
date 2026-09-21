'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import { ShieldCheck, Loader2, RefreshCw, Mail, Lock } from 'lucide-react';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;
const MAX_ATTEMPTS = 3;

export type OtpPurpose =
    | 'merit'
    | 'bonus'
    | 'merit_delete'
    | 'bonus_delete'
    | 'benefit'
    | 'benefit_delete'
    | 'claim'
    | 'claim_delete'
    | string;

export interface OtpSessionPayload {
    token: string;
    scope: string;
    secondsLeft: number;
}

interface OtpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVerified: (session: OtpSessionPayload) => void | Promise<void>;
    purpose: OtpPurpose;
    title?: string;
    subtitle?: string;
    actionLabel?: string;
}

const OtpModal = ({
    isOpen,
    onClose,
    onVerified,
    purpose,
    title,
    subtitle,
    actionLabel,
}: OtpModalProps) => {
    const toast = useToast();
    const { postData: sendOtp } = useApi('/payroll-benefits-dashboard/api/otp/send');
    const { postData: verifyOtp } = useApi('/payroll-benefits-dashboard/api/otp/verify');

    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [cooldown, setCooldown] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [attemptsLeft, setAttemptsLeft] = useState<number>(MAX_ATTEMPTS);
    const [lockedUntil, setLockedUntil] = useState<number | null>(null);
    const [lockSeconds, setLockSeconds] = useState(0);

    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const autoSubmitRef = useRef(false);
    const verifiedRef = useRef(false);
    const lastOpenRef = useRef<boolean>(false);
    const mountedRef = useRef(true);

    const displayTitle = title || 'Verify action';
    const displaySubtitle = subtitle || 'Enter the 6-digit code sent to your email.';
    const displayActionLabel = actionLabel || 'action';

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const resetLocalState = useCallback(() => {
        setDigits(Array(CODE_LENGTH).fill(''));
        setCodeSent(false);
        setExpiresAt(null);
        setSecondsLeft(0);
        setCooldown(0);
        setErrorMsg('');
        setAttemptsLeft(MAX_ATTEMPTS);
        setLockedUntil(null);
        setLockSeconds(0);
        autoSubmitRef.current = false;
        verifiedRef.current = false;
    }, []);

    const handleSendCode = useCallback(async () => {
        if (isSendingCode || cooldown > 0 || lockSeconds > 0) return;
        if (verifiedRef.current) return;
        setIsSendingCode(true);
        setErrorMsg('');
        try {
            const res: any = await sendOtp('', { purpose });
            if (!mountedRef.current) return;
            setCodeSent(true);
            setCooldown(RESEND_COOLDOWN);
            if (res?.expires_at) setExpiresAt(new Date(res.expires_at).getTime());
            setDigits(Array(CODE_LENGTH).fill(''));
            setAttemptsLeft(MAX_ATTEMPTS);
            autoSubmitRef.current = false;
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
            toast.showSuccess('Verification code sent to your email');
        } catch (err: any) {
            if (!mountedRef.current) return;
            const status = err?.response?.status ?? err?.status;
            const isLocked = status === 429 || err?.locked === true;
            if (isLocked) {
                const mins = err?.minutes_left || err?.minutesLeft || 5;
                setLockedUntil(Date.now() + mins * 60 * 1000);
                setErrorMsg(`Account locked. Try again in ${mins} minute(s).`);
            } else {
                setErrorMsg(err?.message || 'Failed to send code');
            }
            toast.showError(err?.message || 'Failed to send code');
        } finally {
            if (mountedRef.current) setIsSendingCode(false);
        }
    }, [isSendingCode, cooldown, lockSeconds, purpose, sendOtp, toast]);

    useEffect(() => {
        const wasOpen = lastOpenRef.current;
        lastOpenRef.current = isOpen;

        if (!isOpen) {
            if (wasOpen) {
                resetLocalState();
            }
            return;
        }

        if (isOpen && !wasOpen) {
            resetLocalState();
            const t = setTimeout(() => {
                if (!mountedRef.current) return;
                if (!verifiedRef.current && isOpen) {
                    void handleSendCode();
                }
            }, 50);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!codeSent || !expiresAt) return;
        const tick = () => {
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            setSecondsLeft(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [codeSent, expiresAt]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const interval = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(interval);
    }, [cooldown]);

    useEffect(() => {
        if (!lockedUntil) return;
        const tick = () => {
            const diff = Math.max(0, Math.floor((lockedUntil - Date.now()) / 1000));
            setLockSeconds(diff);
            if (diff === 0) {
                setLockedUntil(null);
                setErrorMsg('');
                setCodeSent(false);
                setExpiresAt(null);
                setDigits(Array(CODE_LENGTH).fill(''));
                setAttemptsLeft(MAX_ATTEMPTS);
                autoSubmitRef.current = false;
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [lockedUntil]);

    const handleVerify = useCallback(async () => {
        const code = digits.join('');
        if (code.length !== CODE_LENGTH) {
            setErrorMsg('Enter the full 6-digit code');
            return;
        }
        if (lockSeconds > 0) return;
        if (isVerifying) return;
        if (verifiedRef.current) return;

        setIsVerifying(true);
        setErrorMsg('');

        try {
            const res: any = await verifyOtp('', { purpose, code });

            verifiedRef.current = true;

            if (mountedRef.current) {
                toast.showSuccess('Verified — unlocked for 5 minutes');
            }

            try {
                await onVerified({
                    token: res.session_token,
                    scope: 'all',
                    secondsLeft: (res.session_minutes || 5) * 60,
                });
            } catch (cbErr) {
                console.error('[OtpModal] onVerified error:', cbErr);
            }

            if (mountedRef.current) {
                onClose();
            }
        } catch (err: any) {
            if (!mountedRef.current) return;
            const status = err?.response?.status ?? err?.status;
            const isLocked = status === 429 || err?.locked === true;
            const isWrongCode = status === 400;

            if (isLocked) {
                const mins = err?.minutes_left || err?.minutesLeft || 5;
                setLockedUntil(Date.now() + mins * 60 * 1000);
                setAttemptsLeft(0);
                setErrorMsg(
                    `Too many wrong attempts. Account locked for ${mins} minutes. A confirmation email was sent.`
                );
            } else {
                const next = Math.max(0, attemptsLeft - 1);
                setAttemptsLeft(next);
                if (isWrongCode && next > 0) {
                    setErrorMsg(
                        `Incorrect code. ${next} attempt${next === 1 ? '' : 's'} left.`
                    );
                } else if (next === 0) {
                    setErrorMsg('Too many wrong attempts. Please request a new code.');
                } else {
                    setErrorMsg(err?.message || 'Invalid or expired code');
                }
            }
            setDigits(Array(CODE_LENGTH).fill(''));
            autoSubmitRef.current = false;
            setTimeout(() => inputRefs.current[0]?.focus(), 50);
        } finally {
            if (mountedRef.current) setIsVerifying(false);
        }
    }, [digits, lockSeconds, isVerifying, purpose, verifyOtp, onVerified, onClose, attemptsLeft, toast]);

    useEffect(() => {
        if (!isOpen) return;
        if (verifiedRef.current) return;
        if (lockSeconds > 0) return;
        if (isVerifying) return;
        if (autoSubmitRef.current) return;
        const code = digits.join('');
        if (code.length !== CODE_LENGTH) return;
        autoSubmitRef.current = true;
        void handleVerify();
    }, [digits, isOpen, lockSeconds, isVerifying, handleVerify]);

    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const handleDigitChange = (index: number, value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (!cleaned) {
            setDigits((d) => {
                const next = [...d];
                next[index] = '';
                return next;
            });
            autoSubmitRef.current = false;
            return;
        }
        if (cleaned.length > 1) {
            const pasted = cleaned.slice(0, CODE_LENGTH).split('');
            setDigits((d) => {
                const next = [...d];
                pasted.forEach((c, i) => {
                    if (index + i < CODE_LENGTH) next[index + i] = c;
                });
                return next;
            });
            const nextIndex = Math.min(index + pasted.length, CODE_LENGTH - 1);
            inputRefs.current[nextIndex]?.focus();
            return;
        }
        setDigits((d) => {
            const next = [...d];
            next[index] = cleaned;
            return next;
        });
        autoSubmitRef.current = false;
        if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
        if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
        if (e.key === 'Enter') {
            e.preventDefault();
            void handleVerify();
        }
    };

    const codeComplete = digits.every((d) => d !== '');
    const expired = codeSent && secondsLeft === 0 && lockSeconds === 0;
    const isLocked = lockSeconds > 0;
    const attemptsColor =
        attemptsLeft === MAX_ATTEMPTS
            ? 'text-muted'
            : attemptsLeft === 0
                ? 'text-red-600 dark:text-red-400 font-semibold'
                : 'text-red-500 dark:text-red-400';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={displayTitle}
            className="max-w-md"
            accent="pink"
            icon={ShieldCheck}
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isVerifying}
                        className="font-rethink"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleVerify}
                        disabled={!codeComplete || isVerifying || expired || isLocked}
                        className="font-rethink"
                    >
                        {isVerifying ? (
                            <span className="flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Verifying…
                            </span>
                        ) : (
                            'Verify'
                        )}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-800/30 dark:bg-blue-950/20">
                    <Mail className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                    <div className="text-[12px] text-blue-800 dark:text-blue-300 font-rethink leading-relaxed">
                        <p className="font-semibold">{displaySubtitle}</p>
                        <p className="mt-1 text-blue-700/80 dark:text-blue-300/80">
                            Codes expire in 5 minutes. You have 3 attempts before the account locks for 5 minutes.
                        </p>
                    </div>
                </div>

                {isLocked && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-800/30 dark:bg-red-950/20">
                        <Lock className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                        <div className="text-[12px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                            <p className="font-semibold">Account temporarily locked</p>
                            <p className="mt-1">
                                Too many wrong attempts. Try again in{' '}
                                <span className="font-mono font-semibold">
                                    {formatCountdown(lockSeconds)}
                                </span>
                                . We sent a confirmation email to your inbox.
                            </p>
                        </div>
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-xs font-medium text-ink font-rethink text-center">
                        Verification Code
                    </label>
                    <div className="flex justify-center gap-2">
                        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                            <input
                                key={i}
                                ref={(el) => {
                                    inputRefs.current[i] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={1}
                                value={digits[i]}
                                onChange={(e) => handleDigitChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                disabled={isVerifying || isSendingCode || isLocked}
                                className="h-12 w-11 rounded-lg border border-line bg-paper text-center text-lg font-mono font-semibold text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 dark:border-line/30"
                            />
                        ))}
                    </div>

                    <div className="mt-3 flex flex-col items-center gap-1.5">
                        {codeSent && secondsLeft > 0 && !expired && !isLocked && (
                            <p className="text-[11px] text-muted font-rethink">
                                Expires in{' '}
                                <span className="font-mono font-semibold text-ink">
                                    {formatCountdown(secondsLeft)}
                                </span>
                            </p>
                        )}
                        {expired && !isLocked && (
                            <p className="text-[11px] text-red-600 font-rethink">
                                Code expired. Request a new one.
                            </p>
                        )}
                        {isVerifying && !isLocked && (
                            <p className="text-[11px] text-muted font-rethink">
                                Verifying {displayActionLabel}…
                            </p>
                        )}

                        <p className={`text-[11px] font-rethink ${attemptsColor}`}>
                            Attempts left: {attemptsLeft} of {MAX_ATTEMPTS}
                        </p>
                    </div>
                </div>

                {errorMsg && !isLocked && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-800/30 dark:bg-red-950/20">
                        <span className="mt-0.5 text-[14px] leading-none text-red-500">•</span>
                        <p className="text-[11px] text-red-800 dark:text-red-300 font-rethink">
                            {errorMsg}
                        </p>
                    </div>
                )}

                <div className="flex items-center justify-center gap-2 border-t border-line pt-3 dark:border-line/30">
                    <span className="text-[11px] text-muted font-rethink">Didn't receive a code?</span>
                    <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={isSendingCode || cooldown > 0 || isLocked}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline font-rethink"
                    >
                        {isSendingCode ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Sending…
                            </>
                        ) : cooldown > 0 ? (
                            <>Resend in {cooldown}s</>
                        ) : (
                            <>
                                <RefreshCw className="h-3 w-3" />
                                Resend code
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OtpModal;