'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Check, X, Loader2, Clock, DollarSign, FileText, User, Building, Tag, AlertCircle, Users, UserCog, Shield, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import Portal from '../client/Portal';


interface Notification {
    id: string;
    creator_name: string;
    creator_email: string;
    title: string;
    message: string;
    type: string;
    link: string;
    is_read: boolean;
    created_at: string;
    po_request_id: string | null;
    role: string;
}

interface PurchaseRequest {
    id: string;
    request_number: string;
    type: string;
    description: string;
    requested_by: string;
    department: string;
    supplier_name: string;
    amount: number;
    priority: string;
    status: string;
    date: string;
    reason: string;
    items: any[];
    created_at: string;
}

const PAGE_SIZE = 10;
const CACHE_KEY_BASE = 'notifications_cache';
const LEGACY_CACHE_KEY = 'notifications_cache';
const CACHE_DURATION = 5 * 60 * 1000;

export function NotificationBell() {
    const router = useRouter();
    const { confirm } = useConfirm();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [totalUnread, setTotalUnread] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [purchaseRequest, setPurchaseRequest] = useState<PurchaseRequest | null>(null);
    const [isLoadingPR, setIsLoadingPR] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const getCacheKey = useCallback(() => {
        return `${CACHE_KEY_BASE}_${userEmail || 'anon'}`;
    }, [userEmail]);

    // Get user data from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (localStorage.getItem(LEGACY_CACHE_KEY)) {
                localStorage.removeItem(LEGACY_CACHE_KEY);
            }

            const role = localStorage.getItem('user_role') || 'User';
            const email = localStorage.getItem('user_email') || '';
            setUserRole(role);
            setUserEmail(email);
        }
    }, []);

    // Prevent body scroll when dropdown is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Load cached notifications
    const loadCachedNotifications = useCallback(() => {
        try {
            const cached = localStorage.getItem(getCacheKey());
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CACHE_DURATION;
                if (!isExpired && data && data.length > 0) {
                    const filteredData = data.filter((n: Notification) =>
                        n.role === 'All' || n.role === userRole
                    );
                    setNotifications(filteredData);
                    const unread = filteredData.filter((n: Notification) => !n.is_read).length;
                    setUnreadCount(unread);
                    setTotalUnread(unread);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error);
        }
        return false;
    }, [userRole, getCacheKey]);

    // Save to cache
    const saveToCache = useCallback((data: Notification[]) => {
        try {
            localStorage.setItem(getCacheKey(), JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }, [getCacheKey]);

    // Fetch total unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .or(`role.eq.All,role.eq.${userRole}`);

            if (error) throw error;
            const unread = count ?? 0;
            setTotalUnread(unread);
            setUnreadCount(unread);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [userRole]);

    // Fetch notifications with pagination
    const fetchNotifications = useCallback(async (pageNum: number, append: boolean = false) => {
        if (pageNum === 0) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            // Get filtered count first
            const { count, error: countError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .or(`role.eq.All,role.eq.${userRole}`);

            if (countError) throw countError;
            const total = count ?? 0;
            setTotalCount(total);

            if (total === 0) {
                setHasMore(false);
                if (pageNum === 0) {
                    setNotifications([]);
                    setUnreadCount(0);
                    setTotalUnread(0);
                }
                return;
            }

            // Calculate range
            const from = pageNum * PAGE_SIZE;
            const to = Math.min(from + PAGE_SIZE - 1, total - 1);

            // Build query - prioritize unread first
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .or(`role.eq.All,role.eq.${userRole}`)
                .order('is_read', { ascending: true }) // Unread first
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const notificationsData = data || [];

            // Check if we have more data
            const totalFetched = append ? notifications.length + notificationsData.length : notificationsData.length;
            setHasMore(totalFetched < total);

            if (append) {
                setNotifications(prev => [...prev, ...notificationsData]);
            } else {
                setNotifications(notificationsData);
                saveToCache(notificationsData);

                const unread = notificationsData.filter(n => !n.is_read).length;
                setUnreadCount(unread);
                setTotalUnread(unread);
            }

            await fetchUnreadCount();

        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [userRole, saveToCache, fetchUnreadCount, notifications.length]);

    // Initial load
    useEffect(() => {
        if (!userRole || !userEmail) return;

        setIsMounted(true);

        const hasCache = loadCachedNotifications();

        if (!hasCache) {
            fetchNotifications(0, false);
        } else {
            fetchUnreadCount();
        }
    }, [userRole, userEmail, loadCachedNotifications, fetchNotifications, fetchUnreadCount]);

    const handleMarkAsRead = async (id: string) => {
        try {
            // Optimistically update UI
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
            setTotalUnread(prev => Math.max(0, prev - 1));

            // Update in database
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Update cache
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const updated = data.map((n: Notification) =>
                    n.id === id ? { ...n, is_read: true } : n
                );
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: updated,
                    timestamp
                }));
            }
        } catch (error) {
            console.error('Error marking as read:', error);
            toast.error('Failed to mark as read');
            // Revert on error
            fetchNotifications(0, false);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const unreadIds = notifications
                .filter(n => !n.is_read)
                .map(n => n.id);

            if (unreadIds.length === 0) {
                toast.info('No unread notifications');
                return;
            }

            // Optimistically update UI
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            setTotalUnread(0);

            // Update in database
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds);

            if (error) throw error;

            // Update cache
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const updated = data.map((n: Notification) => ({ ...n, is_read: true }));
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: updated,
                    timestamp
                }));
            }

            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
            // Revert on error
            fetchNotifications(0, false);
        }
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        fetchNotifications(nextPage, true);
        setPage(nextPage);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await handleMarkAsRead(notification.id);
        }

        if (notification.type === 'purchase_request' && notification.po_request_id) {
            await showPurchaseRequestModal(notification);
            return;
        }

        if (notification.link) {
            router.push(notification.link);
            setIsOpen(false);
        }
    };

    const showPurchaseRequestModal = async (notification: Notification) => {
        setSelectedNotification(notification);
        setShowModal(true);
        setIsLoadingPR(true);

        try {
            const { data, error } = await supabase
                .from('purchase_requests')
                .select('*')
                .eq('id', notification.po_request_id)
                .single();

            if (error) throw error;
            setPurchaseRequest(data);
        } catch (error) {
            console.error('Error fetching purchase request:', error);
            toast.error('Failed to load purchase request details');
        } finally {
            setIsLoadingPR(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedNotification?.po_request_id) return;

        const confirmed = await confirm({
            title: 'Approve Purchase Request',
            message: `Are you sure you want to approve this purchase request?`,
            confirmText: 'Approve',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setIsApproving(true);
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({
                    status: 'Approved',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedNotification.po_request_id);

            if (error) throw error;

            toast.success('Purchase request approved successfully');
            setShowModal(false);
            fetchNotifications(0, false);
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error('Failed to approve purchase request');
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!selectedNotification?.po_request_id) return;

        if (!rejectReason.trim()) {
            toast.warning('Please provide a reason for rejection');
            return;
        }

        const confirmed = await confirm({
            title: 'Reject Purchase Request',
            message: `Are you sure you want to reject this purchase request?`,
            confirmText: 'Reject',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsApproving(true);
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({
                    status: 'Rejected',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedNotification.po_request_id);

            if (error) throw error;

            toast.success('Purchase request rejected');
            setShowRejectModal(false);
            setRejectReason('');
            setShowModal(false);
            fetchNotifications(0, false);
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error('Failed to reject purchase request');
        } finally {
            setIsApproving(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'appeal': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
            case 'security': return 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30';
            case 'system': return 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30';
            case 'info': return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30';
            case 'alert': return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30';
            case 'purchase_request': return 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30';
            default: return 'bg-gray-100 dark:bg-slate-700/30 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700/60';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'appeal': return 'fas fa-pen';
            case 'security': return 'fas fa-shield-alt';
            case 'system': return 'fas fa-cog';
            case 'info': return 'fas fa-info-circle';
            case 'alert': return 'fas fa-exclamation-triangle';
            case 'purchase_request': return 'fas fa-clipboard-list';
            default: return 'fas fa-inbox';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30';
            case 'Approved': return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30';
            case 'Rejected': return 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30';
            case 'Completed': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
            default: return 'bg-gray-100 dark:bg-slate-700/30 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700/60';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Critical': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20';
            case 'Urgent': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20';
            case 'Normal': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20';
            default: return 'text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/30';
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'All': return <Users className="h-3 w-3" />;
            case 'Admin': return <Shield className="h-3 w-3" />;
            case 'Manager': return <UserCog className="h-3 w-3" />;
            default: return <User className="h-3 w-3" />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'Admin': return 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30';
            case 'Manager': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
            case 'Employee': return 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30';
            case 'Executive': return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30';
            case 'Operator': return 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/30';
            default: return 'bg-gray-100 dark:bg-slate-700/30 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700/60';
        }
    };

    if (!isMounted) return null;

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    ref={buttonRef}
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (!isOpen) {
                            fetchUnreadCount();
                        }
                    }}
                    className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
                    aria-label="Notifications"
                >
                    {totalUnread > 0 ? (
                        <>
                            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        </>
                    ) : (
                        <BellOff className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                </button>

                {isOpen && (
                    <>
                        {/* Mobile Backdrop Overlay */}
                        <div
                            className="fixed inset-0 bg-slate-900/20 dark:bg-slate-950/60 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Main Popover / Modal Panel */}
                        <div className="fixed sm:absolute inset-x-0 top-0 sm:top-full sm:right-0 sm:left-auto mt-0 sm:mt-2 w-full sm:w-96 h-[100dvh] sm:h-auto sm:max-h-[560px] 
                        bg-white dark:bg-[#2a2a2e] 
                        rounded-none sm:rounded-2xl 
                        border-0 sm:border border-slate-200/80 dark:border-slate-700/60 
                        shadow-2xl sm:shadow-xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.6),0_8px_10px_-6px_rgba(0,0,0,0.4)] 
                        z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200">

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3.5 
                          border-b border-slate-100 dark:border-slate-700/60 
                          bg-white/80 dark:bg-[#2a2a2e]/80 backdrop-blur-md shrink-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Notifications
                                    </h3>
                                    {totalCount > 0 && (
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium 
                                bg-slate-100 dark:bg-slate-700/60 
                                text-slate-600 dark:text-slate-300 rounded-full">
                                            {totalCount}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {totalUnread > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="px-2.5 py-1.5 text-xs font-medium 
                            text-pink-600 dark:text-pink-400 
                            hover:text-pink-700 dark:hover:text-pink-300 
                            hover:bg-pink-50/70 dark:hover:bg-pink-950/30 
                            active:bg-pink-100 dark:active:bg-pink-950/50 
                            rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            <span className="hidden xs:inline">Mark all as read</span>
                                            <span className="xs:hidden">Mark read</span>
                                        </button>
                                    )}

                                    {/* Close button for mobile screen view */}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 text-slate-400 dark:text-slate-500 
                          hover:text-slate-600 dark:hover:text-slate-300 
                          hover:bg-slate-100 dark:hover:bg-slate-700/50 
                          rounded-lg transition-colors sm:hidden"
                                        aria-label="Close notifications"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Body */}
                            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700/60 
                          scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
                                        <Loader2 className="animate-spin h-6 w-6 text-pink-500 dark:text-pink-400" />
                                        <span className="text-xs font-medium">Fetching notifications...</span>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-full mb-3">
                                            <BellOff className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All caught up!</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">No new notifications to show right now.</p>
                                    </div>
                                ) : (
                                    <>
                                        {notifications.map((notification) => (
                                            <button
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`w-full text-left p-4 transition-all duration-150 flex items-start gap-3.5 
                                hover:bg-slate-50/80 dark:hover:bg-slate-700/30 
                                active:bg-slate-100 dark:active:bg-slate-700/50 
                                focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700/30 
                                ${!notification.is_read
                                                        ? 'bg-pink-50/25 dark:bg-pink-950/20 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-pink-500'
                                                        : 'bg-white dark:bg-[#2a2a2e]'
                                                    }`}
                                            >
                                                {/* Icon Column */}
                                                <div className={`p-2 rounded-xl shrink-0 border border-slate-100 dark:border-slate-700/60 ${getTypeColor(notification.type)}`}>
                                                    <i className={`text-xs leading-none flex items-center justify-center ${getTypeIcon(notification.type)}`}></i>
                                                </div>

                                                {/* Content Column */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-xs sm:text-sm font-semibold truncate leading-tight 
                                      ${!notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {notification.title}
                                                        </p>

                                                        <div className="shrink-0 pt-0.5">
                                                            {!notification.is_read ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium 
                                            bg-pink-100 dark:bg-pink-950/50 
                                            text-pink-700 dark:text-pink-300 
                                            px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                    <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                                                                    New
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Read</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className={`text-xs mt-1 line-clamp-2 leading-relaxed 
                                    ${!notification.is_read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {notification.message}
                                                    </p>

                                                    {/* Metadata Chips Footer */}
                                                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-[10px] text-slate-400 dark:text-slate-500">
                                                        <span className="font-medium text-slate-500 dark:text-slate-400">
                                                            {new Date(notification.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="truncate max-w-[110px] font-medium text-slate-500 dark:text-slate-400">
                                                            {notification.creator_name}
                                                        </span>

                                                        {notification.type === 'purchase_request' && (
                                                            <span className="text-[10px] font-medium 
                                          bg-indigo-50 dark:bg-indigo-950/30 
                                          text-indigo-600 dark:text-indigo-400 
                                          border border-indigo-100 dark:border-indigo-800/30 
                                          px-1.5 py-0.5 rounded-md whitespace-nowrap ml-auto">
                                                                PO
                                                            </span>
                                                        )}

                                                        {notification.role && (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${getRoleColor(notification.role)} whitespace-nowrap`}>
                                                                {getRoleIcon(notification.role)}
                                                                <span className="font-medium">{notification.role}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}

                                        {/* Load More Button */}
                                        {hasMore && totalCount > 0 && (
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30">
                                                <button
                                                    onClick={handleLoadMore}
                                                    disabled={isLoadingMore}
                                                    className="w-full py-2 px-3 text-xs font-semibold 
                                text-pink-600 dark:text-pink-400 
                                hover:text-pink-700 dark:hover:text-pink-300 
                                bg-white dark:bg-[#2a2a2e] 
                                hover:bg-pink-50/50 dark:hover:bg-pink-950/20 
                                border border-slate-200/80 dark:border-slate-700/60 
                                rounded-xl transition-all shadow-sm 
                                disabled:opacity-50 disabled:cursor-not-allowed 
                                flex items-center justify-center gap-2"
                                                >
                                                    {isLoadingMore ? (
                                                        <>
                                                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                                                            Loading...
                                                        </>
                                                    ) : (
                                                        `Load older notifications (${notifications.length} of ${totalCount})`
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {!hasMore && notifications.length > 0 && (
                                            <div className="py-3 text-center bg-slate-50/30 dark:bg-slate-800/20">
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Showing all {notifications.length} notifications
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer Link */}
                            {notifications.length > 0 && (
                                <div className="p-3 border-t border-slate-100 dark:border-slate-700/60 
                            bg-white dark:bg-[#2a2a2e] text-center shrink-0">
                                    <button
                                        onClick={() => {
                                            router.push('/notifications');
                                            setIsOpen(false);
                                        }}
                                        className="w-full py-1.5 text-xs font-semibold 
                          text-slate-600 dark:text-slate-400 
                          hover:text-pink-600 dark:hover:text-pink-400 
                          hover:bg-slate-50 dark:hover:bg-slate-700/30 
                          rounded-lg transition-colors"
                                    >
                                        View all in activity center →
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Purchase Request Modal - Rendered via Portal */}
            {showModal && selectedNotification && (
                <Portal>
                    {/* Backdrop with click-to-close */}
                    <div
                        className="fixed inset-0 z-[9999] grid place-items-center p-4 
                                  bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm 
                                  overflow-hidden animate-in fade-in duration-200"
                        onClick={() => {
                            setShowModal(false);
                            setSelectedNotification(null);
                            setPurchaseRequest(null);
                        }}
                    >
                        {/* Modal Container */}
                        <div
                            className="flex flex-col w-full max-w-3xl max-h-[88vh] 
                                    bg-white dark:bg-[#2a2a2e] 
                                    rounded-2xl shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] 
                                    overflow-hidden border border-gray-100 dark:border-slate-700/60 
                                    transform transition-all animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >

                            {/* Fixed Header */}
                            <div className="shrink-0 flex items-center justify-between 
                                          border-b border-gray-100 dark:border-slate-700/60 
                                          px-6 py-5 bg-white dark:bg-[#2a2a2e]">
                                <div className="flex items-center gap-3.5">
                                    <div className="p-3 rounded-xl 
                                                  bg-indigo-50 dark:bg-indigo-950/30 
                                                  text-indigo-600 dark:text-indigo-400 
                                                  border border-indigo-100 dark:border-indigo-800/30">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                                                Purchase Request
                                            </h3>
                                            {purchaseRequest?.request_number && (
                                                <span className="text-xs font-mono font-medium 
                                                                text-gray-500 dark:text-slate-400 
                                                                bg-gray-100 dark:bg-slate-700/50 
                                                                px-2 py-0.5 rounded-md">
                                                    #{purchaseRequest.request_number}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                            Review and manage request details below
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setSelectedNotification(null);
                                        setPurchaseRequest(null);
                                    }}
                                    className="text-gray-400 dark:text-slate-500 
                                              hover:text-gray-600 dark:hover:text-slate-300 
                                              hover:bg-gray-100 dark:hover:bg-slate-700/50 
                                              p-2 rounded-xl transition-colors"
                                    aria-label="Close modal"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 dark:bg-[#1c1b1f]">
                                {isLoadingPR ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">Fetching request details...</span>
                                    </div>
                                ) : purchaseRequest ? (
                                    <div className="space-y-6">

                                        {/* Status & Date Bar */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 
                                                      p-3.5 bg-gray-50/80 dark:bg-slate-800/30 
                                                      rounded-xl border border-gray-100 dark:border-slate-700/60">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(purchaseRequest.status)}`}>
                                                    {purchaseRequest.status}
                                                </span>
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityColor(purchaseRequest.priority)}`}>
                                                    {purchaseRequest.priority} Priority
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                                                <span>
                                                    Requested on {new Date(purchaseRequest.date).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Overview Key-Value Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="bg-white dark:bg-[#2a2a2e] rounded-xl p-3.5 
                                                          border border-gray-200/80 dark:border-slate-700/60 shadow-2xs">
                                                <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 mb-1">
                                                    <User className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider">Requester</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{purchaseRequest.requested_by}</p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{purchaseRequest.department}</p>
                                            </div>

                                            <div className="bg-white dark:bg-[#2a2a2e] rounded-xl p-3.5 
                                                          border border-gray-200/80 dark:border-slate-700/60 shadow-2xs">
                                                <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 mb-1">
                                                    <Building className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider">Supplier</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{purchaseRequest.supplier_name || '—'}</p>
                                                <p className="text-xs text-gray-400 dark:text-slate-500">Vendor</p>
                                            </div>

                                            <div className="bg-white dark:bg-[#2a2a2e] rounded-xl p-3.5 
                                                          border border-gray-200/80 dark:border-slate-700/60 shadow-2xs">
                                                <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 mb-1">
                                                    <Tag className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider">Type</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{purchaseRequest.type}</p>
                                                <p className="text-xs text-gray-400 dark:text-slate-500">Category</p>
                                            </div>

                                            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl p-3.5 
                                                          border border-indigo-100/80 dark:border-indigo-800/30 shadow-2xs">
                                                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
                                                    <DollarSign className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Amount</span>
                                                </div>
                                                <p className="text-base font-bold text-indigo-950 dark:text-indigo-200">
                                                    ${purchaseRequest.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Context Cards: Description & Reason */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-50/60 dark:bg-slate-800/30 rounded-xl p-4 
                                                          border border-gray-200/60 dark:border-slate-700/60">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FileText className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                                                    <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Description</h4>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                                                    {purchaseRequest.description || 'No description provided.'}
                                                </p>
                                            </div>

                                            <div className="bg-gray-50/60 dark:bg-slate-800/30 rounded-xl p-4 
                                                          border border-gray-200/60 dark:border-slate-700/60">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                                    <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Business Reason</h4>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                                                    {purchaseRequest.reason || 'No reason specified.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Line Items Table */}
                                        {purchaseRequest.items && purchaseRequest.items.length > 0 && (
                                            <div className="border border-gray-200/80 dark:border-slate-700/60 rounded-xl overflow-hidden 
                                                          bg-white dark:bg-[#2a2a2e]">
                                                <div className="bg-gray-50/80 dark:bg-slate-800/30 px-4 py-3 
                                                                border-b border-gray-200/80 dark:border-slate-700/60 
                                                                flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                                        <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Requested Line Items</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                                                        {purchaseRequest.items.length} {purchaseRequest.items.length === 1 ? 'Item' : 'Items'}
                                                    </span>
                                                </div>

                                                <div className="divide-y divide-gray-100 dark:divide-slate-700/60 overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="text-[11px] font-semibold uppercase 
                                                                          text-gray-400 dark:text-slate-500 
                                                                          bg-gray-50/30 dark:bg-slate-800/20">
                                                                <th className="py-2.5 px-4">Item</th>
                                                                <th className="py-2.5 px-4 text-center">Qty</th>
                                                                <th className="py-2.5 px-4 text-right">Unit Price</th>
                                                                <th className="py-2.5 px-4 text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-sm">
                                                            {purchaseRequest.items.map((item: any, index: number) => {
                                                                const qty = item.quantity || 1;
                                                                const price = item.price || 0;
                                                                return (
                                                                    <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-slate-200">
                                                                            {item.name || item.description}
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center text-gray-600 dark:text-slate-400">
                                                                            {qty}
                                                                        </td>
                                                                        <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">
                                                                            ${price.toFixed(2)}
                                                                        </td>
                                                                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                                                                            ${(qty * price).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Creation Audit Stamp */}
                                        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 
                                                        pt-2 border-t border-gray-100 dark:border-slate-700/60">
                                            <span>System Record</span>
                                            <span>Created: {new Date(purchaseRequest.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 text-gray-500 dark:text-slate-400 font-medium">
                                        Failed to load purchase request details.
                                    </div>
                                )}
                            </div>

                            {/* Fixed Footer Actions */}
                            {purchaseRequest && (
                                <div className="shrink-0 border-t border-gray-100 dark:border-slate-700/60 
                                                p-4 bg-gray-50/80 dark:bg-slate-800/30">
                                    {purchaseRequest.status === 'Pending' ? (
                                        <div className="flex justify-end items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowRejectModal(true)}
                                                disabled={isApproving}
                                                className="px-4 py-2 text-sm font-semibold 
                                                          text-red-600 dark:text-red-400 
                                                          hover:text-red-700 dark:hover:text-red-300 
                                                          bg-white dark:bg-[#2a2a2e] 
                                                          border border-red-200 dark:border-red-800/30 
                                                          hover:bg-red-50 dark:hover:bg-red-950/20 
                                                          rounded-xl transition-all shadow-2xs disabled:opacity-50"
                                            >
                                                Reject Request
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleApprove}
                                                disabled={isApproving}
                                                className="px-5 py-2 bg-indigo-600 dark:bg-indigo-500 
                                                          hover:bg-indigo-700 dark:hover:bg-indigo-600 
                                                          active:bg-indigo-800 dark:active:bg-indigo-700 
                                                          text-white text-sm font-semibold rounded-xl 
                                                          transition-all disabled:opacity-50 flex items-center gap-2 shadow-xs"
                                            >
                                                {isApproving ? (
                                                    <>
                                                        <Loader2 className="animate-spin h-4 w-4" />
                                                        <span>Processing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="h-4 w-4" />
                                                        <span>Approve Request</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 text-xs font-medium 
                                                        text-gray-500 dark:text-slate-400 py-1">
                                            <Clock className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                                            <span>This request was {purchaseRequest.status.toLowerCase()}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </Portal>
            )}

            {/* Reject Reason Modal - Rendered via Portal */}
            {showRejectModal && (
                <Portal>
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm 
                                  flex items-center justify-center z-[9999] p-4">
                        <div className="bg-white dark:bg-[#2a2a2e] rounded-2xl max-w-md w-full shadow-2xl">
                            <div className="border-b border-gray-200 dark:border-slate-700/60 p-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reject Purchase Request</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    Please provide a reason for rejection
                                </p>
                            </div>
                            <div className="p-6">
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Enter reason for rejection..."
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700/60 
                                              bg-white dark:bg-[#2a2a2e] 
                                              text-gray-900 dark:text-white
                                              rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent 
                                              outline-none transition resize-none h-24 text-sm"
                                    maxLength={500}
                                />
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                    {rejectReason.length}/500 characters
                                </p>
                            </div>
                            <div className="border-t border-gray-200 dark:border-slate-700/60 p-4 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                    }}
                                    className="px-4 py-2 text-sm font-semibold 
                                              text-gray-600 dark:text-slate-400 
                                              hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isApproving || !rejectReason.trim()}
                                    className="px-6 py-2 bg-red-600 dark:bg-red-500 
                                              hover:bg-red-700 dark:hover:bg-red-600 
                                              text-white text-sm font-semibold rounded-lg 
                                              transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isApproving ? (
                                        <>
                                            <Loader2 className="animate-spin h-4 w-4" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <X className="h-4 w-4" />
                                            Reject
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
}