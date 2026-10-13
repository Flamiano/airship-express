// app/(supplyChain)/ai/actions/get_user_activity.ts

import { supabase } from "../../lib/services/client/supabase";

export interface UserActivityLog {
    id: number | string;
    user_id: string;
    action: string;
    module?: string | null;
    description?: string | null;
    ip_address?: string | null;
    created_at: string;
}

export interface UserActivitySummary {
    totalActivities: number;
    actionsBreakdown: Record<string, number>;
    modulesBreakdown: Record<string, number>;
    activeSessionsCount: number;
    blockedDevicesCount: number;
    pendingAppealsCount: number;
    recentActivities: UserActivityLog[];
}

/**
 * Fetch recent user activity logs
 */
export async function getUserActivityLogs(params?: {
    action?: string;
    module?: string;
    limit?: number;
}): Promise<UserActivityLog[]> {
    let q = supabase
        .from('user_activity')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.action) {
        q = q.ilike('action', `%${params.action}%`);
    }

    if (params?.module) {
        q = q.ilike('module', `%${params.module}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching user activity logs:', error);
        return [];
    }

    return (data || []) as UserActivityLog[];
}

/**
 * Get aggregated summary metrics for user activity and security audits
 */
export async function getUserActivitySummary(): Promise<UserActivitySummary> {
    const [activitiesRes, sessionsRes, blockedRes, appealsRes] = await Promise.all([
        supabase
            .from('user_activity')
            .select('id, action, module, description, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        supabase
            .from('sessions')
            .select('id, is_active')
            .eq('is_active', true),
        supabase
            .from('blocked_devices')
            .select('id, status')
            .eq('status', 'blocked'),
        supabase
            .from('appeals')
            .select('id, status')
            .eq('status', 'pending'),
    ]);

    const activities = (activitiesRes.data || []) as UserActivityLog[];
    const actionsBreakdown: Record<string, number> = {};
    const modulesBreakdown: Record<string, number> = {};

    activities.forEach(a => {
        const action = a.action || 'General Event';
        actionsBreakdown[action] = (actionsBreakdown[action] || 0) + 1;

        const mod = a.module || 'System';
        modulesBreakdown[mod] = (modulesBreakdown[mod] || 0) + 1;
    });

    return {
        totalActivities: activities.length,
        actionsBreakdown,
        modulesBreakdown,
        activeSessionsCount: sessionsRes.data?.length || 0,
        blockedDevicesCount: blockedRes.data?.length || 0,
        pendingAppealsCount: appealsRes.data?.length || 0,
        recentActivities: activities.slice(0, 10),
    };
}
