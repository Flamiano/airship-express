'use client';

import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Building2,
    Users,
    Loader2,
    Eye,
    EyeOff,
    Pencil,
    CheckCircle2,
    XCircle,
    Star,
    Smartphone,
    ShieldCheck,
    Plus,
    History,
    CreditCard,
    Lock,
    User,
    KeyRound,
    TrendingUp,
    PieChart,
    Clock,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search as SearchInput } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { Dropdown } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Dropdown';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;
const REVEAL_STORAGE_KEY = 'hr4_bank_reveal_expiry';
const MAX_REVEAL_ATTEMPTS = 5;
const MAX_CREATE_ATTEMPTS = 3;
const REVEAL_DURATION_SECONDS = 300;
const POLL_INTERVAL_MS = 15000;

const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
};

function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return v || fallback;
}

function toArray<T>(value: any): T[] {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.data)) return value.data;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.rows)) return value.rows;
    return [];
}

function StatCard({
    icon: Icon,
    label,
    value,
    tint,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald:
            'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber:
            'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        purple:
            'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}
            >
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">
                    {label}
                </p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">
                    {value}
                </p>
            </div>
        </div>
    );
}

interface BankAccount {
    id: number;
    employee_id: string;
    employee_name: string;
    employee_id_number: string | null;
    bank_type_id: number;
    bank_type_name: string | null;
    bank_type_code: string | null;
    bank_type_category: string | null;
    account_number: string;
    account_name: string;
    is_primary: boolean;
    is_active: boolean | null;
    verified_at: string | null;
    verified_by: string | null;
    verified_by_name: string | null;
    last_modified_by: string | null;
    last_modified_by_name: string | null;
    last_modified_by_email: string | null;
    created_at: string | null;
    updated_at: string | null;
}

interface BankType {
    id: number;
    bank_code: string;
    bank_name: string;
    bank_type: 'traditional' | 'digital' | 'e_wallet';
}

interface EmployeeBankRow {
    employee_id: string;
    employee_name: string;
    employee_id_number: string;
    bank_account: any;
    has_complete_bank: boolean;
}

type BankCategoryFilter = 'all' | 'traditional' | 'digital' | 'e_wallet';

const BankDashboard = () => {
    const toast = useToast();
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [bankTypes, setBankTypes] = useState<BankType[]>([]);
    const [employees, setEmployees] = useState<EmployeeBankRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [bankCategoryFilter, setBankCategoryFilter] =
        useState<BankCategoryFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<BankAccount | null>(null);
    const [editAccountUnlocked, setEditAccountUnlocked] = useState(false);
    const [isEditUnlockModalOpen, setIsEditUnlockModalOpen] = useState(false);

    const [form, setForm] = useState({
        employee_id: '',
        bank_type_id: '',
        account_number: '',
        account_name: '',
        is_primary: false,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showAccountNumber, setShowAccountNumber] = useState(false);

    const [historyView, setHistoryView] = useState<BankAccount | null>(null);
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [revealAllActive, setRevealAllActive] = useState(false);
    const [revealTimerSeconds, setRevealTimerSeconds] = useState(0);
    const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
    const [revealPassword, setRevealPassword] = useState('');
    const [showRevealPassword, setShowRevealPassword] = useState(false);
    const [isRevealSubmitting, setIsRevealSubmitting] = useState(false);
    const [revealError, setRevealError] = useState<string | null>(null);
    const [revealAttemptsRemaining, setRevealAttemptsRemaining] = useState<
        number | null
    >(null);
    const [revealLocked, setRevealLocked] = useState(false);
    const [revealLockMinutesLeft, setRevealLockMinutesLeft] = useState<number>(0);
    const [revealStatusLoaded, setRevealStatusLoaded] = useState(false);
    const lockCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isCreateUnlockModalOpen, setIsCreateUnlockModalOpen] =
        useState(false);
    const [createPassword, setCreatePassword] = useState('');
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createAttemptsRemaining, setCreateAttemptsRemaining] = useState<
        number | null
    >(null);
    const [createLocked, setCreateLocked] = useState(false);
    const [createLockMinutesLeft, setCreateLockMinutesLeft] = useState<number>(0);
    const [createStatusLoaded, setCreateStatusLoaded] = useState(false);
    const createLockCheckRef = useRef<ReturnType<typeof setInterval> | null>(
        null
    );

    const { fetchData: fetchAccounts } = useApi(
        '/payroll-benefits-dashboard/api/bank'
    );
    const { fetchData: fetchBankTypes } = useApi(
        '/payroll-benefits-dashboard/api/bank/types'
    );
    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/bank/employee-details'
    );
    const { postData: saveBankAccount } = useApi(
        '/payroll-benefits-dashboard/api/bank'
    );
    const { postData: verifyAccount } = useApi(
        '/payroll-benefits-dashboard/api/bank/verify'
    );
    const { fetchData: fetchHistory } = useApi(
        '/payroll-benefits-dashboard/api/bank/history'
    );
    const { postData: verifyRevealPassword } = useApi(
        '/payroll-benefits-dashboard/api/bank/verify-password'
    );
    const { fetchData: fetchRevealStatus } = useApi(
        '/payroll-benefits-dashboard/api/bank/verify-password'
    );
    const { postData: verifyCreatePassword } = useApi(
        '/payroll-benefits-dashboard/api/bank/verify-create-password'
    );
    const { fetchData: fetchCreateStatus } = useApi(
        '/payroll-benefits-dashboard/api/bank/verify-create-password'
    );

    const bankTypeChartRef = useRef<HTMLCanvasElement | null>(null);
    const bankTypeChartInstanceRef = useRef<Chart | null>(null);
    const verificationChartRef = useRef<HTMLCanvasElement | null>(null);
    const verificationChartInstanceRef = useRef<Chart | null>(null);
    const timelineChartRef = useRef<HTMLCanvasElement | null>(null);
    const timelineChartInstanceRef = useRef<Chart | null>(null);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef = useRef(true);
    const isFetchingRef = useRef(false);

    const startRevealTimer = (expiresAt: number) => {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.floor((expiresAt - Date.now()) / 1000)
            );
            setRevealTimerSeconds(remaining);

            if (remaining <= 0) {
                if (revealTimerRef.current)
                    clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
                setRevealAllActive(false);
                setRevealTimerSeconds(0);
                sessionStorage.removeItem(REVEAL_STORAGE_KEY);
            }
        };

        tick();
        revealTimerRef.current = setInterval(tick, 1000);
    };

    const loadRevealStatus = useCallback(async () => {
        try {
            const data = await fetchRevealStatus();
            if (data && !Array.isArray(data)) {
                setRevealLocked(!!data.locked);
                setRevealLockMinutesLeft(data.minutesLeft || 0);
                setRevealAttemptsRemaining(
                    typeof data.remaining === 'number'
                        ? data.remaining
                        : MAX_REVEAL_ATTEMPTS
                );
            }
        } catch (error) {
            console.error('Failed to load reveal status:', error);
        } finally {
            setRevealStatusLoaded(true);
        }
    }, [fetchRevealStatus]);

    const loadCreateStatus = useCallback(async () => {
        try {
            const data = await fetchCreateStatus();
            if (data && !Array.isArray(data)) {
                setCreateLocked(!!data.locked);
                setCreateLockMinutesLeft(data.minutesLeft || 0);
                setCreateAttemptsRemaining(
                    typeof data.remaining === 'number'
                        ? data.remaining
                        : MAX_CREATE_ATTEMPTS
                );
            }
        } catch (error) {
            console.error('Failed to load create status:', error);
        } finally {
            setCreateStatusLoaded(true);
        }
    }, [fetchCreateStatus]);

    const loadData = useCallback(
        async (opts: { silent?: boolean } = {}) => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            if (!opts.silent) setLoading(true);
            else setRefreshing(true);

            try {
                const [accountsData, typesData, employeesData] =
                    await Promise.all([
                        fetchAccounts().catch((e) => {
                            console.error('fetchAccounts failed:', e);
                            return [];
                        }),
                        fetchBankTypes().catch((e) => {
                            console.error('fetchBankTypes failed:', e);
                            return [];
                        }),
                        fetchEmployees().catch((e) => {
                            console.error('fetchEmployees failed:', e);
                            return [];
                        }),
                    ]);

                if (!isMountedRef.current) return;

                setAccounts(toArray<BankAccount>(accountsData));
                setBankTypes(toArray<BankType>(typesData));
                setEmployees(toArray<EmployeeBankRow>(employeesData));
                setLastSynced(new Date());
            } catch (error: any) {
                console.error('Load error:', error);
                if (isMountedRef.current && !opts.silent) {
                    toast.showError(
                        error?.message || 'Failed to load bank data'
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
                isFetchingRef.current = false;
            }
        },
        [fetchAccounts, fetchBankTypes, fetchEmployees, toast]
    );

    useEffect(() => {
        isMountedRef.current = true;
        loadData();
        loadRevealStatus();
        loadCreateStatus();

        pollRef.current = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadData({ silent: true });
            }
        }, POLL_INTERVAL_MS);

        const onFocus = () => loadData({ silent: true });
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                loadData({ silent: true });
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            isMountedRef.current = false;
            if (pollRef.current) clearInterval(pollRef.current);
            if (revealTimerRef.current) clearInterval(revealTimerRef.current);
            if (lockCheckRef.current) clearInterval(lockCheckRef.current);
            if (createLockCheckRef.current)
                clearInterval(createLockCheckRef.current);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [loadData, loadRevealStatus, loadCreateStatus]);

    useEffect(() => {
        const stored = sessionStorage.getItem(REVEAL_STORAGE_KEY);
        if (stored) {
            const expiresAt = Number(stored);
            if (expiresAt > Date.now()) {
                setRevealAllActive(true);
                startRevealTimer(expiresAt);
            } else {
                sessionStorage.removeItem(REVEAL_STORAGE_KEY);
            }
        }
    }, []);

    useEffect(() => {
        if (!revealStatusLoaded) return;

        if (lockCheckRef.current) {
            clearInterval(lockCheckRef.current);
            lockCheckRef.current = null;
        }

        const shouldPoll =
            revealLocked ||
            (revealAttemptsRemaining !== null &&
                revealAttemptsRemaining < MAX_REVEAL_ATTEMPTS);

        if (!shouldPoll) return;

        lockCheckRef.current = setInterval(() => {
            loadRevealStatus();
        }, 30000);

        return () => {
            if (lockCheckRef.current) clearInterval(lockCheckRef.current);
        };
    }, [
        revealLocked,
        revealAttemptsRemaining,
        revealStatusLoaded,
        loadRevealStatus,
    ]);

    useEffect(() => {
        if (!createStatusLoaded) return;

        if (createLockCheckRef.current) {
            clearInterval(createLockCheckRef.current);
            createLockCheckRef.current = null;
        }

        const shouldPoll =
            createLocked ||
            (createAttemptsRemaining !== null &&
                createAttemptsRemaining < MAX_CREATE_ATTEMPTS);

        if (!shouldPoll) return;

        createLockCheckRef.current = setInterval(() => {
            loadCreateStatus();
        }, 30000);

        return () => {
            if (createLockCheckRef.current)
                clearInterval(createLockCheckRef.current);
        };
    }, [
        createLocked,
        createAttemptsRemaining,
        createStatusLoaded,
        loadCreateStatus,
    ]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!form.employee_id) errors.employee_id = 'Employee is required';
        if (!form.bank_type_id) errors.bank_type_id = 'Bank type is required';

        if (!(editTarget && !editAccountUnlocked)) {
            if (!form.account_number.trim()) {
                errors.account_number = 'Account number is required';
            } else {
                const selectedBank = bankTypes.find(
                    (b) => b.id === Number(form.bank_type_id)
                );
                const cleanNumber = form.account_number.trim().replace(/\s/g, '');
                if (selectedBank) {
                    if (selectedBank.bank_type === 'e_wallet') {
                        if (!/^09\d{9}$/.test(cleanNumber)) {
                            errors.account_number =
                                'E-wallet must be 11 digits starting with 09';
                        }
                    } else {
                        if (!/^\d{9,16}$/.test(cleanNumber)) {
                            errors.account_number =
                                'Bank account must be 9-16 digits';
                        }
                    }
                }
            }
        }

        if (!form.account_name.trim())
            errors.account_name = 'Account name is required';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAddBankClick = () => {
        setCreatePassword('');
        setCreateError(null);
        setShowCreatePassword(false);
        setIsCreateUnlockModalOpen(true);
    };

    const openCreate = () => {
        setEditTarget(null);
        setEditAccountUnlocked(false);
        setForm({
            employee_id: '',
            bank_type_id: '',
            account_number: '',
            account_name: '',
            is_primary: false,
        });
        setFormErrors({});
        setShowAccountNumber(false);
        setIsModalOpen(true);
    };

    const openEdit = (account: BankAccount) => {
        setEditTarget(account);
        setEditAccountUnlocked(false);
        setForm({
            employee_id: account.employee_id,
            bank_type_id: String(account.bank_type_id),
            account_number: '',
            account_name: account.account_name,
            is_primary: account.is_primary,
        });
        setFormErrors({});
        setShowAccountNumber(false);
        setIsModalOpen(true);
    };

    const openHistory = async (account: BankAccount) => {
        setHistoryView(account);
        setHistoryLoading(true);
        try {
            const data = await fetchHistory(
                `?employee_id=${account.employee_id}`
            );
            setHistoryEntries(toArray<any>(data));
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load history');
            setHistoryEntries([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleVerify = async (employeeId: string, verify: boolean) => {
        try {
            await verifyAccount('', { employee_id: employeeId, verify });
            toast.showSuccess(
                `Bank account ${verify ? 'verified' : 'unverified'}`
            );
            await loadData({ silent: true });
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to verify account');
        }
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        const finalAccountNumber =
            editTarget && !editAccountUnlocked
                ? editTarget.account_number
                : form.account_number.trim().replace(/\s/g, '');

        const payload = {
            employee_id: form.employee_id,
            bank_type_id: Number(form.bank_type_id),
            account_number: finalAccountNumber,
            account_name: form.account_name.trim(),
            is_primary: form.is_primary,
        };

        setIsSaving(true);
        try {
            await saveBankAccount('', payload);
            toast.showSuccess(
                editTarget ? 'Bank account updated' : 'Bank account added'
            );
            setIsModalOpen(false);
            setEditAccountUnlocked(false);
            await loadData({ silent: true });
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save bank account');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateUnlockSubmit = async () => {
        setCreateError(null);

        if (createLocked) {
            setCreateError(
                `Access locked. Try again in ${createLockMinutesLeft} minute${createLockMinutesLeft > 1 ? 's' : ''
                }.`
            );
            return;
        }

        if (!createPassword.trim()) {
            setCreateError('Please enter your password');
            return;
        }

        setIsCreateSubmitting(true);
        try {
            await verifyCreatePassword('', { password: createPassword });

            setIsCreateUnlockModalOpen(false);
            setCreatePassword('');
            setShowCreatePassword(false);
            setCreateAttemptsRemaining(MAX_CREATE_ATTEMPTS);
            setCreateLocked(false);
            setCreateLockMinutesLeft(0);

            toast.showSuccess('Verified. Opening new bank account form…');
            loadCreateStatus();

            openCreate();
        } catch (error: any) {
            const remaining = error?.remaining;
            const isLocked = error?.locked;
            const minutesLeft = error?.minutesLeft;
            const maxAttempts = error?.maxAttempts ?? MAX_CREATE_ATTEMPTS;

            if (typeof remaining === 'number') {
                setCreateAttemptsRemaining(remaining);
            } else if (
                typeof error?.status === 'number' &&
                error.status === 403 &&
                !isLocked
            ) {
                setCreateAttemptsRemaining((prev) =>
                    typeof prev === 'number'
                        ? Math.max(0, prev - 1)
                        : maxAttempts - 1
                );
            }

            if (isLocked) {
                setCreateLocked(true);
                setCreateLockMinutesLeft(minutesLeft || 60);
                setCreateAttemptsRemaining(0);
            }

            setCreateError(error?.message || 'Invalid password');
        } finally {
            setIsCreateSubmitting(false);
        }
    };

    const openRevealModal = () => {
        setRevealPassword('');
        setRevealError(null);
        setShowRevealPassword(false);
        setIsRevealModalOpen(true);
    };

    const openEditUnlockModal = () => {
        setRevealPassword('');
        setRevealError(null);
        setShowRevealPassword(false);
        setIsEditUnlockModalOpen(true);
    };

    const handleRevealSubmit = async () => {
        setRevealError(null);

        if (revealLocked) {
            setRevealError(
                `Account suspended. Try again in ${revealLockMinutesLeft} minute${revealLockMinutesLeft > 1 ? 's' : ''
                }.`
            );
            return;
        }

        if (!revealPassword.trim()) {
            setRevealError('Please enter your password');
            return;
        }

        setIsRevealSubmitting(true);
        try {
            await verifyRevealPassword('', { password: revealPassword });
            toast.showSuccess('Bank details revealed for 5 minutes');

            const expiresAt = Date.now() + REVEAL_DURATION_SECONDS * 1000;
            sessionStorage.setItem(REVEAL_STORAGE_KEY, String(expiresAt));

            setRevealAllActive(true);
            startRevealTimer(expiresAt);

            setIsRevealModalOpen(false);
            setRevealPassword('');
            setShowRevealPassword(false);
            setRevealAttemptsRemaining(MAX_REVEAL_ATTEMPTS);
            setRevealLocked(false);
            setRevealLockMinutesLeft(0);

            loadRevealStatus();
        } catch (error: any) {
            const remaining = error?.remaining;
            const isLocked = error?.locked;
            const minutesLeft = error?.minutesLeft;
            const maxAttempts = error?.maxAttempts ?? MAX_REVEAL_ATTEMPTS;

            if (typeof remaining === 'number') {
                setRevealAttemptsRemaining(remaining);
            } else if (
                typeof error?.status === 'number' &&
                error.status === 403 &&
                !isLocked
            ) {
                setRevealAttemptsRemaining((prev) =>
                    typeof prev === 'number'
                        ? Math.max(0, prev - 1)
                        : maxAttempts - 1
                );
            }

            if (isLocked) {
                setRevealLocked(true);
                setRevealLockMinutesLeft(minutesLeft || 60);
                setRevealAttemptsRemaining(0);
            }

            setRevealError(error?.message || 'Invalid password');
        } finally {
            setIsRevealSubmitting(false);
        }
    };

    const handleEditUnlockSubmit = async () => {
        setRevealError(null);

        if (revealLocked) {
            setRevealError(
                `Account suspended. Try again in ${revealLockMinutesLeft} minute${revealLockMinutesLeft > 1 ? 's' : ''
                }.`
            );
            return;
        }

        if (!revealPassword.trim()) {
            setRevealError('Please enter your password');
            return;
        }

        setIsRevealSubmitting(true);
        try {
            await verifyRevealPassword('', { password: revealPassword });

            if (editTarget) {
                setForm((f) => ({
                    ...f,
                    account_number: editTarget.account_number,
                }));
            }
            setEditAccountUnlocked(true);
            setShowAccountNumber(false);

            setIsEditUnlockModalOpen(false);
            setRevealPassword('');
            setShowRevealPassword(false);
            setRevealAttemptsRemaining(MAX_REVEAL_ATTEMPTS);
            setRevealLocked(false);
            setRevealLockMinutesLeft(0);

            toast.showSuccess('Account unlocked for editing');
            loadRevealStatus();
        } catch (error: any) {
            const remaining = error?.remaining;
            const isLocked = error?.locked;
            const minutesLeft = error?.minutesLeft;
            const maxAttempts = error?.maxAttempts ?? MAX_REVEAL_ATTEMPTS;

            if (typeof remaining === 'number') {
                setRevealAttemptsRemaining(remaining);
            } else if (
                typeof error?.status === 'number' &&
                error.status === 403 &&
                !isLocked
            ) {
                setRevealAttemptsRemaining((prev) =>
                    typeof prev === 'number'
                        ? Math.max(0, prev - 1)
                        : maxAttempts - 1
                );
            }

            if (isLocked) {
                setRevealLocked(true);
                setRevealLockMinutesLeft(minutesLeft || 60);
                setRevealAttemptsRemaining(0);
            }

            setRevealError(error?.message || 'Invalid password');
        } finally {
            setIsRevealSubmitting(false);
        }
    };

    const handleStopReveal = () => {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        setRevealAllActive(false);
        setRevealTimerSeconds(0);
        sessionStorage.removeItem(REVEAL_STORAGE_KEY);
        toast.showInfo('Bank details hidden');
    };

    const handleManualRefresh = () => {
        loadData({ silent: true });
    };

    const getBankTypeIcon = (type: string | null) => {
        if (type === 'e_wallet') return Smartphone;
        if (type === 'digital') return CreditCard;
        return Building2;
    };

    const getBankTypeColor = (type: string | null) => {
        if (type === 'e_wallet')
            return 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400';
        if (type === 'digital')
            return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400';
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400';
    };

    const filteredAccounts = useMemo<BankAccount[]>(() => {
        const source = Array.isArray(accounts) ? accounts : [];
        let result = source;

        if (bankCategoryFilter !== 'all') {
            result = result.filter(
                (a) => a.bank_type_category === bankCategoryFilter
            );
        }

        const term = searchTerm.trim().toLowerCase();
        if (term) {
            result = result.filter(
                (a) =>
                    a.employee_name?.toLowerCase().includes(term) ||
                    a.employee_id_number?.toLowerCase().includes(term) ||
                    a.bank_type_name?.toLowerCase().includes(term) ||
                    a.account_name?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [accounts, searchTerm, bankCategoryFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredAccounts.length / PAGE_SIZE)
    );

    const paginatedAccounts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredAccounts.slice(start, start + PAGE_SIZE);
    }, [filteredAccounts, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, bankCategoryFilter]);

    const verifiedCount = useMemo(
        () => accounts.filter((a) => a.verified_at).length,
        [accounts]
    );
    const eWalletCount = useMemo(
        () =>
            accounts.filter((a) => a.bank_type_category === 'e_wallet').length,
        [accounts]
    );
    const traditionalCount = useMemo(
        () =>
            accounts.filter((a) => a.bank_type_category === 'traditional')
                .length,
        [accounts]
    );
    const digitalCount = useMemo(
        () => accounts.filter((a) => a.bank_type_category === 'digital').length,
        [accounts]
    );
    const pendingCount = useMemo(
        () => accounts.filter((a) => !a.verified_at).length,
        [accounts]
    );

    const bankCategoryOptions = useMemo(
        () => [
            { label: `All Types (${accounts.length})`, value: 'all' },
            {
                label: `Traditional (${traditionalCount})`,
                value: 'traditional',
            },
            { label: `Digital (${digitalCount})`, value: 'digital' },
            { label: `E-Wallet (${eWalletCount})`, value: 'e_wallet' },
        ],
        [accounts.length, traditionalCount, digitalCount, eWalletCount]
    );

    const hasActiveFilters =
        searchTerm.trim() !== '' || bankCategoryFilter !== 'all';

    const clearFilters = () => {
        setSearchTerm('');
        setBankCategoryFilter('all');
    };

    useEffect(() => {
        if (loading || !bankTypeChartRef.current || accounts.length === 0) return;
        bankTypeChartInstanceRef.current?.destroy();
        bankTypeChartInstanceRef.current = new Chart(bankTypeChartRef.current, {
            type: 'doughnut',
            data: {
                labels: ['Traditional Banks', 'Digital Banks', 'E-Wallets'],
                datasets: [
                    {
                        data: [traditionalCount, digitalCount, eWalletCount],
                        backgroundColor: [
                            cssVar('--sss', '#2455c7'),
                            cssVar('--accent', '#e5167e'),
                            cssVar('--pagibig', '#b8720e'),
                        ],
                        borderWidth: 2,
                        borderColor: cssVar('--paper', '#fcfbf9'),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 11, family: 'rethink' },
                            color: cssVar('--ink', '#1c1b1f'),
                        },
                    },
                },
            },
        });
        return () => {
            bankTypeChartInstanceRef.current?.destroy();
        };
    }, [accounts, traditionalCount, digitalCount, eWalletCount, loading]);

    useEffect(() => {
        if (loading || !verificationChartRef.current || accounts.length === 0)
            return;
        verificationChartInstanceRef.current?.destroy();
        verificationChartInstanceRef.current = new Chart(
            verificationChartRef.current,
            {
                type: 'doughnut',
                data: {
                    labels: ['Verified', 'Pending'],
                    datasets: [
                        {
                            data: [verifiedCount, pendingCount],
                            backgroundColor: [
                                cssVar('--philhealth', '#0b8f6b'),
                                '#f59e0b',
                            ],
                            borderWidth: 2,
                            borderColor: cssVar('--paper', '#fcfbf9'),
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 10,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: { size: 11, family: 'rethink' },
                                color: cssVar('--ink', '#1c1b1f'),
                            },
                        },
                    },
                },
            }
        );
        return () => {
            verificationChartInstanceRef.current?.destroy();
        };
    }, [accounts, verifiedCount, pendingCount, loading]);

    useEffect(() => {
        if (loading || !timelineChartRef.current || accounts.length === 0) return;
        timelineChartInstanceRef.current?.destroy();

        const monthCounts: Record<string, number> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
            });
            monthCounts[key] = 0;
        }
        accounts.forEach((a) => {
            if (!a.created_at) return;
            const d = new Date(a.created_at);
            const key = d.toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
            });
            if (key in monthCounts) monthCounts[key] += 1;
        });

        timelineChartInstanceRef.current = new Chart(timelineChartRef.current, {
            type: 'line',
            data: {
                labels: Object.keys(monthCounts),
                datasets: [
                    {
                        label: 'Accounts Added',
                        data: Object.values(monthCounts),
                        borderColor: cssVar('--accent', '#e5167e'),
                        backgroundColor: cssVar('--accent', '#e5167e') + '20',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: cssVar('--accent', '#e5167e'),
                        pointBorderColor: cssVar('--paper', '#fcfbf9'),
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: {
                            color: cssVar('--muted', '#6b6b76'),
                            font: { size: 10 },
                        },
                        grid: { display: false },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: cssVar('--muted', '#6b6b76'),
                            font: { size: 10 },
                        },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                },
            },
        });
        return () => {
            timelineChartInstanceRef.current?.destroy();
        };
    }, [accounts, loading]);

    const isEwalletSelected = useMemo(() => {
        if (!form.bank_type_id) return false;
        const selected = bankTypes.find(
            (b) => b.id === Number(form.bank_type_id)
        );
        return selected?.bank_type === 'e_wallet';
    }, [form.bank_type_id, bankTypes]);

    const isBankTypeSelected = useMemo(
        () => !!form.bank_type_id,
        [form.bank_type_id]
    );

    const maxAccountNumberLength = isEwalletSelected ? 11 : 16;

    const PHFlag = () => (
        <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">🇵🇭</span>
            <span className="text-xs font-medium text-muted">+63</span>
        </div>
    );

    const formatTimer = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const formatLockTimer = (minutes: number) => {
        if (minutes <= 0) return '0 minute';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`;
        return `${h}h ${m}m`;
    };

    const formatSyncTime = (d: Date | null) => {
        if (!d) return '—';
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 5) return 'just now';
        if (diff < 60) return `${diff}s ago`;
        const m = Math.floor(diff / 60);
        if (m < 60) return `${m}m ago`;
        return d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const revealButtonLabel = revealLocked
        ? `Suspended · ${formatLockTimer(revealLockMinutesLeft)}`
        : 'View All Numbers';

    const revealButtonClass = revealLocked
        ? 'w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg border-red-300 bg-red-50 text-red-700 hover:bg-red-50 cursor-not-allowed dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400'
        : 'w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg';

    const addBankButtonLabel = createLocked
        ? `Suspended · ${formatLockTimer(createLockMinutesLeft)}`
        : 'Add Bank Account';

    const addBankButtonClass = createLocked
        ? 'w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg border-red-300 bg-red-50 text-red-700 hover:bg-red-50 cursor-not-allowed dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400'
        : 'w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all';

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line dark:border-line/30">
                        <Building2 className="h-4.5 w-4.5 text-muted" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold font-bricolage text-ink">
                            Bank Account Management
                        </h1>
                        <p className="mt-0.5 text-sm text-muted font-rethink">
                            Manage employee bank accounts and e-wallet details for
                            payroll disbursement.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="hidden sm:flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted hover:text-ink hover:bg-ink/[0.03] transition-colors font-rethink disabled:opacity-60"
                    title="Refresh data"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                    />
                    <span>
                        {refreshing
                            ? 'Syncing…'
                            : `Synced ${formatSyncTime(lastSynced)}`}
                    </span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    icon={Users}
                    label="Total Accounts"
                    value={String(accounts.length)}
                    tint="blue"
                />
                <StatCard
                    icon={ShieldCheck}
                    label="Verified"
                    value={String(verifiedCount)}
                    tint="emerald"
                />
                <StatCard
                    icon={Building2}
                    label="Traditional Banks"
                    value={String(traditionalCount)}
                    tint="purple"
                />
                <StatCard
                    icon={Smartphone}
                    label="E-Wallets"
                    value={String(eWalletCount)}
                    tint="amber"
                />
            </div>

            {!loading && accounts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card
                        variant="default"
                        padding="none"
                        className="bg-paper border-line overflow-hidden dark:border-line/30"
                    >
                        <CardBody className="p-4 sm:p-5">
                            <div className="flex items-center gap-1.5 mb-3">
                                <PieChart className="h-3.5 w-3.5 text-accent" />
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    Bank Type Distribution
                                </p>
                            </div>
                            <div className="h-48">
                                <canvas ref={bankTypeChartRef} />
                            </div>
                        </CardBody>
                    </Card>

                    <Card
                        variant="default"
                        padding="none"
                        className="bg-paper border-line overflow-hidden dark:border-line/30"
                    >
                        <CardBody className="p-4 sm:p-5">
                            <div className="flex items-center gap-1.5 mb-3">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    Verification Status
                                </p>
                            </div>
                            <div className="h-48">
                                <canvas ref={verificationChartRef} />
                            </div>
                        </CardBody>
                    </Card>

                    <Card
                        variant="default"
                        padding="none"
                        className="bg-paper border-line overflow-hidden dark:border-line/30"
                    >
                        <CardBody className="p-4 sm:p-5">
                            <div className="flex items-center gap-1.5 mb-3">
                                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    Added (Last 6 Months)
                                </p>
                            </div>
                            <div className="h-48">
                                <canvas ref={timelineChartRef} />
                            </div>
                        </CardBody>
                    </Card>
                </div>
            )}

            {revealLocked && (
                <div className="flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300 font-rethink">
                            Bank number viewing is suspended
                        </p>
                        <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink leading-snug mt-0.5">
                            Due to multiple failed attempts, access is suspended
                            for{' '}
                            <strong>
                                {formatLockTimer(revealLockMinutesLeft)}
                            </strong>
                            . This will automatically lift once the timer ends.
                        </p>
                    </div>
                </div>
            )}

            {createLocked && (
                <div className="flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300 font-rethink">
                            Bank account creation is suspended
                        </p>
                        <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink leading-snug mt-0.5">
                            Too many failed password attempts. Creating new bank
                            accounts is locked for{' '}
                            <strong>
                                {formatLockTimer(createLockMinutesLeft)}
                            </strong>
                            .
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 min-w-0">
                        <SearchInput
                            placeholder="Search by employee, bank, or account name..."
                            onSearch={setSearchTerm}
                            className="w-full"
                        />
                    </div>

                    <div className="w-full lg:w-[200px] shrink-0">
                        <Dropdown
                            items={bankCategoryOptions}
                            value={bankCategoryFilter}
                            onChange={(val) =>
                                setBankCategoryFilter(
                                    val as BankCategoryFilter
                                )
                            }
                            placeholder="All Types"
                            searchable={false}
                        />
                    </div>

                    {hasActiveFilters && (
                        <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="w-full lg:w-auto shrink-0 font-rethink text-sm h-[42px] px-3 rounded-lg border-line text-muted hover:text-ink"
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-2">
                    {revealAllActive ? (
                        <Button
                            variant="outline"
                            onClick={handleStopReveal}
                            className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                        >
                            <span className="flex flex-row items-center justify-center gap-2">
                                <EyeOff className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap leading-none">
                                    Hide Numbers ·{' '}
                                    {formatTimer(revealTimerSeconds)}
                                </span>
                            </span>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={
                                revealLocked ? undefined : openRevealModal
                            }
                            disabled={revealLocked}
                            className={revealButtonClass}
                        >
                            <span className="flex flex-row items-center justify-center gap-2">
                                {revealLocked ? (
                                    <Clock className="h-4 w-4 shrink-0" />
                                ) : (
                                    <KeyRound className="h-4 w-4 shrink-0" />
                                )}
                                <span className="whitespace-nowrap leading-none">
                                    {revealButtonLabel}
                                </span>
                            </span>
                        </Button>
                    )}

                    <Button
                        onClick={handleAddBankClick}
                        disabled={false}
                        className={addBankButtonClass}
                    >
                        <span className="flex flex-row items-center justify-center gap-2 w-full">
                            {createLocked ? (
                                <Lock className="h-4 w-4 shrink-0" />
                            ) : (
                                <Plus className="h-4 w-4 shrink-0" />
                            )}
                            <span className="whitespace-nowrap leading-none">
                                {addBankButtonLabel}
                            </span>
                        </span>
                    </Button>
                </div>
            </div>

            {revealAllActive && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/30">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 font-rethink">
                        Account numbers are visible. This view will automatically
                        lock in{' '}
                        <strong>{formatTimer(revealTimerSeconds)}</strong>.
                    </p>
                </div>
            )}

            <Card
                variant="default"
                padding="none"
                className="bg-paper border-line overflow-hidden dark:border-line/30"
            >
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading bank accounts…
                    </div>
                ) : accounts.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message="No bank accounts set up yet. Add an employee's bank account to get started."
                        />
                    </CardBody>
                ) : filteredAccounts.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message="No accounts match your search or filter."
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                            Employee
                                        </th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">
                                            Bank / E-Wallet
                                        </th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                            Account Holder
                                        </th>
                                        {revealAllActive && (
                                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-rethink">
                                                <span className="inline-flex items-center gap-1">
                                                    <Lock className="h-2.5 w-2.5" />
                                                    Account Number
                                                </span>
                                            </th>
                                        )}
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">
                                            Last Modified
                                        </th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                            Status
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedAccounts.map((account) => {
                                            const Icon = getBankTypeIcon(
                                                account.bank_type_category
                                            );
                                            const colorClass = getBankTypeColor(
                                                account.bank_type_category
                                            );

                                            return (
                                                <motion.tr
                                                    key={account.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                                >
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                                                                <span className="text-xs font-semibold font-mono">
                                                                    {account.employee_name?.charAt(
                                                                        0
                                                                    ) || '?'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="text-[13px] font-medium text-ink font-rethink">
                                                                    {account.employee_name}
                                                                </p>
                                                                <p className="text-[10px] text-muted font-rethink">
                                                                    {account.employee_id_number}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                                                            >
                                                                <Icon className="h-3.5 w-3.5" />
                                                            </span>
                                                            <div>
                                                                <p className="text-[12px] font-medium text-ink font-rethink">
                                                                    {account.bank_type_name}
                                                                </p>
                                                                <p className="text-[9px] text-muted font-rethink uppercase">
                                                                    {account.bank_type_category}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-medium text-ink font-rethink truncate">
                                                                {account.account_name}
                                                            </p>
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                {account.is_primary
                                                                    ? 'Primary account'
                                                                    : 'Secondary account'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    {revealAllActive && (
                                                        <td className="px-3 py-3">
                                                            <p className="text-[12px] font-mono text-amber-700 dark:text-amber-300 select-all">
                                                                {account.account_number}
                                                            </p>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-3 hidden lg:table-cell">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <User className="h-3 w-3 text-muted shrink-0" />
                                                                <span className="text-[10px] font-medium text-ink font-rethink truncate">
                                                                    {account.last_modified_by_name ||
                                                                        'System'}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] text-muted font-rethink">
                                                                {formatDateTime(
                                                                    account.updated_at
                                                                )}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            {account.verified_at ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Verified
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-600 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-400">
                                                                    <XCircle className="h-3 w-3" />
                                                                    Pending
                                                                </span>
                                                            )}
                                                            {account.is_primary && (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-600 dark:border-blue-800/30 dark:bg-blue-950/30 dark:text-blue-400">
                                                                    <Star className="h-3 w-3" />
                                                                    Primary
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() =>
                                                                    openHistory(
                                                                        account
                                                                    )
                                                                }
                                                                className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                                aria-label="View history"
                                                                title="View history"
                                                            >
                                                                <History className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleVerify(
                                                                        account.employee_id,
                                                                        !account.verified_at
                                                                    )
                                                                }
                                                                className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${account.verified_at
                                                                    ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-400'
                                                                    : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                    }`}
                                                                aria-label={
                                                                    account.verified_at
                                                                        ? 'Unverify'
                                                                        : 'Verify'
                                                                }
                                                                title={
                                                                    account.verified_at
                                                                        ? 'Unverify'
                                                                        : 'Verify'
                                                                }
                                                            >
                                                                {account.verified_at ? (
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    openEdit(
                                                                        account
                                                                    )
                                                                }
                                                                className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                                aria-label="Edit"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredAccounts.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isCreateUnlockModalOpen && (
                <Modal
                    isOpen={isCreateUnlockModalOpen}
                    onClose={() => {
                        setIsCreateUnlockModalOpen(false);
                        setCreatePassword('');
                        setCreateError(null);
                        setShowCreatePassword(false);
                    }}
                    title="Confirm Password to Add Account"
                    className="max-w-md"
                    accent="pink"
                    icon={KeyRound}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsCreateUnlockModalOpen(false);
                                    setCreatePassword('');
                                    setCreateError(null);
                                }}
                                disabled={isCreateSubmitting}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleCreateUnlockSubmit}
                                disabled={isCreateSubmitting || createLocked}
                                className="font-rethink"
                            >
                                {isCreateSubmitting
                                    ? 'Verifying…'
                                    : createLocked
                                        ? `Suspended · ${formatLockTimer(
                                            createLockMinutesLeft
                                        )}`
                                        : 'Continue to Form'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-lg border border-pink-200/60 bg-pink-50/50 px-3 py-2.5 dark:border-pink-800/30 dark:bg-pink-950/30">
                            <Lock className="h-4 w-4 shrink-0 text-pink-600 mt-0.5 dark:text-pink-400" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-pink-800 dark:text-pink-300 font-rethink">
                                    Admin verification required
                                </p>
                                <p className="text-[11px] text-pink-700/80 dark:text-pink-400/80 font-rethink leading-snug mt-0.5">
                                    Adding a bank account requires your admin
                                    password. You have <strong>3 attempts</strong>.
                                    Hitting the limit locks creation for 60
                                    minutes across all your sessions.
                                </p>
                            </div>
                        </div>

                        {createLocked && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 font-rethink">
                                        Creation locked
                                    </p>
                                    <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink leading-snug mt-0.5">
                                        Try again in{' '}
                                        <strong>
                                            {formatLockTimer(
                                                createLockMinutesLeft
                                            )}
                                        </strong>
                                        .
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Your Admin Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={
                                        showCreatePassword ? 'text' : 'password'
                                    }
                                    value={createPassword}
                                    onChange={(e) => {
                                        setCreatePassword(e.target.value);
                                        if (createError) setCreateError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' &&
                                            !isCreateSubmitting &&
                                            !createLocked
                                        ) {
                                            handleCreateUnlockSubmit();
                                        }
                                    }}
                                    placeholder={
                                        createLocked
                                            ? 'Input disabled during suspension'
                                            : 'Enter your password'
                                    }
                                    className={`pr-10 font-rethink ${createLocked
                                        ? 'opacity-60 cursor-not-allowed'
                                        : ''
                                        }`}
                                    autoFocus={!createLocked}
                                    disabled={createLocked}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowCreatePassword((v) => !v)
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ink/5 text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={
                                        showCreatePassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    disabled={createLocked}
                                >
                                    {showCreatePassword ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </div>

                            {createAttemptsRemaining !== null &&
                                createAttemptsRemaining > 0 &&
                                !createLocked && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <div className="flex gap-0.5">
                                            {Array.from({
                                                length: MAX_CREATE_ATTEMPTS,
                                            }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`h-1.5 w-4 rounded-full ${i <
                                                        createAttemptsRemaining
                                                        ? 'bg-pink-400'
                                                        : 'bg-red-400'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-rethink text-red-500">
                                            {createAttemptsRemaining} of{' '}
                                            {MAX_CREATE_ATTEMPTS} attempts
                                            remaining
                                        </p>
                                    </div>
                                )}

                            {createError && (
                                <p className="mt-2 text-xs text-red-500 font-rethink">
                                    {createError}
                                </p>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditAccountUnlocked(false);
                    }}
                    title={editTarget ? 'Edit Bank Account' : 'Add Bank Account'}
                    className="max-w-lg"
                    accent="pink"
                    icon={Building2}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditAccountUnlocked(false);
                                }}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                {isSaving
                                    ? 'Saving…'
                                    : editTarget
                                        ? 'Save Changes'
                                        : 'Add Account'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Employee <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.employee_id}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        employee_id: e.target.value,
                                    }))
                                }
                                disabled={!!editTarget}
                                className={`w-full rounded-lg border ${formErrors.employee_id
                                    ? 'border-red-500'
                                    : 'border-line'
                                    } bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 ${editTarget
                                        ? 'opacity-60 cursor-not-allowed'
                                        : ''
                                    }`}
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp) => (
                                    <option
                                        key={emp.employee_id}
                                        value={emp.employee_id}
                                    >
                                        {emp.employee_name}
                                        {emp.employee_id_number
                                            ? ` (${emp.employee_id_number})`
                                            : ''}
                                        {emp.has_complete_bank ? ' ✓' : ''}
                                    </option>
                                ))}
                            </select>
                            {formErrors.employee_id && (
                                <p className="mt-1 text-xs text-red-500">
                                    {formErrors.employee_id}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Bank / E-Wallet{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.bank_type_id}
                                onChange={(e) => {
                                    setForm((f) => ({
                                        ...f,
                                        bank_type_id: e.target.value,
                                        account_number: '',
                                    }));
                                    setShowAccountNumber(false);
                                    if (formErrors.bank_type_id) {
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            bank_type_id: '',
                                        }));
                                    }
                                }}
                                className={`w-full rounded-lg border ${formErrors.bank_type_id
                                    ? 'border-red-500'
                                    : 'border-line'
                                    } bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30`}
                            >
                                <option value="">Select bank type…</option>
                                {bankTypes.map((bank) => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.bank_name} ({bank.bank_type})
                                    </option>
                                ))}
                            </select>
                            {formErrors.bank_type_id && (
                                <p className="mt-1 text-xs text-red-500">
                                    {formErrors.bank_type_id}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                {isEwalletSelected
                                    ? 'E-Wallet Number'
                                    : 'Account Number'}{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            {editTarget && !editAccountUnlocked ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 rounded-lg border border-line bg-ink/[0.03] px-3 py-2.5 dark:border-line/30 dark:bg-ink/10">
                                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />
                                        <span className="font-mono text-sm text-muted tracking-widest select-none">
                                            {isEwalletSelected
                                                ? '•••••••••••'
                                                : '••••••••••••••'}
                                        </span>
                                        <span className="ml-auto text-[10px] text-muted font-rethink">
                                            Hidden
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={openEditUnlockModal}
                                        disabled={revealLocked}
                                        leftIcon={
                                            <KeyRound className="h-3.5 w-3.5" />
                                        }
                                        className={`w-full font-rethink ${revealLocked
                                            ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400 cursor-not-allowed'
                                            : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400'
                                            }`}
                                    >
                                        {revealLocked
                                            ? `Suspended · ${formatLockTimer(
                                                revealLockMinutesLeft
                                            )}`
                                            : 'Unlock to edit account number'}
                                    </Button>
                                    <p className="text-[10px] text-muted font-rethink leading-snug">
                                        For security, the account number is
                                        hidden. Verify your password to reveal
                                        and edit it. The current number will be
                                        kept if you don't unlock.
                                    </p>
                                </div>
                            ) : (
                                <div className="relative">
                                    {isEwalletSelected && isBankTypeSelected && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                            <PHFlag />
                                        </div>
                                    )}
                                    <Input
                                        type={
                                            showAccountNumber
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={form.account_number}
                                        onChange={(e) => {
                                            const value =
                                                e.target.value.replace(
                                                    /\D/g,
                                                    ''
                                                );
                                            setForm((f) => ({
                                                ...f,
                                                account_number: value,
                                            }));
                                            if (formErrors.account_number) {
                                                setFormErrors((prev) => ({
                                                    ...prev,
                                                    account_number: '',
                                                }));
                                            }
                                        }}
                                        placeholder={
                                            !isBankTypeSelected
                                                ? 'Select bank type first'
                                                : isEwalletSelected
                                                    ? '9123456789'
                                                    : 'Enter account number'
                                        }
                                        disabled={!isBankTypeSelected}
                                        className={`${isEwalletSelected &&
                                            isBankTypeSelected
                                            ? 'pl-[82px]'
                                            : 'pl-3'
                                            } pr-10 font-mono ${formErrors.account_number
                                                ? 'border-red-500'
                                                : ''
                                            } ${!isBankTypeSelected
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                            }`}
                                        maxLength={maxAccountNumberLength}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowAccountNumber((v) => !v)
                                        }
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ink/5 text-muted hover:text-ink transition-colors z-10"
                                        aria-label={
                                            showAccountNumber
                                                ? 'Hide account number'
                                                : 'Show account number'
                                        }
                                        disabled={!isBankTypeSelected}
                                    >
                                        {showAccountNumber ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {formErrors.account_number && (
                                <p className="mt-1 text-xs text-red-500">
                                    {formErrors.account_number}
                                </p>
                            )}
                            {isBankTypeSelected &&
                                !formErrors.account_number &&
                                (editAccountUnlocked || !editTarget) && (
                                    <p className="mt-1 text-[10px] text-muted font-rethink">
                                        {isEwalletSelected
                                            ? 'Enter the 11-digit mobile number (e.g., 9123456789)'
                                            : 'Enter the 9-16 digit bank account number'}
                                    </p>
                                )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Account Name{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                value={form.account_name}
                                onChange={(e) => {
                                    setForm((f) => ({
                                        ...f,
                                        account_name: e.target.value,
                                    }));
                                    if (formErrors.account_name) {
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            account_name: '',
                                        }));
                                    }
                                }}
                                placeholder={
                                    !isBankTypeSelected
                                        ? 'Select bank type first'
                                        : 'e.g. Juan Dela Cruz'
                                }
                                className={`${formErrors.account_name
                                    ? 'border-red-500'
                                    : ''
                                    }`}
                            />
                            {formErrors.account_name && (
                                <p className="mt-1 text-xs text-red-500">
                                    {formErrors.account_name}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">
                                Set as Primary Account
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setForm((f) => ({
                                        ...f,
                                        is_primary: !f.is_primary,
                                    }))
                                }
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                                style={{
                                    backgroundColor: form.is_primary
                                        ? '#e5167e'
                                        : '#d1d5db',
                                }}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${form.is_primary
                                        ? 'translate-x-5'
                                        : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isRevealModalOpen && (
                <Modal
                    isOpen={isRevealModalOpen}
                    onClose={() => {
                        setIsRevealModalOpen(false);
                        setRevealPassword('');
                        setRevealError(null);
                        setShowRevealPassword(false);
                    }}
                    title="Confirm Your Password"
                    className="max-w-md"
                    accent="amber"
                    icon={Lock}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsRevealModalOpen(false);
                                    setRevealPassword('');
                                    setRevealError(null);
                                }}
                                disabled={isRevealSubmitting}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleRevealSubmit}
                                disabled={isRevealSubmitting || revealLocked}
                                className="font-rethink"
                            >
                                {isRevealSubmitting
                                    ? 'Verifying…'
                                    : revealLocked
                                        ? `Suspended · ${formatLockTimer(
                                            revealLockMinutesLeft
                                        )}`
                                        : 'Reveal for 5 minutes'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-800/30 dark:bg-amber-950/30">
                            <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 dark:text-amber-400" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 font-rethink">
                                    Security verification
                                </p>
                                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-rethink leading-snug mt-0.5">
                                    Enter your password to reveal all bank account numbers for{' '}
                                    <strong>5 minutes</strong>. After 5 wrong attempts, reveal access
                                    is locked for <strong>60 minutes</strong>.
                                </p>
                            </div>
                        </div>

                        {revealLocked && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 font-rethink">
                                        Account suspended
                                    </p>
                                    <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink leading-snug mt-0.5">
                                        Too many failed attempts. Try again in{' '}
                                        <strong>
                                            {formatLockTimer(
                                                revealLockMinutesLeft
                                            )}
                                        </strong>
                                        .
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Your Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={
                                        showRevealPassword ? 'text' : 'password'
                                    }
                                    value={revealPassword}
                                    onChange={(e) => {
                                        setRevealPassword(e.target.value);
                                        if (revealError) setRevealError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' &&
                                            !isRevealSubmitting &&
                                            !revealLocked
                                        ) {
                                            handleRevealSubmit();
                                        }
                                    }}
                                    placeholder={
                                        revealLocked
                                            ? 'Input disabled during suspension'
                                            : 'Enter your password'
                                    }
                                    className={`pr-10 font-rethink ${revealLocked
                                        ? 'opacity-60 cursor-not-allowed'
                                        : ''
                                        }`}
                                    autoFocus={!revealLocked}
                                    disabled={revealLocked}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowRevealPassword((v) => !v)
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ink/5 text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={
                                        showRevealPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    disabled={revealLocked}
                                >
                                    {showRevealPassword ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </div>

                            {revealAttemptsRemaining !== null &&
                                revealAttemptsRemaining > 0 &&
                                !revealLocked && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <div className="flex gap-0.5">
                                            {Array.from({
                                                length: MAX_REVEAL_ATTEMPTS,
                                            }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`h-1.5 w-4 rounded-full ${i <
                                                        revealAttemptsRemaining
                                                        ? 'bg-amber-400'
                                                        : 'bg-red-400'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-rethink text-red-500">
                                            {revealAttemptsRemaining} of{' '}
                                            {MAX_REVEAL_ATTEMPTS} attempts
                                            remaining
                                        </p>
                                    </div>
                                )}

                            {revealError && (
                                <p className="mt-2 text-xs text-red-500 font-rethink">
                                    {revealError}
                                </p>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {isEditUnlockModalOpen && (
                <Modal
                    isOpen={isEditUnlockModalOpen}
                    onClose={() => {
                        setIsEditUnlockModalOpen(false);
                        setRevealPassword('');
                        setRevealError(null);
                        setShowRevealPassword(false);
                    }}
                    title="Unlock Account Number"
                    className="max-w-md"
                    accent="amber"
                    icon={KeyRound}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditUnlockModalOpen(false);
                                    setRevealPassword('');
                                    setRevealError(null);
                                }}
                                disabled={isRevealSubmitting}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleEditUnlockSubmit}
                                disabled={isRevealSubmitting || revealLocked}
                                className="font-rethink"
                            >
                                {isRevealSubmitting
                                    ? 'Verifying…'
                                    : revealLocked
                                        ? `Suspended · ${formatLockTimer(
                                            revealLockMinutesLeft
                                        )}`
                                        : 'Unlock to Edit'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-800/30 dark:bg-amber-950/30">
                            <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 dark:text-amber-400" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 font-rethink">
                                    Unlock to edit account number
                                </p>
                                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-rethink leading-snug mt-0.5">
                                    Confirm your password to reveal and edit
                                    this employee's account number.
                                </p>
                            </div>
                        </div>

                        {revealLocked && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 font-rethink">
                                        Account suspended
                                    </p>
                                    <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink leading-snug mt-0.5">
                                        Too many failed attempts. Try again in{' '}
                                        <strong>
                                            {formatLockTimer(
                                                revealLockMinutesLeft
                                            )}
                                        </strong>
                                        .
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Your Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={
                                        showRevealPassword ? 'text' : 'password'
                                    }
                                    value={revealPassword}
                                    onChange={(e) => {
                                        setRevealPassword(e.target.value);
                                        if (revealError) setRevealError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' &&
                                            !isRevealSubmitting &&
                                            !revealLocked
                                        ) {
                                            handleEditUnlockSubmit();
                                        }
                                    }}
                                    placeholder={
                                        revealLocked
                                            ? 'Input disabled during suspension'
                                            : 'Enter your password'
                                    }
                                    className={`pr-10 font-rethink ${revealLocked
                                        ? 'opacity-60 cursor-not-allowed'
                                        : ''
                                        }`}
                                    autoFocus={!revealLocked}
                                    disabled={revealLocked}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowRevealPassword((v) => !v)
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ink/5 text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={
                                        showRevealPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    disabled={revealLocked}
                                >
                                    {showRevealPassword ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </div>

                            {revealAttemptsRemaining !== null &&
                                revealAttemptsRemaining > 0 &&
                                !revealLocked && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <div className="flex gap-0.5">
                                            {Array.from({
                                                length: MAX_REVEAL_ATTEMPTS,
                                            }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`h-1.5 w-4 rounded-full ${i <
                                                        revealAttemptsRemaining
                                                        ? 'bg-amber-400'
                                                        : 'bg-red-400'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-rethink text-red-500">
                                            {revealAttemptsRemaining} of{' '}
                                            {MAX_REVEAL_ATTEMPTS} attempts
                                            remaining
                                        </p>
                                    </div>
                                )}

                            {revealError && (
                                <p className="mt-2 text-xs text-red-500 font-rethink">
                                    {revealError}
                                </p>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {historyView && (
                <Modal
                    isOpen={!!historyView}
                    onClose={() => setHistoryView(null)}
                    title={`Bank History — ${historyView.employee_name}`}
                    className="max-w-2xl"
                    accent="blue"
                    icon={History}
                >
                    <div className="space-y-4">
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted" />
                            </div>
                        ) : historyEntries.length === 0 ? (
                            <Alert
                                variant="info"
                                message="No history recorded for this employee."
                            />
                        ) : (
                            historyEntries.map((h: any) => (
                                <div
                                    key={h.id}
                                    className="rounded-lg border border-line p-3 dark:border-line/30"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium shrink-0 ${h.action === 'created'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : h.action === 'updated'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : h.action === 'verified'
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : h.action ===
                                                                'unverified'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}
                                            >
                                                {h.action}
                                            </span>
                                            <span className="text-xs text-muted truncate">
                                                {formatDateTime(h.created_at)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted truncate">
                                            {h.performed_by_name ||
                                                'Unknown Admin'}
                                        </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                        {h.previous_account_name && (
                                            <div>
                                                <p className="text-muted">
                                                    Previous Name
                                                </p>
                                                <p className="text-ink/70">
                                                    {h.previous_account_name}
                                                </p>
                                            </div>
                                        )}
                                        {h.new_account_name && (
                                            <div>
                                                <p className="text-muted">
                                                    New Name
                                                </p>
                                                <p className="text-ink">
                                                    {h.new_account_name}
                                                </p>
                                            </div>
                                        )}
                                        <div className="col-span-2">
                                            <p className="text-muted">
                                                Account Number
                                            </p>
                                            <p className="text-[11px] text-ink/70 italic">
                                                Hidden for security — view via
                                                Account Management
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BankDashboard;