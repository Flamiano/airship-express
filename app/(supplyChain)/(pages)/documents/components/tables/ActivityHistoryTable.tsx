// activity audit history table with filter controls, bulk deletion, and pagination
'use client';

import React from 'react';
import { Activity } from '../../types';
import { getActionIcon } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { Pagination } from "../../../../components/global/pagination";

interface ActivityHistoryTableProps {
    activities: Activity[];
    activitySearch: string;
    onActivitySearchChange: (val: string) => void;
    activityFilter: string;
    onActivityFilterChange: (val: string) => void;
    activityDateFrom: string;
    onActivityDateFromChange: (val: string) => void;
    activityDateTo: string;
    onActivityDateToChange: (val: string) => void;
    onResetFilters: () => void;
    selectedActivityIds: Set<string>;
    onToggleSelectActivity: (id: string) => void;
    onToggleSelectAll: () => void;
    onDeleteSelected: () => void;
    onClearSelection: () => void;
    activityPage: number;
    totalActivities: number;
    activitiesPerPage: number;
    onPageChange: (page: number) => void;
}

export function ActivityHistoryTable({
    activities,
    activitySearch,
    onActivitySearchChange,
    activityFilter,
    onActivityFilterChange,
    activityDateFrom,
    onActivityDateFromChange,
    activityDateTo,
    onActivityDateToChange,
    onResetFilters,
    selectedActivityIds,
    onToggleSelectActivity,
    onToggleSelectAll,
    onDeleteSelected,
    onClearSelection,
    activityPage,
    totalActivities,
    activitiesPerPage,
    onPageChange
}: ActivityHistoryTableProps) {
    return (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col">
            {/* header */}
            <div className="flex-shrink-0 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                            <i className="fas fa-clock-rotate-left text-xs"/>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Activity History</h3>
                    </div>

                    <AppButton
                        type="button"
                        variant="neutral"
                        size="sm"
                        onClick={onResetFilters}
                        title="Reset active filters"
                    >
                        <i className="fas fa-rotate-left text-xs" />
                        <span>Reset Filters</span>
                    </AppButton>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[200px]">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                        <input
                            type="search"
                            value={activitySearch}
                            onChange={(e) => onActivitySearchChange(e.target.value)}
                            placeholder="Search user or document..."
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                        />
                    </div>

                    <select
                        value={activityFilter}
                        onChange={(e) => onActivityFilterChange(e.target.value)}
                        className="bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer"
                    >
                        <option value="">All Actions</option>
                        <option value="upload">Uploads</option>
                        <option value="update">Updates</option>
                        <option value="delete">Deletions</option>
                    </select>

                    <div className="flex items-center gap-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] p-1">
                        <input
                            type="date"
                            value={activityDateFrom}
                            onChange={(e) => onActivityDateFromChange(e.target.value)}
                            className="border-0 bg-transparent px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                            title="Activity Date From"
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase select-none">to</span>
                        <input
                            type="date"
                            value={activityDateTo}
                            onChange={(e) => onActivityDateToChange(e.target.value)}
                            className="border-0 bg-transparent px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                            title="Activity Date To"
                        />
                    </div>
                </div>
            </div>

            {/* bulk actions bar */}
            {selectedActivityIds.size > 0 && (
                <div className="flex-shrink-0 px-4 py-2.5 mb-3 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] rounded-2xl flex items-center justify-between gap-4 flex-wrap animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-pink-500 text-white inline-flex items-center justify-center text-[10px] font-bold shadow-xs">
                            {selectedActivityIds.size}
                        </span>
                        <span>record(s) selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDeleteSelected}
                            className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                            <i className="fas fa-trash-can text-[11px]"></i> Delete Selected
                        </button>
                        <button
                            onClick={onClearSelection}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* scrollable table container */}
            <div className="flex-1 overflow-y-auto max-h-[400px] relative rounded-2xl bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.2)]">
                <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-line">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={activities.length > 0 && selectedActivityIds.size === activities.length}
                            onChange={onToggleSelectAll}
                            className="w-4 h-4 rounded border-line text-accent focus:ring-accent/20 cursor-pointer accent-accent"
                        />
                        <span className="text-xs font-medium text-ink">
                            Select All
                        </span>
                        <span className="text-[10px] text-muted bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-full">
                            {activities.length}
                        </span>
                    </label>
                    {selectedActivityIds.size > 0 && (
                        <span className="text-xs font-medium text-accent bg-accent/15 px-2.5 py-1 rounded-full">
                            {selectedActivityIds.size} selected
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="table-pro w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold tracking-wider text-slate-400 uppercase select-none">
                                <th className="py-3 px-4 text-center w-10">
                                    <input
                                        type="checkbox"
                                        checked={activities.length > 0 && selectedActivityIds.size === activities.length}
                                        onChange={onToggleSelectAll}
                                        className="w-4 h-4 rounded border-line text-accent focus:ring-accent/20 cursor-pointer accent-accent"
                                    />
                                </th>
                                <th className="py-3 px-4">User</th>
                                <th className="py-3 px-4">Action Type</th>
                                <th className="py-3 px-4">Target Resource</th>
                                <th className="py-3 px-4">Document</th>
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3 px-4 !text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80 text-xs">
                            {activities.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-center p-4">
                                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-3 transition-transform duration-300 hover:scale-105">
                                                <i className="fas fa-inbox text-2xl"></i>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No activity recorded yet</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">Activity logs will appear here as users perform operations</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                activities.map((activity) => {
                                    const isSelected = selectedActivityIds.has(activity.id);
                                    return (
                                        <tr key={activity.id} className={`hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors group ${isSelected ? 'bg-pink-500/10 dark:bg-pink-500/20' : ''}`}>
                                            <td data-label="Select" className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => onToggleSelectActivity(activity.id)}
                                                    className="w-4 h-4 rounded border-line text-accent focus:ring-accent/20 cursor-pointer accent-accent"
                                                />
                                            </td>
                                            <td data-label="User" className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div>
                                                        <div className="font-semibold text-slate-900 dark:text-white leading-snug">{activity.user_name}</div>
                                                        {activity.user_email && (
                                                            <div className="text-[10px] text-slate-400 font-normal">{activity.user_email}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Action Type" className="py-3 px-4 whitespace-nowrap">
                                                <StatusBadge
                                                    tone={
                                                        activity.action_type === 'upload'
                                                            ? 'emerald'
                                                            : activity.action_type === 'update'
                                                                ? 'blue'
                                                                : activity.action_type === 'delete'
                                                                    ? 'rose'
                                                                    : 'neutral'
                                                    }
                                                    icon={`fas ${getActionIcon(activity.action_type)}`}
                                                    size="xs"
                                                >
                                                    {activity.action_type.charAt(0).toUpperCase() + activity.action_type.slice(1)}
                                                </StatusBadge>
                                            </td>
                                            <td data-label="Target Resource" className="py-3 px-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">
                                                {activity.target_resource}
                                            </td>
                                            <td data-label="Document" className="py-3 px-4 whitespace-nowrap">
                                                {activity.document_title ? (
                                                    <div>
                                                        <div className="text-slate-900 dark:text-white font-medium truncate max-w-[200px]" title={activity.document_title}>
                                                            {activity.document_title}
                                                        </div>
                                                        {activity.document_id && (
                                                            <div className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">
                                                                ID: {activity.document_id.substring(0, 8)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td data-label="Timestamp" className="py-3 px-4 text-slate-400 whitespace-nowrap">
                                                {new Date(activity.timestamp).toLocaleString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td data-label="Status" className="py-3 px-4 text-right whitespace-nowrap">
                                                <StatusBadge tone="emerald" dot size="xs">
                                                    {activity.status}
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* pagination */}
            {totalActivities > 0 && (
                <div className="flex-shrink-0 pagination-container-class pt-4 mt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                        Showing <span className="font-semibold text-slate-900 dark:text-white">
                            {totalActivities === 0 ? 0 : (activityPage - 1) * activitiesPerPage + 1}
                        </span> to{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {Math.min(activityPage * activitiesPerPage, totalActivities)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{totalActivities}</span> log entries
                    </span>
                    <Pagination
                        currentPage={activityPage}
                        totalPages={Math.ceil(totalActivities / activitiesPerPage)}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </div>
    );
}
