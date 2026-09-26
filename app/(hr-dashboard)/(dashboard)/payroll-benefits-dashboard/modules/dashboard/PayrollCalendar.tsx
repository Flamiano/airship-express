'use client';

import { Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

function buildCalendar(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

interface DayMarker {
    date: string;
    label: string;
    kind: 'payday' | 'holiday' | 'anniversary' | 'period';
}

interface DayEvents {
    paydays: DayMarker[];
    holidays: DayMarker[];
    anniversaries: DayMarker[];
    periods: DayMarker[];
}

export function PayrollCalendar() {
    const today = new Date();
    const weeks = useMemo(
        () => buildCalendar(today.getFullYear(), today.getMonth()),
        [today]
    );
    const monthLabel = today.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const [events, setEvents] = useState<DayEvents>({
        paydays: [],
        holidays: [],
        anniversaries: [],
        periods: [],
    });

    const { fetchData: fetchCalendar } = useApi(
        '/payroll-benefits-dashboard/api/payroll/calendar-events'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchCalendar().catch(() => null);
                if (cancelled || !data) return;
                setEvents({
                    paydays: Array.isArray(data.paydays) ? data.paydays : [],
                    holidays: Array.isArray(data.holidays) ? data.holidays : [],
                    anniversaries: Array.isArray(data.anniversaries) ? data.anniversaries : [],
                    periods: Array.isArray(data.periods) ? data.periods : [],
                });
            } catch { }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchCalendar]);

    const dayMap = useMemo(() => {
        const m = new Map<
            number,
            { payday?: DayMarker; holiday?: DayMarker; anniversary?: DayMarker; period?: DayMarker }
        >();
        const y = today.getFullYear();
        const mo = today.getMonth();

        const place = (
            list: DayMarker[],
            key: 'payday' | 'holiday' | 'anniversary' | 'period'
        ) => {
            list.forEach((mk) => {
                const d = new Date(mk.date + 'T00:00:00');
                if (d.getFullYear() !== y || d.getMonth() !== mo) return;
                const day = d.getDate();
                const cur = m.get(day) ?? {};
                cur[key] = mk;
                m.set(day, cur);
            });
        };

        place(events.paydays, 'payday');
        place(events.holidays, 'holiday');
        place(events.anniversaries, 'anniversary');
        place(events.periods, 'period');
        return m;
    }, [events, today]);

    return (
        <div className="w-full rounded-2xl border border-line px-5 py-5 dark:border-paper/10">
            <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                <CalendarIcon size={14} strokeWidth={1.75} />
                {monthLabel}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-[11px]">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <span key={i} className="text-muted">
                        {d}
                    </span>
                ))}

                {weeks.flat().map((day, i) => {
                    if (day === null) return <span key={i} className="h-8 w-8" />;

                    const isToday = day === today.getDate();
                    const marks = dayMap.get(day);
                    const hasPayday = !!marks?.payday;
                    const hasHoliday = !!marks?.holiday;
                    const hasAnniversary = !!marks?.anniversary;
                    const hasPeriod = !!marks?.period;
                    const hasAny = hasPayday || hasHoliday || hasAnniversary || hasPeriod;

                    const tooltipParts: string[] = [];
                    if (marks?.payday) tooltipParts.push(`Payday: ${marks.payday.label}`);
                    if (marks?.holiday) tooltipParts.push(`Holiday: ${marks.holiday.label}`);
                    if (marks?.anniversary)
                        tooltipParts.push(`Anniversary: ${marks.anniversary.label}`);
                    if (marks?.period) tooltipParts.push(`Period: ${marks.period.label}`);

                    return (
                        <span
                            key={i}
                            title={tooltipParts.join(' · ') || undefined}
                            className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] transition-colors ${isToday
                                    ? 'bg-accent font-semibold text-paper'
                                    : hasPayday
                                        ? 'border border-emerald-400 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                        : hasHoliday
                                            ? 'border border-rose-300 bg-rose-50 font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                                            : hasAnniversary
                                                ? 'border border-amber-300 bg-amber-50 font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                                : hasPeriod
                                                    ? 'border border-indigo-300 bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                                    : 'text-ink'
                                }`}
                        >
                            {day}
                            {hasAny && !isToday && (
                                <span className="absolute bottom-0.5 flex gap-[1px]">
                                    {hasPayday && <span className="h-1 w-1 rounded-full bg-emerald-500" />}
                                    {hasHoliday && <span className="h-1 w-1 rounded-full bg-rose-500" />}
                                    {hasAnniversary && <span className="h-1 w-1 rounded-full bg-amber-500" />}
                                    {hasPeriod && <span className="h-1 w-1 rounded-full bg-indigo-500" />}
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-[10.5px] dark:border-paper/10">
                <span className="inline-flex items-center gap-1 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Payday
                </span>
                <span className="inline-flex items-center gap-1 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Holiday
                </span>
                <span className="inline-flex items-center gap-1 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Hire anniversary
                </span>
                <span className="inline-flex items-center gap-1 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Payroll period
                </span>
            </div>
        </div>
    );
}