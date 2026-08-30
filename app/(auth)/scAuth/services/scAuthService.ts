import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';

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
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;

    if (sessionToken) {
        try {
            await fetch('/api/supplyChain/logout', {
                method: 'POST',
                headers: { 'x-session-token': sessionToken },
            });
        } catch {
            // ignore network issues during logout
        }
    }

    await supabase.auth.signOut();

    if (typeof window !== 'undefined') {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('session_expires');
        localStorage.removeItem('logged_in_email');
        localStorage.removeItem('user_agent');
        localStorage.removeItem('user_id');
        localStorage.removeItem('session_backup');
        document.cookie = 'session_token=; path=/; max-age=0';
    }
}

// check if there is an active remembered session
export async function checkRememberedSessionApi(sessionToken: string): Promise<any> {
    const res = await fetch('/api/supplyChain/check-remembered-session', {
        headers: { 'x-session-token': sessionToken },
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// restore supabase session from stored refresh token
export async function restoreSupabaseSession(): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            const storedRefreshToken = localStorage.getItem('supabase_refresh_token');

            if (storedRefreshToken) {
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                    refresh_token: storedRefreshToken,
                });

                if (refreshError) {
                    console.error('Refresh token failed:', refreshError.message);
                    localStorage.removeItem('supabase_refresh_token');
                } else if (refreshData.session) {
                    localStorage.setItem('supabase_refresh_token', refreshData.session.refresh_token);
                }
            }
        }
    } catch (error) {
        console.error('Error restoring Supabase session:', error);
    }
}

// check active employee session status
export async function checkEmployeeSessionApi(email: string): Promise<any> {
    const res = await fetch(`/api/supplyChain/check-employee-session?email=${encodeURIComponent(email)}`);
    return await res.json();
}

// sign in with email and password
export async function loginSupplyChainApi(email: string, password: string): Promise<any> {
    const res = await fetch('/api/auth/supplyChain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// fetch directory from hr system
export async function fetchHREmployeesApi(role: string, userEmail?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('role', role);
    if (userEmail) params.append('email', userEmail);

    const res = await fetch(`/api/supplyChain/employees?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
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

    if (!error && data?.session) {
        localStorage.setItem('supabase_refresh_token', data.session.refresh_token);
        localStorage.setItem('supabase_user_email', email);
        await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
        });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_token: sessionToken,
            user_agent: userAgent,
        }),
    });
    return { ok: res.ok, status: res.status };
}
