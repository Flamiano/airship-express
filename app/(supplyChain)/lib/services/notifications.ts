import { supabase } from './client/supabase';

export interface RecipientStatus {
    user_id: string;
    is_read: boolean;
    read_at?: string | null;
    is_deleted?: boolean;
    deleted?: boolean;
}

export type RecipientItem = string | RecipientStatus;

interface CreateNotificationParams {
    userId?: string;
    creatorName: string;
    creatorEmail: string;
    title: string;
    message: string;
    type: 'appeal' | 'system' | 'security' | 'info' | 'alert' | 'purchase_request' | 'dispatch_manifest' | 'ocr_complete' | 'ocr_mismatch' | 'supplier_account' | string;
    link?: string;
    role: string | string[];
    poRequestId?: string;
    recipientUserIds?: RecipientItem[];
}

export async function createNotification(params: CreateNotificationParams) {
    try {
        const rolesPayload = Array.isArray(params.role) 
            ? params.role 
            : (params.role ? [params.role] : ['All']);

        const insertData: any = {
            creator_name: params.creatorName,
            creator_email: params.creatorEmail,
            title: params.title,
            message: params.message,
            type: params.type,
            link: params.link || null,
            role: rolesPayload,
            is_read: false,
            po_request_id: params.poRequestId || null,
        };

        // attach user id if provided
        if (params.userId) {
            insertData.user_id = params.userId;
            insertData.recipient_user_ids = [
                { user_id: params.userId, is_read: false, read_at: null }
            ];
        } else if (params.recipientUserIds && params.recipientUserIds.length > 0) {
            insertData.recipient_user_ids = params.recipientUserIds;
        }

        const { data, error } = await supabase
            .from('notifications')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

export async function getNotifications(userId: string, limit: number = 50) {
    try {
        // filter notifications by user id if provided
        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .eq('id', notificationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

export async function markAllNotificationsAsRead(userId: string) {
    try {
        let query = supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .eq('is_read', false);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

export async function getUnreadCount(userId: string) {
    try {
        let query = supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { count, error } = await query;

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

export async function deleteNotification(notificationId: string) {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
}

/**
 * Marks a notification as read for a specific user.
 * If broadcast notification, updates is_read flag for this user in recipient_user_ids.
 * If direct notification, updates the row's is_read column.
 */
export async function markNotificationAsReadForUser(
    notificationId: string,
    userId: string,
    currentRecipientUserIds?: RecipientItem[] | null,
    notifUserId?: string | null
) {
    if (!notificationId) return false;

    try {
        const cleanUserId = (userId || '').toLowerCase().trim();

        // 1. Try calling the PostgreSQL RPC function first
        if (cleanUserId) {
            const { error: rpcError } = await supabase.rpc('mark_notification_read_for_user', {
                p_notification_id: notificationId,
                p_user_id: cleanUserId,
            });

            if (!rpcError) {
                return true;
            }
        }

        // 2. Fallback in JavaScript
        // Fetch fresh notification to avoid stale recipient_user_ids
        const { data: freshNotif } = await supabase
            .from('notifications')
            .select('id, user_id, recipient_user_ids')
            .eq('id', notificationId)
            .maybeSingle();

        // A. Direct notification to this user
        const targetUserId = (freshNotif?.user_id || notifUserId || '').toLowerCase().trim();
        if (targetUserId && cleanUserId && targetUserId === cleanUserId) {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);
            if (error) throw error;
            return true;
        }

        // B. Broadcast notification with recipient_user_ids
        const recipients = Array.isArray(freshNotif?.recipient_user_ids)
            ? freshNotif.recipient_user_ids
            : (Array.isArray(currentRecipientUserIds) ? currentRecipientUserIds : null);

        if (Array.isArray(recipients) && recipients.length > 0 && cleanUserId) {
            let found = false;
            const updated = recipients.map((item: any) => {
                const uid = typeof item === 'string' ? item : item?.user_id;
                if (uid && uid.toLowerCase() === cleanUserId) {
                    found = true;
                    return {
                        user_id: uid,
                        is_read: true,
                        read_at: new Date().toISOString(),
                    };
                }
                return typeof item === 'string'
                    ? { user_id: item, is_read: false, read_at: null }
                    : item;
            });

            if (!found) {
                updated.push({
                    user_id: cleanUserId,
                    is_read: true,
                    read_at: new Date().toISOString(),
                });
            }

            const { error } = await supabase
                .from('notifications')
                .update({ recipient_user_ids: updated })
                .eq('id', notificationId);
            if (error) throw error;
            return true;
        }

        // C. Fallback for legacy
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error in markNotificationAsReadForUser:', error);
        throw error;
    }
}

/**
 * Marks all notifications as read for a specific user.
 */
export async function markAllNotificationsAsReadForUser(
    notifications: Array<{ id: string; user_id?: string | null; recipient_user_ids?: RecipientItem[] | null }>,
    userId: string
) {
    if (!notifications || notifications.length === 0) return true;

    try {
        const cleanUserId = (userId || '').toLowerCase().trim();
        const ids = notifications.map(n => n.id);
        if (cleanUserId) {
            const { error: rpcError } = await supabase.rpc('mark_all_notifications_read_for_user', {
                p_notification_ids: ids,
                p_user_id: cleanUserId,
            });

            if (!rpcError) {
                return true;
            }
        }

        await Promise.all(
            notifications.map(n =>
                markNotificationAsReadForUser(n.id, cleanUserId, n.recipient_user_ids, n.user_id)
            )
        );
        return true;
    } catch (error) {
        console.error('Error in markAllNotificationsAsReadForUser:', error);
        throw error;
    }
}

/**
 * Deletes or dismisses a notification for a specific user.
 * If direct notification (user_id matches), deletes row.
 * If broadcast notification (recipient_user_ids array), removes user_id from array.
 * If recipient_user_ids becomes empty (all recipients dismissed), deletes the row entirely.
 */
export async function deleteNotificationForUser(
    notificationId: string,
    userId: string,
    currentRecipientUserIds?: RecipientItem[] | null,
    notifUserId?: string | null
) {
    if (!notificationId) return false;

    try {
        const cleanUserId = (userId || '').toLowerCase().trim();

        // 1. Try calling the PostgreSQL RPC function first
        if (cleanUserId) {
            const { error: rpcError } = await supabase.rpc('delete_notification_for_user', {
                p_notification_id: notificationId,
                p_user_id: cleanUserId,
            });

            if (!rpcError) {
                return true;
            }
        }

        // 2. Fallback in JavaScript
        // Fetch fresh notification row from Supabase to ensure accurate recipient array
        const { data: freshNotif } = await supabase
            .from('notifications')
            .select('id, user_id, recipient_user_ids')
            .eq('id', notificationId)
            .maybeSingle();

        if (!freshNotif) return true; // Already deleted

        // A. Direct single-user notification targeted specifically to this user
        const targetUserId = (freshNotif.user_id || notifUserId || '').toLowerCase().trim();
        if (targetUserId && cleanUserId && targetUserId === cleanUserId) {
            const { error: delError } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);
            if (delError) throw delError;
            return true;
        }

        // B. Broadcast notification with recipient_user_ids array
        const recipients = Array.isArray(freshNotif.recipient_user_ids)
            ? freshNotif.recipient_user_ids
            : (Array.isArray(currentRecipientUserIds) ? currentRecipientUserIds : null);

        if (Array.isArray(recipients) && recipients.length > 0 && cleanUserId) {
            const remaining = recipients.filter((item: any) => {
                const uid = typeof item === 'string' ? item : item?.user_id;
                return uid && uid.toLowerCase() !== cleanUserId;
            });

            if (remaining.length === 0) {
                // Last recipient deleted/dismissed it -> remove entire notification row
                const { error: delError } = await supabase
                    .from('notifications')
                    .delete()
                    .eq('id', notificationId);
                if (delError) throw delError;
            } else {
                // Update recipient_user_ids without this user so they never see it again
                const { error: updateError } = await supabase
                    .from('notifications')
                    .update({ recipient_user_ids: remaining })
                    .eq('id', notificationId);
                if (updateError) throw updateError;
            }
            return true;
        }

        // C. Fallback for legacy notifications
        const { error: delError } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);
        if (delError) throw delError;
        return true;
    } catch (error) {
        console.error('Error deleting notification for user:', error);
        throw error;
    }
}

/**
 * Bulk delete/dismiss notifications for a specific user.
 */
export async function deleteAllNotificationsForUser(
    notifications: Array<{ id: string; user_id?: string | null; recipient_user_ids?: RecipientItem[] | null }>,
    userId: string
) {
    if (!notifications || notifications.length === 0) return true;

    try {
        await Promise.all(
            notifications.map(n =>
                deleteNotificationForUser(n.id, userId, n.recipient_user_ids, n.user_id)
            )
        );
        return true;
    } catch (error) {
        console.error('Error in deleteAllNotificationsForUser:', error);
        throw error;
    }
}

export async function getPurchaseRequest(poRequestId: string) {
    try {
        const { data, error } = await supabase
            .from('purchase_requests')
            .select('*')
            .eq('id', poRequestId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching purchase request:', error);
        return null;
    }
}

export async function updatePurchaseRequestStatus(poRequestId: string, status: 'Approved' | 'Rejected', reason?: string) {
    try {
        const { data, error } = await supabase
            .from('purchase_requests')
            .update({
                status: status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', poRequestId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating purchase request:', error);
        throw error;
    }
}

// create workflow notifications
export async function createPurchaseRequestNotification(params: {
    userId: string;
    creatorName: string;
    creatorEmail: string;
    poRequestId: string;
    requestNumber: string;
    description: string;
    amount: number;
}) {
    return createNotification({
        userId: params.userId,
        creatorName: params.creatorName,
        creatorEmail: params.creatorEmail,
        title: `New Purchase Request: ${params.requestNumber}`,
        message: `${params.creatorName} submitted purchase request "${params.description.substring(0, 100)}" for $${params.amount.toFixed(2)}`,
        type: 'purchase_request',
        link: `/purchase-requests/${params.poRequestId}`,
        role: ['Admin', 'Executive'],
        poRequestId: params.poRequestId,
    });
}

export async function createPurchaseRequestApprovedNotification(params: {
    userId: string;
    creatorName: string;
    creatorEmail: string;
    poRequestId: string;
    requestNumber: string;
}) {
    return createNotification({
        userId: params.userId,
        creatorName: params.creatorName,
        creatorEmail: params.creatorEmail,
        title: `Purchase Request Approved: ${params.requestNumber}`,
        message: `Your purchase request ${params.requestNumber} has been approved by ${params.creatorName}`,
        type: 'purchase_request',
        link: `/purchase-requests/${params.poRequestId}`,
        role: ['Admin', 'Executive', 'Purchase Officer', 'Employee'],
        poRequestId: params.poRequestId,
    });
}

export async function createPurchaseRequestRejectedNotification(params: {
    userId: string;
    creatorName: string;
    creatorEmail: string;
    poRequestId: string;
    requestNumber: string;
    reason?: string;
}) {
    return createNotification({
        userId: params.userId,
        creatorName: params.creatorName,
        creatorEmail: params.creatorEmail,
        title: `Purchase Request Rejected: ${params.requestNumber}`,
        message: `Your purchase request ${params.requestNumber} was rejected by ${params.creatorName}${params.reason ? `: ${params.reason}` : ''}`,
        type: 'purchase_request',
        link: `/purchase-requests/${params.poRequestId}`,
        role: ['Admin', 'Executive', 'Purchase Officer', 'Employee'],
        poRequestId: params.poRequestId,
    });
}