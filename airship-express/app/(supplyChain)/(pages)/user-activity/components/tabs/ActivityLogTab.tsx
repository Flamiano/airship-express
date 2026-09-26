'use client';
import React from 'react';
import { Search, Filter, Trash2, Inbox } from 'lucide-react';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
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

const getActionBadgeTone = (action: string) => {
    if (action?.includes('LOGIN') || action?.includes('VERIFIED')) return 'emerald';
    if (action?.includes('FAILED') || action?.includes('ERROR') || action?.includes('BLOCKED') || action?.includes('TIMEOUT') || action?.includes('INACTIVE')) return 'rose';
    if (action?.includes('LOGOUT') || action?.includes('DEACTIVATED')) return 'amber';
    return 'pink';
};

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ activities, isLoading, searchTerm, onSearchTermChange, filter, onFilterChange, uniqueActions, selectedActivities, onToggleSelectActivity, onSelectAllActivities, onBulkDelete, currentPage, totalPages, onPageChange, }) => {
    const allActivitiesSelected = activities.length > 0 && selectedActivities.size === activities.length;
    const someActivitiesSelected = selectedActivities.size > 0 && selectedActivities.size < activities.length;
    return (
        <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* controls header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search activity by user, action, module, or IP..."
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <select
                            value={filter}
                            onChange={(e) => onFilterChange(e.target.value)}
                            className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 sm:min-w-[150px] transition-all cursor-pointer text-slate-700 dark:text-slate-200 shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                        >
                            <option value="all" className="dark:bg-[#1c1d25]">All Actions</option>
                            {uniqueActions.map((action) => (
                                <option key={action} value={action} className="dark:bg-[#1c1d25]">
                                    {action}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* bulk actions banner */}
            {selectedActivities.size > 0 && (
                <div className="p-3 bg-pink-50/60 dark:bg-pink-950/30 border-b border-pink-100 dark:border-pink-900/40 flex items-center justify-between flex-wrap gap-2 transition-all animate-in fade-in duration-150">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        <strong className="text-pink-600 dark:text-pink-400">{selectedActivities.size}</strong> activity(ies) selected
                    </span>
                    <AppButton type="button" variant="danger" size="xs" onClick={onBulkDelete}>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected</span>
                    </AppButton>
                </div>
            )}

            {/* table container */}
            <div className="overflow-x-auto">
                <table className="table-pro w-full text-left border-collapse">
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
                                    { type: 'text', width: 'w-24' },
                                    { type: 'text', width: 'w-48' },
                                    { type: 'mono', width: 'w-28' },
                                    { type: 'date' },
                                ]}
                            />
                        ) : activities.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fa-solid fa-list-check text-2xl text-pink-500 dark:text-pink-400"></i>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No activity logs found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">There is no recorded user activity matching your filters</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            activities.map((activity, index) => {
                                const isSelected = selectedActivities.has(activity.id);
                                const actionTone = getActionBadgeTone(activity.action);
                                const key = activity.id ? `${activity.id}-${index}` : `activity-${index}`;

                                return (
                                    <tr
                                        key={key}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                            isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                        }`}
                                    >
                                        <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-between md:justify-center w-full">
                                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => onToggleSelectActivity(activity.id)}
                                                        aria-label="Select activity"
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                    />
                                                    <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                </label>
                                                <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60">
                                                    {activity.module || 'Activity'}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="User" className="py-3 px-4">
                                            <div className="text-right sm:text-left min-w-0 max-w-[200px] sm:max-w-none ml-auto sm:ml-0">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={activity.users?.display_name || 'Unknown'}>
                                                    {activity.users?.display_name || 'Unknown'}
                                                </span>
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate" title={activity.users?.email || 'No email'}>
                                                    {activity.users?.email || 'No email'}
                                                </span>
                                            </div>
                                        </td>

                                        <td data-label="Action" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                <StatusBadge tone={actionTone} size="xs">
                                                    {activity.action}
                                                </StatusBadge>
                                            </div>
                                        </td>

                                        <td data-label="Module" className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold text-right sm:text-left">
                                            <span className="truncate max-w-[120px] inline-block ml-auto sm:ml-0" title={activity.module || 'General'}>
                                                {activity.module || 'General'}
                                            </span>
                                        </td>

                                        <td data-label="Description" className="py-3 px-4 text-slate-600 dark:text-slate-400 text-right sm:text-left">
                                            <span className="truncate block max-w-[200px] sm:max-w-[250px] ml-auto sm:ml-0" title={activity.description}>
                                                {activity.description || 'No details'}
                                            </span>
                                        </td>

                                        <td data-label="IP Address" className="py-3 px-4">
                                            <div className="flex justify-end sm:justify-start">
                                                <StatusBadge tone="neutral" size="xs">
                                                    <span className="font-mono">{activity.ip_address || 'Unknown'}</span>
                                                </StatusBadge>
                                            </div>
                                        </td>

                                        <td data-label="Timestamp" className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap text-right sm:text-left">
                                            {formatDate(activity.created_at)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* table footer / pagination */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {activities.length} activities
                </span>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
        </div>
    );
};
