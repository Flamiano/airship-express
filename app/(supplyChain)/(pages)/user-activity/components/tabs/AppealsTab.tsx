'use client';

import React from 'react';
import { CheckCircle, X, Send, Eye, Trash2, Loader2 } from 'lucide-react';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { Appeal } from '../../types';
import { formatDate } from '../../utils/formatters';

interface AppealsTabProps {
    appeals: Appeal[];
    isLoading: boolean;
    selectedAppeals: Set<string>;
    onToggleSelectAppeal: (id: string) => void;
    onSelectAllAppeals: () => void;
    onApproveAppeal: (appealId: string) => void;
    onRejectAppeal: (appealId: string) => void;
    onDeleteAppeal: (appealId: string) => void;
    onOpenResponseModal: (appeal: Appeal) => void;
    onBulkApprove: () => void;
    onBulkReject: () => void;
    onBulkDelete: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const AppealsTab: React.FC<AppealsTabProps> = ({
    appeals,
    isLoading,
    selectedAppeals,
    onToggleSelectAppeal,
    onSelectAllAppeals,
    onApproveAppeal,
    onRejectAppeal,
    onDeleteAppeal,
    onOpenResponseModal,
    onBulkApprove,
    onBulkReject,
    onBulkDelete,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const allAppealsSelected = appeals.length > 0 && selectedAppeals.size === appeals.length;
    const someAppealsSelected = selectedAppeals.size > 0 && selectedAppeals.size < appeals.length;

    const areAllSelectedPending =
        selectedAppeals.size > 0 &&
        Array.from(selectedAppeals).every(id => appeals.find(a => a.id === id)?.status === 'pending');

    return (
        <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-2xl dark:shadow-black/60 overflow-hidden transition-all duration-300">
            {/* Contextual Bulk Action Bar */}
            {selectedAppeals.size > 0 && (
                <div className="p-3.5 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-200 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/20 text-pink-400 text-xs font-bold border border-pink-500/30 shadow-2xs">
                            {selectedAppeals.size}
                        </span>
                        <span className="text-xs font-medium text-slate-200 tracking-wide">
                            appeal{selectedAppeals.size > 1 ? 's' : ''} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Approve/Reject visible only when all selected items are pending */}
                        {areAllSelectedPending && (
                            <div className="flex items-center gap-2 pr-2.5 border-r border-slate-700/80">
                                <button
                                    onClick={onBulkApprove}
                                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Approve Selected
                                </button>
                                <button
                                    onClick={onBulkReject}
                                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Reject Selected
                                </button>
                            </div>
                        )}

                        <button
                            onClick={onBulkDelete}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Table Wrapper */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-4 px-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    checked={allAppealsSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someAppealsSelected;
                                        }
                                    }}
                                    onChange={onSelectAllAppeals}
                                    className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 cursor-pointer accent-pink-500 transition-all bg-transparent"
                                />
                            </th>
                            <th className="py-4 px-4">User</th>
                            <th className="py-4 px-4">Email</th>
                            <th className="py-4 px-4">Appeal Message</th>
                            <th className="py-4 px-4">Response</th>
                            <th className="py-4 px-4">Status</th>
                            <th className="py-4 px-4">Submitted</th>
                            <th className="py-4 px-4 text-right! w-[150px] min-w-[150px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="p-3 bg-pink-50 dark:bg-pink-950/40 rounded-full border border-pink-100 dark:border-pink-900/40">
                                            <Loader2 className="animate-spin h-6 w-6 text-pink-500 dark:text-pink-400" />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide">Loading appeals data...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : appeals.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1 shadow-2xs">
                                            <i className="fas fa-inbox text-xl" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No appeals found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">There are no appeals matching your current view filter.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            appeals.map((appeal) => {
                                const isSelected = selectedAppeals.has(appeal.id);
                                const isPending = appeal.status === 'pending';
                                const isResolved = appeal.status === 'approved' || appeal.status === 'rejected';

                                return (
                                    <tr
                                        key={appeal.id}
                                        className={`group transition-all duration-150 ${isSelected
                                            ? 'bg-pink-50/50 dark:bg-pink-950/20 hover:bg-pink-50/70 dark:hover:bg-pink-950/30'
                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <td className="py-3.5 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleSelectAppeal(appeal.id)}
                                                className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 cursor-pointer accent-pink-500 transition-all bg-transparent"
                                            />
                                        </td>

                                        {/* User Name with Initial Avatar Badge */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                                                    {appeal.user_name ? appeal.user_name.charAt(0) : 'U'}
                                                </div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                    {appeal.user_name}
                                                </div>
                                            </div>
                                        </td>

                                        {/* User Email */}
                                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">
                                            {appeal.user_email}
                                        </td>

                                        {/* Appeal Message */}
                                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                                            <span
                                                className="truncate block text-slate-700 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-800/60 group-hover:bg-white dark:group-hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 transition-colors shadow-2xs"
                                                title={appeal.appeal_message}
                                            >
                                                {appeal.appeal_message}
                                            </span>
                                        </td>

                                        {/* Response Message */}
                                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[180px]">
                                            {appeal.response_message ? (
                                                <span
                                                    className="truncate block text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 font-medium shadow-2xs"
                                                    title={appeal.response_message}
                                                >
                                                    {appeal.response_message}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 italic text-[11px] px-1">
                                                    No response yet
                                                </span>
                                            )}
                                        </td>

                                        {/* Status Badge */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs ${isPending
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50'
                                                    : appeal.status === 'approved'
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50'
                                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/50'
                                                    }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${isPending
                                                        ? 'bg-amber-500 animate-pulse'
                                                        : appeal.status === 'approved'
                                                            ? 'bg-emerald-500'
                                                            : 'bg-rose-500'
                                                        }`}
                                                />
                                                {appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1)}
                                            </span>
                                        </td>

                                        {/* Created At */}
                                        <td className="py-3.5 px-4 text-slate-400 dark:text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(appeal.created_at)}
                                        </td>

                                        {/* Row Actions */}
                                        <td className="py-3.5 px-4 text-right whitespace-nowrap w-[150px] min-w-[150px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {isPending && (
                                                    <>
                                                        <CrudActionButton
                                                            action="approve"
                                                            title="Approve Appeal"
                                                            onClick={() => onApproveAppeal(appeal.id)}
                                                        />
                                                        <CrudActionButton
                                                            action="reject"
                                                            title="Reject Appeal"
                                                            onClick={() => onRejectAppeal(appeal.id)}
                                                        />
                                                        <CrudActionButton
                                                            action="respond"
                                                            title="Send Custom Response"
                                                            onClick={() => onOpenResponseModal(appeal)}
                                                        />
                                                    </>
                                                )}

                                                {isResolved && (
                                                    <>
                                                        {appeal.response_message && (
                                                            <CrudActionButton
                                                                action="view"
                                                                title="View Response Details"
                                                                onClick={() => onOpenResponseModal(appeal)}
                                                            />
                                                        )}
                                                        <CrudActionButton
                                                            action="delete"
                                                            title="Delete Record"
                                                            onClick={() => onDeleteAppeal(appeal.id)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer & Pagination */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{appeals.length}</span> appeals
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
