'use client';

import React from 'react';
import { ActivityTab } from '../../types';

interface TabNavProps {
    activeTab: ActivityTab;
    onTabChange: (tab: ActivityTab) => void;
    activeUsersCount: number;
    sessionsCount: number;
    accessControlCount?: number;
    pendingAuthCount?: number;
    blockedCount: number;
    appealsCount: number;
    activitiesCount: number;
    employeeAccountsCount?: number;
}

export const TabNav: React.FC<TabNavProps> = ({
    activeTab,
    onTabChange,
    activeUsersCount,
    sessionsCount,
    accessControlCount = 0,
    pendingAuthCount = 0,
    blockedCount,
    appealsCount,
    activitiesCount,
    employeeAccountsCount = 0,
}) => {
    const tabs: { id: ActivityTab; label: string; icon: string; count: number; badgePulse?: boolean }[] = [
        { id: 'active_users', label: 'Active Users', icon: 'fa-user-check', count: activeUsersCount },
        { id: 'create_account', label: 'Create Account', icon: 'fa-user-plus', count: employeeAccountsCount },
        { id: 'sessions', label: 'Sessions', icon: 'fa-laptop', count: sessionsCount },
        { id: 'access_control', label: 'Access Control', icon: 'fa-user-shield', count: accessControlCount, badgePulse: pendingAuthCount > 0 },
        { id: 'blocked', label: 'Blocked', icon: 'fa-ban', count: blockedCount },
        { id: 'appeals', label: 'Appeals', icon: 'fa-message', count: appealsCount },
        { id: 'activity', label: 'Activity Log', icon: 'fa-clock-rotate-left', count: activitiesCount },
    ];

    return (
        <div className="flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-full overflow-x-auto no-scrollbar w-fit">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${isActive
                            ? 'bg-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[2px_2px_8px_rgba(219,39,119,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] font-bold'
                            : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                            }`}
                    >
                        <i
                            className={`fas ${tab.icon} text-xs transition-colors ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                                }`}
                        ></i>
                        <span>{tab.label}</span>
                        {tab.badgePulse && (
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                        )}
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${isActive
                                ? 'bg-white/20 text-white shadow-2xs'
                                : tab.badgePulse
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
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
