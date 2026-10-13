'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Check, X, Loader2, Clock, DollarSign, FileText, User, Building, Tag, AlertCircle, Users, UserCog, Shield, Calendar, Package, Trash2, Edit3, Plus, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/services/client/supabase';
import { 
    deleteNotificationForUser, 
    deleteAllNotificationsForUser,
    markNotificationAsReadForUser,
    markAllNotificationsAsReadForUser,
    RecipientItem
} from '../../lib/services/notifications';
import { useConfirm } from '../ui/ConfirmModal';
import Portal from '../client/Portal';
import { user } from '../../lib/services/Class/user';


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
    role: string | string[];
    user_id?: string | null;
    recipient_user_ids?: RecipientItem[] | null;
    reference_type?: string | null;
    reference_id?: string | null;
    read_at?: string | null;
}

function isNotificationReadByUser(notif: Notification, currentUserId: string | null): boolean {
    const uidClean = (currentUserId || (typeof window !== 'undefined' ? (user.getUserId() || localStorage.getItem('user_id')) : null) || '').toLowerCase().trim();
    
    if (notif.user_id && uidClean && notif.user_id.toLowerCase() === uidClean) {
        return Boolean(notif.is_read);
    }
    
    if (Array.isArray(notif.recipient_user_ids) && notif.recipient_user_ids.length > 0) {
        if (!uidClean) return Boolean(notif.is_read);
        const found = notif.recipient_user_ids.find((item: any) => {
            const uid = typeof item === 'string' ? item : item?.user_id;
            return uid && String(uid).toLowerCase() === uidClean;
        });
        if (found) {
            if (typeof found === 'object') {
                return Boolean(found.is_read);
            }
            return Boolean(notif.is_read);
        }
        // If current user is not in the recipient array, they are not an active recipient for this notification
        return true;
    }
    
    return Boolean(notif.is_read);
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

const PAGE_SIZE = 3;
const CACHE_KEY_BASE = 'notifications_cache_v4';
const LEGACY_CACHE_KEY = 'notifications_cache';
const CACHE_DURATION = 5 * 60 * 1000;
const DISMISSED_KEY_BASE = 'dismissed_notifications_v2';

function getDismissedSet(userIdentifier: string): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const key = `${DISMISSED_KEY_BASE}_${(userIdentifier || 'anonymous').toLowerCase().trim()}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return new Set(arr);
        }
    } catch {}
    return new Set();
}

function addDismissedKeys(userIdentifier: string, keys: string[]) {
    if (typeof window === 'undefined') return;
    try {
        const set = getDismissedSet(userIdentifier);
        keys.forEach(k => { if (k) set.add(k); });
        const key = `${DISMISSED_KEY_BASE}_${(userIdentifier || 'anonymous').toLowerCase().trim()}`;
        localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
}

// Module-level cache to prevent duplicate toasts across mounted NotificationBell instances (e.g. desktop + mobile) and rapid events
const recentToastedKeys = new Map<string, number>();

function shouldShowToastForNotification(notif: Notification, currentEmail: string, currentName: string): boolean {
    const now = Date.now();
    // Clean entries older than 15s
    for (const [key, timestamp] of recentToastedKeys.entries()) {
        if (now - timestamp > 15000) {
            recentToastedKeys.delete(key);
        }
    }

    // Suppress toast if the current logged-in user is the one who created it (they already received their own action toast)
    const creatorEmail = (notif.creator_email || '').toLowerCase().trim();
    const creatorName = (notif.creator_name || '').toLowerCase().trim();
    const myEmail = (currentEmail || '').toLowerCase().trim();
    const myName = (currentName || '').toLowerCase().trim();

    if (myEmail && creatorEmail && myEmail === creatorEmail) {
        return false;
    }
    if (myName && creatorName && myName === creatorName && myName !== 'system') {
        return false;
    }

    // Deduplication key: prefer po_request_id, otherwise title + message
    const dedupeKey = notif.po_request_id
        ? `pr_${notif.po_request_id}`
        : `${notif.title}_${notif.message}`;

    const lastTime = recentToastedKeys.get(dedupeKey);
    if (lastTime && now - lastTime < 5000) {
        return false; // Suppress duplicate toast within 5 seconds
    }

    recentToastedKeys.set(dedupeKey, now);
    return true;
}

function deduplicateNotifications(list: Notification[]): Notification[] {
    const seen = new Set<string>();
    const result: Notification[] = [];
    for (const item of list) {
        // If it's a purchase request notification, deduplicate by po_request_id so historical dual-role rows don't duplicate
        const key = item.po_request_id ? `pr_${item.po_request_id}` : item.id;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    return result;
}

export function NotificationBell() {
    const router = useRouter();
    const { confirm } = useConfirm();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [visibleCount, setVisibleCount] = useState(3);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [userRole, setUserRole] = useState<string>(() => typeof window !== 'undefined' ? user.getRole() : '');
    const [userEmail, setUserEmail] = useState<string>(() => typeof window !== 'undefined' ? user.getEmail() : '');
    const [userName, setUserName] = useState<string>(() => typeof window !== 'undefined' ? user.getName() : '');
    const [totalUnread, setTotalUnread] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const userEmailRef = useRef(userEmail);
    const userNameRef = useRef(userName);
    useEffect(() => {
        userEmailRef.current = userEmail;
    }, [userEmail]);
    useEffect(() => {
        userNameRef.current = userName;
    }, [userName]);

    // Reset visible count to 3 when opening dropdown
    useEffect(() => {
        if (isOpen) {
            setVisibleCount(3);
        }
    }, [isOpen]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [purchaseRequest, setPurchaseRequest] = useState<PurchaseRequest | null>(null);
    const [isLoadingPR, setIsLoadingPR] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [isEditingPR, setIsEditingPR] = useState(false);
    const [editPRData, setEditPRData] = useState<any>(null);
    const [isSavingEdits, setIsSavingEdits] = useState(false);
    const [linkedPO, setLinkedPO] = useState<any>(null);

    const [userId, setUserId] = useState<string | null>(() => typeof window !== 'undefined' ? user.getUserId() : null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    const getCacheKey = useCallback(() => {
        return `${CACHE_KEY_BASE}_${(userRole || '').toLowerCase()}_${userEmail || 'anon'}`;
    }, [userRole, userEmail]);

    const isNotificationForUser = useCallback((notif: Partial<Notification> | string) => {
        const normalizeRoles = (r: any): string[] => {
            if (!r) return ['all'];
            if (Array.isArray(r)) return r.map((item: any) => String(item).toLowerCase().trim());
            if (typeof r === 'string') {
                const trimmed = r.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed)) return parsed.map((item: any) => String(item).toLowerCase().trim());
                    } catch {}
                }
                return [trimmed.toLowerCase()];
            }
            return ['all'];
        };

        const targetRoles = normalizeRoles(typeof notif === 'string' ? notif : notif.role);
        const uRole = (userRole || (typeof window !== 'undefined' ? user.getRole() : '') || '').toLowerCase().trim();
        const currentUserId = (userId || (typeof window !== 'undefined' ? (user.getUserId() || localStorage.getItem('user_id')) : null) || '').toLowerCase().trim();
        const currentEmail = (userEmail || (typeof window !== 'undefined' ? (user.getEmail() || localStorage.getItem('user_email')) : '') || '').toLowerCase().trim();

        if (typeof notif === 'string') {
            return targetRoles.some(nR => nR === 'all' || nR === uRole);
        }

        const notifUserId = (notif.user_id || '').toLowerCase().trim();
        const creatorEmail = (notif.creator_email || '').toLowerCase().trim();
        const refType = (notif.reference_type || '').toLowerCase();
        const link = (notif.link || '').toLowerCase();
        const title = (notif.title || '').toLowerCase();

        // 0. If user explicitly deleted/dismissed this notification, block immediately
        const dismissedSet = getDismissedSet(currentUserId || currentEmail);
        if (notif.id && dismissedSet.has(notif.id)) {
            return false;
        }
        if (notif.po_request_id && dismissedSet.has(`pr_${notif.po_request_id}`)) {
            return false;
        }

        // 1. If user deleted/dismissed this notification from their recipient list, block immediately
        if (Array.isArray(notif.recipient_user_ids) && notif.recipient_user_ids.length > 0 && currentUserId) {
            const found = notif.recipient_user_ids.find((item: any) => {
                const uid = typeof item === 'string' ? item : item?.user_id;
                return uid && String(uid).toLowerCase() === currentUserId;
            });
            if (!found || (typeof found === 'object' && (found.is_deleted || found.deleted))) {
                return false;
            }
        }

        // 2. Login Authorization Request (Strictly Admin only, NEVER Executive, NEVER other roles)
        if (title.includes('login authorization') || link.includes('access_control')) {
            return uRole === 'admin';
        }

        // 3. Direct recipient match (by user_id or creator_email)
        const isDirectRecipient = (notifUserId && currentUserId && notifUserId === currentUserId) ||
                                  (creatorEmail && currentEmail && creatorEmail === currentEmail);

        // 4. Document-related notification (strictly isolated to the uploader/recipient)
        const isDocNotification =
            refType.includes('document') ||
            link.includes('/documents') ||
            title.startsWith('upload') ||
            title.startsWith('document uploaded') ||
            title.startsWith('missing file');

        if (isDocNotification) {
            return isDirectRecipient;
        }

        // 5. Explicit direct-to-user notification
        if (targetRoles.includes('user')) {
            return isDirectRecipient;
        }

        // 6. Direct recipient match for personal notification
        if (isDirectRecipient && targetRoles.includes('all')) {
            return true;
        }

        // 7. Role-based notifications (Strict match to user's role: Admin is Admin, Executive is Executive)
        return targetRoles.some(nR => nR === 'all' || nR === uRole);
    }, [userRole, userId, userEmail]);

    // get user role and email from storage and keep updated
    useEffect(() => {
        let isMounted = true;
        const syncUserData = async () => {
            if (typeof window !== 'undefined') {
                if (localStorage.getItem(LEGACY_CACHE_KEY)) {
                    localStorage.removeItem(LEGACY_CACHE_KEY);
                }

                let role = user.getRole() || 'User';
                let email = user.getEmail() || '';
                let name = user.getName() || '';
                let uid = user.getUserId() || '';

                if (!uid && email) {
                    try {
                        const { data: dbUser } = await supabase
                            .from('users')
                            .select('id, role')
                            .ilike('email', email.trim())
                            .maybeSingle();
                        if (dbUser?.id && isMounted) {
                            uid = dbUser.id;
                            localStorage.setItem('user_id', dbUser.id);
                        }
                    } catch (e) {
                        // ignore lookup error
                    }
                }

                if (!uid || !email) {
                    try {
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        if (authUser && isMounted) {
                            uid = uid || authUser.id;
                            email = email || authUser.email || '';
                            name = name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
                            role = role || authUser.user_metadata?.role || 'User';
                        }
                    } catch (e) {
                        // ignore auth check error
                    }
                }

                if (isMounted) {
                    setUserRole(role);
                    setUserEmail(email);
                    setUserName(name);
                    setUserId(uid || null);
                }
            }
        };

        syncUserData();
        window.addEventListener('storage', syncUserData);
        return () => {
            isMounted = false;
            window.removeEventListener('storage', syncUserData);
        };
    }, []);

    // Lock page scroll on mobile overlay only (<640px)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isMobile = window.innerWidth < 640;
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen]);

    // Native non-passive wheel isolation to completely prevent wheel propagation to window/Lenis
    useEffect(() => {
        const popoverEl = popoverRef.current;
        if (!isOpen || !popoverEl) return;

        const handleWheel = (e: WheelEvent) => {
            // Stop wheel bubbling so parent page and Lenis never receive it
            e.stopPropagation();

            const listEl = listContainerRef.current;
            if (!listEl) {
                e.preventDefault();
                return;
            }

            const { scrollTop, scrollHeight, clientHeight } = listEl;
            const isScrollable = scrollHeight > clientHeight;

            // If wheeling outside the scroll list (e.g. header/footer) or if not scrollable
            if (!isScrollable || !listEl.contains(e.target as Node)) {
                e.preventDefault();
                return;
            }

            // Prevent chaining at boundaries
            const deltaY = e.deltaY;
            if ((deltaY < 0 && scrollTop <= 0) || (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1)) {
                e.preventDefault();
            }
        };

        popoverEl.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            popoverEl.removeEventListener('wheel', handleWheel);
        };
    }, [isOpen]);

    // close dropdown on outside click
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

    // load cached notifications
    const loadCachedNotifications = useCallback(() => {
        try {
            const cached = localStorage.getItem(getCacheKey());
            const currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CACHE_DURATION;
                if (!isExpired && data && data.length > 0) {
                    const filteredData = deduplicateNotifications(data.filter((n: Notification) => isNotificationForUser(n)));
                    setNotifications(filteredData);
                    setTotalCount(filteredData.length);
                    const unread = filteredData.filter((n: Notification) => !isNotificationReadByUser(n, currentUserId)).length;
                    setUnreadCount(unread);
                    setTotalUnread(unread);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error);
        }
        return false;
    }, [getCacheKey, isNotificationForUser, userId]);

    // save notifications to cache
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

    // count unread notifications
    const fetchUnreadCount = useCallback(async () => {
        try {
            const currentUserId = userId || (typeof window !== 'undefined' ? (user.getUserId() || localStorage.getItem('user_id')) : null) || '';
            const res = await supabase
                .from('notifications')
                .select('id, role, user_id, creator_email, reference_type, po_request_id, is_read, recipient_user_ids, title, link')
                .order('created_at', { ascending: false })
                .limit(100);

            const queryData = res.data || [];
            const visible = queryData.filter((n: any) => isNotificationForUser(n));
            const deduplicated = deduplicateNotifications(visible as Notification[]);
            const unread = deduplicated.filter(n => !isNotificationReadByUser(n, currentUserId)).length;
            setTotalUnread(unread);
            setUnreadCount(unread);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [isNotificationForUser, userId]);

    const isNotificationForUserRef = useRef(isNotificationForUser);
    useEffect(() => {
        isNotificationForUserRef.current = isNotificationForUser;
    }, [isNotificationForUser]);

    const saveToCacheRef = useRef(saveToCache);
    useEffect(() => {
        saveToCacheRef.current = saveToCache;
    }, [saveToCache]);

    const fetchUnreadCountRef = useRef(fetchUnreadCount);
    useEffect(() => {
        fetchUnreadCountRef.current = fetchUnreadCount;
    }, [fetchUnreadCount]);

    // fetch notifications with progressive loading (3 initially, +3 on load more)
    const fetchNotifications = useCallback(async (_pageNum: number = 0, _append: boolean = false) => {
        setIsLoading(true);

        try {
            const res = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            const rawData = res.data || [];
            const notificationsData = rawData.filter((n: any) => isNotificationForUser(n));
            const currentUserId = userId || (typeof window !== 'undefined' ? (user.getUserId() || localStorage.getItem('user_id')) : null) || '';
            const uniqueData = deduplicateNotifications(notificationsData);

            setNotifications(uniqueData);
            setTotalCount(uniqueData.length);
            saveToCache(uniqueData);

            const unread = uniqueData.filter(n => !isNotificationReadByUser(n, currentUserId)).length;
            setUnreadCount(unread);
            setTotalUnread(unread);
            await fetchUnreadCount();

        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [saveToCache, fetchUnreadCount, isNotificationForUser, userId]);

    // load initial notifications
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

    // listen for realtime notification updates
    useEffect(() => {
        let isSubscribed = true;
        const channelId = `navbar_notifs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications' },
                (payload) => {
                    if (!isSubscribed) return;
                    if (payload.eventType === 'INSERT') {
                        const newNotif = payload.new as Notification;
                        if (isNotificationForUserRef.current(newNotif)) {
                            setNotifications(prev => {
                                if (prev.some(n => n.id === newNotif.id || (newNotif.po_request_id && n.po_request_id === newNotif.po_request_id))) return prev;
                                const updated = deduplicateNotifications([newNotif, ...prev]);
                                saveToCacheRef.current(updated);
                                return updated;
                            });
                            setTotalCount(prev => prev + 1);
                            const currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
                            if (!isNotificationReadByUser(newNotif, currentUserId)) {
                                setUnreadCount(prev => prev + 1);
                                setTotalUnread(prev => prev + 1);
                            }
                            if (shouldShowToastForNotification(newNotif, userEmailRef.current, userNameRef.current)) {
                                const toastKey = newNotif.po_request_id || newNotif.id || `${newNotif.title}_${newNotif.message}`;
                                const isLoginAuthReq = newNotif.title === 'Login Authorization Request' || (newNotif.link && newNotif.link.includes('access_control'));
                                if (isLoginAuthReq) {
                                    const targetLink = newNotif.link && newNotif.link.includes('edit_email')
                                        ? newNotif.link
                                        : `/user-activity?tab=access_control&edit_email=${encodeURIComponent(newNotif.creator_email || '')}`;
                                    toast.info(newNotif.title, {
                                        id: `notif_${toastKey}`,
                                        description: newNotif.message,
                                        duration: 8000,
                                        action: { 
                                            label: 'Extend',
                                            onClick: () => {
                                                router.push(targetLink);
                                            },
                                        },
                                    });
                                } else {
                                    toast.info(newNotif.title, {
                                        id: `notif_${toastKey}`,
                                        description: newNotif.message,
                                        duration: 6000,
                                    });
                                }
                            }
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedNotif = payload.new as Notification;
                        if (!isNotificationForUserRef.current(updatedNotif)) {
                            // User was removed from recipient_user_ids (dismissed in another tab/device or session)
                            setNotifications(prev => {
                                const updated = prev.filter(n => n.id !== updatedNotif.id);
                                saveToCacheRef.current(updated);
                                return updated;
                            });
                            setTotalCount(prev => Math.max(0, prev - 1));
                            fetchUnreadCountRef.current();
                        } else {
                            setNotifications(prev => {
                                const updated = prev.map(n => n.id === updatedNotif.id ? updatedNotif : n);
                                saveToCacheRef.current(updated);
                                return updated;
                            });
                            fetchUnreadCountRef.current();
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = (payload.old as { id: string })?.id;
                        if (deletedId) {
                            setNotifications(prev => {
                                const updated = prev.filter(n => n.id !== deletedId);
                                saveToCacheRef.current(updated);
                                return updated;
                            });
                            setTotalCount(prev => Math.max(0, prev - 1));
                            fetchUnreadCountRef.current();
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'purchase_requests' },
                (payload) => {
                    if (!isSubscribed) return;
                    if (payload.eventType === 'UPDATE') {
                        const updatedPR = payload.new as PurchaseRequest;
                        setPurchaseRequest(prev => prev && prev.id === updatedPR.id ? updatedPR : prev);
                    }
                }
            )
            .subscribe((status, err) => {
                if (!isSubscribed) return;
                if (status === 'SUBSCRIBED') {
                    fetchUnreadCountRef.current();
                }
                // Suppress normal transient disconnects / unmount closures (1006) which Supabase handles via auto-reconnect
                if (err && status !== 'CLOSED') {
                    const errMsg = String(err?.message || err).toLowerCase();
                    if (!errMsg.includes('1006') && !errMsg.includes('closed') && !errMsg.includes('transport failure') && !errMsg.includes('timeout')) {
                        console.warn('[Realtime Notifications] Subscription error:', err);
                    }
                }
            });

        return () => {
            isSubscribed = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            const currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
            const target = notifications.find(n => n.id === id);

            // mark notification read in state optimistically
            setNotifications(prev => prev.map(n => {
                if (n.id !== id) return n;
                let updatedRecipients = n.recipient_user_ids;
                if (Array.isArray(updatedRecipients) && currentUserId) {
                    updatedRecipients = updatedRecipients.map((item: any) => {
                        const uid = typeof item === 'string' ? item : item?.user_id;
                        if (uid && uid.toLowerCase() === currentUserId.toLowerCase()) {
                            return { user_id: uid, is_read: true, read_at: new Date().toISOString() };
                        }
                        return item;
                    });
                }
                return { ...n, is_read: true, recipient_user_ids: updatedRecipients };
            }));

            setUnreadCount(prev => Math.max(0, prev - 1));
            setTotalUnread(prev => Math.max(0, prev - 1));

            // save updated state to cache
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const updated = data.map((n: Notification) => {
                    if (n.id !== id) return n;
                    let updatedRecipients = n.recipient_user_ids;
                    if (Array.isArray(updatedRecipients) && currentUserId) {
                        updatedRecipients = updatedRecipients.map((item: any) => {
                            const uid = typeof item === 'string' ? item : item?.user_id;
                            if (uid && uid.toLowerCase() === currentUserId.toLowerCase()) {
                                return { user_id: uid, is_read: true, read_at: new Date().toISOString() };
                            }
                            return item;
                        });
                    }
                    return { ...n, is_read: true, recipient_user_ids: updatedRecipients };
                });
                localStorage.setItem(cacheKey, JSON.stringify({ data: updated, timestamp }));
            }

            // update database for this user
            await markNotificationAsReadForUser(
                id,
                currentUserId,
                target?.recipient_user_ids,
                target?.user_id
            );
        } catch (error) {
            console.error('Error marking as read:', error);
            toast.error('Failed to mark as read');
            fetchNotifications(0, false);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
            const unreadItems = notifications.filter(n => !isNotificationReadByUser(n, currentUserId));

            if (unreadItems.length === 0) {
                toast.info('No unread notifications');
                return;
            }

            // mark all read in state optimistically
            setNotifications(prev => prev.map(n => {
                let updatedRecipients = n.recipient_user_ids;
                if (Array.isArray(updatedRecipients) && currentUserId) {
                    updatedRecipients = updatedRecipients.map((item: any) => {
                        const uid = typeof item === 'string' ? item : item?.user_id;
                        if (uid && uid.toLowerCase() === currentUserId.toLowerCase()) {
                            return { user_id: uid, is_read: true, read_at: new Date().toISOString() };
                        }
                        return item;
                    });
                }
                return { ...n, is_read: true, recipient_user_ids: updatedRecipients };
            }));

            setUnreadCount(0);
            setTotalUnread(0);

            // save updated state to cache
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const updated = data.map((n: Notification) => ({ ...n, is_read: true }));
                localStorage.setItem(cacheKey, JSON.stringify({ data: updated, timestamp }));
            }

            // update in database
            await markAllNotificationsAsReadForUser(
                unreadItems.map(n => ({
                    id: n.id,
                    user_id: n.user_id,
                    recipient_user_ids: n.recipient_user_ids,
                })),
                currentUserId
            );

            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
            fetchNotifications(0, false);
        }
    };

    // delete single notification
    const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const target = notifications.find(n => n.id === id);
            const wasUnread = target && !isNotificationReadByUser(target, userId);
            let currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';

            if (!currentUserId && userEmail) {
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('email', userEmail.trim())
                    .maybeSingle();
                if (dbUser?.id) {
                    currentUserId = dbUser.id;
                    setUserId(dbUser.id);
                    localStorage.setItem('user_id', dbUser.id);
                }
            }

            // remove notification from state immediately
            setNotifications(prev => prev.filter(n => n.id !== id));
            setTotalCount(prev => Math.max(0, prev - 1));
            if (wasUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1));
                setTotalUnread(prev => Math.max(0, prev - 1));
            }

            // update cache
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const updated = data.filter((n: Notification) => n.id !== id);
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: updated,
                    timestamp
                }));
            }

            // Record in persistent dismissed set so it never reappears on refresh
            const userIdentifier = currentUserId || userEmail || (typeof window !== 'undefined' ? user.getEmail() : '');
            const keysToDismiss = [id];
            if (target?.po_request_id) {
                keysToDismiss.push(`pr_${target.po_request_id}`);
            }
            addDismissedKeys(userIdentifier, keysToDismiss);

            // delete/dismiss from database
            await deleteNotificationForUser(
                id,
                currentUserId,
                target?.recipient_user_ids,
                target?.user_id
            );

            toast.success('Notification removed');
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
            fetchNotifications(0, false);
        }
    };

    // delete all notifications
    const handleDeleteAll = async () => {
        if (notifications.length === 0) return;

        const confirmed = await confirm({
            title: 'Clear Notifications',
            message: 'Are you sure you want to delete all notifications?',
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        try {
            let currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
            if (!currentUserId && userEmail) {
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('email', userEmail.trim())
                    .maybeSingle();
                if (dbUser?.id) {
                    currentUserId = dbUser.id;
                    setUserId(dbUser.id);
                    localStorage.setItem('user_id', dbUser.id);
                }
            }

            const currentNotifs = [...notifications];

            // Record all currently visible notifications in persistent dismissed set
            const userIdentifier = currentUserId || userEmail || (typeof window !== 'undefined' ? user.getEmail() : '');
            const keysToDismiss: string[] = [];
            currentNotifs.forEach(n => {
                if (n.id) keysToDismiss.push(n.id);
                if (n.po_request_id) keysToDismiss.push(`pr_${n.po_request_id}`);
            });
            addDismissedKeys(userIdentifier, keysToDismiss);

            setNotifications([]);
            setTotalCount(0);
            setUnreadCount(0);
            setTotalUnread(0);

            // clear cache
            const cacheKey = getCacheKey();
            localStorage.removeItem(cacheKey);

            // delete notifications from database
            await deleteAllNotificationsForUser(
                currentNotifs.map(n => ({
                    id: n.id,
                    user_id: n.user_id,
                    recipient_user_ids: n.recipient_user_ids,
                })),
                currentUserId
            );

            toast.success('All notifications deleted');
        } catch (error) {
            console.error('Error deleting notifications:', error);
            toast.error('Failed to delete notifications');
            fetchNotifications(0, false);
        }
    };

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 3);
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
            if (notification.link.startsWith('/api/') || notification.link.includes('download')) {
                const a = document.createElement('a');
                a.href = notification.link;
                a.target = '_blank';
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast.success('Downloading attached manifest (.xlsx)...');
            } else {
                let targetUrl = notification.link;
                if ((notification.title === 'Login Authorization Request' || targetUrl.includes('tab=access_control')) && !targetUrl.includes('edit_email') && notification.creator_email) {
                    targetUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}edit_email=${encodeURIComponent(notification.creator_email)}`;
                }
                router.push(targetUrl);
            }
            setIsOpen(false);
        }
    };

    const showPurchaseRequestModal = async (notification: Notification) => {
        setSelectedNotification(notification);
        setShowModal(true);
        setIsLoadingPR(true);
        setIsEditingPR(false);
        setEditPRData(null);
        setLinkedPO(null);

        try {
            const { data, error } = await supabase
                .from('purchase_requests')
                .select('*')
                .eq('id', notification.po_request_id)
                .single();

            if (error) throw error;
            setPurchaseRequest(data);
            setEditPRData(data ? JSON.parse(JSON.stringify(data)) : null);

            // Fetch linked purchase order status
            const { data: po } = await supabase
                .from('purchase_orders')
                .select('id, po_number, status')
                .eq('request_id', notification.po_request_id)
                .maybeSingle();

            setLinkedPO(po || null);
        } catch (error) {
            console.error('Error fetching purchase request:', error);
            toast.error('Failed to load purchase request details');
        } finally {
            setIsLoadingPR(false);
        }
    };

    const handleEditItemChange = (index: number, field: string, value: any) => {
        if (!editPRData) return;
        const currentItems = [...(editPRData.items || [])];
        const item = { ...currentItems[index] };

        if (field === 'name') {
            item.name = value;
            item.item_name = value;
        } else if (field === 'quantity') {
            const qty = Math.max(1, Number(value) || 1);
            item.quantity = qty;
            const price = Number(item.unit_price ?? item.price ?? 0);
            item.total = qty * price;
        } else if (field === 'unit_price') {
            const price = Math.max(0, Number(value) || 0);
            item.unit_price = price;
            item.price = price;
            const qty = Math.max(1, Number(item.quantity) || 1);
            item.total = qty * price;
        }

        currentItems[index] = item;
        const newTotal = currentItems.reduce((acc: number, it: any) => acc + (Number(it.total) || 0), 0);

        setEditPRData({
            ...editPRData,
            items: currentItems,
            amount: newTotal,
        });
    };

    const handleAddEditItem = () => {
        if (!editPRData) return;
        const currentItems = [...(editPRData.items || [])];
        currentItems.push({
            name: '',
            quantity: 1,
            unit_price: 0,
            price: 0,
            total: 0,
        });
        setEditPRData({
            ...editPRData,
            items: currentItems,
        });
    };

    const handleRemoveEditItem = (index: number) => {
        if (!editPRData) return;
        const currentItems = (editPRData.items || []).filter((_: any, idx: number) => idx !== index);
        const newTotal = currentItems.reduce((acc: number, it: any) => acc + (Number(it.total) || 0), 0);
        setEditPRData({
            ...editPRData,
            items: currentItems,
            amount: newTotal,
        });
    };

    const handleSaveEdits = async () => {
        if (!selectedNotification?.po_request_id || !purchaseRequest || !editPRData) return;

        const reqStatus = (purchaseRequest.status || '').toLowerCase();
        const poStatus = (linkedPO?.status || '').toLowerCase();
        const isLocked = ['sent', 'confirmed', 'delivered', 'completed'].includes(reqStatus) || ['sent', 'confirmed', 'delivered', 'completed'].includes(poStatus);
        if (isLocked) {
            toast.error('This purchase order/request is locked (sent, confirmed, or delivered) and cannot be updated.');
            setIsEditingPR(false);
            return;
        }

        setIsSavingEdits(true);
        try {
            const rawItems = editPRData.items || [];
            const sanitizedItems = rawItems.map((item: any) => {
                const name = (item.name || item.item_name || 'Item').trim();
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unit_price = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                return {
                    name,
                    quantity,
                    unit_price,
                    price: unit_price,
                    total: quantity * unit_price,
                };
            });
            const computedSum = sanitizedItems.reduce((acc: number, item: any) => acc + item.total, 0);
            const finalAmount = computedSum > 0 ? computedSum : (Number(editPRData.amount) || 0);

            const updatePayload = {
                items: sanitizedItems,
                amount: finalAmount,
                description: editPRData.description || sanitizedItems.map((i: any) => `${i.name} (${i.quantity} @ ₱${i.unit_price.toLocaleString()})`).join(', '),
                reason: editPRData.reason,
                priority: editPRData.priority,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('purchase_requests')
                .update(updatePayload)
                .eq('id', selectedNotification.po_request_id);

            if (error) throw error;

            setPurchaseRequest({
                ...purchaseRequest,
                ...updatePayload,
            });
            toast.success('Changes saved successfully');
            setIsEditingPR(false);
        } catch (error) {
            console.error('Error saving edits:', error);
            toast.error('Failed to save changes');
        } finally {
            setIsSavingEdits(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedNotification?.po_request_id || !purchaseRequest) return;

        const confirmed = await confirm({
            title: 'Approve Purchase Request',
            message: isEditingPR
                ? `Save changes and approve this purchase request? This will mark the request as approved and ready for purchase order creation.`
                : `Are you sure you want to approve this purchase request? This will mark the request as approved and ready for purchase order creation.`,
            confirmText: isEditingPR ? 'Save & Approve' : 'Approve Request',
            cancelText: 'Cancel',
            confirmVariant: 'pink',
        });

        if (!confirmed) return;

        setIsApproving(true);
        try {
            const activeData = isEditingPR && editPRData ? editPRData : purchaseRequest;
            const rawItems = activeData.items || [];
            const sanitizedItems = rawItems.map((item: any) => {
                const name = (item.name || item.item_name || 'Item').trim();
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unit_price = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                return {
                    name,
                    quantity,
                    unit_price,
                    price: unit_price,
                    total: quantity * unit_price,
                };
            });
            const computedSum = sanitizedItems.reduce((acc: number, item: any) => acc + item.total, 0);
            const finalAmount = computedSum > 0 ? computedSum : (Number(activeData.amount) || 0);

            const updatePayload: any = {
                status: 'Approved',
                updated_at: new Date().toISOString(),
            };

            if (isEditingPR && editPRData) {
                updatePayload.items = sanitizedItems;
                updatePayload.amount = finalAmount;
                updatePayload.description = editPRData.description || sanitizedItems.map((i: any) => `${i.name} (${i.quantity} @ ₱${i.unit_price.toLocaleString()})`).join(', ');
                updatePayload.reason = editPRData.reason || purchaseRequest.reason;
                updatePayload.priority = editPRData.priority || purchaseRequest.priority;
            }

            const { error } = await supabase
                .from('purchase_requests')
                .update(updatePayload)
                .eq('id', selectedNotification.po_request_id);

            if (error) throw error;

            toast.success(isEditingPR ? 'Request updated and approved successfully' : 'Purchase request approved successfully');
            setIsEditingPR(false);
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
            message: `Are you sure you want to reject this purchase request? Reason: "${rejectReason}"`,
            confirmText: 'Reject Request',
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
            setIsEditingPR(false);
            setEditPRData(null);
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
            case 'dispatch_manifest': return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30';
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
            case 'dispatch_manifest': return 'fas fa-file-excel';
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

    const getRoleIcon = (role?: string | string[]) => {
        let first = 'All';
        if (Array.isArray(role)) {
            first = role[0] || 'All';
        } else if (typeof role === 'string') {
            if (role.startsWith('[') && role.endsWith(']')) {
                try {
                    const parsed = JSON.parse(role);
                    first = Array.isArray(parsed) ? (parsed[0] || 'All') : role;
                } catch {
                    first = role;
                }
            } else {
                first = role;
            }
        }
        switch (first) {
            case 'All': return <Users className="h-3 w-3" />;
            case 'Admin': return <Shield className="h-3 w-3" />;
            case 'Purchase Officer': return <UserCog className="h-3 w-3" />;
            case 'Executive': return <Shield className="h-3 w-3" />;
            default: return <User className="h-3 w-3" />;
        }
    };

    const getRoleColor = (role?: string | string[]) => {
        let first = 'All';
        if (Array.isArray(role)) {
            first = role[0] || 'All';
        } else if (typeof role === 'string') {
            if (role.startsWith('[') && role.endsWith(']')) {
                try {
                    const parsed = JSON.parse(role);
                    first = Array.isArray(parsed) ? (parsed[0] || 'All') : role;
                } catch {
                    first = role;
                }
            } else {
                first = role;
            }
        }
        switch (first) {
            case 'Admin': return 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30';
            case 'Purchase Officer': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
            case 'Employee': return 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30';
            case 'Executive': return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30';
            case 'Operator': return 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/30';
            default: return 'bg-gray-100 dark:bg-slate-700/30 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700/60';
        }
    };

    if (!isMounted) return null;    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Neumorphic Bell Trigger Button */}
                <button
                    ref={buttonRef}
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (!isOpen) {
                            fetchUnreadCount();
                        }
                    }}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200 cursor-pointer ${
                        isOpen
                            ? 'bg-[#e4ebf5] dark:bg-[#151622] shadow-[inset_3px_3px_6px_#caced6,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0e0f15,inset_-3px_-3px_6px_#222533] border border-slate-300/40 dark:border-white/5'
                            : 'bg-[#ebf0f7] dark:bg-[#181a24] shadow-[4px_4px_10px_#c2cad6,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_12px_#0e0f15,-4px_-4px_12px_#222533] hover:shadow-[2px_2px_6px_#c2cad6,-2px_-2px_6px_#ffffff] border border-white/80 dark:border-[#27293a] active:scale-95'
                    }`}
                    aria-label="Notifications"
                >
                    {totalUnread > 0 ? (
                        <>
                            <Bell className="h-4 w-4 text-pink-600 dark:text-pink-400 drop-shadow-[0_1px_2px_rgba(244,63,94,0.3)] animate-wiggle" />
                            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-gradient-to-tr from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_2px_6px_rgba(244,63,94,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/60 dark:border-pink-300/40">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        </>
                    ) : (
                        <BellOff className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    )}
                </button>

                {isOpen && (
                    <>
                        {/* Mobile Backdrop Overlay */}
                        <div
                            className="fixed inset-0 bg-slate-900/30 dark:bg-black/60 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Main Neumorphic Popover Panel */}
                        <div 
                            ref={popoverRef}
                            data-lenis-prevent
                            className="fixed sm:absolute inset-x-0 top-0 sm:top-full sm:right-0 sm:left-auto mt-0 sm:mt-3 w-full sm:w-[410px] h-[100dvh] sm:h-auto sm:max-h-[580px] 
                            bg-[#ebf0f7] dark:bg-[#181a24] 
                            rounded-none sm:rounded-3xl 
                            border-0 sm:border border-white/80 dark:border-[#27293a] 
                            shadow-[14px_14px_32px_#c2cad6,-14px_-14px_32px_#ffffff] dark:shadow-[16px_16px_40px_#0a0b10,-8px_-8px_30px_#242636] 
                            z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200 overscroll-contain"
                            style={{ overscrollBehavior: 'contain' }}
                        >

                            {/* Neumorphic Header */}
                            <div className="flex items-center justify-between px-5 py-4 
                            border-b border-slate-200/50 dark:border-slate-800/80 
                            bg-[#ebf0f7]/95 dark:bg-[#181a24]/95 backdrop-blur-md shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                        Notifications
                                    </h3>
                                    {notifications.length > 0 && (
                                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold 
                                        bg-[#e3e9f3] dark:bg-[#14151e] 
                                        text-slate-700 dark:text-slate-300 rounded-full 
                                        shadow-[inset_2px_2px_4px_#cbd4e2,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0d0e14,inset_-2px_-2px_4px_#20222f] 
                                        border border-white/40 dark:border-white/5">
                                            {notifications.length}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            disabled={totalUnread === 0}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                                totalUnread > 0
                                                    ? 'text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#1b1d2a] shadow-[3px_3px_7px_#c5cfdd,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_7px_#0d0e14,-3px_-3px_7px_#262838] hover:shadow-[inset_2px_2px_4px_#c5cfdd,inset_-2px_-2px_4px_#ffffff] dark:hover:shadow-[inset_2px_2px_4px_#0d0e14,inset_-2px_-2px_4px_#262838]'
                                                    : 'text-slate-400 dark:text-slate-600 bg-slate-100/50 dark:bg-slate-800/30 cursor-not-allowed opacity-60'
                                            }`}
                                            title="Mark all notifications as read"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            <span>Mark all read</span>
                                        </button>
                                    )}

                                    {notifications.length > 0 && (
                                        <button
                                            onClick={handleDeleteAll}
                                            className="p-2 text-slate-400 dark:text-slate-500 
                                            hover:text-rose-600 dark:hover:text-rose-400 
                                            bg-[#ebf0f7] dark:bg-[#1b1d2a] 
                                            shadow-[3px_3px_7px_#c5cfdd,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_7px_#0d0e14,-3px_-3px_7px_#262838] 
                                            hover:shadow-[inset_2px_2px_4px_#c5cfdd,inset_-2px_-2px_4px_#ffffff] dark:hover:shadow-[inset_2px_2px_4px_#0d0e14,inset_-2px_-2px_4px_#262838] 
                                            active:scale-95 rounded-xl transition-all flex items-center cursor-pointer"
                                            title="Clear all notifications"
                                            aria-label="Clear all notifications"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}

                                    {/* Mobile close button */}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 text-slate-400 dark:text-slate-500 
                                        bg-[#ebf0f7] dark:bg-[#1b1d2a] 
                                        shadow-[3px_3px_7px_#c5cfdd,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_7px_#0d0e14,-3px_-3px_7px_#262838] 
                                        rounded-xl sm:hidden"
                                        aria-label="Close notifications"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Neumorphic Scrollable List Container */}
                            <div 
                                ref={listContainerRef}
                                data-lenis-prevent
                                className="overflow-y-auto flex-1 p-3.5 space-y-3 
                                scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 overscroll-contain"
                                style={{ overscrollBehavior: 'contain' }}
                            >
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#ebf0f7] dark:bg-[#181a24] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0d0e14,inset_-3px_-3px_6px_#222533]">
                                            <Loader2 className="animate-spin h-6 w-6 text-pink-500 dark:text-pink-400" />
                                        </div>
                                        <span className="text-xs font-semibold">Updating notifications...</span>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center 
                                        bg-[#e5ebf4] dark:bg-[#14151e] 
                                        shadow-[inset_4px_4px_8px_#ccd5e2,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#0c0d12,inset_-4px_-4px_8px_#1e202c] mb-3.5">
                                            <BellOff className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">All caught up!</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
                                            No notifications right now. Alerts and notices will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {notifications.slice(0, visibleCount).map((notification) => {
                                            const currentUserId = userId || (typeof window !== 'undefined' ? user.getUserId() : null) || '';
                                            const isRead = isNotificationReadByUser(notification, currentUserId);

                                            return (
                                                <div
                                                    key={notification.id}
                                                    onClick={() => handleNotificationClick(notification)}
                                                    className={`group w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-start gap-3.5 cursor-pointer relative ${
                                                        !isRead
                                                            ? 'bg-[#eef2f7] dark:bg-[#1c1e2b] shadow-[4px_4px_12px_#cbd4e2,-4px_-4px_12px_#ffffff] dark:shadow-[5px_5px_14px_#0d0e14,-4px_-4px_12px_#272a3c] border border-white/80 dark:border-[#2b2e40] hover:shadow-[6px_6px_16px_#c4cedc,-6px_-6px_16px_#ffffff] dark:hover:shadow-[6px_6px_18px_#0a0b10,-5px_-5px_15px_#2a2d40] border-l-4 border-l-pink-500 dark:border-l-pink-400'
                                                            : 'bg-[#e5ebf4] dark:bg-[#14151f] shadow-[inset_2px_2px_6px_#ccd5e2,inset_-2px_-2px_6px_#ffffff] dark:shadow-[inset_2px_2px_6px_#0b0c11,inset_-2px_-2px_6px_#1f212e] border border-slate-200/50 dark:border-white/5 opacity-85 hover:opacity-100'
                                                    }`}
                                                >
                                                    {/* Neumorphic Icon Well */}
                                                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center transition-all ${
                                                        !isRead
                                                            ? 'bg-[#ebf0f7] dark:bg-[#191a25] shadow-[2px_2px_5px_#cbd4e2,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_#0d0e14,-2px_-2px_5px_#232535]'
                                                            : 'bg-[#e0e7f1] dark:bg-[#12131b] shadow-[inset_1px_1px_3px_#ccd5e2,inset_-1px_-1px_3px_#ffffff] dark:shadow-[inset_1px_1px_3px_#0a0b0f,inset_-1px_-1px_3px_#1d1f2b]'
                                                    } ${getTypeColor(notification.type)}`}>
                                                        <i className={`text-xs leading-none flex items-center justify-center ${getTypeIcon(notification.type)}`}></i>
                                                    </div>

                                                    {/* Content Column */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                                                                !isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                                                            }`}>
                                                                {notification.title}
                                                            </p>

                                                            <div className="shrink-0 flex items-center gap-1.5">
                                                                {/* Neumorphic delete button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleDeleteNotification(notification.id, e)}
                                                                    className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-transparent hover:bg-[#e2e8f1] dark:hover:bg-[#161722] active:shadow-[inset_1px_1px_3px_#cbd4e2,inset_-1px_-1px_3px_#ffffff] dark:active:shadow-[inset_1px_1px_3px_#0b0c11,inset_-1px_-1px_3px_#1f212e] transition-all cursor-pointer"
                                                                    title="Delete notification"
                                                                    aria-label="Delete notification"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                                                            !isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            {notification.message}
                                                        </p>


                                                        {/* Login Authorization Request - Extend Action */}
                                                        {(notification.title === 'Login Authorization Request' || (notification.link && notification.link.includes('tab=access_control'))) && (
                                                            <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!isRead) {
                                                                            handleMarkAsRead(notification.id);
                                                                        }
                                                                        const targetLink = notification.link && notification.link.includes('edit_email')
                                                                            ? notification.link
                                                                            : `/user-activity?tab=access_control&edit_email=${encodeURIComponent(notification.creator_email || '')}`;
                                                                        router.push(targetLink);
                                                                        setIsOpen(false);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl text-sky-700 dark:text-sky-300 bg-[#e5f3fc] dark:bg-[#142330] shadow-[3px_3px_7px_#c5dbe9,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_7px_#091118,-2px_-2px_6px_#1c3345] hover:shadow-[inset_2px_2px_4px_#c5dbe9,inset_-2px_-2px_4px_#ffffff] dark:hover:shadow-[inset_2px_2px_4px_#091118,inset_-2px_-2px_4px_#1c3345] active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                                                    <span>Extend</span>
                                                                </button>
                                                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium px-2 py-0.5 rounded-md bg-[#e1effa] dark:bg-[#111e29] shadow-[inset_1px_1px_2px_#c2d8e7,inset_-1px_-1px_2px_#ffffff] flex items-center gap-1">
                                                                    <Shield className="h-3 w-3" />
                                                                    <span>Access Request</span>
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Neumorphic Footer Chips */}
                                                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-[10px] text-slate-400 dark:text-slate-500">
                                                            <span className="px-2 py-0.5 rounded-md bg-[#e3e9f3] dark:bg-[#14151e] shadow-[inset_1px_1px_2px_#ccd5e2,inset_-1px_-1px_2px_#ffffff] dark:shadow-[inset_1px_1px_2px_#0d0e14,inset_-1px_-1px_2px_#1f212d] text-slate-600 dark:text-slate-400 font-medium">
                                                                {new Date(notification.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="truncate max-w-[110px] px-2 py-0.5 rounded-md bg-[#e3e9f3] dark:bg-[#14151e] shadow-[inset_1px_1px_2px_#ccd5e2,inset_-1px_-1px_2px_#ffffff] dark:shadow-[inset_1px_1px_2px_#0d0e14,inset_-1px_-1px_2px_#1f212d] font-medium text-slate-600 dark:text-slate-400">
                                                                {notification.creator_name}
                                                            </span>

                                                            {notification.type === 'purchase_request' && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-[inset_1px_1px_2px_rgba(99,102,241,0.2)] ml-auto">
                                                                    PO
                                                                </span>
                                                            )}

                                                            {notification.role && (() => {
                                                                const rawRole = notification.role;
                                                                let roleList: string[] = [];
                                                                if (Array.isArray(rawRole)) {
                                                                    roleList = rawRole.map(String);
                                                                } else if (typeof rawRole === 'string') {
                                                                    if (rawRole.startsWith('[') && rawRole.endsWith(']')) {
                                                                        try {
                                                                            const parsed = JSON.parse(rawRole);
                                                                            if (Array.isArray(parsed)) roleList = parsed.map(String);
                                                                        } catch {
                                                                            roleList = [rawRole];
                                                                        }
                                                                    } else {
                                                                        roleList = [rawRole];
                                                                    }
                                                                }
                                                                const displayRole = roleList.join(', ');
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[#e3e9f3] dark:bg-[#14151e] shadow-[inset_1px_1px_2px_#ccd5e2,inset_-1px_-1px_2px_#ffffff] dark:shadow-[inset_1px_1px_2px_#0d0e14,inset_-1px_-1px_2px_#1f212d] border border-slate-200/40 dark:border-white/5 ${getRoleColor(notification.role)} whitespace-nowrap`}>
                                                                        {getRoleIcon(notification.role)}
                                                                        <span className="font-semibold">To: {displayRole}</span>
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Neumorphic Load More Button */}
                                        {visibleCount < notifications.length && (
                                            <div className="pt-2 pb-1">
                                                <button
                                                    onClick={handleLoadMore}
                                                    className="w-full py-2.5 px-4 text-xs font-semibold 
                                                    text-pink-600 dark:text-pink-400 
                                                    bg-[#ebf0f7] dark:bg-[#1c1e2b] 
                                                    shadow-[4px_4px_10px_#c5cfdd,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#0d0e14,-4px_-4px_10px_#262838] 
                                                    hover:shadow-[inset_2px_2px_5px_#c5cfdd,inset_-2px_-2px_5px_#ffffff] dark:hover:shadow-[inset_2px_2px_5px_#0d0e14,inset_-2px_-2px_5px_#262838] 
                                                    active:scale-98 rounded-2xl transition-all 
                                                    flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    {`Load older notifications (${Math.min(visibleCount, notifications.length)} of ${notifications.length})`}
                                                </button>
                                            </div>
                                        )}

                                        {visibleCount >= notifications.length && notifications.length > 3 && (
                                            <div className="py-2 text-center">
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Showing all {notifications.length} notifications
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>            {/* Purchase Request Modal - Rendered via Portal */}
            {showModal && selectedNotification && (
                <Portal>
                    {/* Backdrop with click-to-close */}
                    <div
                        className="fixed inset-0 z-[9999] grid place-items-center p-4 
                                  bg-slate-950/60 dark:bg-black/75 backdrop-blur-md 
                                  overflow-hidden animate-in fade-in duration-200"
                        onClick={() => {
                            setShowModal(false);
                            setSelectedNotification(null);
                            setPurchaseRequest(null);
                        }}
                    >
                        {/* Modal Container */}
                        <div
                            className="flex flex-col w-full max-w-3xl max-h-[90vh] 
                                    bg-[#f0f3f8] dark:bg-[#161722] 
                                    rounded-3xl  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] 
                                    overflow-hidden border border-white/90 dark:border-white/[0.08] 
                                    transform transition-all animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >

                            {/* Fixed Header */}
                            <div className="shrink-0 flex items-center justify-between 
                                          border-b border-slate-200/60 dark:border-white/[0.06] 
                                          px-6 py-4.5 bg-[#f0f3f8] dark:bg-[#161722]">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-lg">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                                                Purchase Request
                                            </h3>
                                            {purchaseRequest?.request_number && (
                                                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2.5 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                    #{purchaseRequest.request_number}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
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
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                    aria-label="Close modal"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {isLoadingPR ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Fetching request details...</span>
                                    </div>
                                ) : purchaseRequest ? (
                                    <div className="space-y-5">

                                        {/* Status & Date Bar */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 
                                                      p-4 bg-[#ebf0f7] dark:bg-[#14151e] 
                                                      rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(purchaseRequest.status)}`}>
                                                    {purchaseRequest.status}
                                                </span>
                                                {isEditingPR ? (
                                                    <select
                                                        value={editPRData?.priority || 'Normal'}
                                                        onChange={(e) => setEditPRData({ ...editPRData, priority: e.target.value })}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#e4ebf5] dark:bg-[#111218] border border-pink-300/80 dark:border-pink-800/80 text-pink-600 dark:text-pink-400 focus:outline-none cursor-pointer shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                    >
                                                        <option value="Low">Low Priority</option>
                                                        <option value="Normal">Normal Priority</option>
                                                        <option value="High">High Priority</option>
                                                        <option value="Urgent">Urgent Priority</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getPriorityColor(purchaseRequest.priority)}`}>
                                                        {purchaseRequest.priority} Priority
                                                    </span>
                                                )}
                                                {isEditingPR && (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
                                                        Editing Mode
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
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
                                            <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-4 
                                                          border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.3),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)]">
                                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                                    <User className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Requester</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{purchaseRequest.requested_by}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{purchaseRequest.department}</p>
                                            </div>

                                            <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-4 
                                                          border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.3),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)]">
                                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                                    <Building className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Supplier</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{purchaseRequest.supplier_name || '—'}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Vendor</p>
                                            </div>

                                            <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-4 
                                                          border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.3),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)]">
                                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                                    <Tag className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Type</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{purchaseRequest.type}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Category</p>
                                            </div>

                                            <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-4 
                                                          border border-pink-200/80 dark:border-pink-900/40 shadow-[3px_3px_7px_rgba(166,175,195,0.3),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)]">
                                                <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 mb-1">
                                                    <DollarSign className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Amount</span>
                                                </div>
                                                <p className="text-base font-extrabold text-pink-600 dark:text-pink-400">
                                                    ₱{(() => {
                                                        const activeData = isEditingPR && editPRData ? editPRData : purchaseRequest;
                                                        const computedSum = activeData.items?.reduce((acc: number, item: any) => {
                                                            const q = Number(item.quantity) || 1;
                                                            const p = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                                                            return acc + (q * p);
                                                        }, 0) || 0;
                                                        const finalAmt = computedSum > 0 ? computedSum : (Number(activeData.amount || 0));
                                                        return finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                    })()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Context Cards: Description & Reason */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 
                                                          border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Description</h4>
                                                </div>
                                                {isEditingPR ? (
                                                    <textarea
                                                        value={editPRData?.description || ''}
                                                        onChange={(e) => setEditPRData({ ...editPRData, description: e.target.value })}
                                                        rows={3}
                                                        className="w-full min-h-[75px] text-xs text-slate-800 dark:text-slate-200 bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl px-3 py-2.5 outline-none focus:border-pink-500 resize-none font-medium transition-all"
                                                        placeholder="Description of the request..."
                                                    />
                                                ) : (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed font-medium">
                                                        {purchaseRequest.description || 'No description provided.'}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 
                                                          border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Business Reason</h4>
                                                </div>
                                                {isEditingPR ? (
                                                    <textarea
                                                        value={editPRData?.reason || ''}
                                                        onChange={(e) => setEditPRData({ ...editPRData, reason: e.target.value })}
                                                        rows={3}
                                                        className="w-full min-h-[75px] text-xs text-slate-800 dark:text-slate-200 bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl px-3 py-2.5 outline-none focus:border-pink-500 resize-none font-medium transition-all"
                                                        placeholder="Business justification..."
                                                    />
                                                ) : (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed font-medium">
                                                        {purchaseRequest.reason || 'No reason specified.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Line Items Table */}
                                        {isEditingPR ? (
                                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-pink-300/50 dark:border-pink-900/40 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                <div className="pb-3 mb-2 border-b border-slate-200/60 dark:border-white/[0.04] flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Requested Line Items (Editing)</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddEditItem}
                                                        className="text-xs text-pink-600 dark:text-pink-400 font-bold hover:text-pink-500 flex items-center gap-1 bg-[#f0f3f8] dark:bg-[#1a1b26] px-2.5 py-1 rounded-xl border border-pink-200/80 dark:border-pink-900/40 shadow-xs cursor-pointer active:scale-95 transition-all"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                        <span>Add Item</span>
                                                    </button>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/40 dark:border-white/[0.03]">
                                                                <th className="py-2 px-3">Item Name</th>
                                                                <th className="py-2 px-3 text-center w-24">Qty</th>
                                                                <th className="py-2 px-3 text-right w-36">Unit Price (₱)</th>
                                                                <th className="py-2 px-3 text-right w-28">Total</th>
                                                                <th className="py-2 px-2 text-center w-12">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/40 dark:divide-white/[0.03] text-xs font-medium">
                                                            {(editPRData?.items || []).map((item: any, index: number) => {
                                                                const qty = Number(item.quantity) || 1;
                                                                const price = Number(item.unit_price ?? item.price ?? 0);
                                                                const total = qty * price;
                                                                return (
                                                                    <tr key={index} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                                                        <td className="py-2 px-2">
                                                                            <input
                                                                                type="text"
                                                                                value={item.name || item.item_name || ''}
                                                                                onChange={(e) => handleEditItemChange(index, 'name', e.target.value)}
                                                                                placeholder="Item name"
                                                                                className="w-full h-11 bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                            />
                                                                        </td>
                                                                        <td className="py-2 px-2 text-center">
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={item.quantity || 1}
                                                                                onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)}
                                                                                className="w-20 h-11 text-center bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                            />
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="1"
                                                                                value={item.unit_price ?? item.price ?? 0}
                                                                                onChange={(e) => handleEditItemChange(index, 'unit_price', e.target.value)}
                                                                                className="w-32 h-11 text-right bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                            />
                                                                        </td>
                                                                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                                            ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td className="py-2 px-2 text-center">
                                                                            {(editPRData?.items || []).length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveEditItem(index)}
                                                                                    className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                                                                    title="Remove item"
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            purchaseRequest.items && purchaseRequest.items.length > 0 && (
                                                <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="pb-3 mb-2 border-b border-slate-200/60 dark:border-white/[0.04] flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Requested Line Items</span>
                                                        </div>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold bg-[#f0f3f8] dark:bg-[#1a1b26] px-2 py-0.5 rounded-lg border border-white/80 dark:border-[#2a2b38]">
                                                            {purchaseRequest.items.length} {purchaseRequest.items.length === 1 ? 'Item' : 'Items'}
                                                        </span>
                                                    </div>

                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/40 dark:border-white/[0.03]">
                                                                    <th className="py-2 px-3">Item</th>
                                                                    <th className="py-2 px-3 text-center">Qty</th>
                                                                    <th className="py-2 px-3 text-right">Unit Price</th>
                                                                    <th className="py-2 px-3 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200/40 dark:divide-white/[0.03] text-xs font-medium">
                                                                {purchaseRequest.items.map((item: any, index: number) => {
                                                                    const qty = Number(item.quantity) || 1;
                                                                    const directPrice = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                                                                    const totalReqAmt = Number(purchaseRequest.amount) || 0;
                                                                    const fallbackPrice = totalReqAmt > 0 && purchaseRequest.items.length
                                                                        ? (totalReqAmt / purchaseRequest.items.length) / qty
                                                                        : 0;
                                                                    const unitPrice = directPrice > 0 ? directPrice : fallbackPrice;
                                                                    const rowTotal = Number(item.total) > 0 ? Number(item.total) : (qty * unitPrice);

                                                                    return (
                                                                        <tr key={index} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                                                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                                                                {item.name || item.item_name || item.description || 'Inventory Item'}
                                                                            </td>
                                                                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400">
                                                                                {qty}
                                                                            </td>
                                                                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                                                                ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </td>
                                                                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                                                                ₱{rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )
                                        )}

                                        {/* Creation Audit Stamp */}
                                        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-1">
                                            <span>System Record</span>
                                            <span>Created: {new Date(purchaseRequest.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
                                        Failed to load purchase request details.
                                    </div>
                                )}
                            </div>

                            {/* Fixed Footer Actions */}
                            {purchaseRequest && (
                                <div className="shrink-0 border-t border-slate-200/60 dark:border-white/[0.06] 
                                                px-6 py-4 bg-[#ebf0f7]/60 dark:bg-[#14151e]/60 flex items-center justify-between flex-wrap gap-3">
                                    {/* Action Buttons (Approve/Reject/Edit) with precise permission checks */}
                                    {(() => {
                                        const normalizedRole = (userRole || '').trim().toLowerCase();
                                        const statusLower = (purchaseRequest.status || '').toLowerCase();
                                        const poStatusLower = (linkedPO?.status || '').toLowerCase();
                                        const isLocked = ['sent', 'confirmed', 'delivered', 'completed'].includes(statusLower) || ['sent', 'confirmed', 'delivered', 'completed'].includes(poStatusLower);
                                        const canApproveReject = !isLocked && statusLower === 'pending' && ['admin', 'executive'].includes(normalizedRole);
                                        const canEdit = !isLocked && statusLower === 'pending' && ['admin', 'executive', 'manager'].includes(normalizedRole);

                                        if (!canEdit && !canApproveReject) {
                                            return (
                                                <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 py-1 w-full">
                                                    <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                                    <span>{isLocked ? `This order is locked (${linkedPO?.status ? `PO: ${linkedPO.status}` : purchaseRequest.status}) and cannot be modified` : `This request is currently ${purchaseRequest.status.toLowerCase()}`}</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {canEdit && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isEditingPR) {
                                                                        setEditPRData(JSON.parse(JSON.stringify(purchaseRequest)));
                                                                        setIsEditingPR(false);
                                                                    } else {
                                                                        setIsEditingPR(true);
                                                                    }
                                                                }}
                                                                disabled={isApproving || isSavingEdits}
                                                                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 ${
                                                                    isEditingPR
                                                                        ? 'text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#1a1b26] border border-slate-300 dark:border-slate-700 shadow-sm'
                                                                        : 'text-indigo-600 dark:text-indigo-400 bg-[#f0f3f8] dark:bg-[#1a1b26] border border-indigo-200/80 dark:border-indigo-900/40 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)]'
                                                                }`}
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                                <span>{isEditingPR ? 'Cancel Edit' : 'Edit Request'}</span>
                                                            </button>

                                                            {isEditingPR && (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSaveEdits}
                                                                    disabled={isApproving || isSavingEdits}
                                                                    className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-[#f0f3f8] dark:bg-[#1a1b26] border border-emerald-300 dark:border-emerald-800 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {isSavingEdits ? (
                                                                        <>
                                                                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                                                                            <span>Saving...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Check className="h-3.5 w-3.5" />
                                                                            <span>Save Edits</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {canApproveReject && (
                                                    <div className="flex items-center justify-end gap-3 w-full sm:w-auto ml-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowRejectModal(true)}
                                                            disabled={isApproving || isSavingEdits}
                                                            className="px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-[#f0f3f8] dark:bg-[#1a1b26] border border-rose-200/80 dark:border-rose-900/40 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                                        >
                                                            <X className="h-4 w-4" />
                                                            <span>Reject Request</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleApprove}
                                                            disabled={isApproving || isSavingEdits}
                                                            className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-pink-600 hover:bg-pink-500 active:bg-pink-700 shadow-[3px_3px_8px_rgba(236,72,153,0.35),-2px_-2px_6px_rgba(255,255,255,0.4)] border border-pink-400/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                                        >
                                                            {isApproving ? (
                                                                <>
                                                                    <Loader2 className="animate-spin h-4 w-4" />
                                                                    <span>Processing...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check className="h-4 w-4" />
                                                                    <span>{isEditingPR ? 'Save & Approve' : 'Approve Request'}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                        </div>
                    </div>
                </Portal>
            )}

            {/* Reject Reason Modal - Rendered via Portal with high z-index */}
            {showRejectModal && (
                <Portal>
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md 
                                  flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-200">
                        <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-md w-full p-6 sm:p-7  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200">
                            
                            {/* Inset Icon Well */}
                            <div className="w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-rose-200/80 dark:border-rose-900/40 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                                <X className="h-6 w-6" />
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-center tracking-tight">Reject Purchase Request</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-4 font-medium">
                                Please provide a reason for rejecting this purchase request.
                            </p>

                            <div className="mb-5">
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Enter specific reason for rejection..."
                                    className="w-full px-4 py-3 bg-[#e2e8f0]/60 dark:bg-[#101118] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] 
                                              text-slate-800 dark:text-slate-200
                                              rounded-2xl focus:ring-2 focus:ring-rose-500/30 
                                              outline-none transition resize-none h-28 text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    maxLength={500}
                                />
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 text-right font-medium">
                                    {rejectReason.length}/500 characters
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                    }}
                                    className="flex-1 py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-bold 
                                              text-slate-700 dark:text-slate-300 
                                              bg-[#f0f3f8] dark:bg-[#1a1b26] border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all cursor-pointer active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isApproving || !rejectReason.trim()}
                                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-400/60
                                              text-white text-xs sm:text-sm font-bold rounded-2xl 
                                              shadow-[3px_3px_8px_rgba(225,29,72,0.35)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    {isApproving ? (
                                        <>
                                            <Loader2 className="animate-spin h-4 w-4" />
                                            <span>Rejecting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="h-4 w-4" />
                                            <span>Confirm Reject</span>
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