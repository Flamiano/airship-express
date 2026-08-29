'use client';

import React from 'react';
import { Search, Filter, Trash2, Loader2, Inbox } from 'lucide-react';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableRowsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { UserActivity } from '../../types';
import { formatDate } from '../../utils/formatters';

interface ActivityLogTabProps {
    activities: UserActivity[];
    isLoading: boolean;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    filter: string;
    onFilterChange: (filter: string) => void;
    uniqueActions: string[];
    selectedActivities: Set<number>;
    onToggleSelectActivity: (id: number) => void;
    onSelectAllActivities: () => void;
    onBulkDelete: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({
    activities,
    isLoading,
    searchTerm,
    onSearchTermChange,
    filter,
    onFilterChange,
    uniqueActions,
    selectedActivities,
    onToggleSelectActivity,
    onSelectAllActivities,
    onBulkDelete,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const allActivitiesSelected = activities.length > 0 && selectedActivities.size === activities.length;
    const someActivitiesSelected = selectedActivities.size > 0 && selectedActivities.size < activities.length;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-2xl dark:shadow-black/60 overflow-hidden">
            {/* Controls Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search activity by user, action, module, or IP..."
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <select
                            value={filter}
                            onChange={(e) => onFilterChange(e.target.value)}
                            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 outline-none min-w-[150px] transition-all cursor-pointer text-slate-700 dark:text-slate-200 shadow-2xs"
                        >
                            <option value="all" className="dark:bg-slate-900">All Actions</option>
                            {uniqueActions.map((action) => (
                                <option key={action} value={action} className="dark:bg-slate-900">
                                    {action}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedActivities.size > 0 && (
                <div className="p-3 bg-pink-50/60 dark:bg-pink-950/30 border-b border-pink-100 dark:border-pink-900/40 flex items-center justify-between flex-wrap gap-2 transition-all animate-in fade-in duration-150">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        <strong className="text-pink-600 dark:text-pink-400">{selectedActivities.size}</strong> activity(ies) selected
                    </span>
                    <AppButton
                        type="button"
                        variant="danger"
                        size="xs"
                        onClick={onBulkDelete}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected</span>
                    </AppButton>
                </div>
            )}

            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-3 px-4 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allActivitiesSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someActivitiesSelected;
                                        }
                                    }}
                                    onChange={onSelectAllActivities}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                />
                            </th>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Action</th>
                            <th className="py-3 px-4">Module</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4">IP Address</th>
                            <th className="py-3 px-4">Timestamp</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {isLoading ? (
                            <TableRowsSkeleton
                                rows={6}
                                columns={[
                                    { type: 'checkbox', width: 'w-10' },
                                    { type: 'avatar-text', subtext: false },
                                    { type: 'badge' },
                                    { type: 'badge' },
                                    { type: 'text', width: 'w-64' },
                                    { type: 'mono', width: 'w-28' },
                                    { type: 'date' },
                                ]}
                            />
                        ) : activities.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                                        <span className="font-medium">No activity log found</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            activities.map((activity, idx) => {
                                const isSelected = selectedActivities.has(activity.id);
                                const key = activity.id ?? `activity-${idx}`;

                                const isSuccess =
                                    activity.action?.includes('LOGIN') || activity.action?.includes('VERIFIED');
                                const isDanger =
                                    activity.action?.includes('FAILED') ||
                                    activity.action?.includes('ERROR') ||
                                    activity.action?.includes('BLOCKED');

                                const actionTone = isSuccess ? 'emerald' : isDanger ? 'rose' : 'pink';

                                return (
                                    <tr
                                        key={key}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                            }`}
                                    >
                                        <td className="py-3 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleSelectActivity(activity.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500"
                                            />
                                        </td>

                                        <td className="py-3 px-4">
                                            <div>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                                                    {activity.users?.display_name || 'Unknown'}
                                                </span>
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    {activity.users?.email || 'No email'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-4">
                                            <StatusBadge tone={actionTone} size="xs">
                                                {activity.action}
                                            </StatusBadge>
                                        </td>

                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                                            {activity.module || 'General'}
                                        </td>

                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[250px]">
                                            <span className="truncate block" title={activity.description}>
                                                {activity.description || 'No details'}
                                            </span>
                                        </td>

                                        <td className="py-3 px-4">
                                            <StatusBadge tone="neutral" size="xs">
                                                <span className="font-mono">{activity.ip_address || 'Unknown'}</span>
                                            </StatusBadge>
                                        </td>

                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(activity.created_at)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table Footer / Pagination */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {activities.length} activities
                </span>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};
