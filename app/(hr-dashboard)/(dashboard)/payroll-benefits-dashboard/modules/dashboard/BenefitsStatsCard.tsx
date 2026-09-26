'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, HeartPulse, PiggyBank, Receipt } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

function pickArray(resp: any): any[] {
    if (!resp) return [];
    if (Array.isArray(resp)) return resp;
    for (const k of ['rows', 'data', 'items', 'brackets', 'rates', 'tiers', 'results']) {
        if (Array.isArray(resp[k])) return resp[k];
    }
    return [];
}

function pickNum(obj: any, ...keys: string[]): number {
    if (!obj) return 0;
    for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v);
            if (!Number.isNaN(n)) return n;
        }
    }
    return 0;
}

interface MiniStat {
    label: string;
    value: string;
    hint: string;
    bar: string;
    tint: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

export function BenefitsStatsCard() {
    const [stats, setStats] = useState<MiniStat[]>([]);
    const [loading, setLoading] = useState(true);

    const { fetchData: fetchSSS } = useApi('/payroll-benefits-dashboard/api/benefits/sss');
    const { fetchData: fetchPhilhealth } = useApi('/payroll-benefits-dashboard/api/benefits/philhealth');
    const { fetchData: fetchPagibig } = useApi('/payroll-benefits-dashboard/api/benefits/pagibig');
    const { fetchData: fetchClaims } = useApi('/payroll-benefits-dashboard/api/claims/summary');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [sssRaw, phRaw, piRaw, claimsRaw] = await Promise.all([
                    fetchSSS().catch(() => null),
                    fetchPhilhealth().catch(() => null),
                    fetchPagibig().catch(() => null),
                    fetchClaims().catch(() => null),
                ]);
                if (cancelled) return;

                const sss = pickArray(sssRaw);
                const ph = pickArray(phRaw);
                const pi = pickArray(piRaw);

                const sssActive = sss.filter((r) => r.is_active !== false).length || sss.length;
                const phActive = ph.filter((r) => r.is_active !== false).length || ph.length;
                const piActive = pi.filter((r) => r.is_active !== false).length || pi.length;

                const phRate = ph.length ? pickNum(ph[0], 'employee_rate', 'employeeRate') * 100 : 0;

                let pendingClaims = pickNum(
                    claimsRaw,
                    'pending',
                    'pending_count',
                    'pendingCount',
                    'total_pending',
                    'totalPending'
                );
                let pendingTotal = pickNum(
                    claimsRaw,
                    'pending_total',
                    'pendingTotal',
                    'total_pending_amount',
                    'totalPendingAmount'
                );

                if (pendingClaims === 0) {
                    const arr = pickArray(claimsRaw);
                    arr.forEach((c: any) => {
                        if ((c.status ?? '').toLowerCase() === 'pending') {
                            pendingClaims++;
                            pendingTotal += Number(c.amount || 0);
                        }
                    });
                }

                const peso = (n: number) =>
                    `₱${Number(n || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}`;

                setStats([
                    {
                        label: 'SSS brackets',
                        value: String(sssActive),
                        hint: sssActive === 1 ? '1 active bracket' : `${sssActive} active brackets`,
                        bar: 'border-l-blue-500',
                        tint: 'text-blue-500',
                        icon: ShieldCheck,
                    },
                    {
                        label: 'PhilHealth rates',
                        value: String(phActive),
                        hint: phRate > 0 ? `Employee share ${phRate.toFixed(2)}%` : 'Active schedule',
                        bar: 'border-l-emerald-500',
                        tint: 'text-emerald-500',
                        icon: HeartPulse,
                    },
                    {
                        label: 'Pag-IBIG tiers',
                        value: String(piActive),
                        hint: piActive === 1 ? '1 active tier' : `${piActive} active tiers`,
                        bar: 'border-l-amber-500',
                        tint: 'text-amber-500',
                        icon: PiggyBank,
                    },
                    {
                        label: 'Pending claims',
                        value: String(pendingClaims),
                        hint: `${peso(pendingTotal)} total`,
                        bar: 'border-l-rose-500',
                        tint: 'text-rose-500',
                        icon: Receipt,
                    },
                ]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchSSS, fetchPhilhealth, fetchPagibig, fetchClaims]);

    return (
        <div className="w-full rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Statutory benefits &amp; claims
            </p>

            {loading ? (
                <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                </div>
            ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {stats.map((s) => {
                        const Icon = s.icon;
                        return (
                            <div
                                key={s.label}
                                className={`relative overflow-hidden rounded-xl border border-line border-l-4 bg-paper px-4 py-3.5 dark:border-paper/10 ${s.bar}`}
                            >
                                <Icon
                                    size={64}
                                    className={`pointer-events-none absolute -bottom-3 -right-3 opacity-[0.06] ${s.tint}`}
                                />
                                <p className="relative text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                    {s.label}
                                </p>
                                <p className="relative mt-1.5 font-bricolage text-[20px] font-semibold leading-none tracking-tight text-ink">
                                    {s.value}
                                </p>
                                <p className="relative mt-1 text-[11px] text-muted truncate">{s.hint}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}