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
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-inner max-w-full overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${isActive
                            ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5 dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700/80'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40'
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
