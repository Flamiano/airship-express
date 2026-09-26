'use client';

import { useEffect, useState } from 'react';
import {
    Loader2,
    Shield,
    Mail,
    Wallet,
    Receipt,
    TrendingUp,
    Bell,
    Volume2,
    Sparkles,
} from 'lucide-react';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';

type Prefs = {
    admin_id: string;
    security_alerts: boolean;
    email_payslip_distribution: boolean;
    email_budget_alerts: boolean;
    email_claim_approvals: boolean;
    email_payroll_run_updates: boolean;
    email_merit_bonus: boolean;
    in_app_bell: boolean;
    in_app_toast: boolean;
    in_app_sound: boolean;
    daily_briefing: boolean;
};

type BooleanKey = keyof Omit<Prefs, 'admin_id'>;

const SECTIONS: Array<{
    title: string;
    subtitle: string;
    rows: Array<{
        key: BooleanKey;
        icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
        title: string;
        description: string;
    }>;
}> = [
        {
            title: 'Security',
            subtitle: 'Alerts about access and account activity.',
            rows: [
                {
                    key: 'security_alerts',
                    icon: Shield,
                    title: 'Suspicious activity alerts',
                    description:
                        'Email me when a restricted request is made on my account.',
                },
            ],
        },
        {
            title: 'Email notifications',
            subtitle: 'Sent to your admin email. Never contains salary figures.',
            rows: [
                {
                    key: 'email_payslip_distribution',
                    icon: Mail,
                    title: 'Payslip distribution reports',
                    description:
                        'Summary after a payslip batch finishes sending.',
                },
                {
                    key: 'email_payroll_run_updates',
                    icon: Wallet,
                    title: 'Payroll run status changes',
                    description:
                        'When a run is submitted, approved, rejected, or distributed.',
                },
                {
                    key: 'email_claim_approvals',
                    icon: Receipt,
                    title: 'Claim approvals and overrides',
                    description:
                        'When a claim with an AI verdict override is submitted.',
                },
                {
                    key: 'email_budget_alerts',
                    icon: TrendingUp,
                    title: 'Budget threshold alerts',
                    description:
                        'When a compensation budget crosses 80% or 100% utilization.',
                },
                {
                    key: 'email_merit_bonus',
                    icon: Sparkles,
                    title: 'Merit and bonus approvals',
                    description:
                        'When merit plans or bonus allocations need your signature.',
                },
            ],
        },
        {
            title: 'In-app',
            subtitle: 'How the bell and toasts behave inside the dashboard.',
            rows: [
                {
                    key: 'in_app_bell',
                    icon: Bell,
                    title: 'Show bell badge',
                    description:
                        'Display unread count in the top navigation bar.',
                },
                {
                    key: 'in_app_toast',
                    icon: Bell,
                    title: 'Show toast popups',
                    description:
                        'Popup notifications when events happen while you are active.',
                },
                {
                    key: 'in_app_sound',
                    icon: Volume2,
                    title: 'Play sound',
                    description:
                        'Play a soft sound for security events and approvals.',
                },
            ],
        },
        {
            title: 'Briefings',
            subtitle: 'Scheduled summaries.',
            rows: [
                {
                    key: 'daily_briefing',
                    icon: Sparkles,
                    title: 'Daily morning briefing',
                    description:
                        'Receive Airy’s payroll briefing at the start of each day.',
                },
            ],
        },
    ];

async function authedFetch(
    supabase: ReturnType<typeof createClient>,
    input: string,
    init: RequestInit = {}
) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(input, { ...init, headers });
}

export default function NotificationsPanel() {
    const supabase = createClient();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<BooleanKey | null>(null);
    const [prefs, setPrefs] = useState<Prefs | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authedFetch(
                    supabase,
                    '/payroll-benefits-dashboard/api/settings/notification-prefs'
                );
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to load preferences.');
                }
                if (!cancelled) setPrefs(data.prefs as Prefs);
            } catch (err: any) {
                toast.showError(err?.message || 'Failed to load preferences.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase, toast]);

    const toggle = async (key: BooleanKey, next: boolean) => {
        if (!prefs) return;

        const previous = prefs[key];
        setPrefs({ ...prefs, [key]: next });
        setSaving(key);

        try {
            const res = await authedFetch(
                supabase,
                '/payroll-benefits-dashboard/api/settings/notification-prefs',
                {
                    method: 'PATCH',
                    body: JSON.stringify({ [key]: next }),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to save preference.');
            }
            setPrefs(data.prefs as Prefs);
            toast.showSuccess('Preference saved.');
        } catch (err: any) {
            setPrefs({ ...prefs, [key]: previous });
            toast.showError(err?.message || 'Failed to save preference.');
        } finally {
            setSaving(null);
        }
    };

    if (loading || !prefs) {
        return (
            <div className="flex items-center justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Notifications
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Choose what reaches you and how. Changes save automatically.
                </p>
            </header>

            <div className="space-y-6">
                {SECTIONS.map((section) => (
                    <section key={section.title}>
                        <div className="mb-2 px-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                {section.title}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-muted font-rethink">
                                {section.subtitle}
                            </p>
                        </div>
                        <div className="space-y-2">
                            {section.rows.map((row) => (
                                <Row
                                    key={row.key}
                                    icon={row.icon}
                                    title={row.title}
                                    description={row.description}
                                    checked={prefs[row.key]}
                                    disabled={saving === row.key}
                                    onChange={(v) => toggle(row.key, v)}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function Row({
    icon: Icon,
    title,
    description,
    checked,
    disabled,
    onChange,
}: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-paper p-4 dark:border-line/40">
            <div className="flex items-start gap-3 min-w-0">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink font-rethink">
                        {title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted font-rethink">
                        {description}
                    </p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-accent' : 'bg-ink/20 dark:bg-paper/20'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                />
            </button>
        </div>
    );
}