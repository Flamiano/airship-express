import { supabase } from './client/supabase';

interface CreateNotificationParams {
    userId?: string; // Make optional
    creatorName: string;
    creatorEmail: string;
    title: string;
    message: string;
    type: 'appeal' | 'system' | 'security' | 'info' | 'alert' | 'purchase_request';
    link?: string;
    role: 'Admin' | 'Manager' | 'Employee' | 'All';
    poRequestId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
    try {
        const insertData: any = {
            creator_name: params.creatorName,
            creator_email: params.creatorEmail,
            title: params.title,
            message: params.message,
            type: params.type,
            link: params.link || null,
            role: params.role,
            is_read: false,
            po_request_id: params.poRequestId || null,
        };

        // Only add user_id if provided
        if (params.userId) {
            insertData.user_id = params.userId;
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
        // If userId is provided, filter by it
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

// Notification creation helpers
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
        role: 'Admin',
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
        role: 'All',
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
        role: 'All',
        poRequestId: params.poRequestId,
    });
}