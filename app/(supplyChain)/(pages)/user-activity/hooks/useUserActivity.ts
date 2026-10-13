'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { user } from '../../../lib/services/Class/user';
import { supabase } from '../../../lib/services/client/supabase';
import { Session, BlockedDevice, Appeal, UserActivity } from '../types';
import { isRateLimited, sanitizeText } from '../utils/formatters';
import { DEFAULT_ALLOWED_DAYS, DEFAULT_TIME_START, DEFAULT_TIME_END } from '../../../lib/services/userAccessService';

const ITEMS_PER_PAGE = 30;

export function useUserActivity() {
    const { confirm } = useConfirm();

    // raw data from supabase
    const [sessions, setSessions] = useState<Session[]>([]);
    const [accessControlList, setAccessControlList] = useState<Session[]>([]);
    const [activeUsers, setActiveUsers] = useState<Session[]>([]);
    const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [appeals, setAppeals] = useState<Appeal[]>([]);

    // status states
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);

    // action loading states
    const [blockingSessionId, setBlockingSessionId] = useState<string | null>(null);
    const [isBulkBlockingSessions, setIsBulkBlockingSessions] = useState(false);
    const [isBulkDeletingSessions, setIsBulkDeletingSessions] = useState(false);

    const [unblockingDeviceId, setUnblockingDeviceId] = useState<string | null>(null);
    const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
    const [isBulkUnblockingDevices, setIsBulkUnblockingDevices] = useState(false);
    const [isBulkDeletingDevices, setIsBulkDeletingDevices] = useState(false);

    const [approvingAppealId, setApprovingAppealId] = useState<string | null>(null);
    const [rejectingAppealId, setRejectingAppealId] = useState<string | null>(null);
    const [deletingAppealId, setDeletingAppealId] = useState<string | null>(null);
    const [isBulkApprovingAppeals, setIsBulkApprovingAppeals] = useState(false);
    const [isBulkRejectingAppeals, setIsBulkRejectingAppeals] = useState(false);
    const [isBulkDeletingAppeals, setIsBulkDeletingAppeals] = useState(false);

    const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
    const [isBulkTerminating, setIsBulkTerminating] = useState(false);
    const [isBulkDeletingActivities, setIsBulkDeletingActivities] = useState(false);

    // search & filter state
    const [sessionSearchTerm, setSessionSearchTerm] = useState('');
    const [accessControlSearchTerm, setAccessControlSearchTerm] = useState('');
    const [activeUserSearchTerm, setActiveUserSearchTerm] = useState('');
    const [activitySearchTerm, setActivitySearchTerm] = useState('');
    const [activityActionFilter, setActivityActionFilter] = useState<string>('all');
    const [blockedSearchTerm, setBlockedSearchTerm] = useState('');
    const [appealSearchTerm, setAppealSearchTerm] = useState('');
    const [appealStatusFilter, setAppealStatusFilter] = useState<string>('all');

    // selections
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
    const [selectedActiveUsers, setSelectedActiveUsers] = useState<Set<string>>(new Set());
    const [selectedBlockedDevices, setSelectedBlockedDevices] = useState<Set<string>>(new Set());
    const [selectedAppeals, setSelectedAppeals] = useState<Set<string>>(new Set());
    const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());

    const [userRole, setUserRole] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    // pagination states
    const [sessionPage, setSessionPage] = useState(1);
    const [accessControlPage, setAccessControlPage] = useState(1);
    const [activeUserPage, setActiveUserPage] = useState(1);
    const [blockedPage, setBlockedPage] = useState(1);
    const [appealPage, setAppealPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);

    // slot & queue stats
    const [queuedUsersCount, setQueuedUsersCount] = useState<number>(0);
    const [queuedRolesCount, setQueuedRolesCount] = useState<Record<string, number>>({});
    const [slotStats, setSlotStats] = useState<{
        executive: { reserved: number; active: number; available: number };
        manager: { reserved: number; active: number; available: number };
        employee: { reserved: number; active: number; available: number };
        supplier: { reserved: number; active: number; available: number };
        totalActive: number;
        maxCapacity: number;
    }>({
        executive: { reserved: 10, active: 0, available: 10 },
        manager: { reserved: 20, active: 0, available: 20 },
        employee: { reserved: 70, active: 0, available: 70 },
        supplier: { reserved: 10, active: 0, available: 10 },
        totalActive: 0,
        maxCapacity: 110,
    });

    const isMounted = useRef(true);
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const debouncedFetch = useCallback((key: string, callback: () => void, delay = 300) => {
        if (debounceTimers.current[key]) {
            clearTimeout(debounceTimers.current[key]);
        }
        debounceTimers.current[key] = setTimeout(() => {
            if (isMounted.current) {
                callback();
            }
        }, delay);
    }, []);

    // 1. Fetch Sessions & Access Control Rules (Sessions & Access Control Tabs)
    const fetchSessions = useCallback(async (isSilent = false) => {
        try {
            const [blockedResult, sessionsResult, accessRulesRes, usersResult] = await Promise.all([
                supabase
                    .from('blocked_devices')
                    .select('id, user_agent, ip_address, email, status')
                    .eq('status', 'blocked'),
                supabase
                    .from('sessions')
                    .select(`
                        *,
                        users!inner(
                            display_name,
                            email,
                            role
                        )
                    `)
                    .order('created_at', { ascending: false }),
                fetch('/api/supplyChain/user-access-control').then(r => r.ok ? r.json() : null).catch(() => null),
                supabase
                    .from('users')
                    .select('id, display_name, email, role, department')
            ]);

            if (blockedResult.error) throw blockedResult.error;
            if (sessionsResult.error) throw sessionsResult.error;

            const blockedData = blockedResult.data || [];
            const sessionsData = sessionsResult.data || [];
            const accessRulesMap = (accessRulesRes?.rules || {}) as Record<string, any>;
            const usersData = usersResult.data || [];

            // fetch ai chatbot moderation strike and lockout states
            const moderationMap = new Map();
            try {
                const modRes = await fetch('/ai/api/moderation-status?all=true');
                if (modRes.ok) {
                    const modData = await modRes.json();
                    if (modData.success && modData.states) {
                        Object.entries(modData.states).forEach(([key, state]: [string, any]) => {
                            moderationMap.set(key, state);
                        });
                    }
                }
            } catch (e) {
                // non-critical
            }

            const blockedMap = new Map();
            blockedData.forEach(d => {
                const key = `${d.user_agent}_${d.ip_address || 'unknown'}_${d.email || ''}`;
                blockedMap.set(key, d.id);
            });

            const sessionsWithBlockStatus: Session[] = sessionsData.map(session => {
                const sessionEmail = session.email || session.users?.email || '';
                const emailKey = sessionEmail.toLowerCase().trim();
                const key = `${session.user_agent}_${session.ip_address || 'unknown'}_${sessionEmail}`;
                const blockedDeviceId = blockedMap.get(key);
                const modState = moderationMap.get(session.user_id) || moderationMap.get(sessionEmail) || moderationMap.get(session.ip_address);
                const accessRule = accessRulesMap[emailKey];
                const isManagement = ['admin', 'executive'].includes((session.users?.role || '').toLowerCase().trim());

                const isAllowValue = session.is_allow !== null && session.is_allow !== undefined
                    ? Boolean(session.is_allow)
                    : (accessRule !== undefined ? Boolean(accessRule.is_allow) : true);
                
                let allowedDaysValue = session.allowed_days;
                if (typeof allowedDaysValue === 'string') {
                    try { allowedDaysValue = JSON.parse(allowedDaysValue); } catch { allowedDaysValue = allowedDaysValue.split(',').map((d: string) => d.trim()); }
                }
                if (!Array.isArray(allowedDaysValue) || allowedDaysValue.length === 0) {
                    allowedDaysValue = accessRule?.allowed_days || DEFAULT_ALLOWED_DAYS;
                }

                const startTimeValue = session.allowed_time_start || accessRule?.allowed_time_start || DEFAULT_TIME_START;
                const endTimeValue = session.allowed_time_end || accessRule?.allowed_time_end || DEFAULT_TIME_END;
                const authReqValue = session.auth_requested !== null && session.auth_requested !== undefined
                    ? Boolean(session.auth_requested)
                    : Boolean(accessRule?.auth_requested);
                const authReqAtValue = session.auth_requested_at || accessRule?.auth_requested_at || null;

                return {
                    ...session,
                    is_blocked: !!blockedDeviceId,
                    blocked_device_id: blockedDeviceId || undefined,
                    strikes: modState?.strikes || 0,
                    is_locked_out: modState?.isLockedOut || false,
                    lockout_remaining_seconds: modState?.lockoutRemainingSeconds || 0,
                    is_allow: isAllowValue,
                    allowed_days: allowedDaysValue,
                    allowed_time_start: startTimeValue,
                    allowed_time_end: endTimeValue,
                    auth_requested: authReqValue,
                    auth_requested_at: authReqAtValue,
                    auth_request_message: accessRule?.auth_request_message || null,
                };
            });

            // Combine unique accounts into access control list (excluding Executive accounts)
            const seenEmails = new Set<string>();
            const fullAccessList: Session[] = [];

            sessionsWithBlockStatus.forEach(s => {
                const sRole = (s.users?.role || '').toLowerCase().trim();
                if (sRole === 'executive') return; // Executive is completely excluded from Access Control

                const em = (s.email || s.users?.email || '').toLowerCase().trim();
                if (em && !seenEmails.has(em)) {
                    seenEmails.add(em);
                    fullAccessList.push(s);
                }
            });

            usersData.forEach(u => {
                const uRole = (u.role || '').toLowerCase().trim();
                if (uRole === 'executive') return; // Executive is completely excluded from Access Control

                const em = (u.email || '').toLowerCase().trim();
                if (em && !seenEmails.has(em)) {
                    seenEmails.add(em);
                    const accessRule = accessRulesMap[em];
                    const isAdmin = uRole === 'admin';

                    fullAccessList.push({
                        id: `user_${u.id}`,
                        user_id: u.id,
                        session_token: '',
                        expires_at: '',
                        expires_at_remember: null,
                        ip_address: '—',
                        user_agent: '—',
                        created_at: new Date().toISOString(),
                        is_active: false,
                        email: u.email,
                        hr_employee_name: u.display_name,
                        remember_me: false,
                        users: {
                            display_name: u.display_name,
                            email: u.email,
                            role: u.role,
                            department: u.department,
                        },
                        is_allow: accessRule !== undefined ? Boolean(accessRule.is_allow) : true,
                        allowed_days: accessRule?.allowed_days || DEFAULT_ALLOWED_DAYS,
                        allowed_time_start: accessRule?.allowed_time_start || DEFAULT_TIME_START,
                        allowed_time_end: accessRule?.allowed_time_end || DEFAULT_TIME_END,
                        auth_requested: Boolean(accessRule?.auth_requested),
                        auth_requested_at: accessRule?.auth_requested_at || null,
                        auth_request_message: accessRule?.auth_request_message || null,
                    });
                }
            });

            if (isMounted.current) {
                setSessions(sessionsWithBlockStatus);
                setAccessControlList(fullAccessList);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
            if (!isSilent) toast.error('Failed to fetch sessions');
        }
    }, []);

    // 2. Fetch Active Users & Queue Stats (Active Users Tab)
    const fetchActiveUsers = useCallback(async (isSilent = false) => {
        try {
            const [activeRes, queueStatusRes] = await Promise.all([
                supabase
                    .from('sessions')
                    .select(`
                        *,
                        users!inner(
                            display_name,
                            email,
                            role
                        )
                    `)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false }),
                fetch('/api/supplyChain/queue-status').then(r => (r.ok ? r.json() : null)).catch(() => null)
            ]);

            if (activeRes.error) throw activeRes.error;
            const activeData = activeRes.data || [];

            if (isMounted.current) {
                setActiveUsers(activeData);

                if (queueStatusRes) {
                    setQueuedUsersCount(queueStatusRes.queuedCount || 0);
                    setQueuedRolesCount(queueStatusRes.queuedRolesCount || {});
                    if (queueStatusRes.slots) {
                        setSlotStats({
                            executive: queueStatusRes.slots.executive,
                            manager: queueStatusRes.slots.manager,
                            employee: queueStatusRes.slots.employee,
                            supplier: queueStatusRes.slots.supplier || { reserved: 10, active: 0, available: 10 },
                            totalActive: queueStatusRes.totalActive || activeData.length,
                            maxCapacity: queueStatusRes.maxCapacity || 110,
                        });
                    }
                } else {
                    setQueuedRolesCount({});
                }
            }
        } catch (error) {
            console.error('Error fetching active users:', error);
            if (!isSilent) toast.error('Failed to fetch active users');
        }
    }, []);

    // 3. Fetch Blocked Devices (Blocked Tab)
    const fetchBlockedDevices = useCallback(async (isSilent = false) => {
        try {
            const { data: devices, error: devicesError } = await supabase
                .from('blocked_devices')
                .select('*')
                .eq('status', 'blocked')
                .order('blocked_at', { ascending: false });

            if (devicesError) throw devicesError;

            const devicesWithCount = await Promise.all(
                (devices || []).map(async (device) => {
                    const { count } = await supabase
                        .from('blocked_devices')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_agent', device.user_agent)
                        .eq('ip_address', device.ip_address || '')
                        .eq('email', device.email || '');

                    return {
                        ...device,
                        blocked_count: count || 0,
                    };
                })
            );

            if (isMounted.current) {
                setBlockedDevices(devicesWithCount);
            }
        } catch (error) {
            console.error('Error fetching blocked devices:', error);
            if (!isSilent) toast.error('Failed to fetch blocked devices');
        }
    }, []);

    // 4. Fetch Activity Logs (Activity Log Tab)
    const fetchActivities = useCallback(async (isSilent = false) => {
        try {
            const { data, error } = await supabase
                .from('user_activity')
                .select('*, users!inner(display_name, email)')
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) throw error;
            if (isMounted.current) {
                setActivities(data || []);
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
            if (!isSilent) toast.error('Failed to fetch activities');
        }
    }, []);

    // 5. Fetch Appeals (Appeals Tab)
    const fetchAppeals = useCallback(async (isSilent = false) => {
        try {
            const { data, error } = await supabase
                .from('appeals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (isMounted.current) {
                setAppeals(data || []);
            }
        } catch (error) {
            console.error('Error fetching appeals:', error);
            if (!isSilent) toast.error('Failed to fetch appeals');
        }
    }, []);

    // Fetch all tabs data
    const fetchAllData = useCallback(async (isManual = false) => {
        if (isManual) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            await Promise.all([
                fetchSessions(true),
                fetchActiveUsers(true),
                fetchBlockedDevices(true),
                fetchActivities(true),
                fetchAppeals(true)
            ]);
        } catch (error) {
            console.error('Error fetching all activity data:', error);
            if (isManual) toast.error('Failed to refresh data');
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [fetchSessions, fetchActiveUsers, fetchBlockedDevices, fetchActivities, fetchAppeals]);

    // Realtime postgres subscriptions across all tabs
    useEffect(() => {
        isMounted.current = true;
        const role = user.getRole();
        const userData = user.getUser();
        setUserRole(role);
        setCurrentUserId(userData?.email || '');
        fetchAllData(false);

        const channelId = `user_activity_all_tabs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase
            .channel(channelId)
            // 1. Activity Log tab realtime updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_activity' },
                () => {
                    debouncedFetch('activity', () => fetchActivities(true));
                }
            )
            // 2. Active Users & Sessions tabs realtime updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions' },
                () => {
                    debouncedFetch('sessions', () => {
                        fetchSessions(true);
                        fetchActiveUsers(true);
                    });
                }
            )
            // 3. Blocked Devices, Sessions, Appeals & Active Users tabs realtime updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'blocked_devices' },
                () => {
                    debouncedFetch('blocked', () => {
                        fetchBlockedDevices(true);
                        fetchSessions(true);
                        fetchActiveUsers(true);
                    });
                }
            )
            // 4. Appeals tab realtime updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appeals' },
                () => {
                    debouncedFetch('appeals', () => fetchAppeals(true));
                }
            )
            // 5. Active Users & Access Control: slot allocations, capacity & user permissions realtime updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sc_system_settings' },
                () => {
                    debouncedFetch('settings', () => {
                        fetchSessions(true);
                        fetchActiveUsers(true);
                    });
                }
            )
            // 6. User accounts & role changes across all tabs
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                () => {
                    debouncedFetch('users', () => {
                        fetchSessions(true);
                        fetchActiveUsers(true);
                        fetchActivities(true);
                    });
                }
            )
            // 7. Instant Broadcast Events for Access Control & Auth Requests
            .on(
                'broadcast',
                { event: 'access_control_update' },
                () => {
                    debouncedFetch('sessions', () => {
                        fetchSessions(true);
                        fetchActiveUsers(true);
                    });
                }
            )
            .on(
                'broadcast',
                { event: 'auth_requested' },
                () => {
                    debouncedFetch('sessions', () => {
                        fetchSessions(true);
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' && isMounted.current) {
                    setIsRealtimeActive(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    if (isMounted.current) {
                        setIsRealtimeActive(false);
                    }
                }
            });

        // live background polling interval: keeps active sessions, access control permissions, blocked devices, appeals, activities, slots, and queued users updated in realtime
        const liveQueueInterval = setInterval(() => {
            if (isMounted.current) {
                fetchActiveUsers(true);
                fetchSessions(true);
                fetchBlockedDevices(true);
                fetchAppeals(true);
                fetchActivities(true);
            }
        }, 5000);

        // interval: updates active countdowns dynamically when any strike exists
        const pollInterval = setInterval(() => {
            if (isMounted.current) {
                setSessions(prev => {
                    const hasStrikes = prev.some(s => (s.strikes || 0) > 0 || s.is_locked_out);
                    if (hasStrikes) {
                        fetchSessions(true);
                    }
                    return prev;
                });
            }
        }, 10000);

        return () => {
            isMounted.current = false;
            Object.values(debounceTimers.current).forEach(t => clearTimeout(t));
            clearInterval(liveQueueInterval);
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [fetchAllData, debouncedFetch, fetchActivities, fetchSessions, fetchActiveUsers, fetchBlockedDevices, fetchAppeals]);

    // Reactive filtering for all tabs that preserves active user searches upon realtime updates
    const filteredSessions = useMemo(() => {
        if (!sessionSearchTerm.trim()) return sessions;
        const term = sessionSearchTerm.toLowerCase();
        return sessions.filter(session =>
            session.user_agent?.toLowerCase().includes(term) ||
            session.ip_address?.toLowerCase().includes(term) ||
            session.email?.toLowerCase().includes(term) ||
            session.hr_employee_name?.toLowerCase().includes(term) ||
            session.users?.display_name?.toLowerCase().includes(term)
        );
    }, [sessions, sessionSearchTerm]);

    const filteredAccessControl = useMemo(() => {
        if (!accessControlSearchTerm.trim()) return accessControlList;
        const term = accessControlSearchTerm.toLowerCase();
        return accessControlList.filter(session =>
            session.email?.toLowerCase().includes(term) ||
            session.hr_employee_name?.toLowerCase().includes(term) ||
            session.users?.display_name?.toLowerCase().includes(term) ||
            session.users?.role?.toLowerCase().includes(term)
        );
    }, [accessControlList, accessControlSearchTerm]);

    const filteredActiveUsers = useMemo(() => {
        if (!activeUserSearchTerm.trim()) return activeUsers;
        const term = activeUserSearchTerm.toLowerCase();
        return activeUsers.filter(session =>
            session.user_agent?.toLowerCase().includes(term) ||
            session.ip_address?.toLowerCase().includes(term) ||
            session.email?.toLowerCase().includes(term) ||
            session.hr_employee_name?.toLowerCase().includes(term) ||
            session.users?.display_name?.toLowerCase().includes(term) ||
            session.users?.role?.toLowerCase().includes(term)
        );
    }, [activeUsers, activeUserSearchTerm]);

    const filteredBlockedDevices = useMemo(() => {
        if (!blockedSearchTerm.trim()) return blockedDevices;
        const term = blockedSearchTerm.toLowerCase();
        return blockedDevices.filter(d =>
            d.device_name?.toLowerCase().includes(term) ||
            d.user_agent?.toLowerCase().includes(term) ||
            d.ip_address?.toLowerCase().includes(term) ||
            d.email?.toLowerCase().includes(term) ||
            d.reason?.toLowerCase().includes(term) ||
            d.status?.toLowerCase().includes(term)
        );
    }, [blockedDevices, blockedSearchTerm]);

    const filteredAppeals = useMemo(() => {
        let list = appeals;
        if (appealSearchTerm.trim()) {
            const term = appealSearchTerm.toLowerCase();
            list = list.filter(a =>
                a.user_name?.toLowerCase().includes(term) ||
                a.user_email?.toLowerCase().includes(term) ||
                a.appeal_message?.toLowerCase().includes(term) ||
                a.response_message?.toLowerCase().includes(term) ||
                a.status?.toLowerCase().includes(term)
            );
        }

        if (appealStatusFilter !== 'all') {
            list = list.filter(a => a.status === appealStatusFilter);
        }

        return list;
    }, [appeals, appealSearchTerm, appealStatusFilter]);

    const filteredActivities = useMemo(() => {
        let list = activities;
        if (activitySearchTerm.trim()) {
            const term = activitySearchTerm.toLowerCase();
            list = list.filter(activity =>
                activity.action?.toLowerCase().includes(term) ||
                activity.module?.toLowerCase().includes(term) ||
                activity.description?.toLowerCase().includes(term) ||
                activity.ip_address?.toLowerCase().includes(term) ||
                activity.users?.display_name?.toLowerCase().includes(term) ||
                activity.users?.email?.toLowerCase().includes(term)
            );
        }

        if (activityActionFilter !== 'all') {
            list = list.filter(activity => activity.action === activityActionFilter);
        }

        return list;
    }, [activities, activitySearchTerm, activityActionFilter]);

    // Total pages calculations
    const sessionTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE)), [filteredSessions]);
    const accessControlTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredAccessControl.length / ITEMS_PER_PAGE)), [filteredAccessControl]);
    const activeUserTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredActiveUsers.length / ITEMS_PER_PAGE)), [filteredActiveUsers]);
    const blockedTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredBlockedDevices.length / ITEMS_PER_PAGE)), [filteredBlockedDevices]);
    const appealTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredAppeals.length / ITEMS_PER_PAGE)), [filteredAppeals]);
    const activityTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredActivities.length / ITEMS_PER_PAGE)), [filteredActivities]);

    // Compatibility filter helpers for parent wrapper
    const filterSessions = useCallback((term: string) => {
        setSessionSearchTerm(term);
        setSessionPage(1);
    }, []);

    const filterAccessControl = useCallback((term: string) => {
        setAccessControlSearchTerm(term);
        setAccessControlPage(1);
    }, []);

    const filterActiveUsers = useCallback((term: string) => {
        setActiveUserSearchTerm(term);
        setActiveUserPage(1);
    }, []);

    const filterBlockedDevices = useCallback((term: string) => {
        setBlockedSearchTerm(term);
        setBlockedPage(1);
    }, []);

    const filterAppeals = useCallback((term: string, filter = 'all') => {
        setAppealSearchTerm(term);
        setAppealStatusFilter(filter);
        setAppealPage(1);
    }, []);

    const filterActivities = useCallback((term: string, filter: string) => {
        setActivitySearchTerm(term);
        setActivityActionFilter(filter);
        setActivityPage(1);
    }, []);

    const isTargetUserAdmin = async (userId: string): Promise<boolean> => {
        try {
            const { data } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single();
            return data?.role === 'Admin' || data?.role === 'Executive';
        } catch (error) {
            console.error('Error checking user role:', error);
            return false;
        }
    };

    // Actions
    const handleBlockDevice = async (sessionId: string, userAgent: string, ipAddress?: string, userName?: string, email?: string) => {
        const session = sessions.find(s => s.id === sessionId);
        const sessionRole = session?.users?.role;
        if (sessionRole === 'Admin' || sessionRole === 'Executive') {
            toast.warning('Cannot block Admin or Executive users');
            return;
        }
        if (session?.user_id) {
            const isProtected = await isTargetUserAdmin(session.user_id);
            if (isProtected) {
                toast.warning('Cannot block Admin or Executive users');
                return;
            }
        }

        const confirmed = await confirm({
            title: 'Block Device',
            message: `Are you sure you want to block this device?\n\nDevice: ${userName || 'Unknown'}\nIP: ${ipAddress || 'Unknown'}\nEmail: ${email || 'Unknown'}`,
            confirmText: 'Block Device',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setBlockingSessionId(sessionId);
        try {
            const userId = session?.user_id || currentUserId || '00000000-0000-0000-0000-000000000000';
            const userEmail = email || session?.email || session?.users?.email || '';

            const { data: existingDevice, error: checkError } = await supabase
                .from('blocked_devices')
                .select('id, status')
                .eq('user_agent', userAgent)
                .eq('ip_address', ipAddress || '')
                .eq('email', userEmail)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingDevice) {
                if (existingDevice.status === 'blocked') {
                    toast.warning('This device is already blocked');
                    await fetchSessions(true);
                    return;
                } else if (existingDevice.status === 'unblocked') {
                    const { error: updateError } = await supabase
                        .from('blocked_devices')
                        .update({
                            status: 'blocked',
                            blocked_at: new Date().toISOString(),
                            blocked_by: userId,
                            reason: 'Blocked by admin',
                            updated_at: new Date().toISOString(),
                            unblocked_at: null,
                        })
                        .eq('id', existingDevice.id);

                    if (updateError) throw updateError;
                }
            } else {
                const { error: insertError } = await supabase
                    .from('blocked_devices')
                    .insert({
                        user_id: userId,
                        device_name: userName || 'Unknown Device',
                        user_agent: userAgent,
                        ip_address: ipAddress || 'Unknown',
                        status: 'blocked',
                        email: userEmail,
                        reason: 'Blocked by admin',
                        blocked_at: new Date().toISOString(),
                        blocked_by: userId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) throw insertError;
            }

            // Deactivate any matching active sessions so the target user is logged out immediately in realtime
            await supabase
                .from('sessions')
                .update({
                    is_active: false,
                    in_queue: false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sessionId);

            if (userEmail) {
                await supabase
                    .from('sessions')
                    .update({
                        is_active: false,
                        in_queue: false,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('email', userEmail);
            }

            // Log activity
            await supabase
                .from('user_activity')
                .insert({
                    user_id: userId,
                    user_email: userEmail,
                    action: 'DEVICE_BLOCKED',
                    description: `Device blocked by administrator: ${userName || 'Unknown'} (${userAgent})`,
                    created_at: new Date().toISOString(),
                });

            toast.success('Device blocked successfully');
            await fetchAllData(true);
        } catch (error: any) {
            console.error('Error blocking device:', error);
            toast.error(`Failed to block device: ${error?.message || 'Unknown error'}`);
        } finally {
            if (isMounted.current) {
                setBlockingSessionId(null);
            }
        }
    };

    const handleResetStrikes = async (identifier: string) => {
        try {
            const res = await fetch('/ai/api/moderation-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset', identifier }),
            });
            if (res.ok) {
                toast.success('Moderation strikes reset successfully');
                await fetchSessions(true);
            }
        } catch (e) {
            toast.error('Failed to reset strikes');
        }
    };

    const handleUnblockDevice = async (deviceId: string, email: string) => {
        const confirmed = await confirm({
            title: 'Unblock Device',
            message: 'Are you sure you want to unblock this device?',
            confirmText: 'Unblock',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setUnblockingDeviceId(deviceId);
        try {
            await supabase
                .from('blocked_devices')
                .update({
                    status: 'unblocked',
                    unblocked_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', deviceId)
                .eq('email', email);

            toast.success('Device unblocked successfully');
            await fetchAllData(true);
        } catch (error) {
            console.error('Error unblocking device:', error);
            toast.error('Failed to unblock device');
        } finally {
            if (isMounted.current) {
                setUnblockingDeviceId(null);
            }
        }
    };

    const handleDeleteDevice = async (deviceId: string) => {
        const confirmed = await confirm({
            title: 'Delete Device Record',
            message: 'Are you sure you want to delete this device record?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setDeletingDeviceId(deviceId);
        try {
            await supabase
                .from('blocked_devices')
                .delete()
                .eq('id', deviceId);

            toast.success('Device record deleted');
            await fetchAllData(true);
        } catch (error) {
            console.error('Error deleting device:', error);
            toast.error('Failed to delete device');
        } finally {
            if (isMounted.current) {
                setDeletingDeviceId(null);
            }
        }
    };

    const handleApproveAppeal = async (appealId: string) => {
        const confirmed = await confirm({
            title: 'Approve Appeal',
            message: 'Are you sure you want to approve this appeal? The device will be unblocked.',
            confirmText: 'Approve',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setApprovingAppealId(appealId);
        try {
            const appeal = appeals.find(a => a.id === appealId);
            if (!appeal) return;

            await supabase
                .from('appeals')
                .update({
                    status: 'approved',
                    resolved_at: new Date().toISOString(),
                    resolved_by: user.getEmail() || 'Admin',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', appealId);

            await supabase
                .from('blocked_devices')
                .update({
                    status: 'unblocked',
                    unblocked_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', appeal.blocked_device_id);

            toast.success('Appeal approved and device unblocked');
            await fetchAllData(true);
        } catch (error) {
            console.error('Error approving appeal:', error);
            toast.error('Failed to approve appeal');
        } finally {
            if (isMounted.current) {
                setApprovingAppealId(null);
            }
        }
    };

    const handleRejectAppeal = async (appealId: string) => {
        const confirmed = await confirm({
            title: 'Reject Appeal',
            message: 'Are you sure you want to reject this appeal? The device will remain blocked.',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setRejectingAppealId(appealId);
        try {
            await supabase
                .from('appeals')
                .update({
                    status: 'rejected',
                    resolved_at: new Date().toISOString(),
                    resolved_by: user.getEmail() || 'Admin',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', appealId);

            toast.success('Appeal rejected');
            await fetchAllData(true);
        } catch (error) {
            console.error('Error rejecting appeal:', error);
            toast.error('Failed to reject appeal');
        } finally {
            if (isMounted.current) {
                setRejectingAppealId(null);
            }
        }
    };

    const handleDeleteAppeal = async (appealId: string) => {
        const confirmed = await confirm({
            title: 'Delete Appeal',
            message: 'Are you sure you want to delete this appeal? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setDeletingAppealId(appealId);
        try {
            await supabase
                .from('appeals')
                .delete()
                .eq('id', appealId);

            toast.success('Appeal deleted successfully');
            await fetchAllData(true);
        } catch (error) {
            console.error('Error deleting appeal:', error);
            toast.error('Failed to delete appeal');
        } finally {
            if (isMounted.current) {
                setDeletingAppealId(null);
            }
        }
    };

    const handleSendResponse = async (selectedAppeal: Appeal, responseMessage: string) => {
        if (!selectedAppeal || !responseMessage.trim()) {
            toast.warning('Please enter a response message');
            return false;
        }

        try {
            await supabase
                .from('appeals')
                .update({
                    response_message: sanitizeText(responseMessage.trim()),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedAppeal.id);

            toast.success('Response sent successfully');
            await fetchAppeals(true);
            return true;
        } catch (error) {
            console.error('Error sending response:', error);
            toast.error('Failed to send response');
            return false;
        }
    };

    // Bulk actions
    const handleBulkBlock = async () => {
        if (selectedSessions.size === 0) {
            toast.warning('Please select at least one device');
            return;
        }

        if (isRateLimited('bulk-block')) {
            toast.warning('Too many requests. Please wait a moment.');
            return;
        }

        const adminCheckPromises = Array.from(selectedSessions).map(async (sessionId) => {
            const session = sessions.find(s => s.id === sessionId);
            const sessionRole = session?.users?.role;
            if (sessionRole === 'Admin' || sessionRole === 'Executive') {
                return true;
            }
            if (session?.user_id) {
                return await isTargetUserAdmin(session.user_id);
            }
            return false;
        });

        const adminResults = await Promise.all(adminCheckPromises);
        if (adminResults.some(isAdmin => isAdmin)) {
            toast.warning('Cannot block Admin or Executive users');
            return;
        }

        const confirmed = await confirm({
            title: `Block ${selectedSessions.size} Devices`,
            message: `Are you sure you want to block ${selectedSessions.size} selected device(s)?`,
            confirmText: 'Block All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkBlockingSessions(true);
        try {
            let blockedCount = 0;
            let skippedCount = 0;

            const sessionIds = Array.from(selectedSessions);
            const batchSize = 5;

            for (let i = 0; i < sessionIds.length; i += batchSize) {
                const batch = sessionIds.slice(i, i + batchSize);

                await Promise.all(
                    batch.map(async (sessionId) => {
                        const session = sessions.find(s => s.id === sessionId);
                        if (!session) return;

                        const sessionEmail = session.email || session.users?.email || '';

                        const { data: existingBlocked } = await supabase
                            .from('blocked_devices')
                            .select('id')
                            .eq('user_agent', session.user_agent)
                            .eq('ip_address', session.ip_address || '')
                            .eq('email', sessionEmail)
                            .eq('status', 'blocked')
                            .maybeSingle();

                        if (existingBlocked) {
                            skippedCount++;
                            return;
                        }

                        const { data: existingUnblocked } = await supabase
                            .from('blocked_devices')
                            .select('id')
                            .eq('user_agent', session.user_agent)
                            .eq('ip_address', session.ip_address || '')
                            .eq('email', sessionEmail)
                            .eq('status', 'unblocked')
                            .maybeSingle();

                        const userId = session.user_id || currentUserId || '00000000-0000-0000-0000-000000000000';
                        const deviceName = session.users?.display_name || session.hr_employee_name || 'Unknown Device';

                        if (existingUnblocked) {
                            const { error: updateError } = await supabase
                                .from('blocked_devices')
                                .update({
                                    status: 'blocked',
                                    blocked_at: new Date().toISOString(),
                                    blocked_by: userId,
                                    reason: 'Blocked by admin (bulk action)',
                                    updated_at: new Date().toISOString(),
                                    unblocked_at: null,
                                })
                                .eq('id', existingUnblocked.id);

                            if (!updateError) blockedCount++;
                        } else {
                            const { error: insertError } = await supabase
                                .from('blocked_devices')
                                .insert({
                                    user_id: userId,
                                    device_name: deviceName,
                                    user_agent: session.user_agent,
                                    ip_address: session.ip_address || 'Unknown',
                                    status: 'blocked',
                                    email: sessionEmail,
                                    reason: 'Blocked by admin (bulk action)',
                                    blocked_at: new Date().toISOString(),
                                    blocked_by: userId,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                });

                            if (!insertError) blockedCount++;
                        }

                        // Deactivate session in realtime
                        await supabase
                            .from('sessions')
                            .update({
                                is_active: false,
                                in_queue: false,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', sessionId);
                    })
                );
            }

            if (blockedCount > 0) {
                toast.success(`Blocked ${blockedCount} device(s)`);
            }
            if (skippedCount > 0) {
                toast.info(`${skippedCount} device(s) were already blocked`);
            }
            if (blockedCount === 0 && skippedCount === 0) {
                toast.warning('No devices were blocked');
            }

            setSelectedSessions(new Set());
            await fetchAllData(true);
        } catch (error: any) {
            console.error('Error bulk blocking devices:', error);
            toast.error(`Failed to block devices: ${error?.message || 'Unknown error'}`);
        } finally {
            if (isMounted.current) {
                setIsBulkBlockingSessions(false);
            }
        }
    };

    const handleBulkUnblock = async () => {
        if (selectedBlockedDevices.size === 0) {
            toast.warning('Please select at least one device');
            return;
        }

        if (isRateLimited('bulk-unblock')) {
            toast.warning('Too many requests. Please wait a moment.');
            return;
        }

        const confirmed = await confirm({
            title: `Unblock ${selectedBlockedDevices.size} Devices`,
            message: `Are you sure you want to unblock ${selectedBlockedDevices.size} selected device(s)?`,
            confirmText: 'Unblock All',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setIsBulkUnblockingDevices(true);
        try {
            await supabase
                .from('blocked_devices')
                .update({
                    status: 'unblocked',
                    unblocked_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .in('id', Array.from(selectedBlockedDevices));

            toast.success(`Unblocked ${selectedBlockedDevices.size} device(s)`);
            setSelectedBlockedDevices(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk unblocking devices:', error);
            toast.error('Failed to unblock devices');
        } finally {
            if (isMounted.current) {
                setIsBulkUnblockingDevices(false);
            }
        }
    };

    const handleBulkDeleteBlocked = async () => {
        if (selectedBlockedDevices.size === 0) {
            toast.warning('Please select at least one device');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedBlockedDevices.size} Device Records`,
            message: `Are you sure you want to delete ${selectedBlockedDevices.size} selected device record(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkDeletingDevices(true);
        try {
            await supabase
                .from('blocked_devices')
                .delete()
                .in('id', Array.from(selectedBlockedDevices));

            toast.success(`Deleted ${selectedBlockedDevices.size} device record(s)`);
            setSelectedBlockedDevices(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk deleting devices:', error);
            toast.error('Failed to delete devices');
        } finally {
            if (isMounted.current) {
                setIsBulkDeletingDevices(false);
            }
        }
    };

    const handleBulkDeleteSessions = async () => {
        if (selectedSessions.size === 0) {
            toast.warning('Please select at least one session');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedSessions.size} Sessions`,
            message: `Are you sure you want to delete ${selectedSessions.size} selected session(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkDeletingSessions(true);
        try {
            await supabase
                .from('sessions')
                .delete()
                .in('id', Array.from(selectedSessions));

            toast.success(`Deleted ${selectedSessions.size} session(s)`);
            setSelectedSessions(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk deleting sessions:', error);
            toast.error('Failed to delete sessions');
        } finally {
            if (isMounted.current) {
                setIsBulkDeletingSessions(false);
            }
        }
    };

    const handleBulkDeleteActivities = async () => {
        if (selectedActivities.size === 0) {
            toast.warning('Please select at least one activity');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedActivities.size} Activities`,
            message: `Are you sure you want to delete ${selectedActivities.size} selected activity record(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkDeletingActivities(true);
        try {
            await supabase
                .from('user_activity')
                .delete()
                .in('id', Array.from(selectedActivities));

            toast.success(`Deleted ${selectedActivities.size} activity record(s)`);
            setSelectedActivities(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk deleting activities:', error);
            toast.error('Failed to delete activities');
        } finally {
            if (isMounted.current) {
                setIsBulkDeletingActivities(false);
            }
        }
    };

    const handleBulkDeleteAppeals = async () => {
        if (selectedAppeals.size === 0) {
            toast.warning('Please select at least one appeal');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedAppeals.size} Appeals`,
            message: `Are you sure you want to delete ${selectedAppeals.size} selected appeal(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkDeletingAppeals(true);
        try {
            await supabase
                .from('appeals')
                .delete()
                .in('id', Array.from(selectedAppeals));

            toast.success(`Deleted ${selectedAppeals.size} appeal(s)`);
            setSelectedAppeals(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk deleting appeals:', error);
            toast.error('Failed to delete appeals');
        } finally {
            if (isMounted.current) {
                setIsBulkDeletingAppeals(false);
            }
        }
    };

    const handleBulkApproveAppeals = async () => {
        if (selectedAppeals.size === 0) return;

        const confirmed = await confirm({
            title: `Approve ${selectedAppeals.size} Appeals`,
            message: `Are you sure you want to approve ${selectedAppeals.size} selected appeal(s)? The devices will be unblocked.`,
            confirmText: 'Approve All',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setIsBulkApprovingAppeals(true);
        try {
            const appealIds = Array.from(selectedAppeals);
            const selectedAppealsList = appeals.filter(a => appealIds.includes(a.id));
            const deviceIds = selectedAppealsList.map(a => a.blocked_device_id).filter(Boolean);

            await Promise.all([
                supabase
                    .from('appeals')
                    .update({
                        status: 'approved',
                        resolved_at: new Date().toISOString(),
                        resolved_by: user.getEmail() || 'Admin',
                        updated_at: new Date().toISOString(),
                    })
                    .in('id', appealIds),
                deviceIds.length > 0
                    ? supabase
                        .from('blocked_devices')
                        .update({
                            status: 'unblocked',
                            unblocked_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .in('id', deviceIds)
                    : Promise.resolve()
            ]);

            toast.success(`Approved ${appealIds.length} appeal(s)`);
            setSelectedAppeals(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk approving appeals:', error);
            toast.error('Failed to approve appeals');
        } finally {
            if (isMounted.current) {
                setIsBulkApprovingAppeals(false);
            }
        }
    };

    const handleBulkRejectAppeals = async () => {
        if (selectedAppeals.size === 0) return;

        const confirmed = await confirm({
            title: `Reject ${selectedAppeals.size} Appeals`,
            message: `Are you sure you want to reject ${selectedAppeals.size} selected appeal(s)?`,
            confirmText: 'Reject All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkRejectingAppeals(true);
        try {
            const appealIds = Array.from(selectedAppeals);
            await supabase
                .from('appeals')
                .update({
                    status: 'rejected',
                    resolved_at: new Date().toISOString(),
                    resolved_by: user.getEmail() || 'Admin',
                    updated_at: new Date().toISOString(),
                })
                .in('id', appealIds);

            toast.success(`Rejected ${appealIds.length} appeal(s)`);
            setSelectedAppeals(new Set());
            await fetchAllData(true);
        } catch (error) {
            console.error('Error bulk rejecting appeals:', error);
            toast.error('Failed to reject appeals');
        } finally {
            if (isMounted.current) {
                setIsBulkRejectingAppeals(false);
            }
        }
    };

    const handleTerminateSession = async (sessionId: string, targetRole?: string, employeeName?: string) => {
        const callerRole = (userRole || user.getRole() || '').toLowerCase();
        const normalizedTarget = (targetRole || '').toLowerCase();

        if (normalizedTarget === 'executive') {
            toast.error('Executive accounts are protected and cannot be logged out.');
            return;
        }

        if (normalizedTarget === 'admin' && callerRole !== 'executive') {
            toast.error('Admin accounts can only be logged out by Executive accounts.');
            return;
        }

        if (!['admin', 'executive'].includes(callerRole)) {
            toast.error('You do not have permission to terminate user sessions.');
            return;
        }

        const confirmed = await confirm({
            title: 'Terminate Active Session',
            message: `Are you sure you want to forcibly log out ${employeeName || 'this user'} (${targetRole || 'User'})? Their active session will be terminated immediately.`,
            confirmText: 'Log Out User',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setTerminatingSessionId(sessionId);
        try {
            const callerToken = user.getSessionToken() || '';
            const res = await fetch('/api/supplyChain/terminate-user-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': callerToken,
                },
                body: JSON.stringify({ sessionId })
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || data.error || 'Failed to terminate session');
                return;
            }

            toast.success(data.message || 'User session terminated successfully');
            await Promise.all([fetchActiveUsers(true), fetchSessions(true), fetchActivities(true)]);
        } catch (error) {
            console.error('Error terminating session:', error);
            toast.error('Failed to terminate user session');
        } finally {
            if (isMounted.current) {
                setTerminatingSessionId(null);
            }
        }
    };

    const handleBulkTerminateActiveUsers = async () => {
        if (selectedActiveUsers.size === 0) return;

        const callerRole = (userRole || user.getRole() || '').toLowerCase();
        if (!['admin', 'executive'].includes(callerRole)) {
            toast.error('You do not have permission to terminate user sessions.');
            return;
        }

        // Filter out any protected users from the selected set
        const eligibleToTerminate = activeUsers.filter(s => {
            if (!selectedActiveUsers.has(s.id)) return false;
            const target = (s.users?.role || '').toLowerCase();
            if (target === 'executive') return false;
            if (target === 'admin' && callerRole !== 'executive') return false;
            return true;
        });

        if (eligibleToTerminate.length === 0) {
            toast.warning('None of the selected users can be terminated (Protected roles).');
            return;
        }

        const confirmed = await confirm({
            title: `Terminate ${eligibleToTerminate.length} Active Sessions`,
            message: `Are you sure you want to log out ${eligibleToTerminate.length} selected user(s)? Protected roles will not be affected.`,
            confirmText: 'Terminate Sessions',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsBulkTerminating(true);
        try {
            let successCount = 0;
            const callerToken = user.getSessionToken() || '';
            for (const session of eligibleToTerminate) {
                const res = await fetch('/api/supplyChain/terminate-user-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-token': callerToken,
                    },
                    body: JSON.stringify({ sessionId: session.id })
                });
                if (res.ok) successCount++;
            }

            toast.success(`Successfully terminated ${successCount} session(s)`);
            setSelectedActiveUsers(new Set());
            await Promise.all([fetchActiveUsers(true), fetchSessions(true), fetchActivities(true)]);
        } catch (error) {
            console.error('Error in bulk termination:', error);
            toast.error('Failed to terminate some sessions');
        } finally {
            if (isMounted.current) {
                setIsBulkTerminating(false);
            }
        }
    };

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    return {
        // state
        sessions,
        filteredSessions,
        activeUsers,
        filteredActiveUsers,
        blockedDevices,
        filteredBlockedDevices,
        activities,
        filteredActivities,
        appeals,
        filteredAppeals,
        isLoading,
        isRefreshing,
        isRealtimeActive,
        userRole,
        currentUserId,
        queuedUsersCount,
        queuedRolesCount,
        slotStats,

        // action loading states
        blockingSessionId,
        isBulkBlockingSessions,
        isBulkDeletingSessions,
        unblockingDeviceId,
        deletingDeviceId,
        isBulkUnblockingDevices,
        isBulkDeletingDevices,
        approvingAppealId,
        rejectingAppealId,
        deletingAppealId,
        isBulkApprovingAppeals,
        isBulkRejectingAppeals,
        isBulkDeletingAppeals,
        terminatingSessionId,
        isBulkTerminating,
        isBulkDeletingActivities,

        // selections
        selectedSessions,
        setSelectedSessions,
        selectedActiveUsers,
        setSelectedActiveUsers,
        selectedBlockedDevices,
        setSelectedBlockedDevices,
        selectedAppeals,
        setSelectedAppeals,
        selectedActivities,
        setSelectedActivities,

        // pagination
        sessionPage,
        setSessionPage,
        activeUserPage,
        setActiveUserPage,
        blockedPage,
        setBlockedPage,
        appealPage,
        setAppealPage,
        activityPage,
        setActivityPage,

        sessionTotalPages,
        activeUserTotalPages,
        blockedTotalPages,
        appealTotalPages,
        activityTotalPages,

        // data helpers & fetch
        getPaginatedData,
        filterSessions,
        filterAccessControl,
        filterActiveUsers,
        filterBlockedDevices,
        filterAppeals,
        filterActivities,
        fetchAllData,
        fetchActiveUsers,
        fetchSessions,
        fetchBlockedDevices,
        fetchActivities,
        fetchAppeals,

        // access control
        accessControlList,
        filteredAccessControl,
        accessControlPage,
        setAccessControlPage,
        accessControlTotalPages,
        handleUpdateAccessRule: async (rule: {
            email: string;
            user_id?: string;
            display_name?: string;
            role?: string;
            is_allow: boolean;
            allowed_days: string[];
            allowed_time_start: string;
            allowed_time_end: string;
            auth_requested?: boolean;
        }) => {
            const targetEmail = rule.email.toLowerCase().trim();

            // Optimistic update for instant UI feedback
            setAccessControlList(prev =>
                prev.map(item => {
                    const itemEmail = (item.email || item.users?.email || '').toLowerCase().trim();
                    if (itemEmail === targetEmail) {
                        return {
                            ...item,
                            is_allow: rule.is_allow,
                            allowed_days: rule.allowed_days,
                            allowed_time_start: rule.allowed_time_start,
                            allowed_time_end: rule.allowed_time_end,
                            auth_requested: rule.auth_requested !== undefined ? rule.auth_requested : false,
                            auth_requested_at: rule.auth_requested ? new Date().toISOString() : null,
                        };
                    }
                    return item;
                })
            );

            setSessions(prev =>
                prev.map(s => {
                    const sEmail = (s.email || s.users?.email || '').toLowerCase().trim();
                    if (sEmail === targetEmail) {
                        return {
                            ...s,
                            is_allow: rule.is_allow,
                            allowed_days: rule.allowed_days,
                            allowed_time_start: rule.allowed_time_start,
                            allowed_time_end: rule.allowed_time_end,
                            auth_requested: rule.auth_requested !== undefined ? rule.auth_requested : false,
                            auth_requested_at: rule.auth_requested ? new Date().toISOString() : null,
                            ...(rule.is_allow === false ? { is_active: false } : {}),
                        };
                    }
                    return s;
                })
            );

            try {
                const res = await fetch('/api/supplyChain/user-access-control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rule,
                        updatedBy: user.getUser()?.name || userRole || 'Admin',
                    }),
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    toast.error(data.message || 'Failed to update access rule');
                    await fetchSessions(true);
                    return;
                }

                toast.success(`Access permissions updated for ${rule.display_name || rule.email}`);
                await fetchSessions(true);
            } catch (err: any) {
                console.error('Error updating access rule:', err);
                toast.error('Network error updating access rule');
                await fetchSessions(true);
            }
        },

        handleBulkUpdateAccessRules: async (rules: Array<{
            email: string;
            user_id?: string;
            display_name?: string;
            role?: string;
            is_allow: boolean;
            allowed_days: string[];
            allowed_time_start: string;
            allowed_time_end: string;
            auth_requested?: boolean;
        }>) => {
            const rulesMap = new Map(rules.map(r => [r.email.toLowerCase().trim(), r]));

            // Optimistic bulk update
            setAccessControlList(prev =>
                prev.map(item => {
                    const itemEmail = (item.email || item.users?.email || '').toLowerCase().trim();
                    const matchingRule = rulesMap.get(itemEmail);
                    if (matchingRule) {
                        return {
                            ...item,
                            is_allow: matchingRule.is_allow,
                            allowed_days: matchingRule.allowed_days,
                            allowed_time_start: matchingRule.allowed_time_start,
                            allowed_time_end: matchingRule.allowed_time_end,
                            auth_requested: matchingRule.auth_requested !== undefined ? matchingRule.auth_requested : false,
                        };
                    }
                    return item;
                })
            );

            setSessions(prev =>
                prev.map(s => {
                    const sEmail = (s.email || s.users?.email || '').toLowerCase().trim();
                    const matchingRule = rulesMap.get(sEmail);
                    if (matchingRule) {
                        return {
                            ...s,
                            is_allow: matchingRule.is_allow,
                            allowed_days: matchingRule.allowed_days,
                            allowed_time_start: matchingRule.allowed_time_start,
                            allowed_time_end: matchingRule.allowed_time_end,
                            auth_requested: matchingRule.auth_requested !== undefined ? matchingRule.auth_requested : false,
                            ...(matchingRule.is_allow === false ? { is_active: false } : {}),
                        };
                    }
                    return s;
                })
            );

            try {
                const res = await fetch('/api/supplyChain/user-access-control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rules,
                        updatedBy: user.getUser()?.name || userRole || 'Admin',
                    }),
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    toast.error(data.message || 'Failed to bulk update access rules');
                    await fetchSessions(true);
                    return false;
                }

                toast.success(`Access permissions updated for ${rules.length} account(s)`);
                await fetchSessions(true);
                return true;
            } catch (err: any) {
                console.error('Error bulk updating access rules:', err);
                toast.error('Network error updating access rules');
                await fetchSessions(true);
                return false;
            }
        },

        // moderation
        handleResetStrikes,

        // operations
        handleBlockDevice,
        handleUnblockDevice,
        handleDeleteDevice,
        handleApproveAppeal,
        handleRejectAppeal,
        handleDeleteAppeal,
        handleSendResponse,
        handleTerminateSession,

        // bulk operations
        handleBulkBlock,
        handleBulkUnblock,
        handleBulkDeleteBlocked,
        handleBulkDeleteSessions,
        handleBulkTerminateActiveUsers,
        handleBulkDeleteActivities,
        handleBulkDeleteAppeals,
        handleBulkApproveAppeals,
        handleBulkRejectAppeals,
    };
}

