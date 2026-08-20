'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye,
    EyeOff,
    X,
    Search,
    Send,
    CheckCircle,
    AlertCircle,
    Users,
    UserCog,
    User,
    Building,
    Loader2,
    Clock,
    Mail,
    LogIn,
    AlertTriangle,
    MessageSquare,
    Pencil,
    Trash2,
    Eye as EyeIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { OfflineDetector } from '@/app/(supplyChain)/components/global/OfflineDetector';

export default function SupplyChainLoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // login form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loggedInUser, setLoggedInUser] = useState<any>(null);

    // employee selection
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // remembered session
    const [isRemembered, setIsRemembered] = useState(false);
    const [isCheckingRemembered, setIsCheckingRemembered] = useState(false);
    const [rememberedData, setRememberedData] = useState<any>(null);
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);
    const [isRequestingOTP, setIsRequestingOTP] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isLoggingInWithRemembered, setIsLoggingInWithRemembered] = useState(false);
    const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);
    const [isSelectionLocked, setIsSelectionLocked] = useState(false);

    // device blocking
    const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);
    const [blockedDeviceId, setBlockedDeviceId] = useState<string | null>(null);
    const [showAppealModal, setShowAppealModal] = useState(false);
    const [appealMessage, setAppealMessage] = useState('');
    const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
    const [existingAppeal, setExistingAppeal] = useState<any>(null);
    const [isEditingAppeal, setIsEditingAppeal] = useState(false);

    // password setup
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [useHrPassword, setUseHrPassword] = useState(false);
    const [hrPassword, setHrPassword] = useState('');
    const [hrHasPassword, setHrHasPassword] = useState(false);
    const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState<any>(null);

    // remembered password modal
    const [showRememberedPasswordModal, setShowRememberedPasswordModal] = useState(false);
    const [rememberedPassword, setRememberedPassword] = useState('');

    const lastCheckRef = useRef<number>(0);
    const isCheckingRef = useRef<boolean>(false);
    const checkCacheDuration = 60 * 1000;
    const { confirm } = useConfirm();

    // clear all session data
    const clearUserSession = useCallback(async () => {
        const sessionToken = localStorage.getItem('session_token');

        if (sessionToken) {
            try {
                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    headers: { 'x-session-token': sessionToken }
                });
            } catch (error) {
            }
        }

        await supabase.auth.signOut();

        localStorage.removeItem('session_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('session_expires');
        localStorage.removeItem('logged_in_email');
        localStorage.removeItem('user_agent');
        localStorage.removeItem('user_id');
        localStorage.removeItem('session_backup');
        document.cookie = 'session_token=; path=/; max-age=0';
    }, []);

    // check if device is blocked
    const checkIfDeviceBlocked = async (userId: string, userAgent: string): Promise<any> => {
        try {
            const { data: userData, error: userError } = await supabase
                .from('role_based_accounts')
                .select('role')
                .eq('id', userId)
                .maybeSingle();

            if (userError) {
                return null;
            }

            if (userData?.role === 'Admin') {
                return null;
            }

            const { data, error } = await supabase
                .from('blocked_devices')
                .select('id, device_name, reason, status')
                .eq('user_id', userId)
                .eq('user_agent', userAgent)
                .eq('status', 'blocked')
                .maybeSingle();

            if (error) {
                return null;
            }

            return data;
        } catch (error) {
            return null;
        }
    };

    // check for existing appeal
    const checkExistingAppeal = async (blockedDeviceId: string) => {
        try {
            const { data, error } = await supabase
                .from('appeals')
                .select('*')
                .eq('blocked_device_id', blockedDeviceId)
                .order('created_at', { ascending: false })
                .maybeSingle();

            if (error) {
                return null;
            }

            return data;
        } catch (error) {
            return null;
        }
    };

    useEffect(() => {
        if (isDeviceBlocked && blockedDeviceId) {
            const fetchAppeal = async () => {
                const appeal = await checkExistingAppeal(blockedDeviceId);
                setExistingAppeal(appeal);
            };
            fetchAppeal();
        }
    }, [isDeviceBlocked, blockedDeviceId]);

    // submit appeal
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
            const existing = await checkExistingAppeal(blockedDeviceId);
            if (existing) {
                toast.warning('You already have a pending appeal for this device');
                setShowAppealModal(false);
                setIsSubmittingAppeal(false);
                return;
            }

            const { data, error } = await supabase
                .from('appeals')
                .insert({
                    blocked_device_id: blockedDeviceId,
                    user_agent: navigator.userAgent,
                    user_email: loggedInUser?.email || '',
                    user_name: loggedInUser?.display_name || 'Unknown User',
                    user_role: loggedInUser?.role || 'Employee',
                    appeal_message: appealMessage.trim(),
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select();

            if (error) {
                toast.error('Failed to submit appeal. Please try again.');
                return;
            }

            toast.success('Appeal submitted successfully. Please wait for admin approval.');
            setShowAppealModal(false);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setExistingAppeal(data?.[0] || null);
        } catch (error) {
            toast.error('Failed to submit appeal. Please try again.');
        } finally {
            setIsSubmittingAppeal(false);
        }
    };

    // update appeal
    const handleUpdateAppeal = async () => {
        if (!appealMessage.trim()) {
            toast.error('Please enter an appeal message');
            return;
        }

        if (!existingAppeal?.id) {
            toast.error('No appeal found to update');
            return;
        }

        setIsSubmittingAppeal(true);

        try {
            const { error } = await supabase
                .from('appeals')
                .update({
                    appeal_message: appealMessage.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingAppeal.id);

            if (error) {
                toast.error('Failed to update appeal. Please try again.');
                return;
            }

            toast.success('Appeal updated successfully');
            setShowAppealModal(false);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setExistingAppeal({ ...existingAppeal, appeal_message: appealMessage.trim() });
        } catch (error) {
            toast.error('Failed to update appeal. Please try again.');
        } finally {
            setIsSubmittingAppeal(false);
        }
    };

    // delete appeal
    const handleDeleteAppeal = async () => {
        if (!existingAppeal?.id) {
            toast.error('No appeal found to delete');
            return;
        }

        const confirmed = await confirm({
            title: 'Delete Appeal',
            message: 'Are you sure you want to delete this appeal? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('appeals')
                .delete()
                .eq('id', existingAppeal.id);

            if (error) {
                toast.error('Failed to delete appeal. Please try again.');
                return;
            }

            toast.success('Appeal deleted successfully');
            setExistingAppeal(null);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setShowAppealModal(false);
        } catch (error) {
            toast.error('Failed to delete appeal. Please try again.');
        }
    };

    // check for existing session on load
    useEffect(() => {
        const checkExistingSession = async () => {
            const sessionToken = localStorage.getItem('session_token');

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
                const res = await fetch('/api/supplyChain/check-remembered-session', {
                    headers: { 'x-session-token': sessionToken }
                });

                lastCheckRef.current = now;
                const data = await res.json();

                if (res.ok && data.remembered) {

                    if (data.differentDevice) {
                        toast.warning('Different device. Please login with OTP.');
                        setIsLoading(false);
                        return;
                    }

                    const userAgent = localStorage.getItem('user_agent') || navigator.userAgent;
                    const blockedDevice = await checkIfDeviceBlocked(data.user?.id, userAgent);

                    if (blockedDevice) {
                        setIsDeviceBlocked(true);
                        setBlockedDeviceId(blockedDevice.id);
                        toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                        setIsLoading(false);
                        return;
                    }

                    localStorage.setItem('user_role', data.user.role);

                    try {
                        const { data: { session } } = await supabase.auth.getSession();

                        if (!session) {
                            console.log('Remembered login: No Supabase session, attempting to restore...');

                            const storedRefreshToken = localStorage.getItem('supabase_refresh_token');

                            if (storedRefreshToken) {
                                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                                    refresh_token: storedRefreshToken,
                                });

                                if (refreshError) {
                                    console.error('Refresh token failed:', refreshError.message);
                                    localStorage.removeItem('supabase_refresh_token');
                                } else if (refreshData.session) {
                                    console.log('Supabase session restored via refresh token!');
                                    console.log('User:', refreshData.session?.user?.email);
                                    localStorage.setItem('supabase_refresh_token', refreshData.session.refresh_token);
                                }
                            } else {
                                console.warn('No refresh token found for Supabase session');
                            }
                        } else {
                            console.log('Supabase session already exists for remembered login:', session?.user?.email);
                        }
                    } catch (error) {
                        console.error('Error restoring Supabase session:', error);
                    }

                    const roleRedirects: Record<string, string> = {
                        'Admin': '/executive',
                        'Manager': '/warehousing?tab=incoming',
                        'Employee': '/documents',
                        'Operator': '/warehousing?tab=incoming',
                        'Executive': '/executive'
                    };

                    const redirectPath = roleRedirects[data.user.role] || '/warehousing';
                    window.location.href = redirectPath;
                    return;
                }

                await clearUserSession();
                toast.error('Session expired. Please login again.');
            } catch (error) {
                console.error('Error checking remembered session:', error);
            } finally {
                isCheckingRef.current = false;
                setIsLoading(false);
            }
        };

        checkExistingSession();
    }, [clearUserSession]);

    // countdown timer for otp resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // handle employee selection
    const handleEmployeeSelect = async (employee: any) => {
        if (isSelectionLocked || isCheckingRemembered || isRequestingOTP || isDeviceBlocked) return;

        setSelectedEmployee(employee);
        setIsCheckingRemembered(true);
        setIsRemembered(false);
        setIsCurrentlyActive(false);
        setRememberedData(null);
        setIsSelectionLocked(true);

        try {
            const storedUserAgent = localStorage.getItem('user_agent');

            const res = await fetch(`/api/supplyChain/check-employee-session?email=${encodeURIComponent(employee.email)}`);
            const data = await res.json();

            if (data.found && data.user_id) {
                const userAgent = navigator.userAgent;
                const blockedDevice = await checkIfDeviceBlocked(data.user_id, userAgent);

                if (blockedDevice) {
                    setIsDeviceBlocked(true);
                    setBlockedDeviceId(blockedDevice.id);
                    toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                    setIsCheckingRemembered(false);
                    setIsSelectionLocked(false);
                    return;
                }
            }

            if (data.found && data.is_currently_active) {
                setIsCurrentlyActive(true);
                toast.info(`${employee.display_name} is currently logged in on another device`);
                setIsCheckingRemembered(false);
                setIsSelectionLocked(false);
                return;
            }

            if (data.found && data.remember_me && !data.is_expired) {
                const isSameDevice = data.user_agent === storedUserAgent;

                if (isSameDevice) {
                    setIsRemembered(true);
                    setRememberedData({
                        ...data,
                        user: { role: data.role || 'Employee' }
                    });
                    toast.success(`${employee.display_name} is remembered on this device`);
                } else {
                    toast.warning('Different device. Please verify with OTP.');
                    setIsRemembered(false);
                }
            } else {
                setIsRemembered(false);
            }
        } catch (error) {
            setIsRemembered(false);
        } finally {
            setIsCheckingRemembered(false);
            setIsSelectionLocked(false);
        }
    };

    // show password modal for remembered login
    const handleLoginWithRemembered = () => {
        if (!selectedEmployee || isDeviceBlocked) {
            if (isDeviceBlocked) {
                toast.error('This device is blocked. Please submit an appeal.');
            }
            return;
        }

        setShowRememberedPasswordModal(true);
        setRememberedPassword('');
    };

    const handleVerifyRememberedPassword = async () => {
        if (!rememberedPassword.trim()) {
            toast.error('Please enter your password');
            return;
        }

        setIsLoggingInWithRemembered(true);

        try {
            const userRole = rememberedData?.role ||
                loggedInUser?.role ||
                localStorage.getItem('user_role') ||
                'Employee';

            const sessionToken = rememberedData?.session_token || localStorage.getItem('session_token');

            // verify password with supabase
            try {
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: selectedEmployee.email,
                    password: rememberedPassword,
                });

                if (signInError) {
                    console.error('Supabase sign in error:', signInError.message);
                    toast.error('Invalid password. Please try again.');
                    setRememberedPassword('');
                    setIsLoggingInWithRemembered(false);
                    return;
                }

                console.log('Supabase Auth login successful!');

                if (signInData.session) {
                    localStorage.setItem('supabase_refresh_token', signInData.session.refresh_token);
                    localStorage.setItem('supabase_user_email', selectedEmployee.email);
                    await supabase.auth.setSession({
                        access_token: signInData.session.access_token,
                        refresh_token: signInData.session.refresh_token,
                    });
                }
            } catch (authError) {
                console.error('Auth error:', authError);
                toast.error('Authentication failed. Please try again.');
                setRememberedPassword('');
                setIsLoggingInWithRemembered(false);
                return;
            }

            // activate remembered session
            if (sessionToken) {
                const currentUserAgent = navigator.userAgent;

                const blockedDevice = await checkIfDeviceBlocked(rememberedData?.user_id || loggedInUser?.id, currentUserAgent);
                if (blockedDevice) {
                    setIsDeviceBlocked(true);
                    setBlockedDeviceId(blockedDevice.id);
                    toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                    setIsLoggingInWithRemembered(false);
                    setShowRememberedPasswordModal(false);
                    return;
                }

                const updateRes = await fetch('/api/supplyChain/activate-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_token: sessionToken,
                        user_agent: currentUserAgent,
                    }),
                });

                if (!updateRes.ok) {
                    toast.error('Session activation failed. Please login with OTP.');
                    setIsLoggingInWithRemembered(false);
                    setShowRememberedPasswordModal(false);
                    return;
                }

                localStorage.setItem('session_token', sessionToken);
            } else {
                const existingToken = localStorage.getItem('session_token');
                if (!existingToken) {
                    toast.error('No session found. Please login with OTP.');
                    setIsLoggingInWithRemembered(false);
                    setShowRememberedPasswordModal(false);
                    return;
                }
            }

            // store user data
            localStorage.setItem('user_role', userRole);
            localStorage.setItem('user_name', selectedEmployee.display_name);
            localStorage.setItem('user_email', selectedEmployee.email);

            const roleRedirects: Record<string, string> = {
                'Admin': '/executive',
                'Manager': '/warehousing?tab=incoming',
                'Employee': '/documents',
            };

            toast.success('Login successful!');
            setShowRememberedPasswordModal(false);
            setShowEmployeeModal(false);
            router.push(roleRedirects[userRole] || '/warehousing');

        } catch (error) {
            console.error('Error logging in:', error);
            toast.error('Failed to login. Please try again.');
        } finally {
            setIsLoggingInWithRemembered(false);
        }
    };

    // main login handler
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginError(null);

        if (!email || !password) {
            setLoginError('Please enter your email and password.');
            return;
        }

        setIsLoggingIn(true);
        try {
            await supabase.auth.signOut();

            localStorage.removeItem('session_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_email');
            localStorage.removeItem('session_expires');
            localStorage.removeItem('logged_in_email');
            localStorage.removeItem('user_agent');
            localStorage.removeItem('user_id');
            localStorage.removeItem('session_backup');

            document.cookie.split(";").forEach(c => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toISOString() + ";path=/");
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            const res = await fetch('/api/auth/supplyChain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setLoginError(data.message || 'Invalid email or password.');
                return;
            }

            setLoggedInUser(data.user);

            localStorage.setItem('user_agent', navigator.userAgent);
            localStorage.setItem('logged_in_email', data.user.email);
            localStorage.setItem('user_role', data.user.role);
            localStorage.setItem('user_name', data.user.display_name || 'User');
            localStorage.setItem('user_id', data.user.id);

            await loadEmployeesFromHR(data.user.role);
            setShowEmployeeModal(true);
        } catch (err) {
            setLoginError('Something went wrong. Please try again.');
        } finally {
            setIsLoggingIn(false);
        }
    }

    // load employees from hr system
    async function loadEmployeesFromHR(role: string) {
        setIsLoadingEmployees(true);
        try {
            const userEmail = loggedInUser?.email;
            const params = new URLSearchParams();
            params.append('role', role);
            if (userEmail) params.append('email', userEmail);

            const res = await fetch(`/api/supplyChain/employees?${params.toString()}`, {
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (res.ok) {
                setEmployees(data);
            } else {
                setLoginError('Failed to load employees from HR system.');
            }
        } catch (err) {
            setLoginError('Failed to connect to HR system.');
        } finally {
            setIsLoadingEmployees(false);
        }
    }

    // request otp
    async function requestOTP() {
        if (!selectedEmployee || isDeviceBlocked) {
            if (isDeviceBlocked) {
                toast.error('This device is blocked. Please submit an appeal.');
            }
            return;
        }

        setIsRequestingOTP(true);
        setOtpError(null);
        setOtpSuccess(null);

        try {
            const blockedDevice = await checkIfDeviceBlocked(loggedInUser.id, navigator.userAgent);
            if (blockedDevice) {
                setIsDeviceBlocked(true);
                setBlockedDeviceId(blockedDevice.id);
                toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                setIsRequestingOTP(false);
                return;
            }

            const res = await fetch('/api/supplyChain/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedEmployee.id,
                    email: selectedEmployee.email,
                    loggedInUserId: loggedInUser.id,
                    employeeName: selectedEmployee.display_name,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    toast.error('Rate limit exceeded. Please wait an hour.');
                    setOtpError('Rate limit exceeded. Please wait an hour.');
                } else {
                    throw new Error(data.message || 'Failed to send OTP');
                }
                return;
            }

            toast.success(`OTP sent to ${selectedEmployee.email}`);
            setOtpSuccess(`OTP sent to ${selectedEmployee.email}`);

            setOtpSent(true);
            setCountdown(30);
            setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
        } catch (err: any) {
            toast.error(err.message);
            setOtpError(err.message);
        } finally {
            setIsRequestingOTP(false);
        }
    }

    // resend otp
    async function resendOTP() {
        if (!selectedEmployee || isDeviceBlocked) {
            if (isDeviceBlocked) {
                toast.error('This device is blocked. Please submit an appeal.');
            }
            return;
        }

        setIsResending(true);
        setOtpError(null);
        setOtpSuccess(null);

        try {
            const blockedDevice = await checkIfDeviceBlocked(loggedInUser.id, navigator.userAgent);
            if (blockedDevice) {
                setIsDeviceBlocked(true);
                setBlockedDeviceId(blockedDevice.id);
                toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                setIsResending(false);
                return;
            }

            const res = await fetch('/api/supplyChain/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedEmployee.id,
                    email: selectedEmployee.email,
                    loggedInUserId: loggedInUser.id,
                    employeeName: selectedEmployee.display_name,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    toast.error('Rate limit exceeded. Please wait an hour.');
                    setOtpError('Rate limit exceeded. Please wait an hour.');
                } else {
                    throw new Error(data.message || 'Failed to resend OTP');
                }
                return;
            }

            toast.success(`New OTP sent to ${selectedEmployee.email}`);
            setOtpSuccess(`New OTP sent to ${selectedEmployee.email}`);
            setCountdown(30);
        } catch (err: any) {
            toast.error(err.message);
            setOtpError(err.message);
        } finally {
            setIsResending(false);
        }
    }

    async function verifyOTP() {
        const otpString = otpCode.join('');
        if (otpString.length !== 6) {
            toast.error('Please enter all 6 digits');
            setOtpError('Please enter all 6 digits');
            return;
        }

        if (isDeviceBlocked) {
            toast.error('This device is blocked. Please submit an appeal.');
            return;
        }

        setIsVerifying(true);
        setOtpError(null);
        setOtpSuccess(null);

        try {
            const blockedDevice = await checkIfDeviceBlocked(loggedInUser.id, navigator.userAgent);
            if (blockedDevice) {
                setIsDeviceBlocked(true);
                setBlockedDeviceId(blockedDevice.id);
                toast.error(`This device is blocked. Reason: ${blockedDevice.reason || 'Blocked by admin'}`);
                setIsVerifying(false);
                return;
            }

            const res = await fetch('/api/supplyChain/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: loggedInUser.id,
                    otp: otpString,
                    targetUserId: selectedEmployee.id,
                    rememberMe: rememberMe,
                    email: selectedEmployee.email,
                    employeeName: selectedEmployee.display_name,
                    employeeRole: selectedEmployee.role,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Invalid OTP');
            }

            if (data.userExists) {
                // Store session token temporarily
                localStorage.setItem('session_token', data.session_token);
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('user_name', data.employee.display_name);
                localStorage.setItem('user_email', data.employee.email);

                setSelectedEmployee({
                    id: data.employee.id || selectedEmployee.id,
                    display_name: data.employee.display_name,
                    email: data.employee.email,
                    role: data.employee.role || selectedEmployee.role,
                    employee_id: selectedEmployee.employee_id,
                    department: selectedEmployee.department,
                    position: selectedEmployee.position,
                });

                // Store remembered data for password verification
                setRememberedData({
                    session_token: data.session_token,
                    role: data.role,
                    user_id: data.userId,
                });

                setShowRememberedPasswordModal(true);
                setRememberedPassword('');
                setOtpSent(false);
                setShowEmployeeModal(false);

            } else {
                // User doesn't exist - show password setup modal
                setTempToken(data.tempToken);
                setHrHasPassword(data.hrHasPassword);
                setHrPassword(data.hrPassword || '');
                setSelectedEmployeeForPassword({
                    ...data.employee,
                    role: data.employee.role || selectedEmployee.role
                });
                setUseHrPassword(data.hrHasPassword);
                setShowPasswordModal(true);
                setOtpSent(false);
                setShowEmployeeModal(false);
            }
        } catch (err: any) {
            toast.error(err.message);
            setOtpError(err.message);
            setOtpCode(['', '', '', '', '', '']);
            document.getElementById('otp-0')?.focus();
        } finally {
            setIsVerifying(false);
        }
    }

    // create account
    async function handleCreateAccount() {
        if (!useHrPassword) {
            if (newPassword.length < 6) {
                toast.error('Password must be at least 6 characters');
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.error('Passwords do not match');
                return;
            }
        }

        setIsCreatingUser(true);

        try {
            const res = await fetch('/api/supplyChain/create-auth-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: selectedEmployeeForPassword.email,
                    password: newPassword,
                    displayName: selectedEmployeeForPassword.display_name,
                    role: selectedEmployeeForPassword.role,
                    tempToken: tempToken,
                    useHrPassword: useHrPassword,
                    hrPassword: useHrPassword ? hrPassword : null,
                    rememberMe: rememberMe,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Account created successfully!');

                if (data.access_token) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token || '',
                    });

                    if (sessionError) {
                        console.error('Error setting Supabase session:', sessionError);
                    } else {
                        console.log('Supabase session set successfully!');
                        const { data: { session } } = await supabase.auth.getSession();
                        console.log('User:', session?.user?.email);
                        console.log('User ID:', session?.user?.id);
                    }
                } else {
                    console.warn('No access token available for Supabase session');
                    const password = useHrPassword ? hrPassword : newPassword;
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email: selectedEmployeeForPassword.email,
                        password: password,
                    });

                    if (signInError) {
                        console.error('Fallback sign in error:', signInError);
                        toast.warning('Please login again to refresh your session');
                    } else {
                        console.log('Fallback sign in successful!');
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: signInData.session?.access_token || '',
                            refresh_token: signInData.session?.refresh_token || '',
                        });
                        if (sessionError) {
                            console.error('Error setting session:', sessionError);
                        }
                    }
                }

                localStorage.setItem('session_token', data.session_token);
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('user_name', selectedEmployeeForPassword.display_name);
                localStorage.setItem('user_email', selectedEmployeeForPassword.email);
                if (data.remember_me) {
                    localStorage.setItem('session_expires', data.expires_at);
                }

                setShowPasswordModal(false);
                setShowEmployeeModal(false);
                router.push(data.redirect_url);
            } else {
                toast.error(data.message || 'Failed to create account');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setIsCreatingUser(false);
        }
    }

    // otp input handlers
    function handleOtpChange(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpCode];
        newOtp[index] = value.slice(0, 1);
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

    // filter employees by search
    const filteredEmployees = employees.filter(emp =>
        (emp.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayedEmployees = filteredEmployees.length > 5
        ? filteredEmployees.slice(0, 5)
        : filteredEmployees;
    const remainingCount = filteredEmployees.length - 5;

    // get role color
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'Admin': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Manager': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Employee': return 'bg-green-100 text-green-700 border-green-200';
            case 'Executive': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Operator': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // close modal and cleanup
    const handleCloseModal = async () => {
        setShowEmployeeModal(false);
        await clearUserSession();
        router.push('/scAuth');
    };

    // open appeal modal
    const openAppealModal = () => {
        if (existingAppeal) {
            setAppealMessage(existingAppeal.appeal_message);
            setIsEditingAppeal(false);
        } else {
            setAppealMessage('');
            setIsEditingAppeal(false);
        }
        setShowAppealModal(true);
    };

    // loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">Checking session...</p>
                </div>
            </div>
        );
    }

    return (
        <OfflineDetector
            showToast={true}
            autoReconnect={true}
            reconnectInterval={30000}
            blurAmount={4}
        >
            <>
                <div className="h-dvh w-full bg-paper dark:bg-slate-900 text-ink dark:text-slate-100 font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px]">
                    {/* left side - branding */}
                    <div className="relative hidden lg:flex flex-col justify-between border-r border-line dark:border-slate-700 px-16 py-14 overflow-hidden">
                        <div className="absolute bottom-14 right-14 rotate-[-6deg] select-none">
                            <div className="flex items-center gap-2 rounded-full border border-line dark:border-slate-700 px-4 py-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent dark:bg-accent" />
                                <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.16em] text-muted dark:text-slate-400">
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
                                className="h-10 w-auto dark:brightness-90"
                                priority
                            />
                        </motion.div>

                        <motion.div
                            className="max-w-lg"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
                        >
                            <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent dark:text-accent">
                                Secure Access
                            </p>
                            <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight text-ink dark:text-white">
                                Supply Chain
                                <br />
                                Management
                                <br />
                                Portal
                            </h1>
                            <p className="mt-5 text-[15px] leading-relaxed text-muted dark:text-slate-400">
                                Access the supply chain management system to track inventory,
                                manage orders, and optimize logistics.
                            </p>
                        </motion.div>

                        <div className="flex items-center gap-2 text-[12px] text-muted dark:text-slate-400">
                            <span className="h-1 w-1 rounded-full bg-accent dark:bg-accent" />
                            Internal use only &middot; Airship Express Supply Chain
                        </div>
                    </div>

                    {/* right side - login form */}
                    <div className="h-dvh overflow-y-auto flex items-center justify-center px-5 py-8 sm:px-12 sm:py-16 bg-paper dark:bg-slate-900">
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
                                    className="h-8 w-auto sm:h-9 dark:brightness-90"
                                    priority
                                />
                            </div>

                            <p className="font-rethink text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.2em] text-accent dark:text-accent">
                                Welcome back
                            </p>
                            <h2 className="mt-2 sm:mt-3 font-bricolage text-[24px] sm:text-[28px] lg:text-[30px] font-medium tracking-tight text-ink dark:text-white">
                                Sign in to Supply Chain
                            </h2>
                            <p className="mt-2 sm:mt-2.5 text-[13.5px] sm:text-[14.5px] leading-relaxed text-muted dark:text-slate-400">
                                Use your company email and password.
                            </p>

                            <form
                                onSubmit={handleLogin}
                                className="mt-6 sm:mt-9 lg:mt-11 space-y-5 sm:space-y-7 lg:space-y-8"
                                noValidate
                            >
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-slate-400"
                                    >
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="mt-2 block w-full border-0 border-b border-line dark:border-slate-700 bg-transparent px-0 py-2 text-[14px] sm:text-[15px] text-ink dark:text-white placeholder:text-line dark:placeholder:text-slate-600 outline-none transition focus:border-accent dark:focus:border-accent"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-baseline justify-between">
                                        <label
                                            htmlFor="password"
                                            className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-slate-400"
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
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="mt-2 block w-full border-0 border-b border-line dark:border-slate-700 bg-transparent px-0 py-2 pr-12 text-[14px] sm:text-[15px] text-ink dark:text-white placeholder:text-line dark:placeholder:text-slate-600 outline-none transition focus:border-accent dark:focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute bottom-1.5 right-0 text-muted dark:text-slate-400 transition-colors hover:text-ink dark:hover:text-white"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={17} strokeWidth={1.75} />
                                            ) : (
                                                <Eye size={17} strokeWidth={1.75} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {loginError && (
                                    <div role="alert" className="border-l-2 border-red-500 dark:border-red-400 pl-3 text-[13px] text-red-600 dark:text-red-400">
                                        {loginError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="w-full bg-ink dark:bg-slate-700 px-4 py-3.5 text-[14px] font-medium tracking-wide text-paper dark:text-white transition-colors duration-200 hover:bg-accent dark:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isLoggingIn ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Signing in…
                                        </>
                                    ) : (
                                        'Sign in'
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200/60 dark:border-slate-700/60">
                                <p className="mt-6 sm:mt-9 lg:mt-12 text-center text-[12px] sm:text-[12.5px] text-muted dark:text-slate-400">
                                    Trouble accessing your account? Contact HR at{' '}
                                    <a
                                        href="mailto:supplychainandinventory@gmail.com"
                                        className="font-medium text-accent dark:text-accent transition-colors hover:text-accent-dark dark:hover:text-accent-dark"
                                    >
                                        supplychainandinventory@gmail.com
                                    </a>
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* employee selection modal */}
                <AnimatePresence>
                    {showEmployeeModal && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl dark:shadow-black/60"
                            >
                                {/* Header */}
                                <div className="border-b border-slate-100 dark:border-slate-800 p-6 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl transition-colors">
                                    <div className="flex items-center gap-3.5">
                                        <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100/80 dark:border-pink-900/30 shrink-0">
                                            <Building size={22} className="text-pink-500 dark:text-pink-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                                Select Employee from HR System
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    HR System Data
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseModal}
                                        className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all p-2 rounded-xl active:scale-95 cursor-pointer"
                                        title="Close"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* User Info Bar */}
                                <div className="px-6 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Logged in as:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {loggedInUser?.display_name || loggedInUser?.email}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] tracking-wide border border-transparent ${getRoleColor(loggedInUser?.role)}`}>
                                            {loggedInUser?.role}
                                        </span>
                                    </div>
                                    <span className="text-slate-400 dark:text-slate-500 hidden sm:inline-block font-medium">
                                        Select an employee to verify
                                    </span>
                                </div>

                                {isDeviceBlocked ? (
                                    // Device blocked view
                                    <div className="p-6 sm:p-8 text-center">
                                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                                            <AlertTriangle className="h-8 w-8 text-rose-500 dark:text-rose-400" />
                                        </div>

                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Device Blocked</h3>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
                                            This device has been restricted and blocked by an administrator.
                                        </p>

                                        {/* Admin Response Section */}
                                        {existingAppeal?.response_message && (
                                            <div className="mt-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 text-left shadow-2xs">
                                                <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-pink-50 dark:bg-pink-950/50 border border-pink-100 dark:border-pink-900/30 rounded-lg flex items-center justify-center text-xs font-bold text-pink-600 dark:text-pink-400">
                                                            A
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Admin Response</span>
                                                    </div>

                                                    {existingAppeal.status === 'approved' && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                                                            <CheckCircle size={12} />
                                                            Approved
                                                        </span>
                                                    )}
                                                    {existingAppeal.status === 'rejected' && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-800/40">
                                                            <AlertCircle size={12} />
                                                            Rejected
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {existingAppeal.response_message}
                                                </p>

                                                {existingAppeal.resolved_at && (
                                                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                        Resolved: {new Date(existingAppeal.resolved_at).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Pending / Submitted Status Section */}
                                        {existingAppeal && !existingAppeal.response_message && (
                                            <div className="mt-5 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/40 text-left">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                    <span className="text-xs font-bold text-amber-800 dark:text-amber-400">
                                                        Status: {existingAppeal.status === 'pending' ? 'Under Admin Review' : existingAppeal.status === 'approved' ? 'Approved' : 'Rejected'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                                                    {existingAppeal.status === 'pending' ? 'Your appeal has been logged and is waiting for review.' :
                                                        existingAppeal.status === 'approved' ? 'Appeal approved! Device access will be granted shortly.' :
                                                            'Appeal rejected. Please reach out to support for further assistance.'}
                                                </p>
                                                <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/30 text-[10px] font-medium text-amber-600/80 dark:text-amber-400/70">
                                                    Submitted: {new Date(existingAppeal.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                                            {existingAppeal ?
                                                (existingAppeal.response_message ? 'An admin has reviewed and replied to your appeal.' :
                                                    'Your appeal is currently processing.') :
                                                'If you believe this restriction is a mistake, you can submit an appeal ticket.'}
                                        </p>

                                        <button
                                            onClick={openAppealModal}
                                            className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shadow-pink-500/20 mx-auto cursor-pointer"
                                        >
                                            {existingAppeal ? (
                                                <>
                                                    <EyeIcon size={15} />
                                                    <span>{existingAppeal.response_message ? 'View Response' : 'Review Appeal'}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <MessageSquare size={15} />
                                                    <span>Submit Appeal</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : !otpSent ? (
                                    // Employee selection view
                                    <>
                                        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 transition-colors">
                                            <div className="relative">
                                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 shrink-0 pointer-events-none" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Search employee by name, ID, or email..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-500/30 focus:border-pink-500 dark:focus:border-pink-500/80 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 sm:p-4 max-h-[60vh] sm:max-h-96 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                                            {isLoadingEmployees ? (
                                                <div className="text-center py-10 sm:py-14">
                                                    <Loader2 className="animate-spin text-accent mx-auto" size={32} />
                                                    <p className="mt-2.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Fetching directory from HR system...</p>
                                                </div>
                                            ) : filteredEmployees.length === 0 ? (
                                                <div className="text-center py-10 sm:py-14 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                                                        <User size={24} />
                                                    </div>
                                                    <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">No matching employees found</p>
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search terms</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {displayedEmployees.map((emp) => {
                                                        const isSelected = selectedEmployee?.id === emp.id;
                                                        const isDisabled = isSelectionLocked || isCheckingRemembered || isDeviceBlocked;

                                                        return (
                                                            <button
                                                                key={emp.id}
                                                                onClick={() => handleEmployeeSelect(emp)}
                                                                disabled={isDisabled}
                                                                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all border duration-150 
                                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
                                            ${isSelected
                                                                        ? 'border-accent bg-accent/10 dark:bg-accent/15 dark:border-accent/60 shadow-2xs'
                                                                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-start gap-3">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                                            <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                                                                {emp.display_name}
                                                                            </span>
                                                                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                                                                                {emp.employee_id}
                                                                            </span>

                                                                            {emp.is_active && (
                                                                                <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                                                    Active
                                                                                </span>
                                                                            )}
                                                                            {!emp.is_active && emp.remembered && (
                                                                                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                                    Remembered
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{emp.email}</div>

                                                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 ${getRoleColor(emp.role)}`}>
                                                                                {emp.role}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[120px] sm:max-w-none">
                                                                                {emp.department}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[120px] sm:max-w-none">
                                                                                {emp.position}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {isSelected && (
                                                                        <div className="mt-0.5 shrink-0 bg-accent/15 dark:bg-accent/20 p-1 rounded-full text-accent">
                                                                            <CheckCircle size={18} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}

                                                    {remainingCount > 0 && (
                                                        <div className="text-center py-2.5 text-xs text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-slate-800 mt-3 font-medium">
                                                            + {remainingCount} more {remainingCount === 1 ? 'employee' : 'employees'} available
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-900/80 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                                {selectedEmployee ? (
                                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                        <CheckCircle className="text-emerald-500 dark:text-emerald-400 shrink-0" size={16} />
                                                        <span className="font-medium text-slate-600 dark:text-slate-300">Selected:</span>
                                                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[180px]">
                                                            {selectedEmployee.display_name}
                                                        </span>

                                                        {isCheckingRemembered ? (
                                                            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs">
                                                                <Loader2 className="animate-spin text-pink-500" size={13} />
                                                                <span>Checking...</span>
                                                            </div>
                                                        ) : isCurrentlyActive ? (
                                                            <span className="text-[10px] bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 px-2 py-0.5 rounded-full font-bold">
                                                                Logged In
                                                            </span>
                                                        ) : isRemembered ? (
                                                            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 px-2 py-0.5 rounded-full font-bold">
                                                                Remembered
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full font-medium">
                                                                Not remembered
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Select an employee from the HR list</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                                <button
                                                    onClick={handleCloseModal}
                                                    className="flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-center cursor-pointer"
                                                >
                                                    Cancel
                                                </button>

                                                {selectedEmployee && isCurrentlyActive ? (
                                                    <button
                                                        disabled
                                                        className="flex-1 sm:flex-initial px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                                        <span>Logged In</span>
                                                    </button>
                                                ) : selectedEmployee && isRemembered ? (
                                                    <button
                                                        onClick={handleLoginWithRemembered}
                                                        disabled={isCheckingRemembered || isDeviceBlocked}
                                                        className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                                    >
                                                        <LogIn size={15} />
                                                        <span>Login</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={requestOTP}
                                                        disabled={!selectedEmployee || isRequestingOTP || isCheckingRemembered || isDeviceBlocked}
                                                        className="flex-1 sm:flex-initial px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                                    >
                                                        {isRequestingOTP || isCheckingRemembered ? (
                                                            <>
                                                                <Loader2 className="animate-spin" size={15} />
                                                                <span>{isRequestingOTP ? 'Sending...' : 'Checking...'}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send size={15} />
                                                                <span>Send OTP</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    // OTP verification view
                                    <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
                                        <div className="text-center mb-6">
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-pink-50 dark:bg-pink-950/40 ring-1 ring-pink-500/20 dark:ring-pink-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                                                {isVerifying ? (
                                                    <Loader2 className="animate-spin text-pink-500 dark:text-pink-400" size={24} />
                                                ) : (
                                                    <Mail className="text-pink-500 dark:text-pink-400" size={24} />
                                                )}
                                            </div>
                                            <h4 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">Verify Security Code</h4>
                                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 px-2 leading-relaxed">
                                                Enter the 6-digit verification code sent to <br />
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">{selectedEmployee?.email}</span>
                                            </p>
                                            <div className="mt-2.5 inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                                    HR Employee: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedEmployee?.display_name}</span> ({selectedEmployee?.employee_id})
                                                </p>
                                            </div>
                                        </div>

                                        {otpSuccess && (
                                            <div className="mb-5 border-l-4 border-emerald-500 text-xs sm:text-[13px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 rounded-r-xl shadow-xs">
                                                <CheckCircle size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                <span>{otpSuccess}</span>
                                            </div>
                                        )}

                                        {otpError && (
                                            <div className="mb-5 border-l-4 border-rose-500 text-xs sm:text-[13px] text-rose-800 dark:text-rose-300 font-medium flex items-center gap-2.5 bg-rose-50/80 dark:bg-rose-950/40 p-3.5 rounded-r-xl shadow-xs">
                                                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                                                <span>{otpError}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-center gap-2 sm:gap-2.5 my-6">
                                            {otpCode.map((digit, index) => (
                                                <input
                                                    key={index}
                                                    id={`otp-${index}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                    onPaste={index === 0 ? handleOtpPaste : undefined}
                                                    className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-slate-50 dark:bg-slate-800/60 border-2 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all duration-200 transform focus:-translate-y-0.5 cursor-pointer 
                                ${isVerifying ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 dark:hover:border-slate-700'}
                                ${otpError
                                                            ? 'border-rose-400 dark:border-rose-500/60 text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20'
                                                            : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                                        }`}
                                                    disabled={isVerifying}
                                                    autoFocus={index === 0}
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between mb-5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                                            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all cursor-pointer bg-white dark:bg-slate-800"
                                                    disabled={isVerifying}
                                                />
                                                <span>Remember me on this device</span>
                                            </label>
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 shrink-0">
                                                {rememberMe ? '15 days' : '8 hours'}
                                            </span>
                                        </div>

                                        {countdown > 0 && (
                                            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                                                <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                                                <span>Resend available in <strong className="text-slate-800 dark:text-slate-200 font-bold">{countdown}s</strong></span>
                                            </div>
                                        )}

                                        <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    setOtpSent(false);
                                                    setOtpCode(['', '', '', '', '', '']);
                                                    setOtpError(null);
                                                    setOtpSuccess(null);
                                                    setIsRemembered(false);
                                                }}
                                                className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-center py-2 sm:py-0 active:scale-95 cursor-pointer"
                                                disabled={isVerifying}
                                            >
                                                ← Back
                                            </button>

                                            <div className="flex flex-col sm:flex-row gap-2.5">
                                                <button
                                                    onClick={resendOTP}
                                                    disabled={countdown > 0 || isResending || isVerifying || isDeviceBlocked}
                                                    className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                                >
                                                    {isResending ? (
                                                        <>
                                                            <Loader2 className="animate-spin text-slate-500 dark:text-slate-400" size={14} />
                                                            <span>Resending...</span>
                                                        </>
                                                    ) : (
                                                        <span>Resend Code</span>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={verifyOTP}
                                                    disabled={isVerifying || otpCode.join('').length !== 6 || isDeviceBlocked}
                                                    className="w-full sm:w-auto px-6 py-2.5 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                                >
                                                    {isVerifying ? (
                                                        <>
                                                            <Loader2 className="animate-spin" size={16} />
                                                            <span>Verifying...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={16} />
                                                            <span>Verify Code</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* password setup modal */}
                <AnimatePresence>
                    {showPasswordModal && selectedEmployeeForPassword && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl dark:shadow-black/60"
                            >
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 bg-accent/10 dark:bg-accent/20 ring-1 ring-accent/20 dark:ring-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                        <User className="text-accent dark:text-accent" size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Set Up Your Account</h3>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                                        Create your account to access the supply chain system
                                    </p>
                                </div>

                                <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Employee</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedEmployeeForPassword.display_name}</p>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">{selectedEmployeeForPassword.email}</p>
                                    {selectedEmployeeForPassword.employee_id && (
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">ID: {selectedEmployeeForPassword.employee_id}</p>
                                    )}
                                    {selectedEmployeeForPassword.department && (
                                        <p className="text-xs text-gray-400 dark:text-slate-500">{selectedEmployeeForPassword.department} • {selectedEmployeeForPassword.position}</p>
                                    )}
                                    <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployeeForPassword.role)}`}>
                                        {selectedEmployeeForPassword.role}
                                    </span>
                                </div>

                                {hrHasPassword && (
                                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/40">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useHrPassword}
                                                onChange={(e) => setUseHrPassword(e.target.checked)}
                                                className="mt-1 w-4 h-4 text-accent rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-accent dark:focus:ring-accent/50"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                                                    Use HR system password
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                                    Your password will be synced from the HR system
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {!useHrPassword && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                                New Password
                                            </label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                                placeholder="Enter password (min 6 characters)"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                                Confirm Password
                                            </label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                                placeholder="Confirm your password"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => {
                                            setShowPasswordModal(false);
                                            setOtpSent(true);
                                            setShowEmployeeModal(true);
                                        }}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleCreateAccount}
                                        disabled={isCreatingUser}
                                        className="flex-1 px-4 py-2.5 bg-accent dark:bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-dark dark:hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isCreatingUser ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Account'
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* remembered login password modal */}
                <AnimatePresence>
                    {showRememberedPasswordModal && selectedEmployee && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl dark:shadow-black/60"
                            >
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-800/40 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                        <LogIn className="text-emerald-600 dark:text-emerald-400" size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Login as {selectedEmployee.display_name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                                        Enter your password to continue
                                    </p>
                                </div>

                                <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Account</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedEmployee.display_name}</p>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">{selectedEmployee.email}</p>
                                    {selectedEmployee.employee_id && (
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">ID: {selectedEmployee.employee_id}</p>
                                    )}
                                    {selectedEmployee.department && (
                                        <p className="text-xs text-gray-400 dark:text-slate-500">{selectedEmployee.department} • {selectedEmployee.position}</p>
                                    )}
                                    <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployee.role)}`}>
                                        {selectedEmployee.role}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={rememberedPassword}
                                            onChange={(e) => setRememberedPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleVerifyRememberedPassword();
                                                }
                                            }}
                                            className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                            placeholder="Enter your password"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => {
                                            setShowRememberedPasswordModal(false);
                                            setRememberedPassword('');
                                        }}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleVerifyRememberedPassword}
                                        disabled={isLoggingInWithRemembered || !rememberedPassword.trim()}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoggingInWithRemembered ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                <LogIn size={16} />
                                                Login
                                            </>
                                        )}
                                    </button>
                                </div>

                                <p className="mt-3 text-center text-xs text-gray-400 dark:text-slate-500">
                                    This is a remembered session. Your password is required for security.
                                </p>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* appeal modal */}
                <AnimatePresence>
                    {showAppealModal && (
                        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl dark:shadow-black/60"
                            >
                                {/* Header */}
                                <div className="border-b border-gray-200 dark:border-slate-800 p-6 flex justify-between items-center bg-white dark:bg-slate-900 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 ring-1 ring-blue-500/10 dark:ring-blue-500/20">
                                            {existingAppeal ? <EyeIcon size={22} /> : <MessageSquare size={22} />}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                                {existingAppeal ? 'Review Appeal' : 'Submit Appeal'}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                                {existingAppeal ? 'View and manage your appeal' : 'Request to unblock your device'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowAppealModal(false);
                                            setAppealMessage('');
                                            setIsEditingAppeal(false);
                                        }}
                                        className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-4 bg-white dark:bg-slate-900 transition-colors">
                                    {existingAppeal && !isEditingAppeal ? (
                                        // View existing appeal
                                        <>
                                            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</span>
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full 
                                ${existingAppeal.status === 'pending'
                                                            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/40'
                                                            : existingAppeal.status === 'approved'
                                                                ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                                                                : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800/40'
                                                        }`}>
                                                        {existingAppeal.status.charAt(0).toUpperCase() + existingAppeal.status.slice(1)}
                                                    </span>
                                                </div>

                                                <div className="mt-2">
                                                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Your Message:</span>
                                                    <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{existingAppeal.appeal_message}</p>
                                                </div>

                                                {existingAppeal.response_message && (
                                                    <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800/40">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">A</span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Admin Response</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 dark:text-slate-300">{existingAppeal.response_message}</p>
                                                    </div>
                                                )}

                                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400 dark:text-slate-500">
                                                    <span>Submitted: {new Date(existingAppeal.created_at).toLocaleString()}</span>
                                                    {existingAppeal.resolved_at && (
                                                        <span>• Resolved: {new Date(existingAppeal.resolved_at).toLocaleString()}</span>
                                                    )}
                                                    {existingAppeal.resolved_by && (
                                                        <span>• By: {existingAppeal.resolved_by}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {existingAppeal.status === 'pending' && (
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setIsEditingAppeal(true);
                                                            setAppealMessage(existingAppeal.appeal_message);
                                                        }}
                                                        className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all flex items-center gap-2 border border-blue-200/60 dark:border-blue-800/40"
                                                    >
                                                        <Pencil size={15} />
                                                        Edit Appeal
                                                    </button>
                                                    <button
                                                        onClick={handleDeleteAppeal}
                                                        className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-all flex items-center gap-2 border border-red-200/60 dark:border-red-800/40"
                                                    >
                                                        <Trash2 size={15} />
                                                        Delete Appeal
                                                    </button>
                                                </div>
                                            )}

                                            {existingAppeal.status !== 'pending' && (
                                                <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 border border-gray-200 dark:border-slate-700 text-center">
                                                    <p className="text-sm text-gray-600 dark:text-slate-300">
                                                        {existingAppeal.status === 'approved' ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400">Your appeal has been approved!</span>
                                                        ) : (
                                                            <span className="text-red-600 dark:text-red-400">Your appeal was rejected.</span>
                                                        )}
                                                    </p>
                                                    {existingAppeal.response_message && (
                                                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                                            See the admin response above for more details.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        // Submit/edit appeal form
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                                    Appeal Message
                                                </label>
                                                <textarea
                                                    value={appealMessage}
                                                    onChange={(e) => setAppealMessage(e.target.value)}
                                                    placeholder="Explain why you believe this device should be unblocked..."
                                                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition resize-none h-32 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                                    maxLength={500}
                                                />
                                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                                    {appealMessage.length}/500 characters
                                                </p>
                                            </div>

                                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-800/40">
                                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                                    <strong>Note:</strong> Your appeal will be reviewed by an administrator. You will be notified once a decision is made.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-200 dark:border-slate-800 p-4 flex justify-end gap-3 bg-white dark:bg-slate-900 transition-colors">
                                    <button
                                        onClick={() => {
                                            setShowAppealModal(false);
                                            setAppealMessage('');
                                            setIsEditingAppeal(false);
                                        }}
                                        className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                                    >
                                        {existingAppeal && !isEditingAppeal ? 'Close' : 'Cancel'}
                                    </button>
                                    {isEditingAppeal || !existingAppeal ? (
                                        <button
                                            onClick={existingAppeal ? handleUpdateAppeal : handleSubmitAppeal}
                                            disabled={isSubmittingAppeal || !appealMessage.trim()}
                                            className="px-6 py-2 bg-accent dark:bg-accent text-white rounded-lg hover:bg-accent-dark dark:hover:bg-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {isSubmittingAppeal ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    {existingAppeal ? 'Updating...' : 'Submitting...'}
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={16} />
                                                    {existingAppeal ? 'Update Appeal' : 'Submit Appeal'}
                                                </>
                                            )}
                                        </button>
                                    ) : null}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </>
        </OfflineDetector>
    );
}