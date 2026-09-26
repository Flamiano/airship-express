'use client';

import React from 'react';
import { Search, Ban, Trash2, AlertTriangle, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
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
    onResetStrikes?: (identifier: string) => void;
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
    onResetStrikes,
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
        <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* search header */}
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search sessions by user, IP, or user agent..."
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                    />
                </div>
            </div>

            {/* bulk actions banner */}
            {selectedSessions.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
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

            {/* table content */}
            <div className="overflow-x-auto">
                <table className="table-pro w-full text-left border-collapse">
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
                            <th className="py-3 px-4">AI Moderation</th>
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
                                    { type: 'badge' },
                                    { type: 'date' },
                                    { type: 'date' },
                                    { type: 'badge' },
                                    { type: 'actions', align: 'right', width: 'w-[80px]' },
                                ]}
                            />
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fa-solid fa-laptop text-2xl text-pink-500 dark:text-pink-400"></i>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No active sessions found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">There are currently no matching user sessions</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sessions.map((session) => {
                                const isSelected = selectedSessions.has(session.id);
                                const isProtectedRole = session.users?.role === 'Admin' || session.users?.role === 'Executive';
                                const isBlocked = Boolean(session.is_blocked);
                                const isDisabled = isProtectedRole || isBlocked;
                                const userName = session.users?.display_name || session.hr_employee_name || 'Unknown';
                                const userIdentifier = session.user_id || session.email || session.ip_address || '';
                                const strikeCount = session.strikes || 0;
                                const isLockedOut = Boolean(session.is_locked_out);

                                return (
                                    <tr
                                        key={session.id}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                            isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                        } ${isBlocked ? 'opacity-60 bg-red-50/20 dark:bg-red-950/10' : ''}`}
                                    >
                                        <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-between md:justify-center w-full">
                                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isDisabled}
                                                        onChange={() => onToggleSelectSession(session.id, isDisabled)}
                                                        aria-label="Select session"
                                                        className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 accent-pink-500 bg-transparent ${
                                                            isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                        }`}
                                                    />
                                                    <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select Session</span>
                                                </label>
                                                <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {isBlocked ? 'BLOCKED' : session.is_active ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="User" className="py-3 px-4">
                                            <div className="flex items-center justify-end sm:justify-start gap-2 min-w-0 max-w-[62%] sm:max-w-none ml-auto sm:ml-0">
                                                <div className="w-7 h-7 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/50 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] shrink-0 uppercase">
                                                    {userName.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={userName}>
                                                    {userName}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Email" className="py-3 px-4 text-right sm:text-left">
                                            <span className="text-slate-600 dark:text-slate-400 truncate inline-block max-w-[200px] sm:max-w-[180px]" title={session.email || session.users?.email || 'N/A'}>
                                                {session.email || session.users?.email || 'N/A'}
                                            </span>
                                        </td>

                                        <td data-label="Device / User Agent" className="py-3 px-4 text-right sm:text-left">
                                            <span className="text-slate-600 dark:text-slate-400 max-w-[200px] truncate inline-block" title={session.user_agent}>
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

                                        {/* ai moderation / strike status */}
                                        <td data-label="AI Moderation" className="py-3 px-4">
                                            <div className="flex items-center justify-end sm:justify-start gap-1.5">
                                                {isLockedOut ? (
                                                    <>
                                                        <StatusBadge tone="rose" size="xs" icon={<ShieldAlert className="w-3 h-3 text-rose-500" />}>
                                                            <span>5/5 Lockout ({session.lockout_remaining_seconds || 300}s)</span>
                                                        </StatusBadge>
                                                        {onResetStrikes && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onResetStrikes(userIdentifier)}
                                                                title="Reset moderation strikes"
                                                                className="p-1 rounded-md text-slate-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition-colors cursor-pointer"
                                                            >
                                                                <RotateCcw className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : strikeCount > 0 ? (
                                                    <>
                                                        <StatusBadge tone="amber" size="xs" icon={<AlertTriangle className="w-3 h-3 text-amber-500" />}>
                                                            <span>{strikeCount}/5 Strikes</span>
                                                        </StatusBadge>
                                                        {onResetStrikes && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onResetStrikes(userIdentifier)}
                                                                title="Reset moderation strikes"
                                                                className="p-1 rounded-md text-slate-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition-colors cursor-pointer"
                                                            >
                                                                <RotateCcw className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                        <span>Clean</span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td data-label="Created At" className="py-3 px-4 text-right sm:text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.created_at)}
                                        </td>

                                        <td data-label="Expires At" className="py-3 px-4 text-right sm:text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(session.expires_at)}
                                        </td>

                                        <td data-label="Status" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                <StatusBadge
                                                    tone={isBlocked ? 'rose' : session.is_active ? 'emerald' : 'neutral'}
                                                    dot
                                                    size="xs"
                                                >
                                                    {isBlocked ? 'Blocked' : session.is_active ? 'Active' : 'Inactive'}
                                                </StatusBadge>
                                            </div>
                                        </td>

                                        <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap sm:w-[80px] sm:min-w-[80px] w-full">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {isBlocked ? (
                                                    <span
                                                        className="text-xs text-slate-400 dark:text-slate-500 italic px-2"
                                                        title={`Blocked for ${session.email || session.users?.email}`}
                                                    >
                                                        Blocked
                                                    </span>
                                                ) : (
                                                    <CrudActionButton
                                                        action="delete"
                                                        variant="pink"
                                                        label="Block"
                                                        title={isProtectedRole ? 'Cannot block Admin or Executive users' : 'Block this device'}
                                                        disabled={isProtectedRole}
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

            {/* pagination footer */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
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
