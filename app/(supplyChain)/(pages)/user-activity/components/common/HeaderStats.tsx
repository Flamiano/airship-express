'use client';

import React from 'react';
import { BlockedDevice, Appeal, UserActivity } from '../../types';

interface HeaderStatsProps {
    blockedDevices: BlockedDevice[];
    appeals: Appeal[];
    activities: UserActivity[];
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
    blockedDevices,
    appeals,
    activities,
}) => {
    const blockedCount = blockedDevices.filter(d => d.status === 'blocked').length;
    const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;

    return (
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
            <div className="flex items-start gap-4 min-w-0">
                {/* Main Icon Box */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-pink-500/10 dark:bg-pink-950/40 border border-pink-500/20 dark:border-pink-900/40 text-pink-500 dark:text-pink-400 flex items-center justify-center text-lg sm:text-xl shadow-xs shrink-0 mt-0.5">
                    <i className="fas fa-shield-halved"></i>
                </div>

                {/* Text Content & Stat Badges */}
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Device Management
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Monitor all sessions, manage blocked devices, view appeals, and user activity
                    </p>

                    {/* Quick Stats / Indicators */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        {/* Blocked Devices Badge */}
                        {blockedCount > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/40 text-[11px] sm:text-xs text-red-700 dark:text-red-300 font-medium shadow-2xs">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 dark:bg-red-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 dark:bg-red-400"></span>
                                </span>
                                <span>
                                    <strong className="font-semibold">{blockedCount}</strong> blocked device(s)
                                </span>
                            </div>
                        )}

                        {/* Pending Appeals Badge */}
                        {pendingAppealsCount > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 font-medium shadow-2xs">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 dark:bg-amber-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 dark:bg-amber-400"></span>
                                </span>
                                <span>
                                    <strong className="font-semibold">{pendingAppealsCount}</strong> pending appeal(s)
                                </span>
                            </div>
                        )}

                        {/* Total Activities Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-900/40 text-[11px] sm:text-xs text-pink-700 dark:text-pink-300 font-medium shadow-2xs">
                            <i className="fas fa-chart-line text-[10px] text-pink-500 dark:text-pink-400"></i>
                            <span>
                                <strong className="font-semibold">{activities.length}</strong> total activities
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
