'use client';

import React from 'react';
import { BlockedDevice, Appeal, UserActivity } from '../../types';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';

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
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-900/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg sm:text-xl shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] shrink-0 mt-0.5">
                    <i className="fas fa-shield-halved" />
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
                            <StatusBadge tone="rose" dot size="xs">
                                <strong>{blockedCount}</strong> blocked device(s)
                            </StatusBadge>
                        )}

                        {/* Pending Appeals Badge */}
                        {pendingAppealsCount > 0 && (
                            <StatusBadge tone="amber" dot size="xs">
                                <strong>{pendingAppealsCount}</strong> pending appeal(s)
                            </StatusBadge>
                        )}

                        {/* Total Activities Badge */}
                        <StatusBadge tone="pink" icon={<i className="fas fa-chart-line text-[10px]" />} size="xs">
                            <strong>{activities.length}</strong> total activities
                        </StatusBadge>
                    </div>
                </div>
            </div>
        </div>
    );
};
