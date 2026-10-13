'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Session } from '../../types';
import { EditAccessScheduleModal } from '../modals/EditAccessScheduleModal';
import { useConfirm } from '../../../../components/ui/ConfirmModal';
import { useDebounce } from '../../../../hooks/useDebounce';
import { Pagination } from '../../../../components/global/pagination';
import { DEFAULT_ALLOWED_DAYS, DEFAULT_TIME_START, DEFAULT_TIME_END } from '../../../../lib/services/userAccessService';

interface AccessControlTabProps {
    sessions: Session[];
    isLoading: boolean;
    userRole?: string;
    searchTerm?: string;
    onSearchTermChange?: (term: string) => void;
    onUpdateAccessRule: (rule: {
        email: string;
        user_id?: string;
        display_name?: string;
        role?: string;
        is_allow: boolean;
        allowed_days: string[];
        allowed_time_start: string;
        allowed_time_end: string;
        auth_requested?: boolean;
    }) => Promise<void>;
    onSaveBulk?: (rules: Array<{
        email: string;
        user_id?: string;
        display_name?: string;
        role?: string;
        is_allow: boolean;
        allowed_days: string[];
        allowed_time_start: string;
        allowed_time_end: string;
        auth_requested?: boolean;
    }>) => Promise<any>;
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    isRealtimeActive?: boolean;
    onRefresh?: () => void;
}

export const AccessControlTab: React.FC<AccessControlTabProps> = ({
    sessions,
    isLoading,
    userRole,
    searchTerm: externalSearchTerm = '',
    onSearchTermChange: externalOnSearchTermChange,
    onUpdateAccessRule,
    onSaveBulk,
    isRealtimeActive = true,
    onRefresh,
}) => {
    const { confirm } = useConfirm();
    const searchParams = useSearchParams();
    const isViewerExecutive = (userRole || '').toLowerCase().trim() === 'executive';
    
    // Auto-open target from search params (e.g. from notification 'Extend' action)
    const editEmailParam = searchParams?.get('edit_email');
    const editUserParam = searchParams?.get('edit_user');
    const autoOpenTarget = editEmailParam || editUserParam;
    const hasAutoOpenedRef = useRef<string | null>(null);

    // Local Search & Debouncing (automatically populated with edit_email / edit_user)
    const [localSearchInput, setLocalSearchInput] = useState(autoOpenTarget || externalSearchTerm);
    const debouncedSearch = useDebounce(localSearchInput, 300);

    // Filter status
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'allowed' | 'disallowed'>('all');
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Selections for Bulk Actions
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

    // Modals & In-flight Loading states
    const [selectedSessionForEdit, setSelectedSessionForEdit] = useState<Session | null>(null);
    const [isBulkScheduleModalOpen, setIsBulkScheduleModalOpen] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // In-flight Action Loaders
    const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<'allow' | 'disallow' | 'schedule' | null>(null);

    // Sync autoOpenTarget into search input when navigated from notification
    useEffect(() => {
        if (autoOpenTarget) {
            setLocalSearchInput(autoOpenTarget);
            setPage(1);
        }
    }, [autoOpenTarget]);

    // Sync search change to parent if provided
    useEffect(() => {
        if (externalOnSearchTermChange) {
            externalOnSearchTermChange(debouncedSearch);
        }
        setPage(1);
    }, [debouncedSearch, externalOnSearchTermChange]);

    // Keep local input in sync if externalSearchTerm changes from outside
    useEffect(() => {
        if (externalSearchTerm !== localSearchInput) {
            setLocalSearchInput(externalSearchTerm);
        }
    }, [externalSearchTerm]);

    // Reset pagination when filter changes
    const handleStatusFilterChange = (status: 'all' | 'pending' | 'allowed' | 'disallowed') => {
        setFilterStatus(status);
        setPage(1);
    };

    // Filter out Executive role accounts completely from the Access Control list
    const nonExecutiveSessions = useMemo(() => {
        return sessions.filter(s => (s.users?.role || '').toLowerCase().trim() !== 'executive');
    }, [sessions]);

    // Auto-open EditAccessScheduleModal when navigated with edit_email / edit_user param
    useEffect(() => {
        if (!autoOpenTarget || nonExecutiveSessions.length === 0) return;
        const targetClean = autoOpenTarget.toLowerCase().trim();
        if (hasAutoOpenedRef.current === targetClean) return;

        const matched = nonExecutiveSessions.find(s =>
            (s.email && s.email.toLowerCase().trim() === targetClean) ||
            (s.user_id && s.user_id.toLowerCase().trim() === targetClean) ||
            (s.id && s.id.toLowerCase().trim() === targetClean) ||
            (s.users?.email && s.users.email.toLowerCase().trim() === targetClean)
        );

        if (matched) {
            hasAutoOpenedRef.current = targetClean;
            setSelectedSessionForEdit(matched);
            setShowEditModal(true);
        }
    }, [autoOpenTarget, nonExecutiveSessions]);

    // Filtered list based on search and status
    const filteredList = useMemo(() => {
        const term = debouncedSearch.toLowerCase().trim();
        return nonExecutiveSessions.filter(session => {
            const email = (session.email || session.users?.email || '').toLowerCase();
            const name = (session.users?.display_name || session.hr_employee_name || '').toLowerCase();
            const role = (session.users?.role || '').toLowerCase();

            const matchesSearch = !term || email.includes(term) || name.includes(term) || role.includes(term);
            if (!matchesSearch) return false;

            if (filterStatus === 'pending') return Boolean(session.auth_requested);
            if (filterStatus === 'allowed') return Boolean(session.is_allow);
            if (filterStatus === 'disallowed') return !session.is_allow;
            return true;
        });
    }, [nonExecutiveSessions, debouncedSearch, filterStatus]);

    // Pagination calculations
    const totalCount = filteredList.length;
    const computedTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safeCurrentPage = Math.min(page, computedTotalPages);

    const paginatedList = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * pageSize;
        return filteredList.slice(startIndex, startIndex + pageSize);
    }, [filteredList, safeCurrentPage, pageSize]);

    // Counts for filters (strictly excluding Executive)
    const pendingRequestsCount = useMemo(() => nonExecutiveSessions.filter(s => s.auth_requested).length, [nonExecutiveSessions]);
    const allowedCount = useMemo(() => nonExecutiveSessions.filter(s => Boolean(s.is_allow)).length, [nonExecutiveSessions]);
    const disallowedCount = useMemo(() => nonExecutiveSessions.filter(s => !s.is_allow).length, [nonExecutiveSessions]);

    // Multi-select handlers
    const selectedSessionsList = useMemo(() => {
        return nonExecutiveSessions.filter(s => {
            const email = s.email || s.users?.email || '';
            return email && selectedEmails.has(email);
        });
    }, [nonExecutiveSessions, selectedEmails]);

    const selectablePaginatedList = useMemo(() => {
        return paginatedList.filter(s => {
            const isTargetAdmin = (s.users?.role || '').toLowerCase().trim() === 'admin';
            return isTargetAdmin ? isViewerExecutive : true;
        });
    }, [paginatedList, isViewerExecutive]);

    const isAllPageSelected = useMemo(() => {
        if (selectablePaginatedList.length === 0) return false;
        return selectablePaginatedList.every(s => {
            const email = s.email || s.users?.email || '';
            return email && selectedEmails.has(email);
        });
    }, [selectablePaginatedList, selectedEmails]);

    const handleToggleSelectAllPage = () => {
        const next = new Set(selectedEmails);
        if (isAllPageSelected) {
            selectablePaginatedList.forEach(s => {
                const email = s.email || s.users?.email || '';
                if (email) next.delete(email);
            });
        } else {
            selectablePaginatedList.forEach(s => {
                const email = s.email || s.users?.email || '';
                if (email) next.add(email);
            });
        }
        setSelectedEmails(next);
    };

    const handleToggleSelectRow = (email: string) => {
        const next = new Set(selectedEmails);
        if (next.has(email)) next.delete(email);
        else next.add(email);
        setSelectedEmails(next);
    };

    const handleClearSelection = () => {
        setSelectedEmails(new Set());
    };

    // Single Toggle handler
    const handleQuickToggle = async (session: Session) => {
        const email = session.email || session.users?.email || '';
        if (!email) return;

        const isTargetAdmin = (session.users?.role || '').toLowerCase().trim() === 'admin';
        if (isTargetAdmin && !isViewerExecutive) {
            return;
        }

        const displayName = session.users?.display_name || session.hr_employee_name || email;
        const willDisable = Boolean(session.is_allow);

        if (willDisable) {
            const confirmed = await confirm({
                title: 'Disable Login Access',
                message: `Are you sure you want to disable login access for ${displayName} (${email})? If this user has an active session, they will be logged out immediately.`,
                confirmText: 'Disable Access',
                cancelText: 'Cancel',
                confirmVariant: 'danger',
            });
            if (!confirmed) return;
        }

        setUpdatingEmail(email);
        try {
            await onUpdateAccessRule({
                email,
                user_id: session.user_id,
                display_name: displayName,
                role: session.users?.role,
                is_allow: !session.is_allow,
                allowed_days: session.allowed_days && session.allowed_days.length > 0 ? session.allowed_days : DEFAULT_ALLOWED_DAYS,
                allowed_time_start: session.allowed_time_start || DEFAULT_TIME_START,
                allowed_time_end: session.allowed_time_end || DEFAULT_TIME_END,
                auth_requested: false,
            });
        } finally {
            setUpdatingEmail(null);
        }
    };

    // Bulk Allow Action
    const handleBulkAllow = async () => {
        const actionable = selectedSessionsList.filter(s => {
            const isTargetAdmin = (s.users?.role || '').toLowerCase().trim() === 'admin';
            return isTargetAdmin ? isViewerExecutive : true;
        });

        if (actionable.length === 0) return;
        setIsBulkUpdating(true);
        setBulkActionType('allow');
        try {
            const rules = actionable.map(s => ({
                email: s.email || s.users?.email || '',
                user_id: s.user_id,
                display_name: s.users?.display_name || s.hr_employee_name,
                role: s.users?.role,
                is_allow: true,
                allowed_days: s.allowed_days && s.allowed_days.length > 0 ? s.allowed_days : DEFAULT_ALLOWED_DAYS,
                allowed_time_start: s.allowed_time_start || DEFAULT_TIME_START,
                allowed_time_end: s.allowed_time_end || DEFAULT_TIME_END,
                auth_requested: false,
            })).filter(r => Boolean(r.email));

            if (onSaveBulk) {
                await onSaveBulk(rules);
            } else {
                for (const r of rules) {
                    await onUpdateAccessRule(r);
                }
            }
            setSelectedEmails(new Set());
        } finally {
            setIsBulkUpdating(false);
            setBulkActionType(null);
        }
    };

    // Bulk Disallow Action
    const handleBulkDisallow = async () => {
        const actionable = selectedSessionsList.filter(s => {
            const isTargetAdmin = (s.users?.role || '').toLowerCase().trim() === 'admin';
            return isTargetAdmin ? isViewerExecutive : true;
        });

        if (actionable.length === 0) return;

        const confirmed = await confirm({
            title: `Disable Login Access for ${actionable.length} Accounts`,
            message: `Are you sure you want to disable login access for all ${actionable.length} selected users? Users currently online will be logged out immediately.`,
            confirmText: 'Disable All Selected',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });
        if (!confirmed) return;

        setIsBulkUpdating(true);
        setBulkActionType('disallow');
        try {
            const rules = actionable.map(s => ({
                email: s.email || s.users?.email || '',
                user_id: s.user_id,
                display_name: s.users?.display_name || s.hr_employee_name,
                role: s.users?.role,
                is_allow: false,
                allowed_days: s.allowed_days && s.allowed_days.length > 0 ? s.allowed_days : DEFAULT_ALLOWED_DAYS,
                allowed_time_start: s.allowed_time_start || DEFAULT_TIME_START,
                allowed_time_end: s.allowed_time_end || DEFAULT_TIME_END,
                auth_requested: false,
            })).filter(r => Boolean(r.email));

            if (onSaveBulk) {
                await onSaveBulk(rules);
            } else {
                for (const r of rules) {
                    await onUpdateAccessRule(r);
                }
            }
            setSelectedEmails(new Set());
        } finally {
            setIsBulkUpdating(false);
            setBulkActionType(null);
        }
    };

    // Bulk Schedule Action (Excludes Admin accounts since Admins don't have shift schedules)
    const schedulableBulkSessions = useMemo(() => {
        return selectedSessionsList.filter(s => (s.users?.role || '').toLowerCase().trim() !== 'admin');
    }, [selectedSessionsList]);

    const handleOpenBulkSchedule = () => {
        if (schedulableBulkSessions.length === 0) return;
        setIsBulkScheduleModalOpen(true);
    };

    const formatTimeWindow = (start?: string, end?: string) => {
        const s = start || DEFAULT_TIME_START;
        const e = end || DEFAULT_TIME_END;
        if (s === '00:00' && (e === '23:59' || e === '24:00')) {
            return '24/7 (All Day)';
        }
        const formatAmPm = (t: string) => {
            const [hStr, mStr] = t.split(':');
            const h = parseInt(hStr, 10);
            if (isNaN(h)) return t;
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 === 0 ? 12 : h % 12;
            return `${h12}:${mStr || '00'} ${period}`;
        };
        return `${formatAmPm(s)} - ${formatAmPm(e)}`;
    };

    return (
        <div className="space-y-4">
            {/* Live Realtime Status & Pending Requests Alert Banner */}
            {pendingRequestsCount > 0 && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-400/40 dark:border-amber-700/50 shadow-[3px_3px_8px_rgba(217,119,6,0.15),-2px_-2px_6px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.4)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                        </span>
                        <div>
                            <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                                {pendingRequestsCount} Pending Login Authorization Request{pendingRequestsCount > 1 ? 's' : ''}
                            </p>
                            <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                                Users outside allowed hours or without active permissions are awaiting approval.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleStatusFilterChange('pending')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/80 shadow-[2px_2px_5px_rgba(217,119,6,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                        <i className="fas fa-filter text-[10px]" />
                        <span>Review Requests</span>
                    </button>
                </div>
            )}

            {/* Control Bar: Search & Status Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Search with Debounce Indicator */}
                <div className="relative flex-1 max-w-md">
                    <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                        type="text"
                        value={localSearchInput}
                        onChange={(e) => setLocalSearchInput(e.target.value)}
                        placeholder="Search by user, email, or role..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-full text-xs sm:text-sm bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 text-slate-800 dark:text-slate-100"
                    />
                    {localSearchInput && (
                        <button
                            type="button"
                            onClick={() => setLocalSearchInput('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                        >
                            <i className="fas fa-times text-xs" />
                        </button>
                    )}
                </div>

                {/* Status Filter Buttons + Realtime Status Badge */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {/* Live Realtime Indicator */}
                    <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#ebf0f7] dark:bg-[#1d1e28] border border-white/80 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] shrink-0"
                        title={isRealtimeActive ? 'Realtime sync connected: Instant updates for schedule & permission changes' : 'Reconnecting realtime...'}
                    >
                        <span className="relative flex h-2 w-2">
                            {isRealtimeActive && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isRealtimeActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">Live</span>
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="ml-1 text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 cursor-pointer transition-colors p-0.5"
                                title="Sync now"
                            >
                                <i className={`fas fa-rotate-right text-[10px] ${isLoading ? 'fa-spin text-pink-500' : ''}`} />
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => handleStatusFilterChange('all')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                            filterStatus === 'all'
                                ? 'bg-pink-600 text-white border border-pink-400/80 shadow-[2px_2px_6px_rgba(219,39,119,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]'
                                : 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/80 dark:border-[#2a2b38] hover:bg-[#e4ebf5] dark:hover:bg-[#232533] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                        }`}
                    >
                        <span>All Users</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {nonExecutiveSessions.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStatusFilterChange('pending')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            filterStatus === 'pending'
                                ? 'bg-amber-500 text-white border border-amber-300/80 shadow-[2px_2px_6px_rgba(217,119,6,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]'
                                : 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-amber-700 dark:text-amber-300 border border-white/80 dark:border-[#2a2b38] hover:bg-amber-50/50 shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                        }`}
                    >
                        <span>Authorization Requested</span>
                        {pendingRequestsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-black animate-pulse">
                                {pendingRequestsCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStatusFilterChange('allowed')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            filterStatus === 'allowed'
                                ? 'bg-pink-600 text-white border border-pink-400/80 shadow-[2px_2px_6px_rgba(219,39,119,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]'
                                : 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-pink-700 dark:text-pink-300 border border-white/80 dark:border-[#2a2b38] hover:bg-pink-50/50 shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                        }`}
                    >
                        <span>Allowed</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'allowed' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {allowedCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStatusFilterChange('disallowed')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            filterStatus === 'disallowed'
                                ? 'bg-rose-600 text-white border border-rose-400/80 shadow-[2px_2px_6px_rgba(225,29,72,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)]'
                                : 'bg-[#ebf0f7] dark:bg-[#1d1e28] text-rose-700 dark:text-rose-300 border border-white/80 dark:border-[#2a2b38] hover:bg-rose-50/50 shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                        }`}
                    >
                        <span>Disabled</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterStatus === 'disallowed' ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {disallowedCount}
                        </span>
                    </button>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedEmails.size > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#181924] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.95)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-pink-600 text-white font-bold text-xs flex items-center justify-center border border-pink-400/80 shadow-[2px_2px_5px_rgba(219,39,119,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]">
                            {selectedEmails.size}
                        </span>
                        <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {selectedEmails.size} account{selectedEmails.size > 1 ? 's' : ''} selected
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Perform batch actions across all selected accounts
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                        {/* Bulk Allow Button */}
                        <button
                            type="button"
                            disabled={isBulkUpdating}
                            onClick={handleBulkAllow}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white border border-pink-400/80 shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                            title="Allow login access for selected users"
                        >
                            {isBulkUpdating && bulkActionType === 'allow' ? (
                                <>
                                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                                    <span>Allowing...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check text-[11px]" />
                                    <span>Allow Selected</span>
                                </>
                            )}
                        </button>

                        {/* Bulk Disallow Button */}
                        <button
                            type="button"
                            disabled={isBulkUpdating}
                            onClick={handleBulkDisallow}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/80 shadow-[3px_3px_7px_rgba(225,29,72,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                            title="Disable login access for selected users"
                        >
                            {isBulkUpdating && bulkActionType === 'disallow' ? (
                                <i className="fas fa-circle-notch fa-spin text-[11px]" />
                            ) : (
                                <i className="fas fa-ban text-[11px]" />
                            )}
                            <span>Disallow Selected</span>
                        </button>

                        {/* Bulk Schedule Button (Only shown/enabled if there are non-Admin accounts selected) */}
                        {schedulableBulkSessions.length > 0 && (
                            <button
                                type="button"
                                disabled={isBulkUpdating}
                                onClick={handleOpenBulkSchedule}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white border border-pink-400/80 shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                                title="Configure working hours & days for selected users"
                            >
                                <i className="fas fa-sliders text-[11px]" />
                                <span>Bulk Schedule ({schedulableBulkSessions.length})</span>
                            </button>
                        )}

                        {/* Clear Selection */}
                        <button
                            type="button"
                            disabled={isBulkUpdating}
                            onClick={handleClearSelection}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#1e1f2c] hover:bg-[#e2e9f3] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer active:scale-95"
                        >
                            Deselect
                        </button>
                    </div>
                </div>
            )}

            {/* Table / List */}
            <div className="bg-[#ebf0f7] dark:bg-[#181924] border border-white/80 dark:border-white/[0.08] rounded-3xl shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.95)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-1px_-1px_3px_rgba(255,255,255,0.03)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/60 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {/* Checkbox Select All Column */}
                                <th className="py-3.5 px-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllPageSelected && selectablePaginatedList.length > 0}
                                        onChange={handleToggleSelectAllPage}
                                        className="rounded border-slate-300 dark:border-slate-600 text-pink-600 focus:ring-pink-500 cursor-pointer h-4 w-4"
                                        title="Select/Deselect all actionable on this page"
                                    />
                                </th>
                                <th className="py-3.5 px-4">User Details</th>
                                <th className="py-3.5 px-4">Role</th>
                                <th className="py-3.5 px-4">Login Access</th>
                                <th className="py-3.5 px-4">Allowed Days</th>
                                <th className="py-3.5 px-4">Allowed Hours</th>
                                <th className="py-3.5 px-4">Auth Status</th>
                                <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/50 dark:divide-white/[0.04] text-xs">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">
                                        <i className="fas fa-circle-notch fa-spin text-lg text-pink-500 mb-2 block" />
                                        <span>Loading user access controls...</span>
                                    </td>
                                </tr>
                            ) : paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">
                                        <i className="fas fa-user-shield text-2xl text-slate-300 dark:text-slate-600 mb-2 block" />
                                        <p className="font-semibold">No user access records found</p>
                                        <p className="text-[11px] text-slate-400">
                                             {localSearchInput ? 'Try adjusting your search criteria' : 'Accounts will appear here upon registration'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map(session => {
                                    const email = session.email || session.users?.email || '';
                                    const displayName = session.users?.display_name || session.hr_employee_name || email;
                                    const role = session.users?.role || 'Employee';
                                    const isTargetAdmin = role.toLowerCase().trim() === 'admin';
                                    
                                    // Executive can allow/disallow Admin; Admin viewer CANNOT allow/disallow another Admin
                                    const canModifyLogin = isTargetAdmin ? isViewerExecutive : true;
                                    // Admin scheduling button is completely removed
                                    const canSchedule = !isTargetAdmin;

                                    const isAllowed = Boolean(session.is_allow);
                                    const isRequested = Boolean(session.auth_requested);
                                    const isRowUpdating = updatingEmail === email;
                                    const isSelected = selectedEmails.has(email);

                                    return (
                                        <tr
                                            key={session.id || email}
                                            className={`hover:bg-white/50 dark:hover:bg-white/[0.03] transition-colors ${
                                                isSelected ? 'bg-pink-500/[0.05] dark:bg-pink-950/20' : ''
                                            } ${isRequested ? 'bg-amber-500/[0.06] dark:bg-amber-950/20' : ''}`}
                                        >
                                            {/* Row Checkbox */}
                                            <td className="py-3.5 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={!canModifyLogin}
                                                    onChange={() => handleToggleSelectRow(email)}
                                                    className={`rounded border-slate-300 dark:border-slate-600 text-pink-600 focus:ring-pink-500 h-4 w-4 ${
                                                        !canModifyLogin ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                                                    }`}
                                                    title={!canModifyLogin ? 'Only Executive accounts can modify Admin access' : undefined}
                                                />
                                            </td>

                                            {/* User Details */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 ${
                                                        isTargetAdmin 
                                                            ? 'bg-purple-600 border border-purple-400/80 shadow-[2px_2px_5px_rgba(147,51,234,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                                            : 'bg-pink-600 border border-pink-400/80 shadow-[2px_2px_5px_rgba(219,39,119,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                                    }`}>
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                                            {displayName}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                            {email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role */}
                                            <td className="py-3.5 px-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                    isTargetAdmin
                                                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60'
                                                        : 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-900/60'
                                                }`}>
                                                    {role}
                                                </span>
                                            </td>

                                            {/* Login Access Toggle with Loading State */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={!canModifyLogin || isRowUpdating || isBulkUpdating}
                                                        onClick={() => handleQuickToggle(session)}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-all duration-200 ease-in-out focus:outline-none ${
                                                            !canModifyLogin 
                                                                ? 'cursor-not-allowed opacity-40' 
                                                                : 'cursor-pointer disabled:opacity-50 active:scale-95'
                                                        } ${
                                                            isAllowed 
                                                                ? 'bg-pink-600 border border-pink-400/80 shadow-[2px_2px_5px_rgba(219,39,119,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]' 
                                                                : 'bg-slate-300 dark:bg-slate-700 border border-white/60 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]'
                                                        }`}
                                                        title={
                                                            !canModifyLogin
                                                                ? 'Only Executive accounts can modify Admin login access'
                                                                : isAllowed
                                                                ? 'Click to disallow login'
                                                                : 'Click to allow login'
                                                        }
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-flex items-center justify-center h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                isAllowed ? 'translate-x-4' : 'translate-x-0'
                                                            }`}
                                                        >
                                                            {isRowUpdating && (
                                                                <i className="fas fa-circle-notch fa-spin text-[8px] text-pink-600" />
                                                            )}
                                                        </span>
                                                    </button>
                                                    <div className="flex items-center gap-1.5">
                                                        {isRowUpdating ? (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-100/90 dark:bg-pink-950/70 border border-pink-200 dark:border-pink-900/50">
                                                                <span className="text-[10px] font-extrabold text-pink-700 dark:text-pink-300 tracking-tight animate-pulse">
                                                                    Saving...
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className={`text-[11px] font-bold ${
                                                                isAllowed ? 'text-pink-600 dark:text-pink-400' : 'text-slate-500 dark:text-slate-400'
                                                            }`}>
                                                                {isAllowed ? 'Allowed' : 'Disabled'}
                                                            </span>
                                                        )}
                                                        {!canModifyLogin && (
                                                            <i className="fas fa-lock text-[10px] text-slate-400 ml-0.5" title="Managed by Executive only" />
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Allowed Days */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {(session.allowed_days && session.allowed_days.length > 0 ? session.allowed_days : DEFAULT_ALLOWED_DAYS).map(d => (
                                                        <span
                                                            key={d}
                                                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#e2e9f3] dark:bg-[#11121a] text-slate-700 dark:text-slate-300 border border-white/60 dark:border-white/[0.04]"
                                                        >
                                                            {d.slice(0, 3)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Allowed Hours */}
                                            <td className="py-3.5 px-4">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                                                    <i className="fas fa-clock text-slate-400 text-[10px]" />
                                                    {formatTimeWindow(session.allowed_time_start, session.allowed_time_end)}
                                                </span>
                                            </td>

                                            {/* Auth Status & Indicator */}
                                            <td className="py-3.5 px-4">
                                                {isRequested ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-[10px] font-bold animate-pulse">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                        </span>
                                                        <span>Authorization Requested</span>
                                                    </div>
                                                ) : isAllowed ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-pink-600 dark:text-pink-400 font-semibold">
                                                        <i className="fas fa-check-circle text-xs text-pink-500" />
                                                        <span>Active</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                                        <i className="fas fa-minus-circle text-xs" />
                                                        <span>No Request</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {isRequested ? (
                                                        <button
                                                            type="button"
                                                            disabled={isRowUpdating || isBulkUpdating}
                                                            onClick={() => {
                                                                setSelectedSessionForEdit(session);
                                                                setShowEditModal(true);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 border border-sky-400/80 shadow-[2px_2px_5px_rgba(2,132,199,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                                            title="Extend schedule and configure authorization"
                                                        >
                                                            <i className="fas fa-clock text-[10px]" />
                                                            <span>Extend</span>
                                                        </button>
                                                    ) : canSchedule ? (
                                                        <button
                                                            type="button"
                                                            disabled={isRowUpdating || isBulkUpdating}
                                                            onClick={() => {
                                                                setSelectedSessionForEdit(session);
                                                                setShowEditModal(true);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f0f3f8] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#282a3a] text-slate-800 dark:text-slate-100 border border-white/90 dark:border-white/[0.1] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                                            title="Configure allowed days & hours"
                                                        >
                                                            <i className="fas fa-sliders text-[10px] text-pink-500" />
                                                            <span>Schedule</span>
                                                        </button>
                                                    ) : null}
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
                {totalCount > 0 && (
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Showing {paginatedList.length} of {totalCount} users
                        </span>
                        <Pagination
                            currentPage={safeCurrentPage}
                            totalPages={computedTotalPages}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {/* Edit Access Schedule Modal (Single User) */}
            <EditAccessScheduleModal
                isOpen={showEditModal}
                session={selectedSessionForEdit}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedSessionForEdit(null);
                }}
                onSave={onUpdateAccessRule}
                onSaveBulk={onSaveBulk}
            />

            {/* Edit Access Schedule Modal (Bulk Users) */}
            <EditAccessScheduleModal
                isOpen={isBulkScheduleModalOpen}
                bulkSessions={schedulableBulkSessions}
                onClose={() => {
                    setIsBulkScheduleModalOpen(false);
                    setSelectedEmails(new Set());
                }}
                onSave={onUpdateAccessRule}
                onSaveBulk={onSaveBulk}
            />
        </div>
    );
};
