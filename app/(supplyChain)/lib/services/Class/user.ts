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
    private inMemoryUser: UserData | null = null;
    private inMemoryToken: string | null = null;

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

        // Store active session token and user in memory
        this.inMemoryToken = data.sessionToken || null;
        this.inMemoryUser = {
            name: data.name || 'User',
            role: data.role || 'User',
            email: data.email || '',
            sessionToken: data.sessionToken || null,
            expiresAt: data.expiresAt || null,
            userAgent,
            ipAddress,
            userId: data.userId || null,
            allowedTimeEnd: data.allowedTimeEnd || null,
            allowedTimeStart: data.allowedTimeStart || null,
            allowedDays: Array.isArray(data.allowedDays) ? data.allowedDays : (data.allowedDays ? [data.allowedDays] : null),
        };

        // Cache non-sensitive display values in sessionStorage (automatically cleared when tab closes)
        try {
            sessionStorage.setItem('user_name', data.name || 'User');
            sessionStorage.setItem('user_role', data.role || 'User');
            sessionStorage.setItem('user_email', data.email || '');
            sessionStorage.setItem('user_id', data.userId || '');
            if (data.allowedTimeEnd) sessionStorage.setItem('user_allowed_time_end', data.allowedTimeEnd);
            if (data.allowedTimeStart) sessionStorage.setItem('user_allowed_time_start', data.allowedTimeStart);
            if (data.allowedDays) {
                const daysStr = Array.isArray(data.allowedDays) ? JSON.stringify(data.allowedDays) : data.allowedDays;
                sessionStorage.setItem('user_allowed_days', daysStr);
            }
        } catch (e) {}

        // PURGE ALL CONFIDENTIAL DATA AND BACKUPS FROM LOCALSTORAGE & LOCAL COOKIES
        purgeConfidentialLocalStorage();
    }

    getRememberToken(_email?: string): string | null {
        return null;
    }

    getAllRememberTokens(): Record<string, string> {
        return {};
    }

    forgetRememberedAccount(email: string) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(`sc_remember_token_${email.toLowerCase()}`);
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

        if (this.inMemoryUser) {
            return this.inMemoryUser;
        }

        let name = '';
        let role = '';
        let email = '';
        let userId: string | null = null;
        let allowedTimeEnd: string | null = null;
        let allowedTimeStart: string | null = null;
        let parsedDays: string[] | null = null;

        try {
            name = sessionStorage.getItem('user_name') || '';
            role = sessionStorage.getItem('user_role') || '';
            email = sessionStorage.getItem('user_email') || '';
            userId = sessionStorage.getItem('user_id') || null;
            allowedTimeEnd = sessionStorage.getItem('user_allowed_time_end') || null;
            allowedTimeStart = sessionStorage.getItem('user_allowed_time_start') || null;
            const storedDays = sessionStorage.getItem('user_allowed_days');
            if (storedDays) {
                try { parsedDays = JSON.parse(storedDays); } catch { parsedDays = storedDays.split(','); }
            }
        } catch (e) {}

        return {
            name: name || 'User',
            role: role || 'User',
            email: email || '',
            sessionToken: this.inMemoryToken,
            expiresAt: null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            ipAddress: '',
            userId: userId,
            allowedTimeEnd,
            allowedTimeStart,
            allowedDays: parsedDays,
        };
    }

    getAllowedTimeEnd(): string | null {
        if (typeof window === 'undefined') return null;
        return this.getUser().allowedTimeEnd || null;
    }

    getAllowedTimeStart(): string | null {
        if (typeof window === 'undefined') return null;
        return this.getUser().allowedTimeStart || null;
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
        return this.inMemoryToken;
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
        this.inMemoryToken = null;
        this.inMemoryUser = null;
        if (typeof window === 'undefined') return;

        try {
            sessionStorage.clear();
        } catch (e) {}

        purgeConfidentialLocalStorage();
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

        if (this.inMemoryUser) {
            this.inMemoryUser = {
                ...this.inMemoryUser,
                name: data.name ?? this.inMemoryUser.name,
                role: data.role ?? this.inMemoryUser.role,
                email: data.email ?? this.inMemoryUser.email,
                userId: data.userId ?? this.inMemoryUser.userId,
                allowedTimeEnd: data.allowedTimeEnd ?? this.inMemoryUser.allowedTimeEnd,
                allowedTimeStart: data.allowedTimeStart ?? this.inMemoryUser.allowedTimeStart,
                allowedDays: data.allowedDays ? (Array.isArray(data.allowedDays) ? data.allowedDays : [data.allowedDays]) : this.inMemoryUser.allowedDays,
            };
        }

        try {
            if (data.name) sessionStorage.setItem('user_name', data.name);
            if (data.role) sessionStorage.setItem('user_role', data.role);
            if (data.email) sessionStorage.setItem('user_email', data.email);
            if (data.userId) sessionStorage.setItem('user_id', data.userId);
            if (data.allowedTimeEnd) sessionStorage.setItem('user_allowed_time_end', data.allowedTimeEnd);
            if (data.allowedTimeStart) sessionStorage.setItem('user_allowed_time_start', data.allowedTimeStart);
            if (data.allowedDays) {
                const daysStr = Array.isArray(data.allowedDays) ? JSON.stringify(data.allowedDays) : data.allowedDays;
                sessionStorage.setItem('user_allowed_days', daysStr);
            }
        } catch (e) {}
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

export function purgeConfidentialLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
        const sensitivePrefixes = [
            'notifications_cache',
            'dismissed_notifications',
            'po_ai_compose',
            'sc_remember_token',
            'ocr_mismatch_rate',
        ];
        const sensitiveExactKeys = [
            'sc_remember_tokens',
            'session_token',
            'sc_session_token',
            'session_backup',
            'session_backup_2',
            'session_backup_3',
            'user_role',
            'user_name',
            'user_email',
            'user_id',
            'logged_in_email',
            'session_expires',
            'user_allowed_time_end',
            'user_allowed_time_start',
            'user_allowed_days',
            'notified_inventory_request_ids',
            'supabase_user_email',
            'supabase_refresh_token',
            'sc_system_settings',
        ];

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (sensitiveExactKeys.includes(key) || sensitivePrefixes.some(p => key.startsWith(p))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => {
            try { localStorage.removeItem(k); } catch {}
        });

        document.cookie = 'session_backup=; path=/; max-age=0';
        document.cookie = 'session_backup_2=; path=/; max-age=0';
        document.cookie = 'session_backup_3=; path=/; max-age=0';
        document.cookie = 'user_role=; path=/; max-age=0';
        document.cookie = 'user_email=; path=/; max-age=0';
        document.cookie = 'session_token=; path=/; max-age=0';
        document.cookie = 'sc_session_token=; path=/; max-age=0';
    } catch (e) {}
}

if (typeof window !== 'undefined') {
    purgeConfidentialLocalStorage();
}