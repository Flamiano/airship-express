'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, HeartPulse, Home, Settings2 } from 'lucide-react';
import { SSSBracketManager, PhilHealthRateManager, PagIbigTierManager } from './index';
import { Card } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Dropdown } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Dropdown';

export default function BenefitsDashboard() {
    const [activeTab, setActiveTab] = useState('sss');

    const tabs = [
        { id: 'sss', label: 'SSS Brackets', icon: Building2, component: <SSSBracketManager /> },
        { id: 'philhealth', label: 'PhilHealth Rates', icon: HeartPulse, component: <PhilHealthRateManager /> },
        { id: 'pagibig', label: 'Pag-IBIG Tiers', icon: Home, component: <PagIbigTierManager /> },
    ];

    const currentTab = tabs.find(t => t.id === activeTab);

    const dropdownItems = tabs.map(tab => ({
        label: tab.label,
        value: tab.id,
        icon: <tab.icon className="h-4 w-4" />,
    }));

    const tabColors: Record<string, string> = {
        sss: 'text-sss border-sss bg-sss-soft',
        philhealth: 'text-philhealth border-philhealth bg-philhealth-soft',
        pagibig: 'text-pagibig border-pagibig bg-pagibig-soft',
    };

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
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium font-rethink transition-all duration-200 whitespace-nowrap border-b-2 ${isActive ? `${tabColors[tab.id]} border-current` : 'border-transparent text-muted hover:text-ink hover:border-line'
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
                            onChange={(value) => setActiveTab(value)}
                            placeholder="Select module"
                            buttonClassName={`${tabColors[activeTab]} border-0 rounded-lg px-3 py-2 text-sm font-medium w-full`}
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
                                {currentTab?.component}
                            </motion.div>
                        </AnimatePresence>
                    </Card>
                </div>
            </div>
        </div>
    );
}