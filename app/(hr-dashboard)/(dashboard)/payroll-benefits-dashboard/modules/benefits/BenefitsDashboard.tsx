'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, HeartPulse, Home, Settings2 } from 'lucide-react';
import SSSBracketManager from './SSSBracketManager';
import PhilHealthRateManager from './PhilHealthRateManager';
import PagIbigTierManager from './PagIbigTierManager';
import { Card } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Dropdown } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Dropdown';

type TabKey = 'sss' | 'philhealth' | 'pagibig';

const TABS: { value: TabKey; label: string; icon: React.ComponentType<{ className?: string; size?: number; title?: string }> }[] = [
    { value: 'sss', label: 'SSS Brackets', icon: Building2 },
    { value: 'philhealth', label: 'PhilHealth Rates', icon: HeartPulse },
    { value: 'pagibig', label: 'Pag-IBIG Tiers', icon: Home },
];

const TAB_COLORS: Record<TabKey, string> = {
    sss: 'text-sss border-sss bg-sss-soft',
    philhealth: 'text-philhealth border-philhealth bg-philhealth-soft',
    pagibig: 'text-pagibig border-pagibig bg-pagibig-soft',
};

export default function BenefitsDashboard() {
    const [activeTab, setActiveTab] = useState<TabKey>('sss');

    const dropdownItems = TABS.map((tab) => ({
        label: tab.label,
        value: tab.value,
        icon: <tab.icon className="h-4 w-4" />,
    }));

    return (
        <div className="bg-background transition-colors duration-300">
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-2 transition-colors duration-300">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink/5">
                            <Settings2 className="h-3.5 w-3.5 text-muted" />
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Statutory
                            </p>
                            <span className="text-muted/30">|</span>
                            <h1 className="text-sm font-semibold font-bricolage text-ink tracking-tight">
                                Benefits
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted font-rethink bg-ink/[0.03] px-2.5 py-1 rounded-full border border-line w-fit">
                        <span>SSS</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-muted/30" />
                        <span>PhilHealth</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-muted/30" />
                        <span>Pag-IBIG</span>
                    </div>
                </div>

                <div>
                    <div className="hidden sm:flex items-center gap-1 border-b border-line transition-colors duration-300">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.value;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.value}
                                    onClick={() => setActiveTab(tab.value)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium font-rethink transition-all duration-200 whitespace-nowrap border-b-2 ${isActive
                                        ? `${TAB_COLORS[tab.value]} border-current`
                                        : 'border-transparent text-muted hover:text-ink hover:border-line'
                                        }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="sm:hidden">
                        <Dropdown
                            items={dropdownItems}
                            value={activeTab}
                            onChange={(value) => setActiveTab(value as TabKey)}
                            placeholder="Select module"
                            buttonClassName={`${TAB_COLORS[activeTab]} border-0 rounded-lg px-3 py-2 text-sm font-medium w-full`}
                            menuClassName="rounded-lg border border-line shadow-lg"
                        />
                    </div>

                    <Card
                        variant="default"
                        padding="md"
                        className="bg-paper rounded-b-xl rounded-tr-xl border border-t-0 border-line shadow-sm transition-colors duration-300"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -2 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                            >
                                {activeTab === 'sss' && <SSSBracketManager />}
                                {activeTab === 'philhealth' && <PhilHealthRateManager />}
                                {activeTab === 'pagibig' && <PagIbigTierManager />}
                            </motion.div>
                        </AnimatePresence>
                    </Card>
                </div>
            </div>
        </div>
    );
}