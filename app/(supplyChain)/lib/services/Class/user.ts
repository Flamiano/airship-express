'use client';

interface UserData {
    name: string;
    role: string;
    email: string;
    sessionToken: string | null;
    expiresAt: string | null;
    userAgent: string;
    ipAddress: string;
    userId: string | null;
    allowedTimeEnd?: string | null;
    allowedTimeStart?: string | null;
    allowedDays?: string[] | null;
}

class UserService {
    private static instance: UserService;

    private constructor() { }

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    private getCookie(name: string): string | null {
        if (typeof document === 'undefined') return null;
        const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match && match[1] ? decodeURIComponent(match[1]) : null;
    }

    setUser(data: {
        name: string;
        role: string;
        email: string;
        sessionToken: string;
        expiresAt: string;
        rememberMe?: boolean;
        userAgent?: string;
        ipAddress?: string;
        userId?: string;
        allowedTimeEnd?: string;
        allowedTimeStart?: string;
        allowedDays?: string[] | string;
    }) {
        if (typeof window === 'undefined') return;

        const userAgent = data.userAgent || navigator.userAgent || 'Unknown';
        const ipAddress = data.ipAddress || '';

        localStorage.setItem('user_name', data.name || 'User');
        localStorage.setItem('user_role', data.role || 'Employee');
        localStorage.setItem('user_email', data.email || '');
        localStorage.setItem('session_token', data.sessionToken);
        localStorage.setItem('sc_session_token', data.sessionToken);
        localStorage.setItem('session_expires', data.expiresAt || '');
        localStorage.setItem('logged_in_email', data.email || '');
        localStorage.setItem('user_agent', userAgent);
        localStorage.setItem('user_ip', ipAddress);
        localStorage.setItem('user_id', data.userId || '');
        if (data.allowedTimeEnd) localStorage.setItem('user_allowed_time_end', data.allowedTimeEnd);
        if (data.allowedTimeStart) localStorage.setItem('user_allowed_time_start', data.allowedTimeStart);
        if (data.allowedDays) {
            const daysStr = Array.isArray(data.allowedDays) ? JSON.stringify(data.allowedDays) : data.allowedDays;
            localStorage.setItem('user_allowed_days', daysStr);
        }

        // Session backup object
        const backup = {
            session_token: data.sessionToken,
            user_role: data.role,
            user_name: data.name,
            user_email: data.email,
            user_agent: userAgent,
            user_ip: ipAddress,
            session_expires: data.expiresAt,
            user_id: data.userId || '',
            backed_up_at: new Date().toISOString(),
            checksum: btoa(data.sessionToken + (data.role || '') + (data.email || '')),
        };
        const backupStr = JSON.stringify(backup);
        localStorage.setItem('session_backup', backupStr);
        localStorage.setItem('session_backup_2', backupStr);
        localStorage.setItem('session_backup_3', backupStr);
        try {
            sessionStorage.setItem('session_backup', backupStr);
            sessionStorage.setItem('session_token', data.sessionToken);
        } catch (e) {}

        if (data.rememberMe) {
            localStorage.setItem(`sc_remember_token_${data.email.toLowerCase()}`, data.sessionToken);
            try {
                const existing = JSON.parse(localStorage.getItem('sc_remember_tokens') || '{}');
                existing[data.email.toLowerCase()] = data.sessionToken;
                localStorage.setItem('sc_remember_tokens', JSON.stringify(existing));
            } catch (e) {}
        } else {
            localStorage.removeItem(`sc_remember_token_${data.email.toLowerCase()}`);
            try {
                const existing = JSON.parse(localStorage.getItem('sc_remember_tokens') || '{}');
                delete existing[data.email.toLowerCase()];
                localStorage.setItem('sc_remember_tokens', JSON.stringify(existing));
            } catch (e) {}
        }

        const maxAge = data.rememberMe ? 15 * 24 * 60 * 60 : 24 * 60 * 60;
        document.cookie = `session_token=${data.sessionToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `sc_session_token=${data.sessionToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `session_backup=${encodeURIComponent(backupStr)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `user_role=${encodeURIComponent(data.role || '')}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    getRememberToken(email?: string): string | null {
        if (typeof window === 'undefined') return null;
        if (email) {
            const token = localStorage.getItem(`sc_remember_token_${email.toLowerCase()}`);
            if (token) return token;
            try {
                const map = JSON.parse(localStorage.getItem('sc_remember_tokens') || '{}');
                if (map[email.toLowerCase()]) return map[email.toLowerCase()];
            } catch (e) {}
        }
        return this.getSessionToken();
    }

    getAllRememberTokens(): Record<string, string> {
        if (typeof window === 'undefined') return {};
        try {
            return JSON.parse(localStorage.getItem('sc_remember_tokens') || '{}');
        } catch (e) {
            return {};
        }
    }

    forgetRememberedAccount(email: string) {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(`sc_remember_token_${email.toLowerCase()}`);
        try {
            const existing = JSON.parse(localStorage.getItem('sc_remember_tokens') || '{}');
            delete existing[email.toLowerCase()];
            localStorage.setItem('sc_remember_tokens', JSON.stringify(existing));
        } catch (e) {}
    }

    getUser(): UserData {
        if (typeof window === 'undefined') {
            return {
                name: 'User',
                role: 'User',
                email: '',
                sessionToken: null,
                expiresAt: null,
                userAgent: '',
                ipAddress: '',
                userId: null,
            };
        }

        let token = localStorage.getItem('session_token') || localStorage.getItem('sc_session_token');
        let role = localStorage.getItem('user_role');
        let email = localStorage.getItem('user_email');
        let name = localStorage.getItem('user_name');

        if (!token || !role || role === 'User' || !email) {
            const resolvedToken = this.getSessionToken();
            if (resolvedToken) {
                token = resolvedToken;
                role = localStorage.getItem('user_role');
                email = localStorage.getItem('user_email');
                name = localStorage.getItem('user_name');
            }
        }

        let parsedDays: string[] | null = null;
        const storedDays = localStorage.getItem('user_allowed_days');
        if (storedDays) {
            try { parsedDays = JSON.parse(storedDays); } catch { parsedDays = storedDays.split(','); }
        }

        return {
            name: name || 'User',
            role: role || 'User',
            email: email || '',
            sessionToken: token || null,
            expiresAt: localStorage.getItem('session_expires'),
            userAgent: localStorage.getItem('user_agent') || '',
            ipAddress: localStorage.getItem('user_ip') || '',
            userId: localStorage.getItem('user_id') || null,
            allowedTimeEnd: localStorage.getItem('user_allowed_time_end') || null,
            allowedTimeStart: localStorage.getItem('user_allowed_time_start') || null,
            allowedDays: parsedDays,
        };
    }

    getAllowedTimeEnd(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('user_allowed_time_end') || null;
    }

    getAllowedTimeStart(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('user_allowed_time_start') || null;
    }

    getUserId(): string | null {
        if (typeof window === 'undefined') return null;
        return this.getUser().userId;
    }

    getId(): string | null {
        return this.getUserId();
    }

    getName(): string {
        if (typeof window === 'undefined') return 'User';
        return this.getUser().name;
    }

    getRole(): string {
        if (typeof window === 'undefined') return 'User';
        return this.getUser().role;
    }

    getEmail(): string {
        if (typeof window === 'undefined') return '';
        return this.getUser().email;
    }

    getSessionToken(): string | null {
        if (typeof window === 'undefined') return null;
        let token = localStorage.getItem('session_token') || localStorage.getItem('sc_session_token');
        if (token && token !== 'null' && token !== 'undefined' && token !== '') return token;

        // Try sessionStorage
        try {
            token = sessionStorage.getItem('session_token') || sessionStorage.getItem('sc_session_token');
            if (token && token !== 'null' && token !== 'undefined' && token !== '') {
                localStorage.setItem('session_token', token);
                return token;
            }
        } catch (e) {}

        // Try cookies
        const cookieToken = this.getCookie('session_token') || this.getCookie('sc_session_token');
        if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && cookieToken !== '') {
            localStorage.setItem('session_token', cookieToken);
            return cookieToken;
        }

        // Try backup in localStorage / sessionStorage / cookie
        const backupRaw = localStorage.getItem('session_backup') || 
                          localStorage.getItem('session_backup_2') || 
                          localStorage.getItem('session_backup_3') ||
                          this.getCookie('session_backup');
        if (backupRaw) {
            try {
                const parsed = JSON.parse(backupRaw);
                if (parsed && parsed.session_token) {
                    this.setUser({
                        name: parsed.user_name || '',
                        role: parsed.user_role || '',
                        email: parsed.user_email || '',
                        sessionToken: parsed.session_token,
                        expiresAt: parsed.session_expires || '',
                        userAgent: parsed.user_agent || '',
                        ipAddress: parsed.user_ip || '',
                        userId: parsed.user_id || '',
                        rememberMe: true,
                    });
                    return parsed.session_token;
                }
            } catch (e) {}
        }

        return null;
    }

    getUserAgent(): string {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('user_agent') || '';
    }

    getIP(): string {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('user_ip') || '';
    }

    isLoggedIn(): boolean {
        if (typeof window === 'undefined') return false;
        return !!this.getSessionToken();
    }

    hasRole(role: string | string[]): boolean {
        const userRole = this.getRole();
        if (Array.isArray(role)) {
            return role.includes(userRole);
        }
        return userRole === role;
    }

    clearUser() {
        if (typeof window === 'undefined') return;

        localStorage.removeItem('user_name');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_email');
        localStorage.removeItem('session_token');
        localStorage.removeItem('sc_session_token');
        localStorage.removeItem('session_expires');
        localStorage.removeItem('logged_in_email');
        localStorage.removeItem('user_agent');
        localStorage.removeItem('user_ip');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_allowed_time_end');
        localStorage.removeItem('user_allowed_time_start');
        localStorage.removeItem('user_allowed_days');
        localStorage.removeItem('session_backup');
        localStorage.removeItem('session_backup_2');
        localStorage.removeItem('session_backup_3');
        try {
            sessionStorage.removeItem('session_backup');
            sessionStorage.removeItem('session_token');
            sessionStorage.removeItem('sc_session_token');
        } catch (e) {}
        document.cookie = 'session_token=; path=/; max-age=0';
        document.cookie = 'sc_session_token=; path=/; max-age=0';
        document.cookie = 'session_backup=; path=/; max-age=0';
        document.cookie = 'user_role=; path=/; max-age=0';
    }

    updateUser(data: Partial<{
        name: string;
        role: string;
        email: string;
        userAgent: string;
        ipAddress: string;
        userId: string;
        allowedTimeEnd?: string;
        allowedTimeStart?: string;
        allowedDays?: string[] | string;
    }>) {
        if (typeof window === 'undefined') return;

        if (data.name) localStorage.setItem('user_name', data.name);
        if (data.role) {
            localStorage.setItem('user_role', data.role);
            document.cookie = `user_role=${encodeURIComponent(data.role)}; path=/; max-age=86400; SameSite=Lax`;
        }
        if (data.email) localStorage.setItem('user_email', data.email);
        if (data.userAgent) localStorage.setItem('user_agent', data.userAgent);
        if (data.ipAddress) localStorage.setItem('user_ip', data.ipAddress);
        if (data.userId) localStorage.setItem('user_id', data.userId);
        if (data.allowedTimeEnd) localStorage.setItem('user_allowed_time_end', data.allowedTimeEnd);
        if (data.allowedTimeStart) localStorage.setItem('user_allowed_time_start', data.allowedTimeStart);
        if (data.allowedDays) {
            const daysStr = Array.isArray(data.allowedDays) ? JSON.stringify(data.allowedDays) : data.allowedDays;
            localStorage.setItem('user_allowed_days', daysStr);
        }
    }
}

export const user = UserService.getInstance();

export function useUser() {
    if (typeof window === 'undefined') {
        return {
            user: { name: 'User', role: 'User', email: '', sessionToken: null, expiresAt: null, userAgent: '', ipAddress: '', userId: null },
            isLoggedIn: false,
            hasRole: () => false,
            getName: () => 'User',
            getRole: () => 'User',
            getEmail: () => '',
            getUserAgent: () => '',
            getIP: () => '',
            getUserId: () => null,
            updateUser: () => { },
            clearUser: () => { },
        };
    }

    return {
        user: user.getUser(),
        isLoggedIn: user.isLoggedIn(),
        hasRole: (role: string | string[]) => user.hasRole(role),
        getName: () => user.getName(),
        getRole: () => user.getRole(),
        getEmail: () => user.getEmail(),
        getUserAgent: () => user.getUserAgent(),
        getIP: () => user.getIP(),
        getUserId: () => user.getUserId(),
        updateUser: (data: Partial<{ name: string; role: string; email: string; userAgent: string; ipAddress: string; userId: string }>) => user.updateUser(data),
        clearUser: () => user.clearUser(),
    };
}