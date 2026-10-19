import { supabase } from '../../../(supplyChain)/lib/services/client/supabase';
import { user } from '../../../(supplyChain)/lib/services/Class/user';

/**
 * Masks an email address for privacy and security.
 * Example: janzels@gmail.com -> ja***ls@gmail.com
 */
export function maskEmail(email?: string | null): string {
    if (!email || typeof email !== 'string') return '';
    const trimmed = email.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex === -1) return trimmed;

    const userPart = trimmed.slice(0, atIndex);
    const domainPart = trimmed.slice(atIndex + 1);

    if (!userPart) return trimmed;

    if (userPart.length <= 2) {
        return `${userPart.slice(0, 1)}***@${domainPart}`;
    }
    if (userPart.length <= 4) {
        return `${userPart.slice(0, 1)}***${userPart.slice(-1)}@${domainPart}`;
    }
    return `${userPart.slice(0, 2)}***${userPart.slice(-2)}@${domainPart}`;
}

export interface RequestOtpParams {
    userId: string;
    email: string;
    loggedInUserId: string;
    employeeName: string;
}

export interface VerifyOtpParams {
    userId: string;
    otp: string;
    targetUserId: string;
    rememberMe: boolean;
    email: string;
    employeeName: string;
    employeeRole: string;
}

export interface CreateAuthUserParams {
    email: string;
    password: string;
    displayName: string;
    role: string;
    tempToken: string;
    useHrPassword: boolean;
    hrPassword?: string | null;
    rememberMe: boolean;
}

// clear session tokens and logout
export async function clearUserSession(): Promise<void> {
    const sessionToken = user.getSessionToken();
    const userEmail = user.getEmail();
    const userId = user.getUserId();

    try {
        await fetch('/api/supplyChain/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                ...(sessionToken ? { 'x-session-token': sessionToken } : {})
            },
            body: JSON.stringify({
                action: 'LOGOUT',
                session_token: sessionToken,
                email: userEmail,
                user_id: userId
            }),
        });
    } catch {
        // ignore network issues during logout
    }

    await supabase.auth.signOut();

    user.clearUser();
    if (typeof window !== 'undefined') {
        localStorage.removeItem('session_backup');
        localStorage.removeItem('session_backup_2');
        localStorage.removeItem('session_backup_3');
        document.cookie = 'session_backup=; path=/; max-age=0';
        document.cookie = 'session_backup_2=; path=/; max-age=0';
        document.cookie = 'session_backup_3=; path=/; max-age=0';
    }
}

// validate currently active session
export async function validateSessionApi(sessionToken?: string): Promise<any> {
    try {
        const res = await fetch('/api/supplyChain/validate-session', {
            credentials: 'include',
            headers: sessionToken ? { 'x-session-token': sessionToken } : {},
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    } catch (error) {
        return { ok: false, status: 500, data: null };
    }
}

// check if there is an active remembered session
export async function checkRememberedSessionApi(sessionToken?: string): Promise<any> {
    const res = await fetch('/api/supplyChain/check-remembered-session', {
        credentials: 'include',
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// restore supabase session from stored refresh token
export async function restoreSupabaseSession(): Promise<void> {
    try {
        await supabase.auth.getSession();
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('supabase_refresh_token');
                localStorage.removeItem('supabase_user_email');
            } catch {}
        }
    } catch (error) {
        console.error('Error restoring Supabase session:', error);
    }
}

// check active employee session status
export async function checkEmployeeSessionApi(email: string, sessionToken?: string | null): Promise<any> {
    const token = sessionToken || (typeof window !== 'undefined' ? (user.getRememberToken(email) || user.getSessionToken()) : null);
    const headers: Record<string, string> = {};
    if (token) {
        headers['x-session-token'] = token;
    }
    const params = new URLSearchParams();
    params.append('email', email);
    if (token) {
        params.append('session_token', token);
    }
    const res = await fetch(`/api/supplyChain/check-employee-session?${params.toString()}`, {
        headers,
    });
    return await res.json();
}

// sign in with email and password
export async function loginSupplyChainApi(email: string, password: string, rememberMe: boolean = false): Promise<any> {
    const res = await fetch('/api/auth/supplyChain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// fetch directory from hr system
export async function fetchHREmployeesApi(role: string, userEmail?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('role', role);
    if (userEmail) params.append('email', userEmail);

    const token = typeof window !== 'undefined' ? (user.getRememberToken(userEmail) || user.getSessionToken()) : null;
    const tokensMap = typeof window !== 'undefined' ? user.getAllRememberTokens() : {};

    const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-remember-tokens': JSON.stringify(tokensMap),
    };
    if (token) {
        headers['x-session-token'] = token;
    }

    const res = await fetch(`/api/supplyChain/employees?${params.toString()}`, {
        headers,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// send otp code to employee email
export async function requestOtpApi(params: RequestOtpParams): Promise<any> {
    const res = await fetch('/api/supplyChain/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// verify otp code
export async function verifyOtpApi(params: VerifyOtpParams): Promise<any> {
    const res = await fetch('/api/supplyChain/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// create supply chain user account
export async function createAuthUserApi(params: CreateAuthUserParams): Promise<any> {
    const res = await fetch('/api/supplyChain/create-auth-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// sign in with password via supabase auth
export async function signInWithSupabasePassword(email: string, password: string): Promise<any> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem('supabase_refresh_token');
            localStorage.removeItem('supabase_user_email');
        } catch {}
    }

    return { data, error };
}

// set supabase auth session tokens
export async function setSupabaseSession(accessToken: string, refreshToken: string): Promise<{ error: any }> {
    const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    return { error };
}

// activate a remembered session
export async function activateSessionApi(sessionToken: string, userAgent: string): Promise<any> {
    const res = await fetch('/api/supplyChain/activate-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_token: sessionToken,
            user_agent: userAgent,
        }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// request login authorization from Admin
export async function requestLoginAuthorizationApi(params: {
    email: string;
    userId?: string;
    displayName?: string;
    role?: string;
    message?: string;
}): Promise<{ ok: boolean; data: any }> {
    const res = await fetch('/api/supplyChain/request-login-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}

export const NOTIFY_WINDOW_SECONDS = 300; // 5 minutes
export const MAX_NOTIFICATIONS_PER_WINDOW = 2; // max 2 notifications per window

export function getNoticeCategory(msg?: string | null): 'disabled' | 'schedule' | 'general' {
    if (!msg) return 'general';
    const lower = msg.toLowerCase();
    if (lower.includes('disabled') || lower.includes('deactivated') || lower.includes('suspended')) {
        return 'disabled';
    }
    if (lower.includes('permitted between') || lower.includes('allowed') || lower.includes('schedule') || lower.includes('hours') || lower.includes('time')) {
        return 'schedule';
    }
    return 'general';
}

export function getNotifyRateLimitKey(category: string, email: string): string {
    return `notify_admin_attempts_${category}_${email.toLowerCase().trim()}`;
}

export function getNotifyTimestamps(category: string, email: string): number[] {
    if (!email || typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(getNotifyRateLimitKey(category, email));
        if (!stored) return [];
        const parsed: number[] = JSON.parse(stored);
        const now = Date.now();
        return parsed.filter(t => now - t < NOTIFY_WINDOW_SECONDS * 1000);
    } catch {
        return [];
    }
}

export function recordNotificationSent(category: string, email: string): void {
    if (!email || typeof window === 'undefined') return;
    const current = getNotifyTimestamps(category, email);
    const updated = [...current, Date.now()];
    localStorage.setItem(getNotifyRateLimitKey(category, email), JSON.stringify(updated));
}

export function getRemainingNotifyCooldown(category: string, email: string): number {
    const timestamps = getNotifyTimestamps(category, email);
    if (timestamps.length < MAX_NOTIFICATIONS_PER_WINDOW) return 0;
    const oldest = Math.min(...timestamps);
    const elapsed = Date.now() - oldest;
    return Math.max(0, Math.ceil((NOTIFY_WINDOW_SECONDS * 1000 - elapsed) / 1000));
}

export function formatNotifyCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) {
        return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    }
    return `${s}s`;
}


