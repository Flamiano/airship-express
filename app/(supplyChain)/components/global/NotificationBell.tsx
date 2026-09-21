'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Check, X, Loader2, Clock, DollarSign, FileText, User, Building, Tag, AlertCircle, Users, UserCog, Shield, Calendar, Package, Trash2, Edit3, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/services/client/supabase';
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
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
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

    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const getCacheKey = useCallback(() => {
        return `${CACHE_KEY_BASE}_${userEmail || 'anon'}`;
    }, [userEmail]);

    const isNotificationForUser = useCallback((notifRole: string) => {
        if (!notifRole) return true;
        const nRole = notifRole.toLowerCase().trim();
        const uRole = (userRole || '').toLowerCase().trim();
        if (nRole === 'all') return true;
        if (nRole === uRole) return true;
        // Admins and Executives see notifications targeted to each other / leadership
        if (['admin', 'executive'].includes(uRole) && ['admin', 'executive'].includes(nRole)) return true;
        // Managers can also see Manager notifications
        if (['admin', 'executive', 'manager'].includes(uRole) && nRole === 'manager') return true;
        return false;
    }, [userRole]);

    const getRoleFilterQuery = useCallback(() => {
        const uRole = (userRole || '').toLowerCase().trim();
        if (['admin', 'executive'].includes(uRole)) {
            return 'role.ilike.All,role.ilike.Admin,role.ilike.Executive';
        }
        if (uRole === 'manager') {
            return 'role.ilike.All,role.ilike.Manager';
        }
        if (uRole) {
            return `role.ilike.All,role.ilike.${userRole}`;
        }
        return 'role.ilike.All';
    }, [userRole]);

    // get user role and email from storage and keep updated
    useEffect(() => {
        const syncUserData = () => {
            if (typeof window !== 'undefined') {
                if (localStorage.getItem(LEGACY_CACHE_KEY)) {
                    localStorage.removeItem(LEGACY_CACHE_KEY);
                }

                const role = user.getRole() || 'User';
                const email = user.getEmail() || '';
                const name = user.getName() || '';
                setUserRole(role);
                setUserEmail(email);
                setUserName(name);
            }
        };

        syncUserData();
        window.addEventListener('storage', syncUserData);
        return () => window.removeEventListener('storage', syncUserData);
    }, []);

    // lock page scroll when dropdown is open
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
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CACHE_DURATION;
                if (!isExpired && data && data.length > 0) {
                    const filteredData = deduplicateNotifications(data.filter((n: Notification) => isNotificationForUser(n.role)));
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
    }, [getCacheKey, isNotificationForUser]);

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
            const roleFilter = getRoleFilterQuery();
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .or(roleFilter);

            if (error) throw error;
            const unread = count ?? 0;
            setTotalUnread(unread);
            setUnreadCount(unread);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [getRoleFilterQuery]);

    // fetch notifications with pagination
    const fetchNotifications = useCallback(async (pageNum: number, append: boolean = false) => {
        if (pageNum === 0) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const roleFilter = getRoleFilterQuery();
            const { count, error: countError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .or(roleFilter);

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

            const from = pageNum * PAGE_SIZE;
            const to = Math.min(from + PAGE_SIZE - 1, total - 1);

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .or(roleFilter)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const notificationsData = data || [];

            if (append) {
                setNotifications(prev => {
                    const existingIds = new Set(prev.map(n => n.id));
                    const freshItems = notificationsData.filter(n => !existingIds.has(n.id));
                    const merged = deduplicateNotifications([...prev, ...freshItems]);
                    setHasMore(merged.length < total);
                    return merged;
                });
            } else {
                const uniqueData = deduplicateNotifications(notificationsData);
                setNotifications(uniqueData);
                saveToCache(uniqueData);
                setHasMore(uniqueData.length < total);
                const unread = uniqueData.filter(n => !n.is_read).length;
                setUnreadCount(unread);
            }

            await fetchUnreadCount();

        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [getRoleFilterQuery, saveToCache, fetchUnreadCount]);

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
        const channelId = `navbar_notifs_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newNotif = payload.new as Notification;
                        if (isNotificationForUser(newNotif.role)) {
                            setNotifications(prev => {
                                if (prev.some(n => n.id === newNotif.id || (newNotif.po_request_id && n.po_request_id === newNotif.po_request_id))) return prev;
                                const updated = deduplicateNotifications([newNotif, ...prev]);
                                saveToCache(updated);
                                return updated;
                            });
                            setTotalCount(prev => prev + 1);
                            if (!newNotif.is_read) {
                                setUnreadCount(prev => prev + 1);
                                setTotalUnread(prev => prev + 1);
                            }
                            if (shouldShowToastForNotification(newNotif, userEmailRef.current, userNameRef.current)) {
                                const toastKey = newNotif.po_request_id || newNotif.id || `${newNotif.title}_${newNotif.message}`;
                                toast.info(newNotif.title, {
                                    id: `notif_${toastKey}`,
                                    description: newNotif.message,
                                    duration: 6000,
                                });
                            }
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedNotif = payload.new as Notification;
                        setNotifications(prev => {
                            const updated = prev.map(n => n.id === updatedNotif.id ? updatedNotif : n);
                            saveToCache(updated);
                            return updated;
                        });
                        fetchUnreadCount();
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = (payload.old as { id: string })?.id;
                        if (deletedId) {
                            setNotifications(prev => {
                                const updated = prev.filter(n => n.id !== deletedId);
                                saveToCache(updated);
                                return updated;
                            });
                            setTotalCount(prev => Math.max(0, prev - 1));
                            fetchUnreadCount();
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'purchase_requests' },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const updatedPR = payload.new as PurchaseRequest;
                        setPurchaseRequest(prev => prev && prev.id === updatedPR.id ? updatedPR : prev);
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    fetchUnreadCount();
                }
                if (err) {
                    console.warn('[Realtime Notifications] Subscription error:', err);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userRole, isNotificationForUser, saveToCache, fetchUnreadCount]);

    const handleMarkAsRead = async (id: string) => {
        try {
            // mark notification read in state
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
            setTotalUnread(prev => Math.max(0, prev - 1));

            // mark notification read in database
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // save updated state to cache
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
            // refetch on error
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

            // mark all read in state
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            setTotalUnread(0);

            // mark all read in database
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds);

            if (error) throw error;

            // save updated state to cache
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
            // refetch on error
            fetchNotifications(0, false);
        }
    };

    // delete single notification
    const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const target = notifications.find(n => n.id === id);
            const wasUnread = target && !target.is_read;

            // remove notification from state
            setNotifications(prev => prev.filter(n => n.id !== id));
            setTotalCount(prev => Math.max(0, prev - 1));
            if (wasUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1));
                setTotalUnread(prev => Math.max(0, prev - 1));
            }

            // delete notification from database
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;

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
            const ids = notifications.map(n => n.id);
            setNotifications([]);
            setTotalCount(0);
            setUnreadCount(0);
            setTotalUnread(0);

            // delete notifications from database
            const { error } = await supabase
                .from('notifications')
                .delete()
                .in('id', ids);

            if (error) throw error;

            // clear cache
            const cacheKey = getCacheKey();
            localStorage.removeItem(cacheKey);

            toast.success('All notifications deleted');
        } catch (error) {
            console.error('Error deleting notifications:', error);
            toast.error('Failed to delete notifications');
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
        setIsEditingPR(false);
        setEditPRData(null);

        try {
            const { data, error } = await supabase
                .from('purchase_requests')
                .select('*')
                .eq('id', notification.po_request_id)
                .single();

            if (error) throw error;
            setPurchaseRequest(data);
            setEditPRData(data ? JSON.parse(JSON.stringify(data)) : null);
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
                    className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] active:scale-95 transition-all duration-200 cursor-pointer"
                    aria-label="Notifications"
                >
                    {totalUnread > 0 ? (
                        <>
                            <Bell className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-gradient-to-tr from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_2px_6px_rgba(244,63,94,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]">
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
                            className="fixed inset-0 bg-slate-900/20 dark:bg-slate-950/60 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Main Popover / Modal Panel */}
                        <div className="fixed sm:absolute inset-x-0 top-0 sm:top-full sm:right-0 sm:left-auto mt-0 sm:mt-2 w-full sm:w-96 h-[100dvh] sm:h-auto sm:max-h-[560px] 
                        bg-[#f2f5fa] dark:bg-[#191a24] 
                        rounded-none sm:rounded-2xl 
                        border-0 sm:border border-white/80 dark:border-[#2c2d3c] 
                        shadow-[8px_8px_24px_rgba(166,175,195,0.45),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] 
                        z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200">

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3.5 
                          border-b border-slate-200/60 dark:border-slate-800 
                          bg-[#f0f3f8]/95 dark:bg-[#191a24]/95 backdrop-blur-md shrink-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        Notifications
                                    </h3>
                                    {totalCount > 0 && (
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold 
                                bg-[#ebf0f7] dark:bg-[#14151c] 
                                text-slate-700 dark:text-slate-300 rounded-full border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
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

                                    {notifications.length > 0 && (
                                        <button
                                            onClick={handleDeleteAll}
                                            className="p-1.5 text-xs font-medium 
                            text-slate-400 dark:text-slate-500 
                            hover:text-red-600 dark:hover:text-red-400 
                            hover:bg-red-50 dark:hover:bg-red-950/30 
                            rounded-lg transition-colors flex items-center"
                                            title="Clear all notifications"
                                            aria-label="Clear all notifications"
                                        >
                                            <Trash2 className="h-4 w-4" />
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
                                            <div
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`group w-full text-left p-4 transition-all duration-150 flex items-start gap-3.5 cursor-pointer 
                                hover:bg-[#e8edf5] dark:hover:bg-[#222432] 
                                active:bg-[#e0e7f1] dark:active:bg-[#262838] 
                                focus:outline-none focus:bg-[#e8edf5] dark:focus:bg-[#222432] 
                                ${!notification.is_read
                                                        ? 'bg-pink-50/40 dark:bg-pink-950/20 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-pink-500'
                                                        : 'bg-[#f0f3f8] dark:bg-[#191a24]'
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

                                                        <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
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

                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                                                                className="opacity-70 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all"
                                                                title="Delete notification"
                                                                aria-label="Delete notification"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
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
                                            </div>
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
                                                        className="w-full text-xs text-slate-800 dark:text-slate-200 bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl p-2.5 outline-none focus:border-pink-500 resize-none font-medium transition-all"
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
                                                        className="w-full text-xs text-slate-800 dark:text-slate-200 bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl p-2.5 outline-none focus:border-pink-500 resize-none font-medium transition-all"
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
                                                                                className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                            />
                                                                        </td>
                                                                        <td className="py-2 px-2 text-center">
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={item.quantity || 1}
                                                                                onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)}
                                                                                className="w-20 text-center bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                            />
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                value={item.unit_price ?? item.price ?? 0}
                                                                                onChange={(e) => handleEditItemChange(index, 'unit_price', e.target.value)}
                                                                                className="w-32 text-right bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
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
                                        const isLocked = ['sent', 'confirmed', 'delivered', 'completed'].includes(statusLower);
                                        const canApproveReject = statusLower === 'pending' && ['admin', 'executive'].includes(normalizedRole);
                                        const canEdit = !isLocked && (
                                            (statusLower === 'pending' && ['admin', 'executive', 'manager'].includes(normalizedRole)) ||
                                            (statusLower === 'approved' && ['admin', 'executive'].includes(normalizedRole))
                                        );

                                        if (!canEdit && !canApproveReject) {
                                            return (
                                                <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 py-1 w-full">
                                                    <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                                    <span>This request is currently {purchaseRequest.status.toLowerCase()}</span>
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