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
    }) {
        if (typeof window === 'undefined') return;

        const userAgent = data.userAgent || navigator.userAgent || 'Unknown';
        const ipAddress = data.ipAddress || '';

        localStorage.setItem('user_name', data.name);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_email', data.email);
        localStorage.setItem('session_token', data.sessionToken);
        localStorage.setItem('session_expires', data.expiresAt);
        localStorage.setItem('logged_in_email', data.email);
        localStorage.setItem('user_agent', userAgent);
        localStorage.setItem('user_ip', ipAddress);
        localStorage.setItem('user_id', data.userId || '');

        if (data.rememberMe) {
            const maxAge = 15 * 24 * 60 * 60;
            document.cookie = `session_token=${data.sessionToken}; path=/; max-age=${maxAge}`;
        } else {
            const maxAge = 8 * 60 * 60;
            document.cookie = `session_token=${data.sessionToken}; path=/; max-age=${maxAge}`;
        }
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

        return {
            name: localStorage.getItem('user_name') || 'User',
            role: localStorage.getItem('user_role') || 'User',
            email: localStorage.getItem('user_email') || '',
            sessionToken: localStorage.getItem('session_token'),
            expiresAt: localStorage.getItem('session_expires'),
            userAgent: localStorage.getItem('user_agent') || '',
            ipAddress: localStorage.getItem('user_ip') || '',
            userId: localStorage.getItem('user_id') || null,
        };
    }

    getUserId(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('user_id') || null;
    }

    getName(): string {
        if (typeof window === 'undefined') return 'User';
        return localStorage.getItem('user_name') || 'User';
    }

    getRole(): string {
        if (typeof window === 'undefined') return 'User';
        return localStorage.getItem('user_role') || 'User';
    }

    getEmail(): string {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('user_email') || '';
    }

    getSessionToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('session_token');
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
        return !!localStorage.getItem('session_token');
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
        localStorage.removeItem('session_expires');
        localStorage.removeItem('logged_in_email');
        localStorage.removeItem('user_agent');
        localStorage.removeItem('user_ip');
        localStorage.removeItem('user_id');
        document.cookie = 'session_token=; path=/; max-age=0';
    }

    updateUser(data: Partial<{ name: string; role: string; email: string; userAgent: string; ipAddress: string; userId: string }>) {
        if (typeof window === 'undefined') return;

        if (data.name) localStorage.setItem('user_name', data.name);
        if (data.role) localStorage.setItem('user_role', data.role);
        if (data.email) localStorage.setItem('user_email', data.email);
        if (data.userAgent) localStorage.setItem('user_agent', data.userAgent);
        if (data.ipAddress) localStorage.setItem('user_ip', data.ipAddress);
        if (data.userId) localStorage.setItem('user_id', data.userId);
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