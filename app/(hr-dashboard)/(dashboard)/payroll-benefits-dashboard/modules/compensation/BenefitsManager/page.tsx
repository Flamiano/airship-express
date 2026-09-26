'use client';

import React, { useState } from 'react';
import { Gift, Moon, Clock3, Calendar } from 'lucide-react';
import BenefitsTab from './BenefitsTab';
import NightDiffTab from './NightDiffTab';
import OvertimeTab from './OvertimeTab';
import HolidayPayTab from './HolidayPayTab';

type TabKey = 'benefits' | 'nightdiff' | 'overtime' | 'holiday';

const TABS: { value: TabKey; label: string; icon: React.ComponentType<{ className?: string; size?: number; title?: string }> }[] = [
    { value: 'benefits', label: 'Benefits & Incentives', icon: Gift },
    { value: 'nightdiff', label: 'Night Differential', icon: Moon },
    { value: 'overtime', label: 'Overtime', icon: Clock3 },
    { value: 'holiday', label: 'Holiday Pay', icon: Calendar },
];

const BenefitsManager = () => {
    const [tab, setTab] = useState<TabKey>('benefits');

    return (
        <div className="space-y-5">
            <div className="relative">
                <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto scrollbar-thin">
                    {TABS.map((t) => {
                        const active = tab === t.value;
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setTab(t.value)}
                                className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${active
                                        ? 'border-accent text-ink'
                                        : 'border-transparent text-muted hover:text-ink/80'
                                    }`}
                            >
                                <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${active
                                            ? 'bg-accent/10 text-accent'
                                            : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                                        }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span>{t.label}</span>
                                {active && (
                                    <span className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-accent rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="transition-opacity duration-200">
                {tab === 'benefits' && <BenefitsTab />}
                {tab === 'nightdiff' && <NightDiffTab />}
                {tab === 'overtime' && <OvertimeTab />}
                {tab === 'holiday' && <HolidayPayTab />}
            </div>
        </div>
    );
};

export default BenefitsManager;