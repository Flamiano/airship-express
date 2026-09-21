'use client';

import React, { useState } from 'react';
import { BarChart3, Gift } from 'lucide-react';
import MeritTab from './MeritTab';
import BonusTab from './BonusTab';

type TabKey = 'merit' | 'bonus';

const TABS: { value: TabKey; label: string; icon: React.ElementType }[] = [
    { value: 'merit', label: 'Merit Increases', icon: BarChart3 },
    { value: 'bonus', label: 'Bonuses', icon: Gift },
];

const PerformanceReviewManager = () => {
    const [tab, setTab] = useState<TabKey>('merit');

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto">
                {TABS.map((t) => {
                    const active = tab === t.value;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => setTab(t.value)}
                            className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink/80'
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
                        </button>
                    );
                })}
            </div>

            {tab === 'merit' && <MeritTab />}
            {tab === 'bonus' && <BonusTab />}
        </div>
    );
};

export default PerformanceReviewManager;