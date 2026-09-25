'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Clock,
    Shield,
    Save,
    RotateCcw,
    Check,
    Sliders,
    Search,
    Lock,
    CheckCircle2,
    ShieldCheck,
    UserCheck,
    UserX,
    BellRing,
    History,
    RefreshCw,
    Compass,
    AlertTriangle,
    SlidersHorizontal,
    Layers,
    LayoutGrid,
    List,
    X,
    ShieldAlert,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { user } from '../../lib/services/Class/user';
import {
    settingsService,
    SystemSettings,
    UserRole,
    ALL_ROLES,
    DEFAULT_PAGE_PERMISSIONS,
    DEFAULT_ROLE_REDIRECTS,
    DEFAULT_CONCURRENCY_SLOTS,
    ConcurrencySlotSettings,
    PagePermission
} from '../../lib/services/settingsService';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import { supabase } from '../../lib/services/client/supabase';

const ALL_SECTIONS = ['all', 'Operations', 'Procurement', 'Intelligence', 'Others'] as const;

const TIMEOUT_PRESETS = [
    { label: '30 sec', value: 30, desc: 'Fast test mode' },
    { label: '1 min', value: 60, desc: 'Ultra-secure' },
    { label: '2 min (Default)', value: 120, desc: 'Standard security' },
    { label: '5 min', value: 300, desc: 'Workstation' },
    { label: '10 min', value: 600, desc: 'Warehouse' },
    { label: '15 min', value: 900, desc: 'Low friction' },
    { label: '30 min', value: 1800, desc: 'Office desk' },
    { label: '1 hour', value: 3600, desc: 'Continuous' },
];

const WARNING_PRESETS = [
    { label: '5 sec', value: 5 },
    { label: '10 sec (Default)', value: 10 },
    { label: '15 sec', value: 15 },
    { label: '30 sec', value: 30 },
    { label: '60 sec', value: 60 },
];

// Lightweight Neumorphic Skeleton Loader
function SettingsSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 animate-in fade-in duration-200 bgCard">
            {/* Header skeleton */}
            <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[6px_6px_14px_#d1dbe7,-6px_-6px_14px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.08] flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2">
                    <SkeletonBlock variant="text" width={240} height={28} />
                    <SkeletonBlock variant="text" width={380} height={16} />
                </div>
                <div className="flex gap-2">
                    <SkeletonBlock variant="button" width={110} height={36} />
                    <SkeletonBlock variant="button" width={110} height={36} />
                </div>
            </div>

            {/* Tabs skeleton */}
            <div className="flex gap-2.5 overflow-x-auto pb-1">
                <SkeletonBlock variant="button" width={160} height={40} />
                <SkeletonBlock variant="button" width={160} height={40} />
                <SkeletonBlock variant="button" width={160} height={40} />
            </div>

            {/* Card grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 pt-2">
                <div className="md:col-span-2 space-y-4">
                    <SkeletonBlock variant="rounded" height={160} />
                    <SkeletonBlock variant="rounded" height={220} />
                </div>
                <div>
                    <SkeletonBlock variant="rounded" height={400} />
                </div>
            </div>
        </div>
    );
}

export default function SettingsContentWrapper() {
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'inactivity' | 'roles' | 'slots' | 'audit'>('inactivity');
    const [settings, setSettings] = useState<SystemSettings>(() => settingsService.getSettings());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('User');
    const [currentUserName, setCurrentUserName] = useState<string>('User');
    const isExecutiveUser = currentUserRole?.toLowerCase() === 'executive';

    // View mode for matrix (auto responsive or toggleable on mobile)
    const [matrixViewMode, setMatrixViewMode] = useState<'auto' | 'cards' | 'table'>('auto');

    // Role search & filter
    const [pageSearch, setPageSearch] = useState('');
    const [selectedSection, setSelectedSection] = useState<string>('all');

    // Initial load with fast cache read
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const role = user.getRole();
            const name = user.getName();
            if (role) setCurrentUserRole(role);
            if (name) setCurrentUserName(name);

            const initial = settingsService.getSettings();
            setSettings(initial);
            setIsLoading(false);

            const unsubscribe = settingsService.subscribe((updated) => {
                setSettings(updated);
            });
            return () => unsubscribe();
        }
    }, []);

    // Active user counts per slot tier
    const [activeSlotCounts, setActiveSlotCounts] = useState<{
        executiveSlots: number;
        managerSlots: number;
        employeeSlots: number;
    }>({
        executiveSlots: 0,
        managerSlots: 0,
        employeeSlots: 0,
    });

    const fetchLiveSlotUsage = useCallback(async () => {
        try {
            const res = await fetch('/api/supplyChain/queue-status');
            if (res.ok) {
                const data = await res.json();
                if (data.slots) {
                    setActiveSlotCounts({
                        executiveSlots: data.slots.executive?.active || 0,
                        managerSlots: data.slots.manager?.active || 0,
                        employeeSlots: data.slots.employee?.active || 0,
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching live slot usage:', err);
        }
    }, []);

    useEffect(() => {
        fetchLiveSlotUsage();
        const interval = setInterval(fetchLiveSlotUsage, 4000);

        const channel = supabase
            .channel(`settings_slot_realtime_${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
                fetchLiveSlotUsage();
            })
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [fetchLiveSlotUsage]);

    // Dirty check memoized
    const markDirty = useCallback((newVal: SystemSettings) => {
        const saved = settingsService.getSettings();
        const isDifferent = JSON.stringify(newVal) !== JSON.stringify(saved);
        setHasUnsavedChanges(isDifferent);
    }, []);

    // --- Inactivity Handlers ---
    const handleToggleInactivity = (enabled: boolean) => {
        const updated: SystemSettings = {
            ...settings,
            inactivity: {
                ...settings.inactivity,
                enabled,
            },
        };
        setSettings(updated);
        markDirty(updated);
    };

    const computeValidWarning = (timeoutSec: number, currentWarningSec: number): number => {
        if (currentWarningSec >= timeoutSec) {
            const validPresets = WARNING_PRESETS.filter(p => p.value < timeoutSec);
            if (validPresets.length > 0) {
                const hasTen = validPresets.some(p => p.value === 10);
                if (hasTen) return 10;
                return validPresets[validPresets.length - 1].value;
            }
            return Math.max(1, Math.floor(timeoutSec / 2));
        }
        return currentWarningSec || 10;
    };

    const handleSelectTimeoutPreset = (seconds: number) => {
        const adjustedWarning = computeValidWarning(seconds, settings.inactivity.warningSeconds);
        const updated: SystemSettings = {
            ...settings,
            inactivity: {
                ...settings.inactivity,
                timeoutSeconds: seconds,
                warningSeconds: adjustedWarning,
            },
        };
        setSettings(updated);
        markDirty(updated);
    };

    const handleCustomTimeoutChange = (seconds: number) => {
        const validTimeout = Math.max(10, Math.min(86400, seconds || 10));
        const adjustedWarning = computeValidWarning(validTimeout, settings.inactivity.warningSeconds);
        const updated: SystemSettings = {
            ...settings,
            inactivity: {
                ...settings.inactivity,
                timeoutSeconds: validTimeout,
                warningSeconds: adjustedWarning,
            },
        };
        setSettings(updated);
        markDirty(updated);
    };

    const handleSelectWarningPreset = (seconds: number) => {
        if (seconds >= settings.inactivity.timeoutSeconds) {
            toast.warning(`Warning countdown (${seconds}s) must be less than total inactivity timeout (${settings.inactivity.timeoutSeconds}s).`);
            return;
        }
        const updated: SystemSettings = {
            ...settings,
            inactivity: {
                ...settings.inactivity,
                warningSeconds: seconds,
            },
        };
        setSettings(updated);
        markDirty(updated);
    };

    // --- Concurrency Slots Handlers ---
    const DEFAULT_SLOTS = {
        executiveSlots: 10,
        managerSlots: 20,
        employeeSlots: 70,
    } as const;

    const getDynamicMinSlot = (tier: keyof ConcurrencySlotSettings) => {
        const active = activeSlotCounts[tier] || 0;
        return Math.max(1, active);
    };

    const handleSlotChange = (tier: keyof ConcurrencySlotSettings, value: number) => {
        const isExecutive = currentUserRole?.toLowerCase() === 'executive';
        if (tier === 'executiveSlots' && !isExecutive) {
            toast.error('Only Executive accounts are authorized to modify Executive & Admin slots.');
            return;
        }

        const activeCount = activeSlotCounts[tier] || 0;
        const minVal = Math.max(1, activeCount);
        const defaultVal = DEFAULT_SLOTS[tier];
        const numVal = isNaN(value) ? defaultVal : value;
        const sanitized = Math.max(minVal, Math.min(1000, numVal));

        const tierName = tier === 'executiveSlots' ? 'Executive & Admin' : tier === 'managerSlots' ? 'Manager' : 'Employee';

        if (numVal < minVal) {
            if (activeCount > 0) {
                toast.warning(`Cannot lessen ${tierName} slots below ${minVal} because ${activeCount} ${tierName} user${activeCount === 1 ? ' is' : 's are'} currently active.`);
            } else {
                toast.warning(`Minimum allowed for ${tierName} slots is ${minVal}.`);
            }
        }

        const updatedSlots: ConcurrencySlotSettings = {
            ...(settings.concurrencySlots || DEFAULT_CONCURRENCY_SLOTS),
            [tier]: sanitized,
        };
        const updated: SystemSettings = {
            ...settings,
            concurrencySlots: updatedSlots,
        };
        setSettings(updated);
        markDirty(updated);
    };

    const handleApplySlotPreset = (exec: number, mgr: number, emp: number) => {
        const isExecutive = currentUserRole?.toLowerCase() === 'executive';
        const currentExec = settings.concurrencySlots?.executiveSlots ?? 10;
        const minExec = getDynamicMinSlot('executiveSlots');
        const minMgr = getDynamicMinSlot('managerSlots');
        const minEmp = getDynamicMinSlot('employeeSlots');

        const targetExec = isExecutive ? Math.max(minExec, exec) : currentExec;
        const targetMgr = Math.max(minMgr, mgr);
        const targetEmp = Math.max(minEmp, emp);

        if (!isExecutive && exec !== currentExec) {
            toast.info(`Executive slots remained at ${currentExec} (Executive role required to alter VIP quota).`);
        }

        const updatedSlots: ConcurrencySlotSettings = {
            executiveSlots: targetExec,
            managerSlots: targetMgr,
            employeeSlots: targetEmp,
        };
        const updated: SystemSettings = {
            ...settings,
            concurrencySlots: updatedSlots,
        };
        setSettings(updated);
        markDirty(updated);
        toast.success(`Applied ${targetExec + targetMgr + targetEmp} total slots preset (${targetExec} Exec / ${targetMgr} Mgr / ${targetEmp} Emp).`);
    };

    // --- Role Access & Redirection Handlers ---
    const handleRoleRedirectChange = (role: UserRole, route: string) => {
        const isExecutiveUser = currentUserRole?.toLowerCase() === 'executive';
        if (role === 'Executive' && !isExecutiveUser) {
            toast.error('Only Executive accounts are authorized to modify Executive redirect settings.');
            return;
        }

        const isPrivileged = role === 'Admin' || role === 'Executive';
        if (!isPrivileged && !settingsService.canAccessPage(role, route)) {
            toast.warning(`Cannot set ${route} as landing page for ${role} because it is restricted in the permission matrix.`);
            return;
        }

        const updated: SystemSettings = {
            ...settings,
            roleRedirects: {
                ...(settings.roleRedirects || {}),
                [role]: route,
            },
        };
        setSettings(updated);
        markDirty(updated);
        toast.success(`Updated login redirect for ${role} to ${route}`);
    };

    const handleToggleRoleForPage = (route: string, role: UserRole) => {
        const isExecutiveUser = currentUserRole?.toLowerCase() === 'executive';

        if (role === 'Executive' && !isExecutiveUser) {
            toast.error('Only Executive accounts are authorized to modify Executive access permissions.');
            return;
        }

        if (route === '/executive' && role !== 'Executive') {
            toast.warning('Executive Overview is strictly restricted to the Executive role only.');
            return;
        }

        const currentRoles = settings.pagePermissions[route] || [];
        let newRoles: UserRole[];

        if (currentRoles.includes(role)) {
            // Prevent removing last administrative role from Settings page
            if (route === '/settings' && role === 'Admin' && !currentRoles.includes('Executive')) {
                toast.error('At least one administrative role must retain access to Settings.');
                return;
            }
            if (route === '/executive' && role === 'Executive') {
                toast.warning('Executive Overview requires Executive role access.');
                return;
            }
            newRoles = currentRoles.filter(r => r !== role);
        } else {
            newRoles = [...currentRoles, role];
        }

        const updatedPermissions = {
            ...settings.pagePermissions,
            [route]: newRoles,
        };

        const updatedRedirects = { ...(settings.roleRedirects || {}) };
        const currentRedirect = updatedRedirects[role];

        // If the restricted route is currently the landing page for this role, auto-change it
        if (!newRoles.includes(role) && currentRedirect === route) {
            const nextAllowedPage = DEFAULT_PAGE_PERMISSIONS.find(p => {
                if (p.route === '/executive') return false;
                const allowed = updatedPermissions[p.route] || p.allowedRoles;
                return allowed.includes(role) && p.route !== route;
            });

            if (nextAllowedPage) {
                updatedRedirects[role] = nextAllowedPage.route;
                toast.info(`Landing page for ${role} auto-changed to ${nextAllowedPage.label} (${nextAllowedPage.route}) because ${route} was restricted.`);
            }
        }

        const updated: SystemSettings = {
            ...settings,
            pagePermissions: updatedPermissions,
            roleRedirects: updatedRedirects,
        };
        setSettings(updated);
        markDirty(updated);
    };

    const handleQuickGrantEmployeeAccess = (allow: boolean) => {
        const updatedPermissions = { ...settings.pagePermissions };
        const targetPages = ['/settings', '/documents', '/gallery', '/inventory', '/warehousing'];

        targetPages.forEach(route => {
            const roles = new Set(updatedPermissions[route] || []);
            roles.add('Executive'); // Always maintain Executive
            if (allow) {
                roles.add('Employee');
            } else {
                roles.delete('Employee');
            }
            updatedPermissions[route] = Array.from(roles);
        });

        // Ensure /executive is strictly Executive only
        updatedPermissions['/executive'] = ['Executive'];

        const updated: SystemSettings = {
            ...settings,
            pagePermissions: updatedPermissions,
        };
        setSettings(updated);
        markDirty(updated);
        toast.success(allow ? 'Granted Employee access to Settings & selected pages' : 'Revoked Employee access');
    };

    const handleApplyPolicyTemplate = (template: 'standard' | 'open' | 'strict') => {
        const newPermissions: Record<string, UserRole[]> = {};

        if (template === 'standard') {
            DEFAULT_PAGE_PERMISSIONS.forEach(p => {
                if (p.route === '/executive') {
                    newPermissions[p.route] = ['Executive'];
                } else {
                    newPermissions[p.route] = p.allowedRoles;
                }
            });
        } else if (template === 'open') {
            DEFAULT_PAGE_PERMISSIONS.forEach(p => {
                if (p.route === '/executive') {
                    newPermissions[p.route] = ['Executive'];
                } else {
                    newPermissions[p.route] = ['Executive', 'Admin', 'Manager', 'Operator', 'Employee'];
                }
            });
        } else if (template === 'strict') {
            DEFAULT_PAGE_PERMISSIONS.forEach(p => {
                if (p.route === '/executive') {
                    newPermissions[p.route] = ['Executive'];
                } else if (p.route === '/settings' || p.route === '/user-activity') {
                    newPermissions[p.route] = ['Executive', 'Admin'];
                } else {
                    newPermissions[p.route] = ['Executive', 'Admin', 'Manager'];
                }
            });
        }

        const updated: SystemSettings = {
            ...settings,
            pagePermissions: newPermissions,
        };
        setSettings(updated);
        markDirty(updated);
        toast.success(`Applied '${template.toUpperCase()}' policy template.`);
    };

    const handleAutoFixRestrictedRedirects = () => {
        const updatedRedirects = { ...(settings.roleRedirects || {}) };
        let fixedCount = 0;

        ALL_ROLES.forEach(r => {
            const currentRoute = updatedRedirects[r] || (DEFAULT_PAGE_PERMISSIONS[0].route);
            const isAllowed = r === 'Executive' ? true : (settings.pagePermissions[currentRoute] || []).includes(r);
            if (!isAllowed) {
                // Find first allowed page for role
                const firstAllowed = DEFAULT_PAGE_PERMISSIONS.find(p => {
                    if (p.route === '/executive' && r !== 'Executive') return false;
                    return (settings.pagePermissions[p.route] || p.allowedRoles).includes(r);
                });
                if (firstAllowed) {
                    updatedRedirects[r] = firstAllowed.route;
                    fixedCount++;
                }
            }
        });

        if (fixedCount > 0) {
            const updated: SystemSettings = {
                ...settings,
                roleRedirects: updatedRedirects,
            };
            setSettings(updated);
            markDirty(updated);
            toast.success(`Adjusted ${fixedCount} restricted landing ${fixedCount === 1 ? 'page' : 'pages'} to accessible modules.`);
        } else {
            toast.info('All role landing pages are already accessible.');
        }
    };

    // --- Save & Reset Actions ---
    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            settingsService.saveSettings(settings, currentUserName);
            setHasUnsavedChanges(false);
            toast.success('Settings saved and synchronized!', {
                description: 'Inactivity timers and permissions are live across all devices.',
            });
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        const confirmed = await confirm({
            title: 'Reset Settings to Factory Defaults',
            message: 'Are you sure you want to reset all inactivity timers and role permissions back to default system values? This action cannot be undone.',
            confirmText: 'Reset Defaults',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        const reset = settingsService.resetToDefaults(currentUserName);
        setSettings(reset);
        setHasUnsavedChanges(false);
        toast.success('Settings restored to factory defaults');
    };

    // Filtered page permissions list
    const filteredPages = useMemo(() => {
        const searchLower = pageSearch.toLowerCase();
        return DEFAULT_PAGE_PERMISSIONS.filter(p => {
            const matchesSearch = !pageSearch ||
                p.label.toLowerCase().includes(searchLower) ||
                p.route.toLowerCase().includes(searchLower) ||
                p.description.toLowerCase().includes(searchLower);
            const matchesSection = selectedSection === 'all' || p.section.toLowerCase() === selectedSection.toLowerCase();
            return matchesSearch && matchesSection;
        });
    }, [pageSearch, selectedSection]);

    // Format duration helper
    const formatDuration = (sec: number) => {
        if (sec < 60) return `${sec} seconds`;
        const mins = Math.floor(sec / 60);
        const rem = sec % 60;
        if (rem === 0) return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
        return `${mins}m ${rem}s`;
    };

    if (isLoading) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-300 bgCard">
            {/* Header Neumorphic Card */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] border border-accent/30 text-accent">
                                <SlidersHorizontal className="h-5 w-5" />
                            </div>
                            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-bricolage">
                                System Settings
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent border border-accent/25">
                                Live Synchronized
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            Configure user inactivity auto-logout timers, warning thresholds, and role-based page permissions.
                        </p>
                    </div>

                    {/* Top Action Buttons */}
                    <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] transition-all cursor-pointer"
                        >
                            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                            <span>Reset Defaults</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 ${
                                hasUnsavedChanges
                                    ? 'bg-accent hover:bg-accent-dark shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] ring-2 ring-accent/40'
                                    : 'bg-accent/80 hover:bg-accent shadow-[3px_3px_8px_rgba(234,88,12,0.25)]'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5" />
                                    <span>{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Context Status Strip */}
                <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                        <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Active Operator: <strong className="text-slate-900 dark:text-white">{currentUserName}</strong></span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] text-accent font-bold uppercase text-[10px] border border-white/40 dark:border-white/[0.04]">
                            {currentUserRole}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Last Saved: <strong>{new Date(settings.updatedAt).toLocaleTimeString()}</strong></span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">Author: <strong>{settings.updatedBy || 'Admin'}</strong></span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Neumorphic Segmented Bar */}
            <div className="p-1.5 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/40 dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                    type="button"
                    onClick={() => setActiveTab('inactivity')}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'inactivity'
                            ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] text-accent border border-white/60 dark:border-white/[0.08]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Inactivity & Timeout</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('roles')}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'roles'
                            ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] text-accent border border-white/60 dark:border-white/[0.08]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>Role Access Matrix</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('slots')}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'slots'
                            ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] text-accent border border-white/60 dark:border-white/[0.08]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Users className="h-4 w-4 shrink-0" />
                    <span>Concurrency Slots</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'audit'
                            ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] text-accent border border-white/60 dark:border-white/[0.08]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <History className="h-4 w-4 shrink-0" />
                    <span>Policy Summary</span>
                </button>
            </div>

            {/* TAB 1: Inactivity & Session Timer */}
            {activeTab === 'inactivity' && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Master Switch Card */}
                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-accent" />
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                    Automatic Inactivity Protection
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Automatically logs out idle sessions after the configured duration with a countdown warning dialog.
                            </p>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto">
                            <input
                                type="checkbox"
                                checked={settings.inactivity.enabled}
                                onChange={(e) => handleToggleInactivity(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-13 h-7 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5.5 after:w-5.5 after:transition-all after:shadow-md peer-checked:bg-accent border border-white/60 dark:border-white/[0.08]"></div>
                            <span className="ml-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                                {settings.inactivity.enabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                        </label>
                    </div>

                    {/* Timeout Presets and Warning Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                        {/* Timeout Presets (2 Cols on lg) */}
                        <div className="lg:col-span-2 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-4 sm:space-y-5">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                                    Inactivity Timeout Duration
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Select how long a session can remain idle before auto-logout kicks in.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                {TIMEOUT_PRESETS.map((preset) => {
                                    const isSelected = settings.inactivity.timeoutSeconds === preset.value;
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            disabled={!settings.inactivity.enabled}
                                            onClick={() => handleSelectTimeoutPreset(preset.value)}
                                            className={`p-3 rounded-2xl text-left transition-all cursor-pointer disabled:opacity-40 ${
                                                isSelected
                                                    ? 'bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border-2 border-accent text-accent font-bold'
                                                    : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-accent/40'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs sm:text-sm font-bold">{preset.label}</span>
                                                {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5 font-normal">
                                                {preset.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Recessed Custom Slider Area */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/40 dark:border-white/[0.06] space-y-3">
                                <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
                                    <label className="font-bold text-slate-800 dark:text-slate-200">
                                        Custom Timeout Slider:
                                    </label>
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <input
                                            type="number"
                                            min={10}
                                            max={86400}
                                            step={10}
                                            disabled={!settings.inactivity.enabled}
                                            value={settings.inactivity.timeoutSeconds}
                                            onChange={(e) => handleCustomTimeoutChange(parseInt(e.target.value, 10))}
                                            className="w-20 px-2.5 py-1 text-xs font-bold rounded-xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-accent"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 text-xs">
                                            sec ({Math.round(settings.inactivity.timeoutSeconds / 60 * 10) / 10} min)
                                        </span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={3600}
                                    step={10}
                                    disabled={!settings.inactivity.enabled}
                                    value={settings.inactivity.timeoutSeconds}
                                    onChange={(e) => handleCustomTimeoutChange(parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-[#d1dbe7] dark:bg-[#252a38] rounded-lg appearance-none cursor-pointer accent-accent"
                                />
                            </div>
                        </div>

                        {/* Warning Window & Timeline */}
                        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                                        Warning Dialog Window
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Countdown duration shown to active users before forced sign-out.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {WARNING_PRESETS.map((w) => {
                                        const isSelected = settings.inactivity.warningSeconds === w.value;
                                        const isTooLarge = w.value >= settings.inactivity.timeoutSeconds;
                                        const isDisabled = !settings.inactivity.enabled || isTooLarge;

                                        return (
                                            <button
                                                key={w.value}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => handleSelectWarningPreset(w.value)}
                                                className={`p-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                                                    isDisabled
                                                        ? 'opacity-30 cursor-not-allowed bg-transparent border border-slate-300 dark:border-slate-800 text-slate-400'
                                                        : isSelected
                                                            ? 'bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] border border-amber-500 text-amber-600 dark:text-amber-400 font-bold cursor-pointer'
                                                            : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-amber-400 cursor-pointer'
                                                }`}
                                            >
                                                <span>{w.label}</span>
                                                {isTooLarge && <span className="block text-[9px] opacity-75">(&ge; timeout)</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Recessed Sequence Simulation */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/40 dark:border-white/[0.06] space-y-2 text-xs">
                                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold">
                                    <span className="flex items-center gap-1.5 text-xs">
                                        <BellRing className="h-3.5 w-3.5 text-amber-500" />
                                        Sequence Flow
                                    </span>
                                    <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                                        Total: {formatDuration(settings.inactivity.timeoutSeconds)}
                                    </span>
                                </div>

                                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                                    <div className="flex items-center justify-between">
                                        <span>1. Idle before warning:</span>
                                        <strong className="text-slate-900 dark:text-white font-mono">
                                            {formatDuration(Math.max(0, settings.inactivity.timeoutSeconds - settings.inactivity.warningSeconds))}
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>2. Warning popup:</span>
                                        <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                                            {settings.inactivity.warningSeconds}s countdown
                                        </strong>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-300/60 dark:border-white/[0.08]">
                                        <span>3. Session terminated:</span>
                                        <strong className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                                            {formatDuration(settings.inactivity.timeoutSeconds)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Role-Based Page Access */}
            {activeTab === 'roles' && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Role Login Landing Pages (Post-Login Redirection) */}
                    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Compass className="h-4 w-4 text-accent" />
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-bricolage">
                                        Role Login Redirection & Default Landing Pages
                                    </h3>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Configure where each role lands after logging in. Restricted landing pages will auto-fallback to allowed modules.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleAutoFixRestrictedRedirects}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-accent bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] border border-white/60 dark:border-white/[0.08] transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Auto-Align Landing Pages</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {ALL_ROLES.map((role) => {
                                const currentTarget = (settings.roleRedirects && settings.roleRedirects[role]) || (DEFAULT_PAGE_PERMISSIONS[0].route);
                                const isAllowed = settingsService.canAccessPage(role, currentTarget);
                                const isExecutive = role === 'Executive';

                                return (
                                    <div
                                        key={role}
                                        className={`p-3.5 sm:p-4 rounded-2xl transition-all ${
                                            !isAllowed
                                                ? 'bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6)] border-2 border-amber-500/80'
                                                : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_8px_#cbd6e4,-3px_-3px_8px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.08]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                                    {role}
                                                </span>
                                                {isExecutive && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        MASTER
                                                    </span>
                                                )}
                                            </div>

                                            {isAllowed ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Accessible
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Restricted
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                                Redirect on Login:
                                            </label>
                                            <select
                                                value={currentTarget}
                                                disabled={isExecutive && !isExecutiveUser}
                                                title={isExecutive && !isExecutiveUser ? "Executive redirect is protected. Only Executive accounts can modify this setting." : undefined}
                                                onChange={(e) => handleRoleRedirectChange(role, e.target.value)}
                                                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white outline-none border ${
                                                    !isAllowed
                                                        ? 'border-amber-500 focus:ring-1 focus:ring-amber-500'
                                                        : 'border-white/60 dark:border-white/[0.08] focus:border-accent'
                                                } ${isExecutive && !isExecutiveUser ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {DEFAULT_PAGE_PERMISSIONS.map((p) => {
                                                    const isPrivileged = role === 'Admin' || role === 'Executive';
                                                    const pageAllowed = settingsService.canAccessPage(role, p.route);
                                                    const isOptionDisabled = !isPrivileged && !pageAllowed;

                                                    return (
                                                        <option
                                                            key={p.route}
                                                            value={p.route}
                                                            disabled={isOptionDisabled}
                                                            className={isOptionDisabled ? 'text-slate-400 dark:text-slate-600 bg-[#EAF0F6] dark:bg-[#13161F]' : 'bg-[#EAF0F6] dark:bg-[#13161F] text-slate-900 dark:text-white'}
                                                        >
                                                            {p.label} ({p.route}) {!pageAllowed ? '(Restricted)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {!isAllowed && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                                    <span>Restricted module. Pick an accessible landing route above.</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 2: Page-by-Page Permissions Matrix */}
                    <div className="space-y-4">
                        {/* Matrix Header & Controls */}
                        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-accent" />
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                            Access Permissions Matrix
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Grant or revoke access per module. Changes apply instantly across navigation bars and route guards.
                                    </p>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickGrantEmployeeAccess(true)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] border border-white/60 dark:border-white/[0.08] transition-all cursor-pointer"
                                    >
                                        Allow Employee All Core
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickGrantEmployeeAccess(false)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] border border-white/60 dark:border-white/[0.08] transition-all cursor-pointer"
                                    >
                                        Lock Down Employee
                                    </button>
                                </div>
                            </div>

                            {/* Search & Section Filter Bar */}
                            <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={pageSearch}
                                        onChange={(e) => setPageSearch(e.target.value)}
                                        placeholder="Search module name, route path, or description..."
                                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white outline-none border border-white/60 dark:border-white/[0.08] focus:border-accent"
                                    />
                                    {pageSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setPageSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                                    {ALL_SECTIONS.map((sec) => (
                                        <button
                                            key={sec}
                                            type="button"
                                            onClick={() => setSelectedSection(sec)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap capitalize ${
                                                selectedSection === sec
                                                    ? 'bg-accent text-white shadow-[2px_2px_6px_rgba(234,88,12,0.35)]'
                                                    : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6)] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-white/60 dark:border-white/[0.08]'
                                            }`}
                                        >
                                            {sec}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mobile Cards Matrix */}
                        <div className={`${matrixViewMode === 'table' ? 'hidden' : 'block md:hidden'} space-y-3`}>
                            {filteredPages.map((page) => {
                                const allowedRoles = settings.pagePermissions[page.route] || page.allowedRoles;
                                const hasAccess = allowedRoles.includes(currentUserRole as UserRole);

                                return (
                                    <div
                                        key={page.route}
                                        className="p-4 rounded-2xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[4px_4px_10px_#d1dbe7,-4px_-4px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                        {page.label}
                                                    </h4>
                                                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[#EAF0F6] dark:bg-[#13161F] text-slate-500 dark:text-slate-400 border border-white/40 dark:border-white/[0.04]">
                                                        {page.section}
                                                    </span>
                                                </div>
                                                <code className="text-[10px] text-accent font-mono mt-0.5 block">
                                                    {page.route}
                                                </code>
                                            </div>

                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                hasAccess
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                            }`}>
                                                {hasAccess ? <CheckCircle2 className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                                                {hasAccess ? 'Allowed' : 'Locked'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {page.description}
                                        </p>

                                        {/* Role Buttons for Mobile */}
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">
                                                Allowed Roles:
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {ALL_ROLES.map((role) => {
                                                    const isExecutiveRole = role === 'Executive';
                                                    const isExecutiveRoute = page.route === '/executive';
                                                    const isExecutiveUser = currentUserRole?.toLowerCase() === 'executive';
                                                    const isChecked = allowedRoles.includes(role);

                                                    if (isExecutiveRole && !isExecutiveUser) {
                                                        return (
                                                            <div
                                                                key={role}
                                                                title="Executive access is protected. Only Executive accounts can modify this role."
                                                                className="px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40 shadow-sm opacity-90 cursor-not-allowed"
                                                            >
                                                                <div className="flex items-center gap-1.5">
                                                                    <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                                                    <span className="text-amber-900 dark:text-amber-200">Executive</span>
                                                                </div>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 font-mono font-bold tracking-wider">
                                                                    LOCKED
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    if (isExecutiveRoute && !isExecutiveRole) {
                                                        return (
                                                            <div
                                                                key={role}
                                                                className="px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between opacity-70 bg-slate-100 dark:bg-[#13161F] text-slate-600 dark:text-slate-400 border border-slate-300/70 dark:border-slate-800"
                                                            >
                                                                <span>{role}</span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-semibold">
                                                                    LOCKED
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <button
                                                            key={role}
                                                            type="button"
                                                            onClick={() => handleToggleRoleForPage(page.route, role)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                                                                isChecked
                                                                    ? isExecutiveRole
                                                                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-[2px_2px_6px_rgba(245,158,11,0.35)] border-amber-500'
                                                                        : 'bg-accent text-white shadow-[2px_2px_6px_rgba(234,88,12,0.35)] border-accent'
                                                                    : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] text-slate-500 dark:text-slate-400 border-white/60 dark:border-white/[0.06]'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                {isExecutiveRole && <Shield className="h-3.5 w-3.5" />}
                                                                <span>{role}</span>
                                                            </div>
                                                            {isChecked ? (
                                                                <Check className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Lock className="h-3.5 w-3.5 opacity-40" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop & Tablet Neumorphic Matrix Table */}
                        <div className={`${matrixViewMode === 'cards' ? 'hidden' : 'hidden md:block'} rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] overflow-hidden`}>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-[#EAF0F6]/80 dark:bg-[#13161F]/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">
                                            <th className="py-3.5 px-5">Page / Module</th>
                                            <th className="py-3.5 px-3">Section</th>
                                            <th className="py-3.5 px-5">Role Access Matrix</th>
                                            <th className="py-3.5 px-4 text-center">Your Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
                                        {filteredPages.map((page) => {
                                            const allowedRoles = settings.pagePermissions[page.route] || page.allowedRoles;
                                            const hasAccess = allowedRoles.includes(currentUserRole as UserRole);

                                            return (
                                                <tr key={page.route} className="hover:bg-[#EAF0F6]/50 dark:hover:bg-[#1A1F2B]/40 transition-colors">
                                                    {/* Page Details */}
                                                    <td className="py-3.5 px-5 align-top">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                                 {page.label}
                                                            </span>
                                                            <code className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EAF0F6] dark:bg-[#13161F] text-accent font-mono border border-white/40 dark:border-white/[0.04]">
                                                                {page.route}
                                                            </code>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                                            {page.description}
                                                        </p>
                                                    </td>

                                                    {/* Section */}
                                                    <td className="py-3.5 px-3 align-top">
                                                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_1px_1px_3px_#cbd6e4] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] text-slate-700 dark:text-slate-300 border border-white/40 dark:border-white/[0.04]">
                                                            {page.section}
                                                        </span>
                                                    </td>

                                                    {/* Role Toggles */}
                                                    <td className="py-3.5 px-5 align-top">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {ALL_ROLES.map((role) => {
                                                                const isExecutiveRole = role === 'Executive';
                                                                const isExecutiveRoute = page.route === '/executive';
                                                                const isExecutiveUser = currentUserRole?.toLowerCase() === 'executive';
                                                                const isChecked = allowedRoles.includes(role);

                                                                // Executive role is LOCKED for non-Executive users (Admin, etc.)
                                                                if (isExecutiveRole && !isExecutiveUser) {
                                                                    return (
                                                                        <button
                                                                            key={role}
                                                                            type="button"
                                                                            disabled={true}
                                                                            title="Executive access is protected. Only Executive accounts can modify this role."
                                                                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-not-allowed bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300/80 dark:border-amber-500/40 shadow-sm"
                                                                        >
                                                                            <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                                            <span className="text-amber-900 dark:text-amber-200">Executive</span>
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 font-mono font-bold tracking-wider">
                                                                            LOCKED
                                                                        </span>
                                                                    </button>
                                                                );
                                                            }

                                                            // /executive route is strictly for Executive role only
                                                            if (isExecutiveRoute && !isExecutiveRole) {
                                                                return (
                                                                    <button
                                                                        key={role}
                                                                        type="button"
                                                                        disabled={true}
                                                                        title="Executive Overview (/executive) is strictly restricted to the Executive role only."
                                                                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border opacity-70 cursor-not-allowed bg-slate-100 dark:bg-[#13161F] text-slate-600 dark:text-slate-400 border-slate-300/70 dark:border-slate-800"
                                                                    >
                                                                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-500" />
                                                                        <span>{role}</span>
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-semibold">
                                                                            LOCKED
                                                                        </span>
                                                                    </button>
                                                                );
                                                            }

                                                            // Role toggle button (Active for Executive on all roles, and active for Admin on all non-Executive roles)
                                                            return (
                                                                <button
                                                                    key={role}
                                                                    type="button"
                                                                    onClick={() => handleToggleRoleForPage(page.route, role)}
                                                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                                                                        isChecked
                                                                            ? isExecutiveRole
                                                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-[2px_2px_6px_rgba(245,158,11,0.35)] border-amber-500 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]'
                                                                                : 'bg-accent text-white shadow-[2px_2px_6px_rgba(234,88,12,0.35)] border-accent active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]'
                                                                            : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6)] text-slate-500 dark:text-slate-400 border-white/60 dark:border-white/[0.08] hover:text-slate-900 dark:hover:text-white'
                                                                    }`}
                                                                >
                                                                    {isExecutiveRole && <Shield className="h-3 w-3" />}
                                                                    {isChecked ? (
                                                                        <Check className="h-3 w-3" />
                                                                    ) : (
                                                                        <Lock className="h-3 w-3 opacity-40" />
                                                                    )}
                                                                    <span>{role}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>

                                                {/* User Access Pill */}
                                                <td className="py-3.5 px-4 align-middle text-center">
                                                    {hasAccess ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                                            Allowed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                                            <UserX className="h-2.5 w-2.5" />
                                                            Restricted
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* TAB: Concurrency Slots Configuration */}
            {activeTab === 'slots' && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Capacity Overview Card */}
                    {(() => {
                        const slots = settings.concurrencySlots || DEFAULT_CONCURRENCY_SLOTS;
                        const execSlots = slots.executiveSlots || 10;
                        const mgrSlots = slots.managerSlots || 20;
                        const empSlots = slots.employeeSlots || 70;
                        const total = execSlots + mgrSlots + empSlots;
                        const execPct = Math.round((execSlots / total) * 100);
                        const mgrPct = Math.round((mgrSlots / total) * 100);
                        const empPct = 100 - execPct - mgrPct;

                        return (
                            <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-accent" />
                                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-bricolage">
                                                System Concurrency Capacity
                                            </h3>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Manage concurrent active session quotas per role tier. If total logged-in users reach capacity, subsequent users enter the login queue until a slot frees up.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="px-4 py-2 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/40 dark:border-white/[0.06] text-right">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Concurrent Slots</span>
                                            <span className="text-2xl font-black text-accent font-bricolage">{total}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Visual Proportion Bar */}
                                <div className="space-y-2 pt-2">
                                    <div className="h-4 w-full rounded-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] p-0.5 flex overflow-hidden">
                                        <div
                                            style={{ width: `${execPct}%` }}
                                            className="h-full bg-pink-500 rounded-l-full transition-all duration-300"
                                            title={`Executive & Admin: ${execSlots} slots (${execPct}%)`}
                                        />
                                        <div
                                            style={{ width: `${mgrPct}%` }}
                                            className="h-full bg-amber-500 transition-all duration-300"
                                            title={`Manager: ${mgrSlots} slots (${mgrPct}%)`}
                                        />
                                        <div
                                            style={{ width: `${empPct}%` }}
                                            className="h-full bg-blue-500 rounded-r-full transition-all duration-300"
                                            title={`Employee: ${empSlots} slots (${empPct}%)`}
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                                            <span>Executive & Admin: <strong>{execSlots}</strong> ({execPct}%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                            <span>Manager: <strong>{mgrSlots}</strong> ({mgrPct}%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                            <span>Employee & Operator: <strong>{empSlots}</strong> ({empPct}%)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Quick Capacity Presets */}
                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-3">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-accent" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-bricolage">
                                Quick Capacity Presets
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => handleApplySlotPreset(10, 20, 70)}
                                className="p-3.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] hover:border-accent/40 border border-white/60 dark:border-white/[0.08] text-left transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm">
                                    <span>Standard (100 Slots)</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">Default</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    10 Executive • 20 Manager • 70 Employee
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleApplySlotPreset(20, 40, 140)}
                                className="p-3.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] hover:border-accent/40 border border-white/60 dark:border-white/[0.08] text-left transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm">
                                    <span>High Traffic (200 Slots)</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">2x Scale</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    20 Executive • 40 Manager • 140 Employee
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleApplySlotPreset(50, 100, 350)}
                                className="p-3.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_7px_#cbd6e4,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] hover:border-accent/40 border border-white/60 dark:border-white/[0.08] text-left transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm">
                                    <span>Enterprise (500 Slots)</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold">5x Scale</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    50 Executive • 100 Manager • 350 Employee
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Tier Adjustment Controls Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Executive Slot Control */}
                        <div className="p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30">
                                        Tier 1: Top VIP (Min: {getDynamicMinSlot('executiveSlots')}{activeSlotCounts.executiveSlots > 0 ? ` • ${activeSlotCounts.executiveSlots} Active` : ''} • Default: 10)
                                    </span>
                                    {!isExecutiveUser ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 font-mono font-bold tracking-wider">
                                            LOCKED (EXEC ONLY)
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-mono font-bold text-slate-400">PRIORITY 1</span>
                                    )}
                                </div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                                    Executive & Admin Slots
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {!isExecutiveUser
                                        ? `Executive & Admin slots are protected. Only Executive accounts can modify this tier (Default: 10 slots • Min: ${getDynamicMinSlot('executiveSlots')}).`
                                        : `Reserved exclusively for Executive and Admin roles. Even if standard slots are exhausted, executive slots remain open (Default: 10 slots • Min: ${getDynamicMinSlot('executiveSlots')}).`}
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('executiveSlots', ((settings.concurrencySlots?.executiveSlots || 10) - 1))}
                                        disabled={!isExecutiveUser || (settings.concurrencySlots?.executiveSlots || 10) <= getDynamicMinSlot('executiveSlots')}
                                        title={!isExecutiveUser ? 'Only Executive accounts can modify Executive slots' : (settings.concurrencySlots?.executiveSlots || 10) <= getDynamicMinSlot('executiveSlots') ? (activeSlotCounts.executiveSlots > 0 ? `Cannot lessen below ${activeSlotCounts.executiveSlots} active users` : 'Minimum 1 slot') : 'Subtract slot'}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={getDynamicMinSlot('executiveSlots')}
                                        max={500}
                                        disabled={!isExecutiveUser}
                                        value={settings.concurrencySlots?.executiveSlots || 10}
                                        onChange={(e) => handleSlotChange('executiveSlots', parseInt(e.target.value, 10))}
                                        className="flex-1 py-2 px-3 text-center text-lg font-black text-pink-600 dark:text-pink-400 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-xl border border-white/40 dark:border-white/[0.04] focus:outline-none focus:ring-2 focus:ring-pink-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('executiveSlots', ((settings.concurrencySlots?.executiveSlots || 10) + 1))}
                                        disabled={!isExecutiveUser}
                                        title={!isExecutiveUser ? 'Only Executive accounts can modify Executive slots' : 'Add slot'}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                    >
                                        +
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min={getDynamicMinSlot('executiveSlots')}
                                    max={100}
                                    disabled={!isExecutiveUser}
                                    value={settings.concurrencySlots?.executiveSlots || 10}
                                    onChange={(e) => handleSlotChange('executiveSlots', parseInt(e.target.value, 10))}
                                    className="w-full accent-pink-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <div className="text-[10px] text-right text-slate-400">Min: {getDynamicMinSlot('executiveSlots')}{activeSlotCounts.executiveSlots > 0 ? ` (${activeSlotCounts.executiveSlots} Active)` : ''} • Default: 10 • Max: 500</div>
                            </div>
                        </div>

                        {/* Manager Slot Control */}
                        <div className="p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                        Tier 2: Leadership (Min: {getDynamicMinSlot('managerSlots')}{activeSlotCounts.managerSlots > 0 ? ` • ${activeSlotCounts.managerSlots} Active` : ''} • Default: 20)
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">PRIORITY 2</span>
                                </div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                                    Manager Reserved Slots
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Reserved for Managers, Executives, and Admins. Managers can also utilize any surplus employee slots (Default: 20 slots • Min: {getDynamicMinSlot('managerSlots')}).
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('managerSlots', ((settings.concurrencySlots?.managerSlots || 20) - 1))}
                                        disabled={(settings.concurrencySlots?.managerSlots || 20) <= getDynamicMinSlot('managerSlots')}
                                        title={(settings.concurrencySlots?.managerSlots || 20) <= getDynamicMinSlot('managerSlots') ? (activeSlotCounts.managerSlots > 0 ? `Cannot lessen below ${activeSlotCounts.managerSlots} active users` : 'Minimum 1 slot') : 'Subtract slot'}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={getDynamicMinSlot('managerSlots')}
                                        max={500}
                                        value={settings.concurrencySlots?.managerSlots || 20}
                                        onChange={(e) => handleSlotChange('managerSlots', parseInt(e.target.value, 10))}
                                        className="flex-1 py-2 px-3 text-center text-lg font-black text-amber-600 dark:text-amber-400 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-xl border border-white/40 dark:border-white/[0.04] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('managerSlots', ((settings.concurrencySlots?.managerSlots || 20) + 1))}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent cursor-pointer active:scale-95"
                                    >
                                        +
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min={getDynamicMinSlot('managerSlots')}
                                    max={200}
                                    value={settings.concurrencySlots?.managerSlots || 20}
                                    onChange={(e) => handleSlotChange('managerSlots', parseInt(e.target.value, 10))}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                                <div className="text-[10px] text-right text-slate-400">Min: {getDynamicMinSlot('managerSlots')}{activeSlotCounts.managerSlots > 0 ? ` (${activeSlotCounts.managerSlots} Active)` : ''} • Default: 20 • Max: 500</div>
                            </div>
                        </div>

                        {/* Employee Slot Control */}
                        <div className="p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                        Tier 3: Standard Pool (Min: {getDynamicMinSlot('employeeSlots')}{activeSlotCounts.employeeSlots > 0 ? ` • ${activeSlotCounts.employeeSlots} Active` : ''} • Default: 70)
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">GENERAL</span>
                                </div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                                    Employee & Operator Slots
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Standard concurrency allocation. Employees and Operators are strictly constrained to this slot capacity (Default: 70 slots • Min: {getDynamicMinSlot('employeeSlots')}).
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('employeeSlots', ((settings.concurrencySlots?.employeeSlots || 70) - 1))}
                                        disabled={(settings.concurrencySlots?.employeeSlots || 70) <= getDynamicMinSlot('employeeSlots')}
                                        title={(settings.concurrencySlots?.employeeSlots || 70) <= getDynamicMinSlot('employeeSlots') ? (activeSlotCounts.employeeSlots > 0 ? `Cannot lessen below ${activeSlotCounts.employeeSlots} active users` : 'Minimum 1 slot') : 'Subtract slot'}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={getDynamicMinSlot('employeeSlots')}
                                        max={1000}
                                        value={settings.concurrencySlots?.employeeSlots || 70}
                                        onChange={(e) => handleSlotChange('employeeSlots', parseInt(e.target.value, 10))}
                                        className="flex-1 py-2 px-3 text-center text-lg font-black text-blue-600 dark:text-blue-400 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-xl border border-white/40 dark:border-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSlotChange('employeeSlots', ((settings.concurrencySlots?.employeeSlots || 70) + 1))}
                                        className="w-10 h-10 rounded-xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[2px_2px_5px_#cbd6e4,-2px_-2px_5px_#ffffff] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] font-black text-base text-slate-700 dark:text-slate-200 hover:text-accent cursor-pointer active:scale-95"
                                    >
                                        +
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min={getDynamicMinSlot('employeeSlots')}
                                    max={500}
                                    value={settings.concurrencySlots?.employeeSlots || 70}
                                    onChange={(e) => handleSlotChange('employeeSlots', parseInt(e.target.value, 10))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                                <div className="text-[10px] text-right text-slate-400">Min: {getDynamicMinSlot('employeeSlots')}{activeSlotCounts.employeeSlots > 0 ? ` (${activeSlotCounts.employeeSlots} Active)` : ''} • Default: 70 • Max: 1000</div>
                            </div>
                        </div>
                    </div>

                    {/* Cascading Hierarchy & Queue Logic Explanation */}
                    <div className="p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-bricolage">
                                Cascading Slot & Login Queue Logic
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <div className="p-3.5 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-white/40 dark:border-white/[0.04] space-y-1">
                                <span className="font-bold text-purple-600 dark:text-purple-400 block">1. Executive & Admin VIP</span>
                                <p className="text-[11px] leading-relaxed">
                                    Can occupy any open slot (Executive, Manager, or Employee pools) as long as total concurrent capacity is not exceeded.
                                </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-white/40 dark:border-white/[0.04] space-y-1">
                                <span className="font-bold text-amber-600 dark:text-amber-400 block">2. Manager Flexibility</span>
                                <p className="text-[11px] leading-relaxed">
                                    Can occupy Manager slots and overflow into unused Employee slots. Cannot push into unused Executive reserved slots.
                                </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-white/40 dark:border-white/[0.04] space-y-1">
                                <span className="font-bold text-blue-600 dark:text-blue-400 block">3. Login Queue (Overflow)</span>
                                <p className="text-[11px] leading-relaxed">
                                    When the relevant pool is full, user sessions are created with <code className="font-mono text-accent">in_queue = true</code> in the <code className="font-mono text-accent">sessions</code> database table until active users log out.
                                </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5 space-y-1">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">4. Safe Slot Downscaling</span>
                                <p className="text-[11px] leading-relaxed">
                                    Reducing slots (e.g., from 70 to 50) <strong>never forcefully disconnects</strong> currently active users. The new ceiling reflects on new logins once active sessions naturally drop to ≤ 50.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Policy Summary & Audit */}
            {activeTab === 'audit' && (
                <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-accent" />
                                Inactivity Timeout
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-bricolage">
                                {settings.inactivity.enabled ? formatDuration(settings.inactivity.timeoutSeconds) : 'Disabled'}
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                Warning countdown at {settings.inactivity.warningSeconds}s
                            </span>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-accent" />
                                Concurrency Slots
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-bricolage">
                                {(() => {
                                    const s = settings.concurrencySlots || DEFAULT_CONCURRENCY_SLOTS;
                                    return (s.executiveSlots || 10) + (s.managerSlots || 20) + (s.employeeSlots || 70);
                                })()} Slots
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                {settings.concurrencySlots?.executiveSlots || 10} Exec • {settings.concurrencySlots?.managerSlots || 20} Mgr • {settings.concurrencySlots?.employeeSlots || 70} Emp
                            </span>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-accent" />
                                Employee Modules
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-bricolage">
                                {Object.values(settings.pagePermissions).filter((roles: UserRole[]) => roles?.includes('Employee')).length} Modules
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                Accessible by Employee role
                            </span>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                Enforcement
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-bricolage">
                                Real-Time Guard
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                Broadcast across all browser tabs
                            </span>
                        </div>
                    </div>

                    {/* Role Landing Redirection Summary */}
                    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-3.5">
                        <div className="flex items-center gap-2">
                            <Compass className="h-4 w-4 text-accent" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-bricolage">
                                Active Role Post-Login Redirection Landing Routes
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
                            {ALL_ROLES.map(role => {
                                const target = (settings.roleRedirects && settings.roleRedirects[role]) || DEFAULT_PAGE_PERMISSIONS[0].route;
                                const isAllowed = settingsService.canAccessPage(role, target);
                                return (
                                    <div
                                        key={role}
                                        className="p-3 rounded-2xl bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_4px_#cbd6e4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/40 dark:border-white/[0.06] text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="text-slate-900 dark:text-white">{role}</span>
                                            {isAllowed ? (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">OK</span>
                                            ) : (
                                                <span className="text-[10px] text-amber-500 font-mono font-bold">FALLBACK</span>
                                            )}
                                        </div>
                                        <code className="text-[11px] text-accent font-mono block truncate font-semibold">
                                            {target}
                                        </code>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#EEF2F6] dark:bg-[#161A23] shadow-[5px_5px_12px_#d1dbe7,-5px_-5px_12px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6),-3px_-3px_10px_rgba(255,255,255,0.03)] border border-white/80 dark:border-white/[0.08] space-y-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div>• Last Modified: <strong className="text-slate-900 dark:text-white">{new Date(settings.updatedAt).toLocaleString()}</strong></div>
                        <div>• Author: <strong className="text-slate-900 dark:text-white">{settings.updatedBy || 'Administrator'}</strong></div>
                        <div>• Cache Status: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Synchronized in Memory & Supabase Database</strong></div>
                    </div>
                </div>
            )}
        </div>
    );
}
