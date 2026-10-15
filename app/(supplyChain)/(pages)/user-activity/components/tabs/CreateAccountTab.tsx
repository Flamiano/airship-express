'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search,
    UserPlus,
    KeyRound,
    RefreshCw,
    Copy,
    Check,
    Eye,
    EyeOff,
    Sparkles,
    ShieldCheck,
    Building2,
    Mail,
    UserCheck,
    AlertCircle,
    Info,
    X,
    BadgeCheck,
    MailCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
import { EmployeeAccount } from '../../types';
import { supabase } from '../../../../lib/services/client/supabase';

// Client-side strong password generator
function generateClientPassword(): string {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppers + lowers + numbers + symbols;

    const chars = [
        uppers[Math.floor(Math.random() * uppers.length)],
        lowers[Math.floor(Math.random() * lowers.length)],
        numbers[Math.floor(Math.random() * numbers.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];

    while (chars.length < 12) {
        chars.push(all[Math.floor(Math.random() * all.length)]);
    }

    // Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}

interface CreateAccountTabProps {
    onAccountsCountChange?: (count: number) => void;
}

export const CreateAccountTab: React.FC<CreateAccountTabProps> = ({ onAccountsCountChange }) => {
    const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'created' | 'pending'>('all');

    // Modal state for Create Account
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [targetEmployeeForCreate, setTargetEmployeeForCreate] = useState<EmployeeAccount | null>(null);
    const [createPassword, setCreatePassword] = useState('');
    const [showCreatePassword, setShowCreatePassword] = useState(true);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [createSuccessData, setCreateSuccessData] = useState<{
        email: string;
        password: string;
        role: string;
        name: string;
        emailSent?: boolean;
    } | null>(null);

    // Modal state for Change Password
    const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const [targetEmployeeForChange, setTargetEmployeeForChange] = useState<EmployeeAccount | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(true);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [changeSuccessData, setChangeSuccessData] = useState<{
        email: string;
        password: string;
        name: string;
    } | null>(null);

    // Copy to clipboard tracker
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopiedField(null), 2500);
    };

    // Fetch administrative employees
    const fetchEmployees = useCallback(async (manual = false) => {
        if (manual) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const res = await fetch('/api/supplyChain/employee-accounts');
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to fetch employees');
            }

            setEmployees(data.employees || []);
            if (onAccountsCountChange) {
                onAccountsCountChange(data.total || (data.employees || []).length);
            }
            if (manual) toast.success('Employee list refreshed');
        } catch (error: any) {
            console.error('Fetch error:', error);
            toast.error(error.message || 'Failed to load employees');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [onAccountsCountChange]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Supabase Realtime subscription for live sync on mock_employees and users tables
    useEffect(() => {
        const channelId = `employee_accounts_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'mock_employees' },
                () => {
                    fetchEmployees(false);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                () => {
                    fetchEmployees(false);
                }
            )
            .subscribe((status) => {
                setIsRealtimeActive(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchEmployees]);

    // Filter employees: STRICTLY only position containing ADMIN
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            // Guarantee position has ADMIN
            const hasAdmin = (emp.position || '').toUpperCase().includes('ADMIN');
            if (!hasAdmin) return false;

            // Status filter
            if (statusFilter === 'created' && !emp.has_account) return false;
            if (statusFilter === 'pending' && emp.has_account) return false;

            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const name = (emp.display_name || '').toLowerCase();
                const email = (emp.email || '').toLowerCase();
                const empId = (emp.employee_id || '').toLowerCase();
                const dept = (emp.department || '').toLowerCase();
                const pos = (emp.position || '').toLowerCase();

                return name.includes(term) || email.includes(term) || empId.includes(term) || dept.includes(term) || pos.includes(term);
            }

            return true;
        });
    }, [employees, statusFilter, searchTerm]);

    // Open Create Account Modal
    const handleOpenCreateModal = (emp: EmployeeAccount) => {
        setTargetEmployeeForCreate(emp);
        setCreatePassword(generateClientPassword());
        setShowCreatePassword(true);
        setCreateSuccessData(null);
        setCreateModalOpen(true);
    };

    // Submit Create Account
    const handleConfirmCreateAccount = async () => {
        if (!targetEmployeeForCreate) return;

        setIsCreatingAccount(true);
        try {
            const res = await fetch('/api/supplyChain/employee-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: targetEmployeeForCreate.employee_id,
                    employeeDbId: targetEmployeeForCreate.id,
                    email: targetEmployeeForCreate.email,
                    displayName: targetEmployeeForCreate.display_name,
                    department: targetEmployeeForCreate.department,
                    position: targetEmployeeForCreate.position,
                    password: createPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to create account');
            }

            if (data.email_sent) {
                toast.success(`Account created! Credentials emailed to ${targetEmployeeForCreate.email}`);
            } else {
                toast.success(data.message || 'Account successfully created!');
            }

            setCreateSuccessData({
                email: targetEmployeeForCreate.email,
                password: createPassword,
                role: 'Purchase Officer',
                name: targetEmployeeForCreate.display_name,
                emailSent: data.email_sent,
            });

            // Update local state
            setEmployees(prev =>
                prev.map(e =>
                    e.id === targetEmployeeForCreate.id
                        ? {
                            ...e,
                            has_account: true,
                            role: 'Purchase Officer',
                            account_status: 'Active',
                            password_hash: createPassword,
                            has_password: true,
                        }
                        : e
                )
            );
        } catch (error: any) {
            console.error('Create account error:', error);
            toast.error(error.message || 'Failed to create account');
        } finally {
            setIsCreatingAccount(false);
        }
    };

    // Open Change Password Modal
    const handleOpenChangePasswordModal = (emp: EmployeeAccount) => {
        setTargetEmployeeForChange(emp);
        setNewPassword(generateClientPassword());
        setShowNewPassword(true);
        setChangeSuccessData(null);
        setChangePasswordModalOpen(true);
    };

    // Submit Change Password
    const handleConfirmChangePassword = async () => {
        if (!targetEmployeeForChange) return;

        setIsChangingPassword(true);
        try {
            const res = await fetch('/api/supplyChain/employee-accounts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: targetEmployeeForChange.email,
                    employeeDbId: targetEmployeeForChange.id,
                    userId: targetEmployeeForChange.user_id,
                    newPassword: newPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to change password');
            }

            if (data.email_sent) {
                toast.success(`Password updated and notification emailed to ${targetEmployeeForChange.email}`);
            } else {
                toast.success('Password updated successfully!');
            }
            setChangeSuccessData({
                email: targetEmployeeForChange.email,
                password: newPassword,
                name: targetEmployeeForChange.display_name,
            });

            // Update local state
            setEmployees(prev =>
                prev.map(e =>
                    e.id === targetEmployeeForChange.id
                        ? { ...e, password_hash: newPassword, has_password: true }
                        : e
                )
            );
        } catch (error: any) {
            console.error('Change password error:', error);
            toast.error(error.message || 'Failed to update password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const totalAdminStaff = employees.length;
    const accountsCreatedCount = employees.filter(e => e.has_account).length;
    const pendingAccountsCount = employees.filter(e => !e.has_account).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header info banner (Solid styling, no gradients) */}
            <div className="bg-white dark:bg-[#151722] p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-sm">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    Administrative Employee Accounts
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800">
                                        Purchase Officer Role
                                    </span>
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    Employees with <strong className="text-pink-600 dark:text-pink-400 font-semibold">ADMIN</strong> in their position are provisioned as <span className="font-semibold text-slate-700 dark:text-slate-300">Purchase Officers</span> with autogenerated passwords.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Realtime Live Sync status indicator */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                            <span>{isRealtimeActive ? 'Live Realtime' : 'Connecting...'}</span>
                        </div>

                        <AppButton
                            variant="neutral"
                            size="sm"
                            icon={RefreshCw}
                            loading={isRefreshing}
                            onClick={() => fetchEmployees(true)}
                            className="shrink-0"
                        >
                            Refresh
                        </AppButton>
                    </div>
                </div>

                {/* Quick stats ribbon */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-4 border-t border-pink-200/40 dark:border-slate-800/80">
                    <div className="bg-white/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-pink-100/80 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Eligible Admin Staff</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{totalAdminStaff}</p>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-pink-100/80 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Accounts Active</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{accountsCreatedCount}</p>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-pink-100/80 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Setup</p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{pendingAccountsCount}</p>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center">
                            <UserPlus className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search employee name, email, position..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all shadow-inner"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Status Filter buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800 shrink-0">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === 'all'
                            ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        All ({totalAdminStaff})
                    </button>
                    <button
                        onClick={() => setStatusFilter('created')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === 'created'
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        Created ({accountsCreatedCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('pending')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === 'pending'
                            ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        Pending ({pendingAccountsCount})
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#151722] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-[2px_2px_8px_rgba(0,0,0,0.04)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold tracking-wider">
                            <tr>
                                <th className="px-5 py-3.5">Employee</th>
                                <th className="px-5 py-3.5">Position & Dept</th>
                                <th className="px-5 py-3.5">Assigned Role</th>
                                <th className="px-5 py-3.5">Account Status</th>
                                <th className="px-5 py-3.5">Password</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-pink-600" />
                                            <span>Loading administrative employees...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <AlertCircle className="w-8 h-8 text-slate-400" />
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                No administrative employees found matching filter.
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                Only employees with ADMIN in their position are displayed.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const initials = (emp.display_name || emp.email || 'U')
                                        .split(' ')
                                        .map(n => n[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase();

                                    return (
                                        <tr
                                            key={emp.id}
                                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            {/* Employee info */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-pink-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>{emp.display_name || 'Unnamed Employee'}</span>
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                                                {emp.employee_id || 'NO-ID'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                            <Mail className="w-3 h-3 text-slate-400" />
                                                            <span className="font-mono">{emp.email}</span>
                                                            <button
                                                                onClick={() => handleCopy(emp.email, `email-${emp.id}`)}
                                                                title="Copy email"
                                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                            >
                                                                {copiedField === `email-${emp.id}` ? (
                                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                                ) : (
                                                                    <Copy className="w-3 h-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Position & Department */}
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/60">
                                                        <span>{emp.position}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Building2 className="w-3 h-3 text-slate-400" />
                                                        {emp.department || 'Administration'}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Assigned Role */}
                                            <td className="px-5 py-4">
                                                <StatusBadge tone="purple" size="sm" dot>
                                                    Purchase Officer
                                                </StatusBadge>
                                            </td>

                                            {/* Account status */}
                                            <td className="px-5 py-4">
                                                {emp.has_account ? (
                                                    <div className="space-y-0.5">
                                                        <StatusBadge tone="emerald" size="sm" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
                                                            Account Active
                                                        </StatusBadge>
                                                        {emp.account_created_at && (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                                Created {new Date(emp.account_created_at).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <StatusBadge tone="amber" size="sm">
                                                        Pending Setup
                                                    </StatusBadge>
                                                )}
                                            </td>

                                            {/* Password status */}
                                            <td className="px-5 py-4">
                                                {emp.has_password || emp.has_account ? (
                                                    <span className="font-mono text-xs text-slate-500 tracking-widest">
                                                        ••••••••••••
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">
                                                        Not generated
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action buttons */}
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!emp.has_account ? (
                                                        <AppButton
                                                            variant="primary"
                                                            size="xs"
                                                            icon={UserPlus}
                                                            onClick={() => handleOpenCreateModal(emp)}
                                                        >
                                                            Create Account
                                                        </AppButton>
                                                    ) : (
                                                        <AppButton
                                                            variant="neutral"
                                                            size="xs"
                                                            icon={KeyRound}
                                                            onClick={() => handleOpenChangePasswordModal(emp)}
                                                        >
                                                            Change Password
                                                        </AppButton>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE ACCOUNT MODAL */}
            {createModalOpen && targetEmployeeForCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#161824] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                        Create Employee Account
                                    </h3>
                                    <p className="text-xs text-slate-500">Provision portal credentials</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!createSuccessData ? (
                            <>
                                {/* Employee Target Info */}
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-800">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Employee Name:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {targetEmployeeForCreate.display_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Email:</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                            {targetEmployeeForCreate.email}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Current Position:</span>
                                        <span className="font-semibold text-pink-600 dark:text-pink-400">
                                            {targetEmployeeForCreate.position}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                        <span className="text-slate-500 font-medium">Assigned Portal Role:</span>
                                        <StatusBadge tone="purple" size="xs">
                                            Purchase Officer
                                        </StatusBadge>
                                    </div>
                                </div>

                                {/* Autogenerated Password Box */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                            Autogenerated Password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setCreatePassword(generateClientPassword())}
                                            className="text-[11px] font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-400 flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Regenerate
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showCreatePassword ? 'text' : 'password'}
                                            value={createPassword}
                                            onChange={(e) => setCreatePassword(e.target.value)}
                                            className="w-full pl-3.5 pr-20 py-2.5 rounded-xl font-mono text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowCreatePassword(!showCreatePassword)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(createPassword, 'create-pwd')}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {copiedField === 'create-pwd' ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 text-slate-400" />
                                        12 characters with uppercase, lowercase, numbers, and symbols.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <AppButton
                                        variant="neutral"
                                        size="sm"
                                        onClick={() => setCreateModalOpen(false)}
                                        disabled={isCreatingAccount}
                                    >
                                        Cancel
                                    </AppButton>
                                    <AppButton
                                        variant="primary"
                                        size="sm"
                                        loading={isCreatingAccount}
                                        onClick={handleConfirmCreateAccount}
                                    >
                                        Create Account
                                    </AppButton>
                                </div>
                            </>
                        ) : (
                            /* Success Confirmation with copyable credentials */
                            <div className="space-y-4 py-2">
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-1.5">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center">
                                        <BadgeCheck className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                                        Account Created Successfully!
                                    </h4>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                        Credentials for {createSuccessData.name} are ready.
                                    </p>
                                </div>

                                {/* Email dispatch indicator */}
                                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${createSuccessData.emailSent ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                    <MailCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>
                                        {createSuccessData.emailSent ? (
                                            <>Credentials have been sent to <strong>{createSuccessData.email}</strong> via email.</>
                                        ) : (
                                            <>Credentials ready. Copy the details below to share with the employee.</>
                                        )}
                                    </span>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase">Login Email</span>
                                        <p className="font-mono text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                                            {createSuccessData.email}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase">Generated Password</span>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <p className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">
                                                {createSuccessData.password}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(createSuccessData.password, 'succ-pwd')}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {copiedField === 'succ-pwd' ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase">Assigned Role</span>
                                        <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                                            {createSuccessData.role}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2.5 pt-2">
                                    <AppButton
                                        variant="neutral"
                                        size="sm"
                                        icon={Copy}
                                        onClick={() => {
                                            const payload = `Airship Portal Credentials:\nEmail: ${createSuccessData.email}\nPassword: ${createSuccessData.password}\nRole: ${createSuccessData.role}`;
                                            handleCopy(payload, 'copy-all');
                                        }}
                                    >
                                        Copy All Details
                                    </AppButton>
                                    <AppButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setCreateModalOpen(false)}
                                    >
                                        Done
                                    </AppButton>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CHANGE PASSWORD MODAL */}
            {changePasswordModalOpen && targetEmployeeForChange && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#161824] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 flex items-center justify-center">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                        Change Employee Password
                                    </h3>
                                    <p className="text-xs text-slate-500">Reset credentials as admin</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setChangePasswordModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!changeSuccessData ? (
                            <>
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-800">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Employee:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {targetEmployeeForChange.display_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Email:</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                            {targetEmployeeForChange.email}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Position:</span>
                                        <span className="font-medium text-pink-600 dark:text-pink-400">
                                            {targetEmployeeForChange.position}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                            New Autogenerated Password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setNewPassword(generateClientPassword())}
                                            className="text-[11px] font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-400 flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Regenerate
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-3.5 pr-20 py-2.5 rounded-xl font-mono text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(newPassword, 'change-pwd')}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {copiedField === 'change-pwd' ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 text-slate-400" />
                                        Must be at least 8 characters with uppercase, lowercase, and numbers.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <AppButton
                                        variant="neutral"
                                        size="sm"
                                        onClick={() => setChangePasswordModalOpen(false)}
                                        disabled={isChangingPassword}
                                    >
                                        Cancel
                                    </AppButton>
                                    <AppButton
                                        variant="primary"
                                        size="sm"
                                        loading={isChangingPassword}
                                        onClick={handleConfirmChangePassword}
                                    >
                                        Update Password
                                    </AppButton>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4 py-2">
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-1.5">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center">
                                        <BadgeCheck className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                                        Password Updated Successfully!
                                    </h4>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                        The employee can now log in using the newly updated password.
                                    </p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase">Employee</span>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                                            {changeSuccessData.name} ({changeSuccessData.email})
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase">New Password</span>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <p className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">
                                                {changeSuccessData.password}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(changeSuccessData.password, 'succ-chg-pwd')}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                {copiedField === 'succ-chg-pwd' ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2.5 pt-2">
                                    <AppButton
                                        variant="neutral"
                                        size="sm"
                                        icon={Copy}
                                        onClick={() => {
                                            handleCopy(changeSuccessData.password, 'copy-new-pwd');
                                        }}
                                    >
                                        Copy New Password
                                    </AppButton>
                                    <AppButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setChangePasswordModalOpen(false)}
                                    >
                                        Done
                                    </AppButton>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
