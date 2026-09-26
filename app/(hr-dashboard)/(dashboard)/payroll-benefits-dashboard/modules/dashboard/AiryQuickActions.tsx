'use client';

import { Bot, FileSearch, Receipt, Search, TrendingUp } from 'lucide-react';

interface Props {
    onOpen: () => void;
}

const ACTIONS = [
    {
        icon: TrendingUp,
        label: 'Explain last payslip',
        hint: 'Ask Airy to break down deductions',
    },
    {
        icon: FileSearch,
        label: 'Flag anomalies',
        hint: 'Scan current data for outliers',
    },
    {
        icon: Search,
        label: 'Find an employee',
        hint: 'Search by name or ID',
    },
    {
        icon: Receipt,
        label: 'Verify a receipt',
        hint: 'Upload and check a claim',
    },
];

export function AiryQuickActions({ onOpen }: Props) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-accent bg-paper px-5 py-5 dark:border-paper/10">
            <Bot
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-accent opacity-[0.06]"
            />
            <div className="relative flex items-center gap-2">
                <Bot size={13} className="text-accent" />
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Ask Airy
                </p>
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-2">
                {ACTIONS.map(({ icon: Icon, label, hint }) => (
                    <button
                        key={label}
                        type="button"
                        onClick={onOpen}
                        className="group flex flex-col items-start gap-1.5 rounded-xl border border-line bg-paper px-3 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.04] dark:border-paper/10"
                    >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition-colors group-hover:border-accent group-hover:text-accent dark:border-paper/15">
                            <Icon size={13} strokeWidth={1.75} />
                        </span>
                        <span className="text-[11.5px] font-medium text-ink leading-tight">
                            {label}
                        </span>
                        <span className="text-[10px] text-muted leading-tight">{hint}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default AiryQuickActions;