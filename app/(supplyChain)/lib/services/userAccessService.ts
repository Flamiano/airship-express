import { supabase } from './client/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export interface UserAccessRule {
    user_id?: string;
    email: string;
    display_name?: string;
    role?: string;
    is_allow: boolean;
    allowed_days: string[]; // e.g. ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    allowed_time_start: string; // e.g. '07:00'
    allowed_time_end: string; // e.g. '17:00'
    auth_requested?: boolean;
    auth_requested_at?: string | null;
    auth_request_message?: string | null;
    updated_at?: string;
    updated_by?: string;
}

export const DEFAULT_ALLOWED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DEFAULT_TIME_START = '00:00';
export const DEFAULT_TIME_END = '23:59';

const SETTINGS_ROW_ID = 'user_access_control';
export const BUSINESS_TIMEZONE = 'Asia/Manila';

/**
 * Helper to get current day name and total minutes in Philippine Time (Asia/Manila)
 */
export function getBusinessTime(timeZone = BUSINESS_TIMEZONE) {
    try {
        const now = new Date();
        const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone });
        const currentDay = dayFormatter.format(now);

        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
            timeZone,
        });
        const parts = timeFormatter.formatToParts(now);
        const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        const safeHours = hours === 24 ? 0 : hours;

        return {
            currentDay,
            currentHours: safeHours,
            currentMinutes: minutes,
            currentTotalMinutes: safeHours * 60 + minutes,
        };
    } catch {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        return {
            currentDay: now.toLocaleDateString('en-US', { weekday: 'long' }),
            currentHours,
            currentMinutes,
            currentTotalMinutes: currentHours * 60 + currentMinutes,
        };
    }
}

/**
 * Fetch all user access control rules from public.sessions table (with fallback to sc_system_settings)
 */
export async function getAllUserAccessRules(): Promise<Record<string, UserAccessRule>> {
    try {
        const rulesMap: Record<string, UserAccessRule> = {};

        // 1. Fetch from sessions table ordered by updated_at DESC so most recent sessions take priority
        const { data: sessionsData, error: sessionErr } = await supabaseAdmin
            .from('sessions')
            .select(`
                user_id,
                email,
                hr_employee_name,
                is_allow,
                allowed_days,
                allowed_time_start,
                allowed_time_end,
                auth_requested,
                auth_requested_at,
                updated_at,
                users (
                    display_name,
                    role,
                    department
                )
            `)
            .order('updated_at', { ascending: false });

        if (!sessionErr && Array.isArray(sessionsData)) {
            sessionsData.forEach((s: any) => {
                const em = (s.email || s.users?.email || '').toLowerCase().trim();
                if (em && !rulesMap[em]) {
                    let parsedDays = DEFAULT_ALLOWED_DAYS;
                    if (Array.isArray(s.allowed_days)) {
                        parsedDays = s.allowed_days;
                    } else if (typeof s.allowed_days === 'string') {
                        try {
                            parsedDays = JSON.parse(s.allowed_days);
                        } catch {
                            parsedDays = s.allowed_days.split(',').map((d: string) => d.trim());
                        }
                    }

                    const isExecutiveOrAdmin = ['admin', 'executive'].includes((s.users?.role || '').toLowerCase().trim());

                    rulesMap[em] = {
                        user_id: s.user_id,
                        email: s.email,
                        display_name: s.users?.display_name || s.hr_employee_name,
                        role: s.users?.role,
                        is_allow: s.is_allow !== null && s.is_allow !== undefined ? Boolean(s.is_allow) : true,
                        allowed_days: parsedDays,
                        allowed_time_start: s.allowed_time_start || DEFAULT_TIME_START,
                        allowed_time_end: s.allowed_time_end || DEFAULT_TIME_END,
                        auth_requested: Boolean(s.auth_requested),
                        auth_requested_at: s.auth_requested_at,
                    };
                }
            });
        }

        // 2. Fetch from sc_system_settings for extra persistence / accounts without active session row
        const { data: settingsData } = await supabaseAdmin
            .from('sc_system_settings')
            .select('*')
            .eq('id', SETTINGS_ROW_ID)
            .maybeSingle();

        if (settingsData?.page_permissions) {
            const fallbackRules = settingsData.page_permissions as Record<string, UserAccessRule>;
            Object.entries(fallbackRules).forEach(([key, rule]) => {
                if (!rulesMap[key]) {
                    rulesMap[key] = rule;
                } else {
                    // merge in case of missing fields
                    rulesMap[key] = {
                        ...rule,
                        ...rulesMap[key],
                    };
                }
            });
        }

        return rulesMap;
    } catch (err) {
        console.error('Error fetching user access rules:', err);
        return {};
    }
}

/**
 * Get or initialize access rule for a specific user (by email or user_id)
 */
export async function getUserAccessRule(identifier: string): Promise<UserAccessRule | null> {
    if (!identifier) return null;
    const key = identifier.toLowerCase().trim();
    const allRules = await getAllUserAccessRules();
    return allRules[key] || null;
}

/**
 * Save / update an access rule for a user (updates sessions table and sc_system_settings)
 */
export async function saveUserAccessRule(rule: Partial<UserAccessRule> & { email: string }, updatedBy = 'Admin'): Promise<boolean> {
    try {
        const emailKey = rule.email.toLowerCase().trim();
        const allRules = await getAllUserAccessRules();

        const existing = allRules[emailKey] || {
            email: rule.email,
            is_allow: true,
            allowed_days: DEFAULT_ALLOWED_DAYS,
            allowed_time_start: DEFAULT_TIME_START,
            allowed_time_end: DEFAULT_TIME_END,
            auth_requested: false,
            auth_requested_at: null,
        };

        const updatedRule: UserAccessRule = {
            ...existing,
            ...rule,
            email: rule.email,
            allowed_days: rule.allowed_days || existing.allowed_days || DEFAULT_ALLOWED_DAYS,
            allowed_time_start: rule.allowed_time_start || existing.allowed_time_start || DEFAULT_TIME_START,
            allowed_time_end: rule.allowed_time_end || existing.allowed_time_end || DEFAULT_TIME_END,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
        };

        // 1. Update public.sessions table directly
        const sessionUpdatePayload: any = {
            is_allow: updatedRule.is_allow,
            allowed_days: updatedRule.allowed_days,
            allowed_time_start: updatedRule.allowed_time_start,
            allowed_time_end: updatedRule.allowed_time_end,
            auth_requested: updatedRule.auth_requested ?? false,
            auth_requested_at: updatedRule.auth_requested ? (updatedRule.auth_requested_at || new Date().toISOString()) : null,
            updated_at: new Date().toISOString(),
        };

        // If disabling login access, immediately terminate any active session (is_active = false)
        if (updatedRule.is_allow === false) {
            sessionUpdatePayload.is_active = false;
            sessionUpdatePayload.in_queue = false;
        }

        await supabaseAdmin
            .from('sessions')
            .update(sessionUpdatePayload)
            .ilike('email', rule.email);

        // 2. Also update sc_system_settings for accounts that haven't created a session yet
        allRules[emailKey] = updatedRule;
        await supabaseAdmin
            .from('sc_system_settings')
            .upsert({
                id: SETTINGS_ROW_ID,
                page_permissions: allRules,
                updated_at: new Date().toISOString(),
                updated_by: updatedBy,
            });

        return true;
    } catch (err) {
        console.error('Error saving user access rule:', err);
        return false;
    }
}

/**
 * Request login authorization from Admin (Flags auth_requested in sessions table and creates notification for Admin ONLY)
 */
export async function requestLoginAuthorization(params: {
    email: string;
    userId?: string;
    displayName?: string;
    role?: string;
    message?: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const emailKey = params.email.toLowerCase().trim();
        const allRules = await getAllUserAccessRules();

        const existing = allRules[emailKey] || {
            email: params.email,
            user_id: params.userId,
            display_name: params.displayName || 'Unknown User',
            role: params.role || 'Employee',
            is_allow: false,
            allowed_days: DEFAULT_ALLOWED_DAYS,
            allowed_time_start: DEFAULT_TIME_START,
            allowed_time_end: DEFAULT_TIME_END,
        };

        const updatedRule: UserAccessRule = {
            ...existing,
            user_id: params.userId || existing.user_id,
            display_name: params.displayName || existing.display_name,
            role: params.role || existing.role,
            auth_requested: true,
            auth_requested_at: new Date().toISOString(),
            auth_request_message: params.message || 'User is requesting login access authorization.',
            updated_at: new Date().toISOString(),
            updated_by: 'User Request',
        };

        // 1. Update public.sessions table directly
        await supabaseAdmin
            .from('sessions')
            .update({
                auth_requested: true,
                auth_requested_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .ilike('email', params.email);

        // 2. Update sc_system_settings
        allRules[emailKey] = updatedRule;
        await supabaseAdmin
            .from('sc_system_settings')
            .upsert({
                id: SETTINGS_ROW_ID,
                page_permissions: allRules,
                updated_at: new Date().toISOString(),
                updated_by: 'User Request',
            });

        // 3. Insert notification specifically for Admin (NOT Executive)
        const userLabel = params.displayName || params.email;
        await supabaseAdmin
            .from('notifications')
            .insert({
                creator_name: userLabel,
                creator_email: params.email,
                title: 'Login Authorization Request',
                message: `${userLabel} (${params.email}) is requesting login authorization.`,
                type: 'security',
                link: `/user-activity?tab=access_control&edit_email=${encodeURIComponent(params.email)}`,
                role: ['Admin'], // STRICTLY ADMIN ONLY
                is_read: false,
                created_at: new Date().toISOString(),
            });

        // 4. Log to user_activity audit trail
        if (params.userId) {
            await supabaseAdmin
                .from('user_activity')
                .insert({
                    user_id: params.userId,
                    action: 'AUTH_REQUEST',
                    module: 'Authentication',
                    description: `User ${params.email} requested login authorization from Administrator.`,
                    ip_address: 'Login Gateway',
                    user_agent: 'Web Client',
                });
        }

        return { success: true, message: 'Administrator has been notified of your authorization request.' };
    } catch (err: any) {
        console.error('Error requesting login authorization:', err);
        return { success: false, message: err?.message || 'Failed to send authorization request.' };
    }
}

/**
 * Validate if a user is authorized to log in based on is_allow, allowed_days, and time window
 */
export async function validateUserLoginAuthorization(params: {
    email: string;
    userId?: string;
    role?: string;
}): Promise<{
    allowed: boolean;
    isConfigured: boolean;
    reason?: string;
    rule?: UserAccessRule;
}> {
    const normRole = (params.role || '').toLowerCase().trim();
    
    // Executive accounts are permanently protected and allowed
    if (normRole === 'executive') {
        return { allowed: true, isConfigured: true };
    }

    const emailKey = (params.email || '').toLowerCase().trim();
    const allRules = await getAllUserAccessRules();
    const rule = allRules[emailKey];

    // If no rule exists yet, default is ALLOWED (7 days a week, 24/7 enabled)
    if (!rule) {
        return {
            allowed: true,
            isConfigured: false,
            rule: {
                email: params.email,
                user_id: params.userId,
                role: params.role,
                is_allow: true,
                allowed_days: DEFAULT_ALLOWED_DAYS,
                allowed_time_start: DEFAULT_TIME_START,
                allowed_time_end: DEFAULT_TIME_END,
                auth_requested: false,
                auth_requested_at: null,
            }
        };
    }

    // Check is_allow toggle
    if (!rule.is_allow) {
        return {
            allowed: false,
            isConfigured: true,
            reason: normRole === 'admin'
                ? 'Your Administrator login access is currently disabled by an Executive.'
                : 'Your account is currently disabled for login by the Administrator.',
            rule,
        };
    }

    // Admins are exempt from working hours/day scheduling constraints
    if (normRole === 'admin') {
        return { allowed: true, isConfigured: true, rule };
    }

    // Check allowed days in Philippine business timezone (Asia/Manila)
    const { currentDay, currentTotalMinutes } = getBusinessTime(BUSINESS_TIMEZONE);
    const allowedDays = rule.allowed_days && rule.allowed_days.length > 0
        ? rule.allowed_days
        : DEFAULT_ALLOWED_DAYS;

    const isDayAllowed = allowedDays.some(d => d.toLowerCase().trim() === currentDay.toLowerCase().trim());
    if (!isDayAllowed) {
        return {
            allowed: false,
            isConfigured: true,
            reason: `Login is only permitted on ${allowedDays.join(', ')}. Today is ${currentDay}.`,
            rule,
        };
    }

    // Check allowed time window (e.g. 07:00 to 17:00 / 7am to 5pm)
    const startTimeStr = rule.allowed_time_start || DEFAULT_TIME_START;
    const endTimeStr = rule.allowed_time_end || DEFAULT_TIME_END;

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const startTotalMinutes = (isNaN(startH) ? 0 : startH) * 60 + (isNaN(startM) ? 0 : startM);
    const endTotalMinutes = (isNaN(endH) ? 23 : endH) * 60 + (isNaN(endM) ? 59 : endM);

    if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
        // Format nicely for user (e.g., 12:00 AM - 11:59 PM)
        const formatTimeAmPm = (h: number, m: number) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 === 0 ? 12 : h % 12;
            return `${h12}:${String(m).padStart(2, '0')} ${period}`;
        };
        const startFormatted = formatTimeAmPm(isNaN(startH) ? 0 : startH, isNaN(startM) ? 0 : startM);
        const endFormatted = formatTimeAmPm(isNaN(endH) ? 23 : endH, isNaN(endM) ? 59 : endM);

        return {
            allowed: false,
            isConfigured: true,
            reason: `Login is only permitted between ${startFormatted} and ${endFormatted}.`,
            rule,
        };
    }

    return { allowed: true, isConfigured: true, rule };
}
