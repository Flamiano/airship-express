'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Eye,
    EyeOff,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { OfflineDetector } from '@/app/(supplyChain)/components/global/OfflineDetector';
import {
    EmployeeSelectionModal,
    PasswordSetupModal,
    RememberedPasswordModal,
    AppealModal,
} from './modals';
import {
    clearUserSession,
    checkRememberedSessionApi,
    restoreSupabaseSession,
    checkEmployeeSessionApi,
    loginSupplyChainApi,
    fetchHREmployeesApi,
    requestOtpApi,
    verifyOtpApi,
    createAuthUserApi,
    signInWithSupabasePassword,
    setSupabaseSession,
    activateSessionApi,
    checkIfDeviceBlocked,
    checkExistingAppeal,
    submitAppeal,
    updateAppeal,
    deleteAppeal,
} from './services';

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

    // fetch existing appeal when device is blocked
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

            const { data, error } = await submitAppeal({
                blockedDeviceId,
                userAgent: navigator.userAgent,
                userEmail: loggedInUser?.email || '',
                userName: loggedInUser?.display_name || 'Unknown User',
                userRole: loggedInUser?.role || 'Employee',
                appealMessage: appealMessage.trim(),
            });

            if (error) {
                toast.error('Failed to submit appeal. Please try again.');
                return;
            }

            toast.success('Appeal submitted successfully. Please wait for admin approval.');
            setShowAppealModal(false);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setExistingAppeal(data || null);
        } catch {
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
            const { error } = await updateAppeal(existingAppeal.id, appealMessage);

            if (error) {
                toast.error('Failed to update appeal. Please try again.');
                return;
            }

            toast.success('Appeal updated successfully');
            setShowAppealModal(false);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setExistingAppeal({ ...existingAppeal, appeal_message: appealMessage.trim() });
        } catch {
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
            const { error } = await deleteAppeal(existingAppeal.id);

            if (error) {
                toast.error('Failed to delete appeal. Please try again.');
                return;
            }

            toast.success('Appeal deleted successfully');
            setExistingAppeal(null);
            setAppealMessage('');
            setIsEditingAppeal(false);
            setShowAppealModal(false);
        } catch {
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
                const { ok, data } = await checkRememberedSessionApi(sessionToken);

                lastCheckRef.current = now;

                if (ok && data.remembered) {
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

                    await restoreSupabaseSession();

                    const roleRedirects: Record<string, string> = {
                        'Admin': '/executive',
                        'Manager': '/warehousing?tab=incoming',
                        'Employee': '/documents',
                        'Operator': '/warehousing?tab=incoming',
                        'Executive': '/executive',
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
    }, []);

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
            const data = await checkEmployeeSessionApi(employee.email);

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
                        user: { role: data.role || 'Employee' },
                    });
                    toast.success(`${employee.display_name} is remembered on this device`);
                } else {
                    toast.warning('Different device. Please verify with OTP.');
                    setIsRemembered(false);
                }
            } else {
                setIsRemembered(false);
            }
        } catch {
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
                const { error: signInError } = await signInWithSupabasePassword(
                    selectedEmployee.email,
                    rememberedPassword
                );

                if (signInError) {
                    toast.error('Invalid password. Please try again.');
                    setRememberedPassword('');
                    setIsLoggingInWithRemembered(false);
                    return;
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

                const { ok } = await activateSessionApi(sessionToken, currentUserAgent);

                if (!ok) {
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
            await clearUserSession();
            await new Promise(resolve => setTimeout(resolve, 500));

            const { ok, data } = await loginSupplyChainApi(email, password);

            if (!ok) {
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
        } catch {
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
            const { ok, data } = await fetchHREmployeesApi(role, userEmail);

            if (ok) {
                setEmployees(data);
            } else {
                setLoginError('Failed to load employees from HR system.');
            }
        } catch {
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

            const { ok, status, data } = await requestOtpApi({
                userId: selectedEmployee.id,
                email: selectedEmployee.email,
                loggedInUserId: loggedInUser.id,
                employeeName: selectedEmployee.display_name,
            });

            if (!ok) {
                if (status === 429) {
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

            const { ok, status, data } = await requestOtpApi({
                userId: selectedEmployee.id,
                email: selectedEmployee.email,
                loggedInUserId: loggedInUser.id,
                employeeName: selectedEmployee.display_name,
            });

            if (!ok) {
                if (status === 429) {
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

            const { ok, data } = await verifyOtpApi({
                userId: loggedInUser.id,
                otp: otpString,
                targetUserId: selectedEmployee.id,
                rememberMe: rememberMe,
                email: selectedEmployee.email,
                employeeName: selectedEmployee.display_name,
                employeeRole: selectedEmployee.role,
            });

            if (!ok) {
                throw new Error(data.message || 'Invalid OTP');
            }

            if (data.userExists) {
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
                setTempToken(data.tempToken);
                setHrHasPassword(data.hrHasPassword);
                setHrPassword(data.hrPassword || '');
                setSelectedEmployeeForPassword({
                    ...data.employee,
                    role: data.employee.role || selectedEmployee.role,
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
            const { ok, data } = await createAuthUserApi({
                email: selectedEmployeeForPassword.email,
                password: newPassword,
                displayName: selectedEmployeeForPassword.display_name,
                role: selectedEmployeeForPassword.role,
                tempToken: tempToken,
                useHrPassword: useHrPassword,
                hrPassword: useHrPassword ? hrPassword : null,
                rememberMe: rememberMe,
            });

            if (ok) {
                toast.success('Account created successfully!');

                if (data.access_token) {
                    const { error: sessionError } = await setSupabaseSession(
                        data.access_token,
                        data.refresh_token || ''
                    );

                    if (sessionError) {
                        console.error('Error setting Supabase session:', sessionError);
                    }
                } else {
                    const password = useHrPassword ? hrPassword : newPassword;
                    const { error: signInError } = await signInWithSupabasePassword(
                        selectedEmployeeForPassword.email,
                        password
                    );

                    if (signInError) {
                        console.error('Fallback sign in error:', signInError);
                        toast.warning('Please login again to refresh your session');
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
        } catch {
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
            <div className="min-h-screen flex items-center justify-center bg-paper dark:bg-ink transition-colors duration-300">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    <p className="mt-2 text-muted dark:text-paper/70">Checking session...</p>
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
                <div className="h-dvh w-full bg-paper dark:bg-ink text-ink dark:text-paper font-rethink grid grid-cols-1 lg:grid-cols-[1fr_460px] transition-colors duration-300">
                    {/* left side - branding */}
                    <div className="relative hidden lg:flex flex-col justify-between border-r border-line dark:border-paper/10 px-16 py-14 overflow-hidden">
                        <div className="absolute bottom-14 right-14 rotate-[-6deg] select-none">
                            <div className="flex items-center gap-2 rounded-full border border-line dark:border-paper/15 px-4 py-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent dark:bg-accent" />
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
                                Secure Access
                            </p>
                            <h1 className="mt-5 font-bricolage text-[44px] font-medium leading-[1.05] tracking-tight text-ink dark:text-paper">
                                Supply Chain
                                <br />
                                Management
                                <br />
                                Portal
                            </h1>
                            <p className="mt-5 text-[15px] leading-relaxed text-muted dark:text-paper/70">
                                Access the supply chain management system to track inventory,
                                manage orders, and optimize logistics.
                            </p>
                        </motion.div>

                        <div className="flex items-center gap-2 text-[12px] text-muted dark:text-paper/60">
                            <span className="h-1 w-1 rounded-full bg-accent" />
                            Internal use only &middot; Airship Express Supply Chain
                        </div>
                    </div>

                    {/* right side - login form */}
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
                                        className="block text-[11.5px] sm:text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted dark:text-paper/70"
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
                                        className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent"
                                    />
                                </div>

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
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="mt-2 block w-full border-0 border-b border-line dark:border-paper/20 bg-transparent px-0 py-2 pr-12 text-[14px] sm:text-[15px] text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 outline-none transition focus:border-accent dark:focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute bottom-1.5 right-0 text-muted dark:text-paper/60 transition-colors hover:text-ink dark:hover:text-paper cursor-pointer"
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
                                    <div role="alert" className="border-l-2 border-accent pl-3 text-[13px] text-accent">
                                        {loginError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="w-full bg-ink dark:bg-paper px-4 py-3.5 text-[14px] font-medium tracking-wide text-paper dark:text-ink transition-colors duration-200 hover:bg-accent dark:hover:bg-accent dark:hover:text-paper disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
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

                            <div className="mt-6 p-4 bg-white dark:bg-paper/5 rounded-lg border border-line dark:border-paper/10">
                                <p className="text-center text-[12px] sm:text-[12.5px] text-muted dark:text-paper/70">
                                    Trouble accessing your account? Contact HR at{' '}
                                    <a
                                        href="mailto:supplychainandinventory@gmail.com"
                                        className="font-medium text-accent hover:text-accent-dark transition-colors"
                                    >
                                        supplychainandinventory@gmail.com
                                    </a>
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* modals */}
                <EmployeeSelectionModal
                    showEmployeeModal={showEmployeeModal}
                    loggedInUser={loggedInUser}
                    employees={employees}
                    selectedEmployee={selectedEmployee}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    isLoadingEmployees={isLoadingEmployees}
                    isSelectionLocked={isSelectionLocked}
                    isCheckingRemembered={isCheckingRemembered}
                    isDeviceBlocked={isDeviceBlocked}
                    isCurrentlyActive={isCurrentlyActive}
                    isRemembered={isRemembered}
                    isRequestingOTP={isRequestingOTP}
                    isResending={isResending}
                    isVerifying={isVerifying}
                    otpSent={otpSent}
                    otpCode={otpCode}
                    otpError={otpError}
                    otpSuccess={otpSuccess}
                    rememberMe={rememberMe}
                    setRememberMe={setRememberMe}
                    countdown={countdown}
                    existingAppeal={existingAppeal}
                    blockedDeviceId={blockedDeviceId}
                    getRoleColor={getRoleColor}
                    handleEmployeeSelect={handleEmployeeSelect}
                    handleCloseModal={handleCloseModal}
                    handleLoginWithRemembered={handleLoginWithRemembered}
                    requestOTP={requestOTP}
                    resendOTP={resendOTP}
                    verifyOTP={verifyOTP}
                    handleOtpChange={handleOtpChange}
                    handleOtpKeyDown={handleOtpKeyDown}
                    handleOtpPaste={handleOtpPaste}
                    openAppealModal={openAppealModal}
                    setOtpSent={setOtpSent}
                    setOtpCode={setOtpCode}
                    setOtpError={setOtpError}
                    setOtpSuccess={setOtpSuccess}
                    setIsRemembered={setIsRemembered}
                />

                <PasswordSetupModal
                    showPasswordModal={showPasswordModal}
                    selectedEmployeeForPassword={selectedEmployeeForPassword}
                    hrHasPassword={hrHasPassword}
                    useHrPassword={useHrPassword}
                    setUseHrPassword={setUseHrPassword}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    isCreatingUser={isCreatingUser}
                    getRoleColor={getRoleColor}
                    handleCreateAccount={handleCreateAccount}
                    setShowPasswordModal={setShowPasswordModal}
                    setOtpSent={setOtpSent}
                    setShowEmployeeModal={setShowEmployeeModal}
                />

                <RememberedPasswordModal
                    showRememberedPasswordModal={showRememberedPasswordModal}
                    selectedEmployee={selectedEmployee}
                    rememberedPassword={rememberedPassword}
                    setRememberedPassword={setRememberedPassword}
                    isLoggingInWithRemembered={isLoggingInWithRemembered}
                    getRoleColor={getRoleColor}
                    handleVerifyRememberedPassword={handleVerifyRememberedPassword}
                    setShowRememberedPasswordModal={setShowRememberedPasswordModal}
                />

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
            </>
        </OfflineDetector>
    );
}
