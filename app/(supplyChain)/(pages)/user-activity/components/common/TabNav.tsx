'use client';

import React from 'react';
import { ActivityTab } from '../../types';

interface TabNavProps {
    activeTab: ActivityTab;
    onTabChange: (tab: ActivityTab) => void;
    sessionsCount: number;
    blockedCount: number;
    appealsCount: number;
    activitiesCount: number;
}

export const TabNav: React.FC<TabNavProps> = ({
    activeTab,
    onTabChange,
    sessionsCount,
    blockedCount,
    appealsCount,
    activitiesCount,
}) => {
    const tabs: { id: ActivityTab; label: string; icon: string; count: number }[] = [
        { id: 'sessions', label: 'Sessions', icon: 'fa-laptop', count: sessionsCount },
        { id: 'blocked', label: 'Blocked', icon: 'fa-ban', count: blockedCount },
        { id: 'appeals', label: 'Appeals', icon: 'fa-message', count: appealsCount },
        { id: 'activity', label: 'Activity Log', icon: 'fa-clock-rotate-left', count: activitiesCount },
    ];

    return (
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-full border border-slate-200/90 dark:border-slate-800 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] max-w-full overflow-x-auto no-scrollbar w-fit">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${isActive
                            ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        <i
                            className={`fas ${tab.icon} text-xs transition-colors ${isActive ? 'text-pink-500 dark:text-pink-400' : 'text-slate-400 dark:text-slate-500'
                                }`}
                        ></i>
                        <span>{tab.label}</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${isActive
                                ? 'bg-pink-500 text-white shadow-2xs'
                                : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                        >
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
