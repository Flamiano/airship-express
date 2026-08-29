'use client';

import React from 'react';
import { Search, Ban, Trash2, Loader2 } from 'lucide-react';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableRowsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { Session } from '../../types';
import { formatDate } from '../../utils/formatters';

interface SessionsTabProps {
    sessions: Session[];
    isLoading: boolean;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    selectedSessions: Set<string>;
    onToggleSelectSession: (id: string, isDisabled: boolean) => void;
    onSelectAllSessions: () => void;
    onBlockDevice: (sessionId: string, userAgent: string, ipAddress?: string, userName?: string, email?: string) => void;
    onBulkBlock: () => void;
    onBulkDelete: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
    sessions,
    isLoading,
    searchTerm,
    onSearchTermChange,
    selectedSessions,
    onToggleSelectSession,
    onSelectAllSessions,
    onBlockDevice,
    onBulkBlock,
    onBulkDelete,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const selectableSessions = sessions.filter(s => !s.is_blocked && s.users?.role !== 'Admin');
    const allSessionsSelected = selectableSessions.length > 0 && selectedSessions.size === selectableSessions.length;
    const someSessionsSelected = selectedSessions.size > 0 && selectedSessions.size < selectableSessions.length;

    return (
        <div className="bg-white dark:bg-[#1c1d25] rounded-2xl border border-slate-200/90 dark:border-[#353746] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 dark:border-[#353746] bg-slate-50/70 dark:bg-[#15161c]">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search sessions by user, IP, or user agent..."
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#2a2a2e] border border-slate-200/90 dark:border-[#353746] rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-[#23242e] transition-all shadow-2xs"
                    />
                </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedSessions.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {selectedSessions.size} session(s) selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <AppButton
                            type="button"
                            variant="danger"
                            size="xs"
                            onClick={onBulkBlock}
                        >
                            <Ban className="w-3 h-3" />
                            <span>Block Selected</span>
                        </AppButton>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="xs"
                            onClick={onBulkDelete}
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Selected</span>
                        </AppButton>
                    </div>
                </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-3 px-4 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allSessionsSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSessionsSelected;
                                        }
                                    }}
                                    onChange={onSelectAllSessions}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                />
                            </th>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Device / User Agent</th>
                            <th className="py-3 px-4">IP Address</th>
                            <th className="py-3 px-4">Created At</th>
                            <th className="py-3 px-4">Expires At</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right w-[80px] min-w-[80px]">Actions</th>
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
                                    { type: 'text', width: 'w-48' },
                                    { type: 'mono', width: 'w-28' },
                                    { type: 'date' },
                                    { type: 'date' },
                                    { type: 'badge' },
                                    { type: 'actions', align: 'right', width: 'w-[80px]' },
                                ]}
                            />
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                                    <i className="fas fa-check-circle text-emerald-500 dark:text-emerald-400 text-base mr-2" />
                                    No sessions found
                                </td>
                            </tr>
                        ) : (
                            sessions.map((session) => {
                                const isSelected = selectedSessions.has(session.id);
                                const isAdmin = session.users?.role === 'Admin';
                                const isBlocked = Boolean(session.is_blocked);
                                const isDisabled = isAdmin || isBlocked;
                                const userName = session.users?.display_name || session.hr_employee_name || 'Unknown';

                                return (
                                    <tr
                                        key={session.id}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected
                                            ? 'bg-pink-50/30 dark:bg-pink-950/20'
                                            : ''
                                            } ${isBlocked
                                                ? 'opacity-60 bg-red-50/20 dark:bg-red-950/10'
                                                : ''
                                            }`}
                                    >
                                        <td className="py-3 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={isDisabled}
                                                onChange={() => onToggleSelectSession(session.id, isDisabled)}
                                                className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 accent-pink-500 bg-transparent ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                            />
                                        </td>

                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] shrink-0 uppercase">
                                                    {userName.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {userName}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                            {session.email || session.users?.email || 'N/A'}
                                        </td>

                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={session.user_agent}>
                                            {session.user_agent}
                                        </td>

                                        <td className="py-3 px-4">
                                            <StatusBadge tone="neutral" size="xs">
                                                <span className="font-mono">{session.ip_address || 'Unknown'}</span>
                                            </StatusBadge>
                                        </td>

                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.created_at)}
                                        </td>

                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.expires_at)}
                                        </td>

                                        <td className="py-3 px-4">
                                            <StatusBadge
                                                tone={isBlocked ? 'rose' : session.is_active ? 'emerald' : 'neutral'}
                                                dot
                                                size="xs"
                                            >
                                                {isBlocked ? 'Blocked' : session.is_active ? 'Active' : 'Inactive'}
                                            </StatusBadge>
                                        </td>

                                        <td className="py-3 px-4 text-right whitespace-nowrap w-[80px] min-w-[80px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {isBlocked ? (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic px-2" title={`Blocked for ${session.email || session.users?.email}`}>
                                                        Blocked
                                                    </span>
                                                ) : (
                                                    <CrudActionButton
                                                        action="delete"
                                                        variant="pink"
                                                        label="Block"
                                                        title={isAdmin ? 'Cannot block admin users' : 'Block this device'}
                                                        disabled={isAdmin}
                                                        onClick={() =>
                                                            onBlockDevice(
                                                                session.id,
                                                                session.user_agent,
                                                                session.ip_address,
                                                                userName,
                                                                session.email
                                                            )
                                                        }
                                                    />
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

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {sessions.length} sessions
                </span>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};
