'use client';

import { Calendar as CalendarIcon } from 'lucide-react';

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

export function PayrollCalendar() {
    const today = new Date();
    const weeks = buildCalendar(today.getFullYear(), today.getMonth());
    const monthLabel = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });

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
                    const isToday = day === today.getDate();
                    return (
                        <span
                            key={i}
                            className={`mx-auto flex h-7 w-7 items-center justify-center text-[12px] ${day === null
                                    ? ''
                                    : isToday
                                        ? 'rounded-full bg-accent font-medium text-paper'
                                        : 'text-ink'
                                }`}
                        >
                            {day ?? ''}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}