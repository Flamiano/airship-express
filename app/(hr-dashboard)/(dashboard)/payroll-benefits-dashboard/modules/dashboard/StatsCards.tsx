'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    Wallet,
    ClipboardList,
    Receipt,
    Briefcase,
    UserCheck,
    TrendingUp,
    Activity,
} from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface Stat {
    label: string;
    value: string;
    hint: string;
    bar: string;
    tint: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const pesoShort = (n: number) => {
    const v = Number(n || 0);
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}K`;
    return `₱${v.toFixed(2)}`;
};

function pickNum(obj: any, ...keys: string[]): number {
    if (!obj) return 0;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v);
            if (!Number.isNaN(n)) return n;
        }
    }
    return 0;
}

export function StatsCards() {
    const [stats, setStats] = useState<Stat[]>([]);
    const [loading, setLoading] = useState(true);

    const { fetchData: fetchSummary } = useApi(
        '/payroll-benefits-dashboard/api/payroll/summary'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const d = (await fetchSummary().catch(() => null)) ?? {};
                if (cancelled) return;

                const activeEmp = pickNum(d, 'active_employees', 'activeEmployees', 'headcount');
                const positions = pickNum(d, 'total_jobs', 'totalJobs', 'total_positions');
                const openPos = pickNum(d, 'open_for_hiring', 'openForHiring', 'open_positions');
                const openRuns = pickNum(d, 'open_runs', 'openRuns');
                const lastNet = pickNum(d, 'last_run_net_pay', 'lastRunNetPay');
                const ytdNet = pickNum(d, 'ytd_net_pay', 'ytdNetPay');
                const ytdGross = pickNum(d, 'ytd_gross_pay', 'ytdGrossPay');
                const att = pickNum(d, 'today_attendance', 'todayAttendance');
                const attRate = pickNum(d, 'attendance_rate', 'attendanceRate');
                const pendingClaims = pickNum(d, 'pending_claims_count', 'pendingClaimsCount', 'pending_claims');
                const pendingTotal = pickNum(d, 'pending_claims_total', 'pendingClaimsTotal');

                setStats([
                    {
                        label: 'Active employees',
                        value: String(activeEmp),
                        hint: 'On payroll',
                        bar: 'border-l-accent',
                        tint: 'text-accent',
                        icon: Users,
                    },
                    {
                        label: 'Payroll this cycle',
                        value: pesoShort(lastNet),
                        hint: `${activeEmp} employees`,
                        bar: 'border-l-accent-dark',
                        tint: 'text-accent-dark',
                        icon: Wallet,
                    },
                    {
                        label: 'Open payroll runs',
                        value: String(openRuns),
                        hint: 'Draft or in progress',
                        bar: 'border-l-indigo-500',
                        tint: 'text-indigo-500',
                        icon: ClipboardList,
                    },
                    {
                        label: 'Pending claims',
                        value: String(pendingClaims),
                        hint: `${pesoShort(pendingTotal)} total`,
                        bar: 'border-l-rose-500',
                        tint: 'text-rose-500',
                        icon: Receipt,
                    },
                    {
                        label: 'Job positions',
                        value: String(positions),
                        hint: `${openPos} open for hiring`,
                        bar: 'border-l-blue-500',
                        tint: 'text-blue-500',
                        icon: Briefcase,
                    },
                    {
                        label: "Today's attendance",
                        value: String(att),
                        hint: `${attRate}% rate`,
                        bar: 'border-l-emerald-500',
                        tint: 'text-emerald-500',
                        icon: UserCheck,
                    },
                    {
                        label: 'YTD gross pay',
                        value: pesoShort(ytdGross),
                        hint: 'Year-to-date gross',
                        bar: 'border-l-purple-500',
                        tint: 'text-purple-500',
                        icon: TrendingUp,
                    },
                    {
                        label: 'YTD net pay',
                        value: pesoShort(ytdNet),
                        hint: 'Year-to-date disbursed',
                        bar: 'border-l-pink-500',
                        tint: 'text-pink-500',
                        icon: Activity,
                    },
                ]);
            } catch {
                if (!cancelled) setStats([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchSummary]);

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } },
    };
    const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

    if (loading || stats.length === 0) {
        const bars = [
            'border-l-accent',
            'border-l-accent-dark',
            'border-l-indigo-500',
            'border-l-rose-500',
            'border-l-blue-500',
            'border-l-emerald-500',
            'border-l-purple-500',
            'border-l-pink-500',
        ];
        return (
            <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                {bars.map((b, i) => (
                    <div
                        key={i}
                        className={`relative h-[88px] animate-pulse overflow-hidden rounded-xl border border-line border-l-4 bg-paper dark:border-paper/10 ${b}`}
                    >
                        <div className="px-4 py-3.5">
                            <div className="h-2.5 w-2/3 rounded bg-ink/10" />
                            <div className="mt-2.5 h-5 w-1/2 rounded bg-ink/10" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4"
        >
            {stats.map((s) => {
                const Icon = s.icon;
                return (
                    <motion.div
                        key={s.label}
                        variants={item}
                        className={`relative overflow-hidden rounded-xl border border-line border-l-4 bg-paper px-4 py-3.5 transition-colors hover:bg-accent/[0.02] dark:border-paper/10 ${s.bar}`}
                    >
                        <Icon
                            size={72}
                            className={`pointer-events-none absolute -bottom-3 -right-3 opacity-[0.06] ${s.tint}`}
                        />
                        <p className="relative text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                            {s.label}
                        </p>
                        <p className="relative mt-1.5 font-bricolage text-[20px] font-semibold leading-none tracking-tight text-ink">
                            {s.value}
                        </p>
                        <p className="relative mt-1 text-[11px] text-muted truncate">{s.hint}</p>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}