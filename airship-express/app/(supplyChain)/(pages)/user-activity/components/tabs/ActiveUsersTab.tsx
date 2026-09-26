'use client';

import React from 'react';
import { Search, LogOut, Shield, ShieldAlert, UserCheck, AlertCircle } from 'lucide-react';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
import { Session } from '../../types';
import { formatDate } from '../../utils/formatters';

interface ActiveUsersTabProps {
    activeUsers: Session[];
    isLoading: boolean;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    selectedActiveUsers: Set<string>;
    onToggleSelectActiveUser: (id: string, isProtected: boolean) => void;
    onSelectAllActiveUsers: () => void;
    onTerminateSession: (sessionId: string, targetRole?: string, employeeName?: string) => void;
    onBulkTerminate: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    userRole?: string;
    queuedUsersCount?: number;
    queuedRolesCount?: Record<string, number>;
    slotStats?: {
        executive: { reserved: number; active: number; available: number };
        manager: { reserved: number; active: number; available: number };
        employee: { reserved: number; active: number; available: number };
        totalActive: number;
        maxCapacity: number;
    };
}

export const ActiveUsersTab: React.FC<ActiveUsersTabProps> = ({
    activeUsers,
    isLoading,
    searchTerm,
    onSearchTermChange,
    selectedActiveUsers,
    onToggleSelectActiveUser,
    onSelectAllActiveUsers,
    onTerminateSession,
    onBulkTerminate,
    currentPage,
    totalPages,
    onPageChange,
    userRole,
    queuedUsersCount = 0,
    queuedRolesCount = {},
    slotStats,
}) => {
    const callerRole = (userRole || '').toLowerCase();

    // Determine if target session is protected:
    // Only Executive accounts are protected from remote logout.
    // Managers, Employees, Operators, and Admins can be logged out.
    const isProtectedRole = (targetRole?: string) => {
        const target = (targetRole || '').toLowerCase();
        return target === 'executive';
    };

    const selectableUsers = activeUsers.filter(s => !isProtectedRole(s.users?.role));
    const allSelected = selectableUsers.length > 0 && selectedActiveUsers.size === selectableUsers.length;
    const someSelected = selectedActiveUsers.size > 0 && selectedActiveUsers.size < selectableUsers.length;

    const canTerminate = ['admin', 'executive'].includes(callerRole);

    const getRoleBadge = (role?: string) => {
        const r = (role || 'Employee').toLowerCase();
        if (r === 'executive') {
            return <StatusBadge tone="purple" size="xs">Executive</StatusBadge>;
        }
        if (r === 'admin') {
            return <StatusBadge tone="rose" size="xs">Admin</StatusBadge>;
        }
        if (r === 'manager') {
            return <StatusBadge tone="amber" size="xs">Manager</StatusBadge>;
        }
        if (r === 'operator') {
            return <StatusBadge tone="blue" size="xs">Operator</StatusBadge>;
        }
        return <StatusBadge tone="neutral" size="xs">Employee</StatusBadge>;
    };

    return (
        <div className="space-y-4">
            {/* Slot Allocation and Queue Overview Cards */}
            {slotStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Executive / Admin Slot Card */}
                    <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all hover:border-slate-300/80 dark:hover:border-slate-700/80">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Executive & Admin
                            </div>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 tracking-tight">
                                {slotStats.executive.active} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {slotStats.executive.reserved} slots</span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Top Priority • Reserved</div>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30 text-xs font-medium">
                            {Math.max(0, slotStats.executive.available)} left
                        </div>
                    </div>

                    {/* Manager Slot Card */}
                    <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 shadow-sm flex items-center justify-between transition-all hover:border-slate-300/80 dark:hover:border-slate-700/80">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Managers
                            </div>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 tracking-tight">
                                {slotStats.manager.active} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {slotStats.manager.reserved} slots</span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Tier 2 Priority • Reserved</div>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30 text-xs font-medium">
                            {Math.max(0, slotStats.manager.available)} left
                        </div>
                    </div>

                    {/* Employee Slot Card */}
                    <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${
                        slotStats.employee.active > slotStats.employee.reserved
                            ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/40'
                            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/80 hover:border-slate-300/80 dark:hover:border-slate-700/80'
                    }`}>
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Employees
                            </div>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 tracking-tight">
                                {slotStats.employee.active} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {slotStats.employee.reserved} slots</span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {slotStats.employee.active > slotStats.employee.reserved
                                    ? `Draining to ≤ ${slotStats.employee.reserved}`
                                    : `Standard Tier • Cap: ${slotStats.employee.reserved}`}
                            </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-xl border text-xs font-medium ${
                            slotStats.employee.active > slotStats.employee.reserved
                                ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                                : 'bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/40'
                        }`}>
                            {Math.max(0, slotStats.employee.available)} left
                        </div>
                    </div>

                    {/* Queue Status Card */}
                    <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${
                        queuedUsersCount > 0 
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40'
                            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/80 hover:border-slate-300/80 dark:hover:border-slate-700/80'
                    }`}>
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Login Queue
                            </div>
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 tracking-tight">
                                {queuedUsersCount} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">waiting</span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {queuedUsersCount > 0 && Object.keys(queuedRolesCount).length > 0
                                    ? Object.entries(queuedRolesCount).map(([r, c]) => `${c} ${r}${c > 1 ? 's' : ''}`).join(', ')
                                    : (queuedUsersCount > 0 ? 'Users holding for open slot' : 'No congestion • All clear')}
                            </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-xl border text-xs font-medium ${
                            queuedUsersCount > 0 
                                ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                                : 'bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/40'
                        }`}>
                            {queuedUsersCount > 0 ? `+${queuedUsersCount}` : '0'}
                        </div>
                    </div>
                </div>
            )}

            {/* Graceful Downscale Alert Banner */}
            {slotStats && (slotStats.employee.active > slotStats.employee.reserved || slotStats.totalActive > slotStats.maxCapacity) && (
                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-3 text-blue-900 dark:text-blue-200 text-xs shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div>
                            <span className="font-bold">Safe Slot Downscale in Effect: </span>
                            <span>
                                Configured slot capacity is {slotStats.employee.reserved}, but {slotStats.employee.active} employees are currently active. Active sessions are <strong>never automatically logged out</strong>. The new limit will reflect on new logins and queue admissions once active sessions naturally reduce to ≤ {slotStats.employee.reserved}.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Waiting Queue Alert Banner if active */}
            {queuedUsersCount > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs shadow-sm">
                    <div className="flex items-start sm:items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    System Concurrency Limit Reached
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-500/30">
                                    {queuedUsersCount} {queuedUsersCount === 1 ? 'user' : 'users'} in queue
                                </span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="font-medium text-slate-500 dark:text-slate-400">Queued Roles:</span>
                                {Object.keys(queuedRolesCount).length > 0 ? (
                                    Object.entries(queuedRolesCount).map(([role, count]) => (
                                        <span key={role} className="inline-flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                            {getRoleBadge(role)}
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">× {count}</span>
                                        </span>
                                    ))
                                ) : (
                                    <span className="italic text-slate-400">Standard Tier</span>
                                )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                When active sessions disconnect or expire, queued users will automatically be admitted in real-time. Priority pools remain reserved.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
                {/* search and summary banner */}
                <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search active users by name, role, email, or IP..."
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>{activeUsers.length} Active {activeUsers.length === 1 ? 'Session' : 'Sessions'} {slotStats ? `(Cap: ${slotStats.maxCapacity})` : ''}</span>
                        </div>
                    </div>
                </div>

            {/* bulk actions banner */}
            {selectedActiveUsers.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {selectedActiveUsers.size} user(s) selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        {canTerminate && (
                            <AppButton
                                type="button"
                                variant="danger"
                                size="xs"
                                onClick={onBulkTerminate}
                            >
                                <LogOut className="w-3 h-3" />
                                <span>Log Out Selected</span>
                            </AppButton>
                        )}
                    </div>
                </div>
            )}

            {/* table content */}
            <div className="overflow-x-auto">
                <table className="table-pro w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-3 px-4 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={onSelectAllActiveUsers}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer accent-emerald-500 bg-transparent"
                                />
                            </th>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Device / User Agent</th>
                            <th className="py-3 px-4">IP Address</th>
                            <th className="py-3 px-4">Session Started</th>
                            <th className="py-3 px-4">Expires At</th>
                            <th className="py-3 px-4">Live Status</th>
                            <th className="py-3 px-4 text-right w-[110px] min-w-[110px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {isLoading ? (
                            <TableRowsSkeleton
                                rows={6}
                                columns={[
                                    { type: 'checkbox', width: 'w-10' },
                                    { type: 'avatar-text', subtext: false },
                                    { type: 'text', width: 'w-36' },
                                    { type: 'badge' },
                                    { type: 'text', width: 'w-48' },
                                    { type: 'mono', width: 'w-28' },
                                    { type: 'date' },
                                    { type: 'date' },
                                    { type: 'badge' },
                                    { type: 'actions', align: 'right', width: 'w-[110px]' },
                                ]}
                            />
                        ) : activeUsers.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <UserCheck className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No active users found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">There are currently no active user sessions matching your filter</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            activeUsers.map((session) => {
                                const isSelected = selectedActiveUsers.has(session.id);
                                const userRoleStr = session.users?.role || 'Employee';
                                const isProtected = isProtectedRole(userRoleStr);
                                const userName = session.users?.display_name || session.hr_employee_name || 'Unknown';
                                const userEmail = session.email || session.users?.email || 'N/A';

                                return (
                                    <tr
                                        key={session.id}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                            isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                                        }`}
                                    >
                                        <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={isProtected}
                                                onChange={() => onToggleSelectActiveUser(session.id, isProtected)}
                                                aria-label="Select active user"
                                                className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500/20 accent-emerald-500 bg-transparent ${
                                                    isProtected ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                }`}
                                            />
                                        </td>

                                        <td data-label="User" className="py-3 px-4">
                                            <div className="flex items-center justify-end sm:justify-start gap-2 min-w-0 max-w-[62%] sm:max-w-none ml-auto sm:ml-0">
                                                <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] shrink-0 uppercase">
                                                    {userName.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={userName}>
                                                    {userName}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Email" className="py-3 px-4 text-right sm:text-left">
                                            <span className="text-slate-600 dark:text-slate-400 truncate inline-block max-w-[200px] sm:max-w-[180px]" title={userEmail}>
                                                {userEmail}
                                            </span>
                                        </td>

                                        <td data-label="Role" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                {getRoleBadge(userRoleStr)}
                                            </div>
                                        </td>

                                        <td data-label="Device / User Agent" className="py-3 px-4 text-right sm:text-left">
                                            <span className="text-slate-600 dark:text-slate-400 max-w-[180px] truncate inline-block" title={session.user_agent}>
                                                {session.user_agent}
                                            </span>
                                        </td>

                                        <td data-label="IP Address" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                <StatusBadge tone="neutral" size="xs">
                                                    <span className="font-mono">{session.ip_address || 'Unknown'}</span>
                                                </StatusBadge>
                                            </div>
                                        </td>

                                        <td data-label="Session Started" className="py-3 px-4 text-right sm:text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.created_at)}
                                        </td>

                                        <td data-label="Expires At" className="py-3 px-4 text-right sm:text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.expires_at)}
                                        </td>

                                        <td data-label="Live Status" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    Online
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap sm:w-[110px] sm:min-w-[110px] w-full">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {isProtected ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 cursor-not-allowed select-none"
                                                        title="Executive accounts are protected from remote termination"
                                                    >
                                                        <Shield className="w-3 h-3 text-amber-500" />
                                                        <span>Protected</span>
                                                    </span>
                                                ) : canTerminate ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onTerminateSession(session.id, userRoleStr, userName)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                                        title={`Log out ${userName}`}
                                                    >
                                                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                                                        <span>Log Out</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                                        No action
                                                    </span>
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

            {/* pagination footer */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {activeUsers.length} active sessions
                </span>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    </div>
);
};
