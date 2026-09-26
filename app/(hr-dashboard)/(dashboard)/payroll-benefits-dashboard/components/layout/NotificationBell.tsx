'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Bell,
    Loader2,
    Check,
    CheckCheck,
    Shield,
    Wallet,
    Receipt,
    TrendingUp,
    Mail,
    Sparkles,
    AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { useTheme } from '@/app/components/ThemeProvider';

type Notification = {
    id: string;
    type: string;
    title: string;
    message: string;
    href: string | null;
    severity: 'info' | 'success' | 'warning' | 'danger';
    is_read: boolean;
    read_at: string | null;
    created_at: string;
};

const TYPE_ICON: Record<string, React.ElementType> = {
    payroll_run_pending: Wallet,
    payroll_run_approved: Wallet,
    payroll_run_rejected: Wallet,
    payroll_run_distributed: Wallet,
    claim_override: Receipt,
    claim_approved: Receipt,
    budget_warning: TrendingUp,
    budget_exceeded: TrendingUp,
    merit_pending: Sparkles,
    bonus_pending: Sparkles,
    payslip_failed: Mail,
    security_event: Shield,
};

const SEVERITY_TONE: Record<Notification['severity'], string> = {
    info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    danger: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
};

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
    });
}

export default function NotificationBell() {
    const supabase = createClient();
    const router = useRouter();
    const { theme } = useTheme();

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [showBadge, setShowBadge] = useState(true);
    const wrapRef = useRef<HTMLDivElement>(null);

    const load = async () => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            const res = await fetch(
                '/payroll-benefits-dashboard/api/notifications',
                {
                    headers: token
                        ? { Authorization: `Bearer ${token}` }
                        : undefined,
                }
            );
            if (!res.ok) throw new Error('Failed to load notifications');
            const data = await res.json();
            setNotifications(data.notifications ?? []);
            setUnread(data.unread ?? 0);
            setShowBadge(data.showBadge !== false);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const id = setInterval(load, 45_000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const markRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        );
        setUnread((u) => Math.max(0, u - 1));

        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            await fetch('/payroll-benefits-dashboard/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ ids: [id] }),
            });
        } catch {
            load();
        }
    };

    const markAllRead = async () => {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnread(0);

        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            await fetch('/payroll-benefits-dashboard/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ all: true }),
            });
        } catch {
            load();
        }
    };

    const handleClick = (n: Notification) => {
        if (!n.is_read) markRead(n.id);
        setOpen(false);
        if (n.href) router.push(n.href);
    };

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`relative flex h-9 w-9 items-center justify-center transition-colors ${theme === 'dark'
                        ? 'text-[#9a98a3] hover:text-[#f4f3f6]'
                        : 'text-[#6b6b76] hover:text-[#1c1b1f]'
                    }`}
                aria-label="Notifications"
            >
                <Bell size={17} strokeWidth={1.75} />
                {showBadge && unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e5167e] px-1 text-[9px] font-semibold text-[#fcfbf9]">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-11 z-50 w-[360px] overflow-hidden rounded-xl border border-line bg-paper shadow-2xl dark:border-line/40">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-line/40">
                        <div>
                            <p className="text-[13px] font-semibold text-ink font-rethink">
                                Notifications
                            </p>
                            <p className="text-[10.5px] text-muted font-rethink">
                                {unread > 0
                                    ? `${unread} unread`
                                    : 'All caught up'}
                            </p>
                        </div>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10 font-rethink"
                            >
                                <CheckCheck className="h-3 w-3" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-4 w-4 animate-spin text-muted" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <Bell className="mx-auto h-6 w-6 text-muted/50" />
                                <p className="mt-2 text-[12px] text-muted font-rethink">
                                    You have no notifications yet.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-line dark:divide-line/40">
                                {notifications.map((n) => {
                                    const Icon = TYPE_ICON[n.type] ?? Bell;
                                    const tone = SEVERITY_TONE[n.severity];
                                    return (
                                        <li key={n.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleClick(n)}
                                                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04] ${!n.is_read ? 'bg-accent/[0.04]' : ''
                                                    }`}
                                            >
                                                <span
                                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p
                                                            className={`text-[12.5px] leading-tight ${!n.is_read
                                                                    ? 'font-semibold text-ink'
                                                                    : 'font-medium text-ink/80'
                                                                } font-rethink`}
                                                        >
                                                            {n.title}
                                                        </p>
                                                        {!n.is_read && (
                                                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted line-clamp-2 font-rethink">
                                                        {n.message}
                                                    </p>
                                                    <p className="mt-1 text-[10px] text-muted/80 font-rethink">
                                                        {relativeTime(n.created_at)}
                                                    </p>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="border-t border-line px-4 py-2 dark:border-line/40">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    router.push('/payroll-benefits-dashboard/settings?tab=notifications');
                                }}
                                className="w-full text-center text-[11px] font-medium text-accent transition-colors hover:underline font-rethink"
                            >
                                Manage notification preferences
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}