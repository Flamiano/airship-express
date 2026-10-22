'use client';

import { supabase } from './client/supabase';

export type UserRole = 'Superadmin' | 'Executive' | 'Admin' | 'Purchase Officer' | 'Operator' | 'Supplier' | 'Employee';

export interface InactivitySettings {
    enabled: boolean;
    timeoutSeconds: number; // Inactivity timeout before auto logout (e.g. 120s)
    warningSeconds: number; // Warning countdown before timeout (e.g. 10s)
    enableCountdownSound?: boolean;
}

export interface ConcurrencySlotSettings {
    executiveSlots: number; // Reserved exclusively for Superadmin/Executives & Admins (default: 10, max: 500)
    managerSlots: number;   // Reserved for Purchase Officers & Operators (default: 20, max: 500)
    employeeSlots: number;  // Standard slots (default: 70, max: 650)
    supplierSlots: number;  // For Suppliers (default: 10, max: 50)
}

export interface PagePermission {
    route: string;
    label: string;
    description: string;
    section: string;
    allowedRoles: UserRole[];
}

export interface SystemSettings {
    inactivity: InactivitySettings;
    concurrencySlots: ConcurrencySlotSettings;
    pagePermissions: Record<string, UserRole[]>;
    roleRedirects: Record<UserRole, string>;
    updatedAt: string;
    updatedBy?: string;
}

export const DEFAULT_CONCURRENCY_SLOTS: ConcurrencySlotSettings = {
    executiveSlots: 10,
    managerSlots: 20,
    employeeSlots: 70,
    supplierSlots: 10,
};

export const ALL_ROLES: UserRole[] = ['Executive', 'Admin', 'Purchase Officer', 'Operator', 'Supplier'];

export const DEFAULT_ROLE_REDIRECTS: Record<UserRole, string> = {
    'Executive': '/executive',
    'Admin': '/inventory',
    'Purchase Officer': '/purchase-orders',
    'Operator': '/warehousing',
    'Supplier': '/suppliers_page/purchase-orders',
    'Superadmin': '/executive',
    'Employee': '/warehousing',
};

export const DEFAULT_PAGE_PERMISSIONS: PagePermission[] = [
    {
        route: '/executive',
        label: 'Executive Overview',
        description: 'High-level business analytics, KPIs, and executive reporting',
        section: 'Operations',
        allowedRoles: ['Superadmin', 'Executive'],
    },
    {
        route: '/warehousing',
        label: 'Warehousing',
        description: 'Facility management, bays, racks, and storage layouts',
        section: 'Operations',
        allowedRoles: ['Superadmin', 'Operator'],
    },
    {
        route: '/inventory',
        label: 'Inventory',
        description: 'Item classifications, stock levels, and warehouse counts',
        section: 'Operations',
        allowedRoles: ['Superadmin', 'Admin'],
    },
    {
        route: '/procurement',
        label: 'Procurement',
        description: 'Purchase requests, supplier requisitions, and budgeting',
        section: 'Procurement',
        allowedRoles: ['Superadmin', 'Purchase Officer'],
    },
    {
        route: '/suppliers',
        label: 'Suppliers',
        description: 'Vendor directory, partner ratings, and supply agreements',
        section: 'Procurement',
        allowedRoles: ['Superadmin', 'Purchase Officer'],
    },
    {
        route: '/purchase-orders',
        label: 'Purchase Orders',
        description: 'Order fulfillment, invoicing, and purchase authorization',
        section: 'Procurement',
        allowedRoles: ['Superadmin', 'Admin', 'Purchase Officer'],
    },
    {
        route: '/documents',
        label: 'Documents',
        description: 'Compliance files, shipping docs, and records archive',
        section: 'Intelligence',
        allowedRoles: ['Superadmin', 'Purchase Officer'],
    },
    {
        route: '/forecast',
        label: 'Forecast',
        description: 'Demand forecasting and algorithmic predictive models',
        section: 'Intelligence',
        allowedRoles: ['Superadmin', 'Executive', 'Admin'],
    },
    {
        route: '/gallery',
        label: 'Gallery',
        description: 'Media archive, logistics photos, and inspection snapshots',
        section: 'Others',
        allowedRoles: ['Superadmin'],
    },
    {
        route: '/trash',
        label: 'Trash & Recycle Bin',
        description: 'Deleted records recovery and permanent purge controls',
        section: 'Others',
        allowedRoles: ['Superadmin', 'Admin', 'Purchase Officer'],
    },
    {
        route: '/user-activity',
        label: 'User Activities',
        description: 'Audit logs, active sessions, and blocked device management',
        section: 'Others',
        allowedRoles: ['Superadmin', 'Executive'],
    },
    {
        route: '/settings',
        label: 'Settings',
        description: 'Inactivity timeouts, role access policies, and system preferences',
        section: 'Others',
        allowedRoles: ['Superadmin', 'Executive'],
    },
];

export const DEFAULT_INACTIVITY_SETTINGS: InactivitySettings = {
    enabled: true,
    timeoutSeconds: 120, 
    warningSeconds: 10,  
    enableCountdownSound: false,
};

export const DEFAULT_SETTINGS: SystemSettings = {
    inactivity: DEFAULT_INACTIVITY_SETTINGS,
    concurrencySlots: DEFAULT_CONCURRENCY_SLOTS,
    pagePermissions: DEFAULT_PAGE_PERMISSIONS.reduce((acc, curr) => {
        acc[curr.route] = curr.allowedRoles;
        return acc;
    }, {} as Record<string, UserRole[]>),
    roleRedirects: { ...DEFAULT_ROLE_REDIRECTS },
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Default',
};

const SETTINGS_STORAGE_KEY = 'sc_system_settings_v3';
const SETTINGS_EVENT_NAME = 'sc_settings_updated';

class SettingsService {
    private static instance: SettingsService;
    private memorySettings: SystemSettings | null = null;
    private listeners: Set<(settings: SystemSettings) => void> = new Set();
    private isRealtimeSubscribed: boolean = false;
    
    // Performance Caches
    private routeRolesCache: Map<string, string[]> = new Map();
    private cachedTimeoutMs: number = 120 * 1000;
    private cachedWarningMs: number = 10 * 1000;

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
                    try {
                        const parsed = JSON.parse(e.newValue) as SystemSettings;
                        this.updateMemoryCache(parsed);
                        this.notifyListeners(parsed);
                    } catch (err) {
                        console.error('Failed to parse storage settings update:', err);
                    }
                }
            });

            window.addEventListener(SETTINGS_EVENT_NAME, (e: Event) => {
                const customEvent = e as CustomEvent<SystemSettings>;
                if (customEvent.detail) {
                    this.updateMemoryCache(customEvent.detail);
                    this.notifyListeners(customEvent.detail);
                }
            });

            // 1. Fast sync from localStorage for immediate 0ms UI load
            this.getSettings();

            // 2. Fetch latest shared settings from backend database
            this.fetchBackendSettings().catch(() => {});

            // 3. Connect to Supabase Realtime for instant cross-device updates
            this.initRealtimeSubscription();
        } else {
            this.rebuildPerformanceCache(DEFAULT_SETTINGS);
        }
    }

    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    private rebuildPerformanceCache(settings: SystemSettings) {
        this.routeRolesCache.clear();
        if (settings.pagePermissions && typeof settings.pagePermissions === 'object') {
            for (const [route, roles] of Object.entries(settings.pagePermissions)) {
                if (!Array.isArray(roles)) continue;
                const cleanKey = route.toLowerCase().replace(/\/$/, '') || '/';
                this.routeRolesCache.set(cleanKey, Array.from(new Set(roles)));
            }
        }

        if (!settings.inactivity || !settings.inactivity.enabled) {
            this.cachedTimeoutMs = Number.MAX_SAFE_INTEGER;
            this.cachedWarningMs = 0;
        } else {
            this.cachedTimeoutMs = Math.max(10, settings.inactivity.timeoutSeconds) * 1000;
            this.cachedWarningMs = Math.max(5, settings.inactivity.warningSeconds) * 1000;
        }
    }

    private updateMemoryCache(settings: SystemSettings) {
        this.memorySettings = settings;
        this.rebuildPerformanceCache(settings);
    }

    /**
     * Get the current active settings (from fast memory cache, localStorage or defaults)
     */
    public getSettings(): SystemSettings {
        if (typeof window === 'undefined') {
            return DEFAULT_SETTINGS;
        }

        if (this.memorySettings) {
            return this.memorySettings;
        }

        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<SystemSettings>;
                const rawPerms: Record<string, UserRole[]> = {
                    ...DEFAULT_SETTINGS.pagePermissions,
                };

                if (parsed.pagePermissions && typeof parsed.pagePermissions === 'object') {
                    Object.entries(parsed.pagePermissions).forEach(([r, val]) => {
                        if (Array.isArray(val)) {
                            rawPerms[r] = val as UserRole[];
                        }
                    });
                }

                const merged: SystemSettings = {
                    inactivity: {
                        ...DEFAULT_INACTIVITY_SETTINGS,
                        ...(parsed.inactivity || {}),
                    },
                    concurrencySlots: {
                        ...DEFAULT_CONCURRENCY_SLOTS,
                        ...(parsed.concurrencySlots || {}),
                    },
                    pagePermissions: rawPerms,
                    roleRedirects: {
                        ...DEFAULT_ROLE_REDIRECTS,
                        ...(parsed.roleRedirects || {}),
                    },
                    updatedAt: parsed.updatedAt || new Date().toISOString(),
                    updatedBy: parsed.updatedBy || 'User',
                };
                this.updateMemoryCache(merged);
                return merged;
            }
        } catch (e) {
            console.warn('Error reading stored settings:', e);
        }

        this.updateMemoryCache(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    }

    /**
     * Save new settings to localStorage and trigger cross-tab & component updates
     */
    public saveSettings(newSettings: Partial<SystemSettings>, updatedBy: string = 'User'): SystemSettings {
        const current = this.getSettings();
        const merged: SystemSettings = {
            inactivity: {
                ...current.inactivity,
                ...(newSettings.inactivity || {}),
            },
            concurrencySlots: {
                ...current.concurrencySlots,
                ...(newSettings.concurrencySlots || {}),
            },
            pagePermissions: {
                ...current.pagePermissions,
                ...(newSettings.pagePermissions || {}),
            },
            roleRedirects: {
                ...current.roleRedirects,
                ...(newSettings.roleRedirects || {}),
            },
            updatedAt: new Date().toISOString(),
            updatedBy,
        };

        this.updateMemoryCache(merged);

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
                window.dispatchEvent(new CustomEvent(SETTINGS_EVENT_NAME, { detail: merged }));
            } catch (e) {
                console.error('Failed to save settings in localStorage:', e);
            }
        }

        this.notifyListeners(merged);

        // Async sync to backend API
        this.syncToBackend(merged).catch(() => {});

        return merged;
    }

    /**
     * Reset settings to clean default values
     */
    public resetToDefaults(updatedBy: string = 'User'): SystemSettings {
        const resetSettings: SystemSettings = {
            inactivity: { ...DEFAULT_INACTIVITY_SETTINGS },
            concurrencySlots: { ...DEFAULT_CONCURRENCY_SLOTS },
            pagePermissions: { ...DEFAULT_SETTINGS.pagePermissions },
            roleRedirects: { ...DEFAULT_ROLE_REDIRECTS },
            updatedAt: new Date().toISOString(),
            updatedBy: `${updatedBy} (Reset)`,
        };

        this.updateMemoryCache(resetSettings);

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(resetSettings));
                window.dispatchEvent(new CustomEvent(SETTINGS_EVENT_NAME, { detail: resetSettings }));
            } catch (e) {
                console.error('Failed to reset settings in localStorage:', e);
            }
        }

        this.notifyListeners(resetSettings);
        this.syncToBackend(resetSettings).catch(() => {});

        return resetSettings;
    }

    /**
     * Helper to get concurrency slot allocation
     */
    public getConcurrencySlots(): ConcurrencySlotSettings {
        return this.getSettings().concurrencySlots || DEFAULT_CONCURRENCY_SLOTS;
    }

    /**
     * Helper to calculate total active user capacity across all tiers
     */
    public getTotalSlots(): number {
        const slots = this.getConcurrencySlots();
        return (slots.executiveSlots || 10) + (slots.managerSlots || 20) + (slots.employeeSlots || 70) + (slots.supplierSlots || 10);
    }

    /**
     * Helper to get allowed roles for a given pathname/route (O(1) cached lookup)
     */
    public getPageRoles(pathname: string, fallbackRoles?: string[]): string[] {
        // Ensure memory cache is initialized
        if (!this.memorySettings && typeof window !== 'undefined') {
            this.getSettings();
        }

        const cleanPath = (pathname || '/').split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '') || '/';
        
        // Fast exact cache hit
        const cached = this.routeRolesCache.get(cleanPath);
        if (cached) return cached;

        // Prefix matching for sub-routes
        for (const [route, roles] of this.routeRolesCache.entries()) {
            if (route !== '/' && cleanPath.startsWith(route)) {
                return roles;
            }
        }

        const validFallback = Array.isArray(fallbackRoles)
            ? fallbackRoles
            : typeof fallbackRoles === 'string' && (fallbackRoles as string).trim()
            ? [(fallbackRoles as string).trim()]
            : undefined;

        return validFallback || ['Superadmin', 'Executive', 'Admin', 'Purchase Officer', 'Operator', 'Supplier'];
    }

    /**
     * Helper to check if a specific role has access to a pathname
     */
    public canAccessPage(role: string, pathname: string, fallbackRoles?: string[]): boolean {
        if (!role) return false;
        const normRole = role.trim().toLowerCase();
        
        // Superadmin has full access to internal pages
        if (normRole === 'superadmin') return true;

        const validFallback = Array.isArray(fallbackRoles)
            ? fallbackRoles
            : typeof fallbackRoles === 'string' && (fallbackRoles as string).trim()
            ? [(fallbackRoles as string).trim()]
            : undefined;

        // Check dynamic allowed roles from DB/settings (falls back to validFallback only if route not configured)
        const allowedRoles = this.getPageRoles(pathname, validFallback);
        return allowedRoles.some(r => {
            const normAllowed = (r || '').trim().toLowerCase();
            if (normRole === normAllowed) return true;
            if ((normRole === 'purchase officer' && (normAllowed === 'staff' || normAllowed === 'employee')) || ((normRole === 'staff' || normRole === 'employee') && normAllowed === 'purchase officer')) return true;
            return false;
        });
    }

    /**
     * Get dynamic login redirection landing page for a given role.
     * If the configured route is restricted for that role, automatically falls back to an allowed route.
     */
    public getRoleRedirect(role: string): string {
        const settings = this.getSettings();
        const configured = settings.roleRedirects?.[role as UserRole] || DEFAULT_ROLE_REDIRECTS[role as UserRole] || '/warehousing';
        
        // If the configured redirect route is allowed for this role, use it
        if (this.canAccessPage(role, configured)) {
            return configured;
        }

        // Otherwise, dynamically fallback to the first allowed route for this role
        for (const page of DEFAULT_PAGE_PERMISSIONS) {
            if (this.canAccessPage(role, page.route)) {
                return page.route;
            }
        }

        return '/warehousing';
    }

    /**
     * Get cached inactivity timeout in milliseconds (instant O(1))
     */
    public getInactivityTimeoutMs(): number {
        return this.cachedTimeoutMs;
    }

    /**
     * Get cached inactivity warning in milliseconds (instant O(1))
     */
    public getInactivityWarningMs(): number {
        return this.cachedWarningMs;
    }

    /**
     * Subscribe to settings updates
     */
    public subscribe(listener: (settings: SystemSettings) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(settings: SystemSettings) {
        this.listeners.forEach((listener) => {
            try {
                listener(settings);
            } catch (err) {
                console.error('Error in settings listener:', err);
            }
        });
    }

    /**
     * Fetch settings directly from backend API / Supabase database
     */
    public async fetchBackendSettings(): Promise<SystemSettings> {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;
        try {
            const res = await fetch('/api/supplyChain/settings', { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                if (json.ok && json.data) {
                    const fetched: SystemSettings = {
                        inactivity: {
                            ...DEFAULT_INACTIVITY_SETTINGS,
                            ...(json.data.inactivity || {}),
                        },
                        concurrencySlots: {
                            ...DEFAULT_CONCURRENCY_SLOTS,
                            ...(json.data.concurrencySlots || {}),
                        },
                        pagePermissions: {
                            ...DEFAULT_SETTINGS.pagePermissions,
                            ...(json.data.pagePermissions || {}),
                        },
                        roleRedirects: {
                            ...DEFAULT_ROLE_REDIRECTS,
                            ...(json.data.roleRedirects || {}),
                        },
                        updatedAt: json.data.updatedAt || new Date().toISOString(),
                        updatedBy: json.data.updatedBy || 'Server',
                    };

                    this.updateMemoryCache(fetched);

                    try {
                        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(fetched));
                    } catch {}

                    this.notifyListeners(fetched);
                    return fetched;
                }
            }
        } catch (err) {
            console.warn('Failed to fetch backend settings:', err);
        }
        return this.getSettings();
    }

    /**
     * Listen to real-time changes from Supabase across all browsers/devices
     */
    public initRealtimeSubscription(): void {
        if (typeof window === 'undefined' || this.isRealtimeSubscribed) return;

        try {
            this.isRealtimeSubscribed = true;
            supabase
                .channel('sc_system_settings_realtime')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'sc_system_settings',
                    },
                    (payload) => {
                        const row: any = payload.new;
                        if (!row || row.id !== 'default_settings') return;

                        const rawPerms: Record<string, UserRole[]> = {
                            ...DEFAULT_SETTINGS.pagePermissions,
                        };
                        if (row.page_permissions && typeof row.page_permissions === 'object') {
                            Object.entries(row.page_permissions).forEach(([r, val]) => {
                                if (Array.isArray(val)) {
                                    rawPerms[r] = val as UserRole[];
                                }
                            });
                        }

                        const updated: SystemSettings = {
                            inactivity: {
                                ...DEFAULT_INACTIVITY_SETTINGS,
                                ...(row.inactivity || {}),
                            },
                            concurrencySlots: {
                                ...DEFAULT_CONCURRENCY_SLOTS,
                                ...(row.concurrency_slots || {}),
                            },
                            pagePermissions: rawPerms,
                            roleRedirects: {
                                ...DEFAULT_ROLE_REDIRECTS,
                                ...(row.role_redirects || {}),
                            },
                            updatedAt: row.updated_at || new Date().toISOString(),
                            updatedBy: row.updated_by || 'Remote Admin',
                        };

                        this.updateMemoryCache(updated);

                        try {
                            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
                        } catch {}

                        this.notifyListeners(updated);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        // console.log('Connected to real-time settings channel');
                    }
                });
        } catch (err) {
            console.error('Error initializing settings realtime subscription:', err);
        }
    }

    private async syncToBackend(settings: SystemSettings): Promise<void> {
        if (typeof window === 'undefined') return;
        try {
            await fetch('/api/supplyChain/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
        } catch (err) {
            console.error('Failed to sync settings to backend:', err);
        }
    }
}

export const settingsService = SettingsService.getInstance();
