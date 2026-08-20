'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, HeartPulse, Home, Settings2 } from 'lucide-react';
import { SSSBracketManager, PhilHealthRateManager, PagIbigTierManager } from '@/payroll-benefits-dashboard/modules/benefits';
import { Card } from '@/payroll-benefits-dashboard/components/ui/Card';

const tabAccents: Record<
    string,
    {
        text: string;
        bg: string;
        bgSoft: string;
        ring: string;
        dot: string;
        borderL: string;
        border: string;
        icon: React.ComponentType<{ className?: string }>;
        gradient: string;
    }
> = {
    sss: {
        text: 'text-sss',
        bg: 'bg-sss',
        bgSoft: 'bg-sss-soft',
        ring: 'border-sss/30',
        dot: 'bg-sss',
        borderL: 'border-l-sss',
        border: 'border-sss/20',
        icon: Building2,
        gradient: 'from-sss/5 to-transparent',
    },
    philhealth: {
        text: 'text-philhealth',
        bg: 'bg-philhealth',
        bgSoft: 'bg-philhealth-soft',
        ring: 'border-philhealth/30',
        dot: 'bg-philhealth',
        borderL: 'border-l-philhealth',
        border: 'border-philhealth/20',
        icon: HeartPulse,
        gradient: 'from-philhealth/5 to-transparent',
    },
    pagibig: {
        text: 'text-pagibig',
        bg: 'bg-pagibig',
        bgSoft: 'bg-pagibig-soft',
        ring: 'border-pagibig/30',
        dot: 'bg-pagibig',
        borderL: 'border-l-pagibig',
        border: 'border-pagibig/20',
        icon: Home,
        gradient: 'from-pagibig/5 to-transparent',
    },
};

export default function BenefitsDashboard() {
    const [activeTab, setActiveTab] = useState('sss');

    const tabs = [
        { id: 'sss', label: 'SSS Brackets', component: <SSSBracketManager /> },
        { id: 'philhealth', label: 'PhilHealth Rates', component: <PhilHealthRateManager /> },
        { id: 'pagibig', label: 'Pag-IBIG Tiers', component: <PagIbigTierManager /> },
    ];

    const accent = tabAccents[activeTab];

    return (
        <div className="min-h-screen bg-gradient-to-br from-paper via-paper to-ink/[0.02] p-3 sm:p-6 md:p-8">
            <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
                <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-line bg-white/80 backdrop-blur-sm px-4 py-4 sm:px-7 sm:py-7 shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-r from-ink/[0.02] via-transparent to-transparent pointer-events-none" />
                    <div className="relative space-y-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/5 sm:h-8 sm:w-8">
                                    <Settings2 className="h-3.5 w-3.5 text-ink/60 sm:h-4 sm:w-4" />
                                </div>
                                <p className="text-[9.5px] sm:text-[10.5px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-muted font-rethink truncate">
                                    Statutory Contributions
                                </p>
                            </div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-bricolage font-semibold text-ink tracking-tight leading-tight">
                                Government Benefits Configuration
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-muted font-rethink bg-ink/[0.03] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-line/60 w-fit">
                            <span>SSS</span>
                            <span className="w-1 h-1 rounded-full bg-muted/30 shrink-0" />
                            <span>PhilHealth</span>
                            <span className="w-1 h-1 rounded-full bg-muted/30 shrink-0" />
                            <span>Pag-IBIG</span>
                        </div>
                    </div>
                </div>

                <div className="w-full">
                    <div className="flex items-end gap-0.5 border-b border-line/70 px-1 overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => {
                            const a = tabAccents[tab.id];
                            const isActive = activeTab === tab.id;
                            const Icon = a.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-t-xl text-[13px] sm:text-sm font-medium font-rethink transition-all duration-200 whitespace-nowrap shrink-0 ${isActive
                                        ? `${a.bgSoft} ${a.text} border border-b-0 ${a.border} -mb-px shadow-[0_-2px_8px_rgba(0,0,0,0.02)]`
                                        : 'text-muted/70 border border-transparent hover:text-ink hover:bg-ink/[0.03] hover:border-line/40'
                                        }`}
                                >
                                    <Icon
                                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${isActive ? a.text : 'text-muted/50 group-hover:text-ink/70'
                                            }`}
                                    />
                                    <span className="hidden xs:inline">{tab.label}</span>
                                    <span className="xs:hidden">
                                        {tab.id === 'sss' && 'SSS'}
                                        {tab.id === 'philhealth' && 'PhilHealth'}
                                        {tab.id === 'pagibig' && 'Pag-IBIG'}
                                    </span>
                                    {isActive && (
                                        <motion.span
                                            layoutId="benefits-tab-underline"
                                            className={`absolute inset-x-4 -bottom-px h-[2.5px] rounded-full ${a.dot}`}
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <Card
                        variant="default"
                        padding="md"
                        className={`bg-white rounded-b-2xl rounded-tr-2xl border-line/70 border-l-[5px] ${accent.borderL} shadow-sm shadow-ink/[0.02] mt-0.5`}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                {tabs.find((t) => t.id === activeTab)?.component}
                            </motion.div>
                        </AnimatePresence>
                    </Card>
                </div>
            </div>
        </div>
    );
}