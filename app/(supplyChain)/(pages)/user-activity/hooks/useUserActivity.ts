'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { user } from '@/app/(supplyChain)/lib/services/Class/user';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { Session, BlockedDevice, Appeal, UserActivity } from '../types';
import { isRateLimited, sanitizeText } from '../utils/formatters';

const ITEMS_PER_PAGE = 50;

export function useUserActivity() {
    const { confirm } = useConfirm();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
    const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [filteredActivities, setFilteredActivities] = useState<UserActivity[]>([]);
    const [appeals, setAppeals] = useState<Appeal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
    const [selectedBlockedDevices, setSelectedBlockedDevices] = useState<Set<string>>(new Set());
    const [selectedAppeals, setSelectedAppeals] = useState<Set<string>>(new Set());
    const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());

    const [userRole, setUserRole] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    // Pagination states
    const [sessionPage, setSessionPage] = useState(1);
    const [blockedPage, setBlockedPage] = useState(1);
    const [appealPage, setAppealPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);

    const [sessionTotalPages, setSessionTotalPages] = useState(1);
    const [blockedTotalPages, setBlockedTotalPages] = useState(1);
    const [appealTotalPages, setAppealTotalPages] = useState(1);
    const [activityTotalPages, setActivityTotalPages] = useState(1);

    const fetchSessions = async () => {
        try {
            const [blockedResult, sessionsResult] = await Promise.all([
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
                    .order('created_at', { ascending: false })
            ]);

            if (blockedResult.error) throw blockedResult.error;
            if (sessionsResult.error) throw sessionsResult.error;

            const blockedData = blockedResult.data || [];
            const sessionsData = sessionsResult.data || [];

            const blockedMap = new Map();
            blockedData.forEach(d => {
                const key = `${d.user_agent}_${d.ip_address || 'unknown'}_${d.email || ''}`;
                blockedMap.set(key, d.id);
            });

            const sessionsWithBlockStatus = sessionsData.map(session => {
                const sessionEmail = session.email || session.users?.email || '';
                const key = `${session.user_agent}_${session.ip_address || 'unknown'}_${sessionEmail}`;
                const blockedDeviceId = blockedMap.get(key);

                return {
                    ...session,
                    is_blocked: !!blockedDeviceId,
                    blocked_device_id: blockedDeviceId || undefined
                };
            });

            setSessions(sessionsWithBlockStatus);
            setFilteredSessions(sessionsWithBlockStatus);
            setSessionTotalPages(Math.max(1, Math.ceil(sessionsWithBlockStatus.length / ITEMS_PER_PAGE)));
        } catch (error) {
            console.error('Error fetching sessions:', error);
            toast.error('Failed to fetch sessions');
        }
    };

    const fetchBlockedDevices = async () => {
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

            setBlockedDevices(devicesWithCount);
            setBlockedTotalPages(Math.max(1, Math.ceil(devicesWithCount.length / ITEMS_PER_PAGE)));
        } catch (error) {
            console.error('Error fetching blocked devices:', error);
            toast.error('Failed to fetch blocked devices');
        }
    };

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase
                .from('user_activity')
                .select('*, users!inner(display_name, email)')
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) throw error;
            setActivities(data || []);
            setFilteredActivities(data || []);
            setActivityTotalPages(Math.max(1, Math.ceil((data || []).length / ITEMS_PER_PAGE)));
        } catch (error) {
            console.error('Error fetching activities:', error);
            toast.error('Failed to fetch activities');
        }
    };

    const fetchAppeals = async () => {
        try {
            const { data, error } = await supabase
                .from('appeals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAppeals(data || []);
            setAppealTotalPages(Math.max(1, Math.ceil((data || []).length / ITEMS_PER_PAGE)));
        } catch (error) {
            console.error('Error fetching appeals:', error);
            toast.error('Failed to fetch appeals');
        }
    };

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchSessions(),
                fetchBlockedDevices(),
                fetchActivities(),
                fetchAppeals()
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const role = user.getRole();
        const userData = user.getUser();
        setUserRole(role);
        setCurrentUserId(userData?.email || '');
        fetchAllData();
    }, [fetchAllData]);

    const isTargetUserAdmin = async (userId: string): Promise<boolean> => {
        try {
            const { data } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single();
            return data?.role === 'Admin';
        } catch (error) {
            console.error('Error checking user role:', error);
            return false;
        }
    };

    // Filter helpers
    const filterSessions = useCallback((term: string) => {
        if (!term.trim()) {
            setFilteredSessions(sessions);
            setSessionTotalPages(Math.max(1, Math.ceil(sessions.length / ITEMS_PER_PAGE)));
            return;
        }

        const filtered = sessions.filter(session =>
            session.user_agent?.toLowerCase().includes(term.toLowerCase()) ||
            session.ip_address?.toLowerCase().includes(term.toLowerCase()) ||
            session.email?.toLowerCase().includes(term.toLowerCase()) ||
            session.hr_employee_name?.toLowerCase().includes(term.toLowerCase()) ||
            session.users?.display_name?.toLowerCase().includes(term.toLowerCase())
        );

        setFilteredSessions(filtered);
        setSessionTotalPages(Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)));
        setSessionPage(1);
    }, [sessions]);

    const filterActivities = useCallback((term: string, filter: string) => {
        let filtered = activities;

        if (term.trim()) {
            filtered = filtered.filter(activity =>
                activity.action?.toLowerCase().includes(term.toLowerCase()) ||
                activity.module?.toLowerCase().includes(term.toLowerCase()) ||
                activity.description?.toLowerCase().includes(term.toLowerCase()) ||
                activity.ip_address?.toLowerCase().includes(term.toLowerCase()) ||
                activity.users?.display_name?.toLowerCase().includes(term.toLowerCase()) ||
                activity.users?.email?.toLowerCase().includes(term.toLowerCase())
            );
        }

        if (filter !== 'all') {
            filtered = filtered.filter(activity => activity.action === filter);
        }

        setFilteredActivities(filtered);
        setActivityTotalPages(Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE)));
        setActivityPage(1);
    }, [activities]);

    // Actions
    const handleBlockDevice = async (sessionId: string, userAgent: string, ipAddress?: string, userName?: string, email?: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session?.user_id) {
            const isAdmin = await isTargetUserAdmin(session.user_id);
            if (isAdmin) {
                toast.warning('Cannot block admin users');
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
                    await fetchSessions();
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

            toast.success('Device blocked successfully');
            await fetchAllData();
        } catch (error: any) {
            console.error('Error blocking device:', error);
            toast.error(`Failed to block device: ${error?.message || 'Unknown error'}`);
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
            await fetchAllData();
        } catch (error) {
            console.error('Error unblocking device:', error);
            toast.error('Failed to unblock device');
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

        try {
            await supabase
                .from('blocked_devices')
                .delete()
                .eq('id', deviceId);

            toast.success('Device record deleted');
            await fetchAllData();
        } catch (error) {
            console.error('Error deleting device:', error);
            toast.error('Failed to delete device');
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
            await fetchAllData();
        } catch (error) {
            console.error('Error approving appeal:', error);
            toast.error('Failed to approve appeal');
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
            await fetchAllData();
        } catch (error) {
            console.error('Error rejecting appeal:', error);
            toast.error('Failed to reject appeal');
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

        try {
            await supabase
                .from('appeals')
                .delete()
                .eq('id', appealId);

            toast.success('Appeal deleted successfully');
            await fetchAllData();
        } catch (error) {
            console.error('Error deleting appeal:', error);
            toast.error('Failed to delete appeal');
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
            await fetchAppeals();
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
            if (session?.user_id) {
                return await isTargetUserAdmin(session.user_id);
            }
            return false;
        });

        const adminResults = await Promise.all(adminCheckPromises);
        if (adminResults.some(isAdmin => isAdmin)) {
            toast.warning('Cannot block admin users');
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

        try {
            let blockedCount = 0;
            let skippedCount = 0;

            const sessionIds = Array.from(selectedSessions);
            const batchSize = 5;

            for (let i = 0; i < sessionIds.length; i += batchSize) {
                const batch = sessionIds.slice(i, i + batchSize);

                await Promise.all(batch.map(async (sessionId) => {
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
                }));
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
            await fetchAllData();
        } catch (error: any) {
            console.error('Error bulk blocking devices:', error);
            toast.error(`Failed to block devices: ${error?.message || 'Unknown error'}`);
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
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk unblocking devices:', error);
            toast.error('Failed to unblock devices');
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

        try {
            await supabase
                .from('blocked_devices')
                .delete()
                .in('id', Array.from(selectedBlockedDevices));

            toast.success(`Deleted ${selectedBlockedDevices.size} device record(s)`);
            setSelectedBlockedDevices(new Set());
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk deleting devices:', error);
            toast.error('Failed to delete devices');
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

        try {
            await supabase
                .from('sessions')
                .delete()
                .in('id', Array.from(selectedSessions));

            toast.success(`Deleted ${selectedSessions.size} session(s)`);
            setSelectedSessions(new Set());
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk deleting sessions:', error);
            toast.error('Failed to delete sessions');
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

        try {
            await supabase
                .from('user_activity')
                .delete()
                .in('id', Array.from(selectedActivities));

            toast.success(`Deleted ${selectedActivities.size} activity record(s)`);
            setSelectedActivities(new Set());
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk deleting activities:', error);
            toast.error('Failed to delete activities');
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

        try {
            await supabase
                .from('appeals')
                .delete()
                .in('id', Array.from(selectedAppeals));

            toast.success(`Deleted ${selectedAppeals.size} appeal(s)`);
            setSelectedAppeals(new Set());
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk deleting appeals:', error);
            toast.error('Failed to delete appeals');
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
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk approving appeals:', error);
            toast.error('Failed to approve appeals');
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
            await fetchAllData();
        } catch (error) {
            console.error('Error bulk rejecting appeals:', error);
            toast.error('Failed to reject appeals');
        }
    };

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    return {
        // State
        sessions,
        filteredSessions,
        blockedDevices,
        activities,
        filteredActivities,
        appeals,
        isLoading,
        userRole,
        currentUserId,

        // Selections
        selectedSessions,
        setSelectedSessions,
        selectedBlockedDevices,
        setSelectedBlockedDevices,
        selectedAppeals,
        setSelectedAppeals,
        selectedActivities,
        setSelectedActivities,

        // Pagination
        sessionPage,
        setSessionPage,
        blockedPage,
        setBlockedPage,
        appealPage,
        setAppealPage,
        activityPage,
        setActivityPage,

        sessionTotalPages,
        blockedTotalPages,
        appealTotalPages,
        activityTotalPages,

        // Data helpers
        getPaginatedData,
        filterSessions,
        filterActivities,
        fetchAllData,

        // Operations
        handleBlockDevice,
        handleUnblockDevice,
        handleDeleteDevice,
        handleApproveAppeal,
        handleRejectAppeal,
        handleDeleteAppeal,
        handleSendResponse,

        // Bulk operations
        handleBulkBlock,
        handleBulkUnblock,
        handleBulkDeleteBlocked,
        handleBulkDeleteSessions,
        handleBulkDeleteActivities,
        handleBulkDeleteAppeals,
        handleBulkApproveAppeals,
        handleBulkRejectAppeals,
    };
}
