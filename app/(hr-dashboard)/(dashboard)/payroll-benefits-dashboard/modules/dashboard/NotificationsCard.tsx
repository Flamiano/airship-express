'use client';

import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    Info,
    Loader2,
    XCircle,
} from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface Notif {
    id: string;
    type: string;
    title: string;
    message: string;
    href: string | null;
    severity: 'info' | 'success' | 'warning' | 'danger';
    is_read: boolean;
    created_at: string;
}

function severityStyle(s: Notif['severity']) {
    switch (s) {
        case 'success':
            return { cls: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 };
        case 'warning':
            return { cls: 'bg-amber-50 text-amber-600', Icon: AlertTriangle };
        case 'danger':
            return { cls: 'bg-rose-50 text-rose-600', Icon: XCircle };
        default:
            return { cls: 'bg-blue-50 text-blue-600', Icon: Info };
    }
}

const fmtRel = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
};

export function NotificationsCard() {
    const [items, setItems] = useState<Notif[]>([]);
    const [loading, setLoading] = useState(true);

    const { fetchData: fetchNotifications } = useApi(
        '/payroll-benefits-dashboard/api/notifications'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchNotifications().catch(() => []);
                if (cancelled) return;
                const list: Notif[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.notifications)
                        ? data.notifications
                        : [];
                const unread = list.filter((n) => !n.is_read).slice(0, 5);
                setItems(unread.length > 0 ? unread : list.slice(0, 5));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchNotifications]);

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-line border-l-4 border-l-accent px-5 py-5 dark:border-paper/10">
            <Bell
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-accent opacity-[0.06]"
            />
            <div className="relative flex items-center gap-2">
                <Bell size={13} className="text-muted" />
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Notifications
                </p>
                {items.length > 0 && (
                    <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        {items.length}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                </div>
            ) : items.length === 0 ? (
                <p className="relative mt-4 text-[12px] text-muted">You&apos;re all caught up.</p>
            ) : (
                <div className="relative mt-4 flex flex-col gap-3">
                    {items.map((n) => {
                        const { cls, Icon } = severityStyle(n.severity);
                        return (
                            <div key={n.id} className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cls}`}>
                                    <Icon size={12} strokeWidth={2} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-medium text-ink truncate">{n.title}</p>
                                    <p className="text-[11px] text-muted line-clamp-2">{n.message}</p>
                                    <p className="mt-0.5 text-[10px] text-muted/70">{fmtRel(n.created_at)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}