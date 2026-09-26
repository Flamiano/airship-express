'use client';

import React from 'react';

interface DateDividerProps {
    dateStr: string;
}

function formatDateLabel(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    });
}

export function isSameDay(a: string, b: string) {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

export const DateDivider: React.FC<DateDividerProps> = ({ dateStr }) => {
    return (
        <div className="my-2 flex items-center justify-center">
            <span className="rounded-full border border-line bg-paper px-3 py-1 text-[10.5px] font-medium text-muted font-rethink dark:border-line/30">
                {formatDateLabel(dateStr)}
            </span>
        </div>
    );
};