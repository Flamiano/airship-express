'use client';

import '../../(supplyChain)/supplyChain.css';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Eye,
    EyeOff,
    Loader2,
    Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../../(supplyChain)/components/ui/ConfirmModal';
import { OfflineDetector } from '../../(supplyChain)/components/global/OfflineDetector';
import CustomCursor from '../../(supplyChain)/components/global/CustomCursor';
import {
    OtpVerificationModal,
    AppealModal,
    LoginQueueModal,
    WaitingForApprovalModal,
} from './modals';
import { user } from '../../(supplyChain)/lib/services/Class/user';
import {
    clearUserSession,
    validateSessionApi,
    checkRememberedSessionApi,
    restoreSupabaseSession,
    loginSupplyChainApi,
    requestOtpApi,
    verifyOtpApi,
    setSupabaseSession,
    checkIfDeviceBlocked,
    checkExistingAppeal,
    submitAppeal,
    updateAppeal,
    deleteAppeal,
    maskEmail,
    requestLoginAuthorizationApi,
    getNoticeCategory,
    recordNotificationSent,
    getRemainingNotifyCooldown,
    formatNotifyCooldown,
} from './services';
import { settingsService } from '../../(supplyChain)/lib/services/settingsService';

export default function SupplyChainLoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // Login form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loggedInUser, setLoggedInUser] = useState<any>(null);

    // Rate limiting (3 failed attempts -> 1 min lockout)
    const [loginAttempts, setLoginAttempts] = useState<number>(0);
    const [loginLockoutSeconds, setLoginLockoutSeconds] = useState<number>(0);
    const MAX_LOGIN_ATTEMPTS = 3;

    // OTP verification modal state (for Superadmin / Admin)
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpTargetEmail, setOtpTargetEmail] = useState('');
    const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
    const [otpTargetUserId, setOtpTargetUserId] = useState('');
    const [otpTargetRole, setOtpTargetRole] = useState('Admin');
    const [otpTargetDisplayName, setOtpTargetDisplayName] = useState('');
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResendingOtp, setIsResendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0); // Resend cooldown (120s)
    const [otpExpiresIn, setOtpExpiresIn] = useState(0); // OTP validity (300s)
    const [otpError, setOtpError] = useState<string | null>(null);
    const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
    const [otpRememberMe, setOtpRememberMe] = useState(false);

    // Device blocking & Appeal modal state
    const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);
    const [blockedDeviceId, setBlockedDeviceId] = useState<string | null>(null);
    const [showAppealModal, setShowAppealModal] = useState(false);
    const [appealMessage, setAppealMessage] = useState('');
    const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
    const [existingAppeal, setExistingAppeal] = useState<any>(null);
    const [isEditingAppeal, setIsEditingAppeal] = useState(false);
    const [authRestrictionMessage, setAuthRestrictionMessage] = useState<string | null>(null);

    // Login queue modal (concurrency slot limit)
    const [showQueueModal, setShowQueueModal] = useState(false);
    const [queuePosition, setQueuePosition] = useState(1);
    const [queueActiveUsers, setQueueActiveUsers] = useState(1);
    const [queueMaxCapacity, setQueueMaxCapacity] = useState(1);

    // Concurrent device login approval state
    const [showWaitingApprovalModal, setShowWaitingApprovalModal] = useState(false);
    const [challengeRequestId, setChallengeRequestId] = useState<string | null>(null);
    const approvalPollRef = useRef<NodeJS.Timeout | null>(null);

    const lastCheckRef = useRef<number>(0);
    const isCheckingRef = useRef<boolean>(false);
    const checkCacheDuration = 60 * 1000;
    const { confirm } = useConfirm();

    // Helper keys for login rate limiting
    const getLoginLockoutKey = () => 'sc_login_lockout_until';
    const getLoginAttemptsKey = () => 'sc_login_attempts';

    const getRemainingLoginLockout = (): number => {
        if (typeof window === 'undefined') return 0;
        const lockoutUntilStr = localStorage.getItem(getLoginLockoutKey());
        if (!lockoutUntilStr) return 0;

        const lockoutUntil = parseInt(lockoutUntilStr, 10);
        const now = Date.now();
        if (lockoutUntil > now) {
            return Math.ceil((lockoutUntil - now) / 1000);
        }

        localStorage.removeItem(getLoginLockoutKey());
        localStorage.removeItem(getLoginAttemptsKey());
        return 0;
    };

    // Initialize rate limit state on mount
    useEffect(() => {
        const remaining = getRemainingLoginLockout();
        if (remaining > 0) {
            setLoginLockoutSeconds(remaining);
            const storedAttempts = parseInt(localStorage.getItem(getLoginAttemptsKey()) || '0', 10);
            setLoginAttempts(storedAttempts || MAX_LOGIN_ATTEMPTS);
        } else {
            const storedAttempts = parseInt(localStorage.getItem(getLoginAttemptsKey()) || '0', 10);
            setLoginAttempts(storedAttempts || 0);
        }
    }, []);

    // Countdown timer for lockout
    useEffect(() => {
        if (loginLockoutSeconds > 0) {
            const timer = setTimeout(() => {
                const nextSec = loginLockoutSeconds - 1;
                setLoginLockoutSeconds(nextSec);
                if (nextSec <= 0) {
                    localStorage.removeItem(getLoginLockoutKey());
                    localStorage.removeItem(getLoginAttemptsKey());
                    setLoginAttempts(0);
                    setLoginError(null);
                    toast.success('Lockout expired. You may now sign in.');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loginLockoutSeconds]);

    // Check for inactivity logout redirect
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const isInactiveParam = urlParams.get('reason') === 'inactive';
            const isInactiveStorage = sessionStorage.getItem('sc_inactive_logout') === 'true';

            if (isInactiveParam || isInactiveStorage) {
                sessionStorage.removeItem('sc_inactive_logout');
                toast.error('Session ended, user inactive', {
                    id: 'session-ended-inactive',
                    duration: 5000,
                    position: 'top-center',
                });
                if (isInactiveParam) {
                    window.history.replaceState({}, '', '/scAuth');
                }
            }
        }
    }, []);

    // Fetch existing appeal if device is blocked
    useEffect(() => {
        if (isDeviceBlocked && blockedDeviceId) {
            const fetchAppeal = async () => {
                const appeal = await checkExistingAppeal(blockedDeviceId);
                setExistingAppeal(appeal);
            };
            fetchAppeal();
        }
    }, [isDeviceBlocked, blockedDeviceId]);

    // Check existing active or remembered session on mount
    useEffect(() => {
        const checkExistingSession = async () => {
            const sessionToken = user.getSessionToken();

            if (!sessionToken) {
                setIsLoading(false);
                return;
            }

            const now = Date.now();
            const lastCheck = lastCheckRef.current;
            if (lastCheck && (now - lastCheck) < checkCacheDuration) {
                setIsLoading(false);
                return;
            }

            if (isCheckingRef.current) return;
            isCheckingRef.current = true;

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const redirectQuery = urlParams.get('redirect') || urlParams.get('returnUrl');

                // 1. First check if user has an active, valid session
                const { ok: validOk, data: validData } = await validateSessionApi(sessionToken);
                lastCheckRef.current = now;

                if (validOk && validData?.valid && validData?.user) {
                    const userAgent = user.getUserAgent() || navigator.userAgent;
                    const blockedDevice = await checkIfDeviceBlocked(validData.user.id, userAgent);

                    if (blockedDevice) {
                        setIsDeviceBlocked(true);
                        setBlockedDeviceId(blockedDevice.id);
                        toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                        setIsLoading(false);
                        return;
                    }

                    user.updateUser({
                        role: validData.user.role,
                        name: validData.user.display_name,
                        email: validData.user.email,
                        userId: validData.user.id,
                    });
                    await restoreSupabaseSession();

                    const defaultRedirect = settingsService.getRoleRedirect(validData.user.role);
                    const finalPath = (redirectQuery && redirectQuery.startsWith('/') && redirectQuery !== '/scAuth')
                        ? redirectQuery
                        : defaultRedirect;

                    window.location.href = finalPath;
                    return;
                }

                // 2. Fallback: check remembered session (exclusively for Suppliers)
                const { ok, data } = await checkRememberedSessionApi(sessionToken);

                if (ok && data?.remembered) {
                    const userRole = (data.user?.role || '').toLowerCase();
                    // Only Supplier sessions can be remembered; all other roles are strictly disallowed
                    if (userRole !== 'supplier') {
                        await clearUserSession();
                        setIsLoading(false);
                        return;
                    }

                    if (data.differentDevice) {
                        toast.warning('Different device detected. Please sign in again.');
                        setIsLoading(false);
                        return;
                    }

                    const userAgent = user.getUserAgent() || navigator.userAgent;
                    const blockedDevice = await checkIfDeviceBlocked(data.user?.id, userAgent);

                    if (blockedDevice) {
                        setIsDeviceBlocked(true);
                        setBlockedDeviceId(blockedDevice.id);
                        toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                        setIsLoading(false);
                        return;
                    }

                    user.updateUser({ role: data.user.role });
                    await restoreSupabaseSession();

                    const defaultRedirect = settingsService.getRoleRedirect(data.user.role);
                    const finalPath = (redirectQuery && redirectQuery.startsWith('/') && redirectQuery !== '/scAuth')
                        ? redirectQuery
                        : defaultRedirect;

                    window.location.href = finalPath;
                    return;
                }

                await clearUserSession();
            } catch (error) {
                console.error('Error checking existing session:', error);
            } finally {
                isCheckingRef.current = false;
                setIsLoading(false);
            }
        };

        checkExistingSession();
    }, []);

    // OTP Countdown timers
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    useEffect(() => {
        if (otpExpiresIn > 0) {
            const timer = setTimeout(() => setOtpExpiresIn(otpExpiresIn - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [otpExpiresIn]);

    // Handle Notify Admin when login is restricted
    const handleNotifyAdmin = async (userInfo: { email: string; userId?: string; displayName?: string; role?: string; reason?: string }) => {
        const category = getNoticeCategory(userInfo.reason || authRestrictionMessage || loginError || otpError);
        const remaining = getRemainingNotifyCooldown(category, userInfo.email);
        if (remaining > 0) {
            toast.error(`Rate limit reached: Max 2 notifications allowed every 5 minutes. Please wait ${formatNotifyCooldown(remaining)}.`, { id: 'auth-req' });
            return false;
        }

        toast.loading('Sending authorization request to Administrator...', { id: 'auth-req' });
        try {
            const { ok, data } = await requestLoginAuthorizationApi({
                email: userInfo.email,
                userId: userInfo.userId,
                displayName: userInfo.displayName,
                role: userInfo.role,
                message: userInfo.reason || authRestrictionMessage || loginError || otpError || undefined,
            });
            if (ok) {
                recordNotificationSent(category, userInfo.email);
                toast.success(data?.message || 'Authorization request sent to Administrator. Please wait for approval.', { id: 'auth-req', duration: 5000 });
                return true;
            } else {
                toast.error(data?.error || data?.message || 'Failed to send request. Please try again.', { id: 'auth-req' });
                return false;
            }
        } catch {
            toast.error('Failed to notify admin. Please check your connection.', { id: 'auth-req' });
            return false;
        }
    };

    // Concurrent device login approval polling & cancel handlers
    const handleCancelWaitingApproval = () => {
        if (approvalPollRef.current) {
            clearInterval(approvalPollRef.current);
            approvalPollRef.current = null;
        }
        setShowWaitingApprovalModal(false);
        setChallengeRequestId(null);
        toast.info('Login approval request cancelled.');
    };

    const startPollingForApproval = (requestId: string, targetUser: any) => {
        if (approvalPollRef.current) {
            clearInterval(approvalPollRef.current);
            approvalPollRef.current = null;
        }

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/concurrent-login/status?requestId=${encodeURIComponent(requestId)}`);
                if (!res.ok) return;

                const data = await res.json();

                if (data.status === 'approved') {
                    if (approvalPollRef.current) {
                        clearInterval(approvalPollRef.current);
                        approvalPollRef.current = null;
                    }
                    setShowWaitingApprovalModal(false);
                    toast.success('Login approved! Transferring session to this device...');

                    const payload = data.sessionPayload || {};
                    if (payload.accessToken) {
                        await setSupabaseSession(payload.accessToken, payload.refreshToken || '');
                    }

                    user.setUser({
                        name: payload.displayName || targetUser?.display_name || targetUser?.name || 'User',
                        role: payload.role || targetUser?.role || 'Admin',
                        email: payload.email || targetUser?.email || email,
                        sessionToken: payload.sessionToken,
                        expiresAt: payload.expiresAt || '',
                        rememberMe: Boolean(payload.rememberMe),
                        userId: payload.userId || targetUser?.id,
                    });

                    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                    const redirectQuery = urlParams?.get('redirect') || urlParams?.get('returnUrl');
                    const defaultRedirect = payload.redirectUrl || settingsService.getRoleRedirect(payload.role || targetUser?.role);
                    const targetRedirect = (redirectQuery && redirectQuery.startsWith('/') && redirectQuery !== '/scAuth')
                        ? redirectQuery
                        : defaultRedirect;

                    router.push(targetRedirect);
                } else if (data.status === 'declined') {
                    if (approvalPollRef.current) {
                        clearInterval(approvalPollRef.current);
                        approvalPollRef.current = null;
                    }
                    setShowWaitingApprovalModal(false);
                    setChallengeRequestId(null);
                    const declMsg = 'Permission declined. You do not have permission to log in from this device.';
                    toast.error(declMsg, { duration: 6000 });
                    setLoginError(declMsg);
                } else if (data.status === 'timeout') {
                    if (approvalPollRef.current) {
                        clearInterval(approvalPollRef.current);
                        approvalPollRef.current = null;
                    }
                    setShowWaitingApprovalModal(false);
                    setChallengeRequestId(null);
                    const timeoutMsg = 'Login approval request timed out. Please try again.';
                    toast.error(timeoutMsg);
                    setLoginError(timeoutMsg);
                }
            } catch (err) {
                console.error('Error polling login approval:', err);
            }
        }, 2000);

        approvalPollRef.current = pollInterval;
    };

    useEffect(() => {
        return () => {
            if (approvalPollRef.current) {
                clearInterval(approvalPollRef.current);
                approvalPollRef.current = null;
            }
        };
    }, []);

    // Main Login Handler
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginError(null);

        const remaining = getRemainingLoginLockout();
        if (remaining > 0) {
            setLoginLockoutSeconds(remaining);
            const lockMsg = `Rate limit reached (3 failed attempts). Please wait ${remaining}s before trying again.`;
            toast.error(lockMsg);
            setLoginError(lockMsg);
            return;
        }

        if (!email.trim() || !password) {
            setLoginError('Please enter your email and password.');
            return;
        }

        setIsLoggingIn(true);
        try {
            await clearUserSession();
            await new Promise(resolve => setTimeout(resolve, 300));

            const { ok, status, data } = await loginSupplyChainApi(email.trim(), password, false);

            if (!ok) {
                if (data?.notAllowed || status === 403) {
                    const userTarget = data?.user || { email };
                    const msg = data?.message || 'You are not authorized to login at this time.';
                    setLoginError(msg);
                    toast.info(msg, {
                        duration: 8000,
                        action: {
                            label: 'Notify Admin',
                            onClick: () => handleNotifyAdmin({
                                email: userTarget.email || email,
                                userId: userTarget.id,
                                displayName: userTarget.display_name,
                                role: userTarget.role,
                            }),
                        },
                    });
                    return;
                }

                const nextAttempts = (loginAttempts || 0) + 1;
                setLoginAttempts(nextAttempts);
                localStorage.setItem(getLoginAttemptsKey(), nextAttempts.toString());

                if (status === 429 || nextAttempts >= MAX_LOGIN_ATTEMPTS || data?.locked) {
                    const lockoutSeconds = data?.retryAfter || 60;
                    const lockoutUntil = Date.now() + lockoutSeconds * 1000;
                    localStorage.setItem(getLoginLockoutKey(), lockoutUntil.toString());
                    setLoginLockoutSeconds(lockoutSeconds);

                    const lockMsg = 'Rate limit reached (3 failed attempts). Login locked. You can continue in 1 minute (60s).';
                    toast.error(lockMsg);
                    setLoginError(lockMsg);
                } else {
                    const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - nextAttempts);
                    const errMsg = data?.message || `Invalid email or password. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`;
                    setLoginError(errMsg);
                    toast.error(errMsg);
                }
                return;
            }

            // Reset rate limit tracking on credentials match
            localStorage.removeItem(getLoginLockoutKey());
            localStorage.removeItem(getLoginAttemptsKey());
            setLoginAttempts(0);
            setLoginLockoutSeconds(0);

            // CASE 0: Another device is currently logged in and approval is required!
            if (data.requireApproval && data.requestId) {
                setChallengeRequestId(data.requestId);
                setLoggedInUser(data.user);
                setShowWaitingApprovalModal(true);
                startPollingForApproval(data.requestId, data.user);
                return;
            }

            // CASE 1: Superadmin / Admin requires 2FA Email OTP
            if (data.requireOtp) {
                setLoggedInUser({
                    id: data.userId,
                    email: data.email,
                    role: data.role,
                    display_name: data.displayName,
                });

                setOtpTargetEmail(data.email);
                setOtpMaskedEmail(data.maskedEmail || maskEmail(data.email));
                setOtpTargetUserId(data.userId);
                setOtpTargetRole(data.role);
                setOtpTargetDisplayName(data.displayName || data.role || 'User');
                setOtpCode(['', '', '', '', '', '']);
                setOtpError(null);
                setOtpSuccess(null);
                setOtpRememberMe(false);
                setCountdown(120); // 2 minutes resend cooldown
                setOtpExpiresIn(300); // 5 minutes OTP validity
                setShowOtpModal(true);

                toast.success(`Security code sent to ${data.maskedEmail || maskEmail(data.email)}`);
                setTimeout(() => document.getElementById('otp-0')?.focus(), 150);
                return;
            }

            // CASE 2: Concurrent Active Session on another device detected — requires approval
            if (data.requireApproval && data.requestId) {
                setChallengeRequestId(data.requestId);
                setLoggedInUser(data.user);
                setShowWaitingApprovalModal(true);
                startPollingForApproval(data.requestId, data.user);
                return;
            }

            // CASE 3: Standard Users (Purchase Officer, Operator, Supplier) Direct Login
            if (data.success && data.user) {
                if (data.access_token) {
                    await setSupabaseSession(data.access_token, data.refresh_token || '');
                }

                user.setUser({
                    name: data.user.display_name || 'User',
                    role: data.user.role,
                    email: data.user.email,
                    sessionToken: data.session_token,
                    expiresAt: data.expires_at || '',
                    rememberMe: false,
                    userId: data.user.id,
                });

                toast.success('Login successful!');
                const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const redirectQuery = urlParams?.get('redirect') || urlParams?.get('returnUrl');
                const defaultRedirect = data.redirect_url || settingsService.getRoleRedirect(data.user.role);
                const targetRedirect = (redirectQuery && redirectQuery.startsWith('/') && redirectQuery !== '/scAuth')
                    ? redirectQuery
                    : defaultRedirect;
                router.push(targetRedirect);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setLoginError('Something went wrong. Please try again.');
        } finally {
            setIsLoggingIn(false);
        }
    }

    // Handle OTP input digits
    function handleOtpChange(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpCode];
        newOtp[index] = value.slice(-1);
        setOtpCode(newOtp);
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    }

    function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        }
    }

    function handleOtpPaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        if (!/^\d{6}$/.test(pastedData)) return;
        const digits = pastedData.split('');
        setOtpCode(digits);
        document.getElementById('otp-5')?.focus();
    }

    // Verify OTP Submission
    async function handleVerifyOtp() {
        const otpString = otpCode.join('');
        if (otpString.length !== 6) {
            setOtpError('Please enter all 6 digits of your security code.');
            return;
        }

        if (otpExpiresIn === 0) {
            setOtpError('Your security code has expired. Please click Resend Code.');
            return;
        }

        setIsVerifyingOtp(true);
        setOtpError(null);
        setOtpSuccess(null);

        try {
            const { ok, status, data } = await verifyOtpApi({
                userId: otpTargetUserId,
                otp: otpString,
                targetUserId: otpTargetUserId,
                rememberMe: false,
                email: otpTargetEmail,
                employeeName: otpTargetDisplayName,
                employeeRole: otpTargetRole,
            });

            if (!ok) {
                throw new Error(data?.message || 'Invalid security code. Please try again.');
            }

            // Check if active session on another device requires approval
            if (data.requireApproval && data.requestId) {
                setShowOtpModal(false);
                setChallengeRequestId(data.requestId);
                setLoggedInUser(data.user);
                setShowWaitingApprovalModal(true);
                startPollingForApproval(data.requestId, data.user);
                return;
            }

            toast.success('Security code verified successfully!');
            setOtpSuccess('Security code verified. Signing in…');

            user.setUser({
                name: data.user?.display_name || otpTargetDisplayName || 'User',
                role: data.role || otpTargetRole,
                email: data.user?.email || otpTargetEmail,
                sessionToken: data.session_token,
                expiresAt: data.expires_at || '',
                rememberMe: false,
                userId: data.userId || otpTargetUserId,
            });

            setShowOtpModal(false);
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const redirectQuery = urlParams?.get('redirect') || urlParams?.get('returnUrl');
            const defaultRedirect = data.redirect_url || settingsService.getRoleRedirect(data.role || otpTargetRole);
            const redirectUrl = (redirectQuery && redirectQuery.startsWith('/') && redirectQuery !== '/scAuth')
                ? redirectQuery
                : defaultRedirect;
            router.push(redirectUrl);

        } catch (err: any) {
            setOtpError(err.message || 'Failed to verify security code');
            toast.error(err.message || 'Invalid security code');
            setOtpCode(['', '', '', '', '', '']);
            document.getElementById('otp-0')?.focus();
        } finally {
            setIsVerifyingOtp(false);
        }
    }

    // Resend OTP
    async function handleResendOtp() {
        if (isResendingOtp || countdown > 0) return;

        setIsResendingOtp(true);
        setOtpError(null);
        setOtpSuccess(null);

        try {
            const { ok, status, data } = await requestOtpApi({
                userId: otpTargetUserId,
                email: otpTargetEmail,
                loggedInUserId: otpTargetUserId,
                employeeName: otpTargetDisplayName,
            });

            if (!ok) {
                if (status === 429) {
                    throw new Error(data?.message || 'Too many requests. Please wait before requesting another code.');
                }
                throw new Error(data?.message || 'Failed to resend code');
            }

            toast.success(`New security code sent to ${otpMaskedEmail || maskEmail(otpTargetEmail)}`);
            setOtpSuccess(`New security code sent to ${otpMaskedEmail || maskEmail(otpTargetEmail)}`);
            setCountdown(120); // 2 mins cooldown
            setOtpExpiresIn(300); // 5 mins validity
            setOtpCode(['', '', '', '', '', '']);
            document.getElementById('otp-0')?.focus();
        } catch (err: any) {
            setOtpError(err.message || 'Failed to resend security code');
            toast.error(err.message || 'Failed to resend security code');
        } finally {
            setIsResendingOtp(false);
        }
    }

    // Submit Appeal for blocked device
    const handleSubmitAppeal = async () => {
        if (!appealMessage.trim()) {
            toast.error('Please enter an appeal message');
            return;
        }

        if (!blockedDeviceId) {
            toast.error('No blocked device found');
            return;
        }

        setIsSubmittingAppeal(true);
        try {
            const { data, error } = await submitAppeal({
                blockedDeviceId,
                userAgent: navigator.userAgent,
                userEmail: email.trim(),
                userName: loggedInUser?.display_name || 'User',
                userRole: loggedInUser?.role || 'User',
                appealMessage: appealMessage.trim(),
            });

            if (error) {
                toast.error('Failed to submit appeal. Please try again.');
                return;
            }

            toast.success('Appeal submitted successfully. Please wait for admin approval.');
            setShowAppealModal(false);
            setAppealMessage('');
            setExistingAppeal(data || null);
        } catch {
            toast.error('Failed to submit appeal.');
        } finally {
            setIsSubmittingAppeal(false);
        }
    };

    const handleUpdateAppeal = async () => {
        if (!appealMessage.trim() || !existingAppeal?.id) return;
        setIsSubmittingAppeal(true);
        try {
            const { error } = await updateAppeal(existingAppeal.id, appealMessage);
            if (error) {
                toast.error('Failed to update appeal.');
                return;
            }
            toast.success('Appeal updated successfully');
            setShowAppealModal(false);
            setExistingAppeal({ ...existingAppeal, appeal_message: appealMessage.trim() });
        } catch {
            toast.error('Failed to update appeal.');
        } finally {
            setIsSubmittingAppeal(false);
        }
    };

    const handleDeleteAppeal = async () => {
        if (!existingAppeal?.id) return;
        const confirmed = await confirm({
            title: 'Delete Appeal',
            message: 'Are you sure you want to delete this appeal?',
            confirmText: 'Delete',
            confirmVariant: 'danger',
        });
        if (!confirmed) return;

        try {
            const { error } = await deleteAppeal(existingAppeal.id);
            if (error) {
                toast.error('Failed to delete appeal.');
                return;
            }
            toast.success('Appeal deleted successfully');
            setExistingAppeal(null);
            setShowAppealModal(false);
        } catch {
            toast.error('Failed to delete appeal.');
        }
    };

    const openAppealModal = () => {
        setAppealMessage(existingAppeal?.appeal_message || '');
        setIsEditingAppeal(false);
        setShowAppealModal(true);
    };

    // Loading Splash Screen
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-paper dark:bg-ink transition-colors duration-300">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    <p className="mt-2 text-muted dark:text-paper/70 text-sm">Checking session…</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <CustomCursor />
            <OfflineDetector
                showToast={true}
                autoReconnect={true}
                reconnectInterval={30000}
                blurAmount={4}
            >
                <div className="supplychain-container h-dvh w-full bg-paper dark:bg-ink text-ink dark:text-paper font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px] transition-colors duration-300">
                    {/* Left side - Branding Hero */}
                    <div className="relative hidden lg:flex flex-col justify-between border-r border-line dark:border-paper/10 px-16 py-14 overflow-hidden">
                        <div className="absolute bottom-14 right-14 rotate-[-6deg] select-none">
                            <div className="flex items-center gap-2 rounded-full border border-line dark:border-paper/15 px-4 py-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.16em] text-muted dark:text-paper/70">
                                    Supply Chain
                                </span>
                            </div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            <Image
                                src="/images/logo-remove-bg.png"
                                alt="Airship Express"
                                width={168}
                                height={48}
                                className="h-10 w-auto dark:brightness-0 dark:invert transition-all"
                                priority
                            />
                        </motion.div>

                        <motion.div
                            className="max-w-lg"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
                        >
                            <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                                Unified Enterprise Access
                            </p>
                            <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight text-ink dark:text-paper">
                                Supply Chain
                                <br />
                                Management
                                <br />
                                Portal
                            </h1>
                            <p className="mt-5 text-[15px] leading-relaxed text-muted dark:text-paper/70">
                                Direct single-sign-on access for Executives, Administrators, Purchase Officers, Operators, and Authorized Suppliers.
                            </p>
                        </motion.div>

                        <div className="flex items-center gap-2 text-[12px] text-muted dark:text-paper/60">
                            <span className="h-1 w-1 rounded-full bg-accent" />
                            Internal use only &middot; Airship Express Supply Chain
                        </div>
                    </div>

                    {/* Right side - Login Form */}
                    <div className="h-dvh overflow-y-auto flex items-center justify-center px-5 py-8 sm:px-12 sm:py-16 bg-paper dark:bg-ink">
                        <motion.div
                            className="w-full max-w-sm"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
                        >
                            <div className="mb-6 sm:mb-10 lg:hidden">
                                <Image
                                    src="/images/logo-remove-bg.png"
                                    alt="Airship Express"
                                    width={144}
                                    height={40}
                                    className="h-8 w-auto sm:h-9 dark:brightness-0 dark:invert transition-all"
                                    priority
                                />
                            </div>

                            <p className="font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                                Welcome back
                            </p>
                            <h2 className="mt-2 sm:mt-3 font-bricolage text-[24px] sm:text-[28px] lg:text-[30px] font-medium tracking-tight text-ink dark:text-paper">
                                Sign in to Supply Chain
                            </h2>
                            <p className="mt-2 sm:mt-2.5 text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted dark:text-paper/70">
                                Use your registered email and password.
                            </p>

                            <form
                                onSubmit={handleLogin}
                                className="mt-6 sm:mt-9 lg:mt-11 space-y-5 sm:space-y-6"
                                noValidate
                            >
                                {/* Email Field */}
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-paper/70"
                                    >
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        disabled={isLoggingIn || loginLockoutSeconds > 0}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Password Field */}
                                <div>
                                    <div className="flex items-baseline justify-between">
                                        <label
                                            htmlFor="password"
                                            className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-paper/70"
                                        >
                                            Password
                                        </label>
                                    </div>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            value={password}
                                            disabled={isLoggingIn || loginLockoutSeconds > 0}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 pr-12 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <button
                                            type="button"
                                            disabled={loginLockoutSeconds > 0}
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute bottom-2 right-0 p-1.5 text-muted hover:text-ink dark:text-paper/80 dark:hover:text-paper transition-colors cursor-pointer disabled:opacity-40"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={20} strokeWidth={2} />
                                            ) : (
                                                <Eye size={20} strokeWidth={2} />
                                            )}
                                        </button>
                                    </div>
                                </div>



                                {/* Rate limit lockout banner */}
                                {loginLockoutSeconds > 0 && (
                                    <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold">Login Locked (3 failed attempts)</p>
                                            <p className="text-[11.5px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                                                Rate limit reached. You can continue in <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{loginLockoutSeconds}s</span>.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {loginError && loginLockoutSeconds <= 0 && (
                                    <div role="alert" className="border-l-2 border-accent pl-3 text-[13px] text-accent">
                                        {loginError}
                                    </div>
                                )}

                                {/* Sign In Button */}
                                <button
                                    type="submit"
                                    disabled={isLoggingIn || loginLockoutSeconds > 0}
                                    className={`w-full px-4 py-3.5 text-[14px] font-medium tracking-wide transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer rounded-xl ${
                                        loginLockoutSeconds > 0
                                            ? 'bg-amber-600 dark:bg-amber-700 text-white cursor-not-allowed opacity-85'
                                            : 'bg-ink dark:bg-paper text-paper dark:text-ink hover:bg-accent dark:hover:bg-accent dark:hover:text-paper disabled:cursor-not-allowed disabled:opacity-60'
                                    }`}
                                >
                                    {isLoggingIn ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Signing in…
                                        </>
                                    ) : loginLockoutSeconds > 0 ? (
                                        <>
                                            <Lock size={16} />
                                            Continue in {loginLockoutSeconds}s
                                        </>
                                    ) : (
                                        'Sign in'
                                    )}
                                </button>
                            </form>

                            {/* Blocked Device Notice Button */}
                            {isDeviceBlocked && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
                                    <span>This device is currently blocked.</span>
                                    <button
                                        type="button"
                                        onClick={openAppealModal}
                                        className="font-bold underline cursor-pointer hover:text-red-700"
                                    >
                                        Submit Appeal
                                    </button>
                                </div>
                            )}

                            {/* Help / HR Contact */}
                            <div className="mt-6 p-4 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-white/60 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] transition-all">
                                <p className="text-center text-xs sm:text-[12.5px] text-slate-600 dark:text-slate-300 font-medium">
                                    Trouble accessing your account? Contact HR at{' '}
                                    <a
                                        href="mailto:supplychainandinventory@gmail.com"
                                        className="font-bold text-accent dark:text-pink-400 hover:text-accent-dark dark:hover:text-pink-300 transition-colors underline decoration-pink-500/30 underline-offset-2"
                                    >
                                        supplychainandinventory@gmail.com
                                    </a>
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* OTP Verification Modal for Superadmin / Admin / Supplier */}
                <OtpVerificationModal
                    isOpen={showOtpModal}
                    onClose={() => {
                        setShowOtpModal(false);
                        setOtpCode(['', '', '', '', '', '']);
                        setOtpError(null);
                        setOtpSuccess(null);
                        setOtpRememberMe(false);
                    }}
                    email={otpTargetEmail}
                    maskedEmail={otpMaskedEmail}
                    role={otpTargetRole}
                    displayName={otpTargetDisplayName}
                    otpCode={otpCode}
                    handleOtpChange={handleOtpChange}
                    handleOtpKeyDown={handleOtpKeyDown}
                    handleOtpPaste={handleOtpPaste}
                    onVerify={handleVerifyOtp}
                    onResend={handleResendOtp}
                    isVerifying={isVerifyingOtp}
                    isResending={isResendingOtp}
                    countdown={countdown}
                    otpExpiresIn={otpExpiresIn}
                    otpError={otpError}
                    otpSuccess={otpSuccess}
                    rememberMe={otpRememberMe}
                    setRememberMe={setOtpRememberMe}
                />

                {/* Appeal Modal for Blocked Devices */}
                <AppealModal
                    showAppealModal={showAppealModal}
                    existingAppeal={existingAppeal}
                    isEditingAppeal={isEditingAppeal}
                    setIsEditingAppeal={setIsEditingAppeal}
                    appealMessage={appealMessage}
                    setAppealMessage={setAppealMessage}
                    isSubmittingAppeal={isSubmittingAppeal}
                    setShowAppealModal={setShowAppealModal}
                    handleSubmitAppeal={handleSubmitAppeal}
                    handleUpdateAppeal={handleUpdateAppeal}
                    handleDeleteAppeal={handleDeleteAppeal}
                />

                {/* Login Queue Concurrency Modal */}
                <LoginQueueModal
                    isOpen={showQueueModal}
                    role={loggedInUser?.role}
                    initialPosition={queuePosition}
                    initialActiveUsers={queueActiveUsers}
                    maxCapacity={queueMaxCapacity}
                    onRetry={() => {
                        setShowQueueModal(false);
                        if (showOtpModal) {
                            handleVerifyOtp();
                        }
                    }}
                    onClose={() => setShowQueueModal(false)}
                />

                {/* Waiting for Other Device Login Approval Modal */}
                <WaitingForApprovalModal
                    isOpen={showWaitingApprovalModal}
                    onCancel={handleCancelWaitingApproval}
                    userEmail={loggedInUser?.email || email}
                    userDisplayName={loggedInUser?.display_name || loggedInUser?.name}
                />
            </OfflineDetector>
        </>
    );
}
