'use client';
import React from 'react';
import { CheckCircle, X, Trash2 } from 'lucide-react';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
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
export const AppealsTab: React.FC<AppealsTabProps> = ({ appeals, isLoading, selectedAppeals, onToggleSelectAppeal, onSelectAllAppeals, onApproveAppeal, onRejectAppeal, onDeleteAppeal, onOpenResponseModal, onBulkApprove, onBulkReject, onBulkDelete, currentPage, totalPages, onPageChange, }) => {
    const allAppealsSelected = appeals.length > 0 && selectedAppeals.size === appeals.length;
    const someAppealsSelected = selectedAppeals.size > 0 && selectedAppeals.size < appeals.length;
    const areAllSelectedPending = selectedAppeals.size > 0 &&
        Array.from(selectedAppeals).every(id => appeals.find(a => a.id === id)?.status === 'pending');
    return (
        <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* contextual bulk action bar */}
            {selectedAppeals.size > 0 && (<div className="p-3.5 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-200 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/20 text-pink-400 text-xs font-bold border border-pink-500/30 shadow-2xs">
                            {selectedAppeals.size}
                        </span>
                        <span className="text-xs font-medium text-slate-200 tracking-wide">
                            appeal{selectedAppeals.size > 1 ? 's' : ''} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* approve/reject visible only when all selected items are pending */}
                        {areAllSelectedPending && (<div className="flex items-center gap-2 pr-2.5 border-r border-slate-700/80">
                                <AppButton type="button" variant="success" size="xs" onClick={onBulkApprove}>
                                    <CheckCircle className="w-3.5 h-3.5"/>
                                    <span>Approve Selected</span>
                                </AppButton>
                                <AppButton type="button" variant="warning" size="xs" onClick={onBulkReject}>
                                    <X className="w-3.5 h-3.5"/>
                                    <span>Reject Selected</span>
                                </AppButton>
                            </div>)}

                        <AppButton type="button" variant="danger" size="xs" onClick={onBulkDelete}>
                            <Trash2 className="w-3.5 h-3.5"/>
                            <span>Delete Selected</span>
                        </AppButton>
                    </div>
                </div>)}

            {/* table wrapper */}
            <div className="overflow-x-auto">
                <table className="table-pro w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-4 px-4 w-12 text-center">
                                <input type="checkbox" checked={allAppealsSelected} ref={(input) => {
            if (input) {
                input.indeterminate = someAppealsSelected;
            }
        }} onChange={onSelectAllAppeals} className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 cursor-pointer accent-pink-500 transition-all bg-transparent"/>
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
                        {isLoading ? (<TableRowsSkeleton rows={6} columns={[
                { type: 'checkbox', width: 'w-12' },
                { type: 'avatar-text', subtext: false },
                { type: 'text', width: 'w-40' },
                { type: 'text', width: 'w-64' },
                { type: 'text', width: 'w-48' },
                { type: 'badge' },
                { type: 'date' },
                { type: 'actions', align: 'right', width: 'w-[150px]' },
            ]}/>) : appeals.length === 0 ? (<tr>
                                <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fa-solid fa-message text-2xl text-pink-500 dark:text-pink-400"></i>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No appeals found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">There are no appeals matching your current view filter.</p>
                                    </div>
                                </td>
                            </tr>) : (appeals.map((appeal) => {
            const isSelected = selectedAppeals.has(appeal.id);
            const isPending = appeal.status === 'pending';
            const isResolved = appeal.status === 'approved' || appeal.status === 'rejected';
            return (<tr key={appeal.id} className={`group transition-all duration-150 ${isSelected
                    ? 'bg-pink-50/50 dark:bg-pink-950/20 hover:bg-pink-50/70 dark:hover:bg-pink-950/30'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
                                        {/* checkbox */}
                                        <td data-label="Select" className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-start md:justify-center w-full">
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={isSelected} onChange={() => onToggleSelectAppeal(appeal.id)} aria-label="Select appeal" className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 cursor-pointer accent-pink-500 transition-all bg-transparent"/>
                                                    <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                </label>
                                            </div>
                                        </td>

                                        {/* user name with initial avatar badge */}
                                        <td data-label="User" className="py-3.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/50 text-pink-600 dark:text-pink-400 font-bold text-xs flex items-center justify-center shrink-0 uppercase shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                                    {appeal.user_name ? appeal.user_name.charAt(0) : 'U'}
                                                </div>
                                                <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors truncate max-w-[150px]" title={appeal.user_name}>
                                                    {appeal.user_name}
                                                </div>
                                            </div>
                                        </td>

                                        {/* user email */}
                                        <td data-label="Email" className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]" title={appeal.user_email}>
                                            {appeal.user_email}
                                        </td>

                                        {/* appeal message */}
                                        <td data-label="Appeal Message" className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                                            <span className="truncate block text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151c] px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] font-medium" title={appeal.appeal_message}>
                                                {appeal.appeal_message}
                                            </span>
                                        </td>

                                        {/* response message */}
                                        <td data-label="Response" className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[180px]">
                                            {appeal.response_message ? (<span className="truncate block text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 font-semibold shadow-2xs" title={appeal.response_message}>
                                                    {appeal.response_message}
                                                </span>) : (<span className="text-slate-400 dark:text-slate-500 italic text-[11px] px-1">
                                                    No response yet
                                                </span>)}
                                        </td>

                                        {/* status badge */}
                                        <td data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                                            <StatusBadge tone={isPending ? 'amber' : appeal.status === 'approved' ? 'emerald' : 'rose'} dot size="xs">
                                                {appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1)}
                                            </StatusBadge>
                                        </td>

                                        {/* created at */}
                                        <td data-label="Submitted" className="py-3.5 px-4 text-slate-400 dark:text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(appeal.created_at)}
                                        </td>

                                        {/* row actions */}
                                        <td data-label="Actions" className="py-3.5 px-4 text-right whitespace-nowrap w-[150px] min-w-[150px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {isPending && (<>
                                                        <CrudActionButton action="approve" title="Approve Appeal" onClick={() => onApproveAppeal(appeal.id)}/>
                                                        <CrudActionButton action="reject" title="Reject Appeal" onClick={() => onRejectAppeal(appeal.id)}/>
                                                        <CrudActionButton action="respond" title="Send Custom Response" onClick={() => onOpenResponseModal(appeal)}/>
                                                    </>)}

                                                {isResolved && (<>
                                                        {appeal.response_message && (<CrudActionButton action="view" title="View Response Details" onClick={() => onOpenResponseModal(appeal)}/>)}
                                                        <CrudActionButton action="delete" title="Delete Record" onClick={() => onDeleteAppeal(appeal.id)}/>
                                                    </>)}
                                            </div>
                                        </td>
                                    </tr>);
        }))}
                    </tbody>
                </table>
            </div>

            {/* footer & pagination */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{appeals.length}</span> appeals
                </span>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange}/>
            </div>
        </div>);
};
