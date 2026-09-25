'use client';
import React from 'react';
import { Undo, Trash2 } from 'lucide-react';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
import { BlockedDevice } from '../../types';
import { formatDate } from '../../utils/formatters';
interface BlockedDevicesTabProps {
    devices: BlockedDevice[];
    isLoading: boolean;
    selectedDevices: Set<string>;
    onToggleSelectDevice: (id: string) => void;
    onSelectAllDevices: () => void;
    onUnblockDevice: (deviceId: string, email: string) => void;
    onDeleteDevice: (deviceId: string) => void;
    onBulkUnblock: () => void;
    onBulkDelete: () => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}
export const BlockedDevicesTab: React.FC<BlockedDevicesTabProps> = ({ devices, isLoading, selectedDevices, onToggleSelectDevice, onSelectAllDevices, onUnblockDevice, onDeleteDevice, onBulkUnblock, onBulkDelete, currentPage, totalPages, onPageChange, }) => {
    const allBlockedSelected = devices.length > 0 && selectedDevices.size === devices.length;
    const someBlockedSelected = selectedDevices.size > 0 && selectedDevices.size < devices.length;
    return (
        <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* bulk actions banner */}
            {selectedDevices.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {selectedDevices.size} device(s) selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <AppButton type="button" variant="success" size="xs" onClick={onBulkUnblock}>
                            <Undo className="w-3 h-3" />
                            <span>Unblock Selected</span>
                        </AppButton>
                        <AppButton type="button" variant="danger" size="xs" onClick={onBulkDelete}>
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Selected</span>
                        </AppButton>
                    </div>
                </div>
            )}

            {/* table content */}
            <div className="overflow-x-auto">
                <table className="table-pro w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                            <th className="py-3 px-4 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allBlockedSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someBlockedSelected;
                                        }
                                    }}
                                    onChange={onSelectAllDevices}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                />
                            </th>
                            <th className="py-3 px-4">Device Name</th>
                            <th className="py-3 px-4">User Agent</th>
                            <th className="py-3 px-4">IP Address</th>
                            <th className="py-3 px-4 text-center">Blocked Count</th>
                            <th className="py-3 px-4">Blocked At</th>
                            <th className="py-3 px-4">Reason</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right! w-[130px] min-w-[130px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {isLoading ? (
                            <TableRowsSkeleton
                                rows={6}
                                columns={[
                                    { type: 'checkbox', width: 'w-10' },
                                    { type: 'text', width: 'w-36' },
                                    { type: 'text', width: 'w-48' },
                                    { type: 'mono', width: 'w-28' },
                                    { type: 'badge', align: 'center' },
                                    { type: 'date' },
                                    { type: 'text', width: 'w-32' },
                                    { type: 'badge' },
                                    { type: 'actions', align: 'right', width: 'w-[130px]' },
                                ]}
                            />
                        ) : devices.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                            <i className="fa-solid fa-ban text-2xl text-pink-500 dark:text-pink-400"></i>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No blocked devices found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">All devices currently have clean access</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            devices.map((device) => {
                                const isSelected = selectedDevices.has(device.id);
                                return (
                                    <tr
                                        key={device.id}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                            isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                        }`}
                                    >
                                        <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-start md:justify-center w-full">
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => onToggleSelectDevice(device.id)}
                                                        aria-label="Select blocked device"
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                    />
                                                    <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                </label>
                                            </div>
                                        </td>
                                        <td data-label="Device Name" className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={device.device_name || 'Unknown Device'}>
                                            {device.device_name || 'Unknown Device'}
                                        </td>
                                        <td data-label="User Agent" className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={device.user_agent}>
                                            {device.user_agent}
                                        </td>
                                        <td data-label="IP Address" className="py-3 px-4">
                                            <StatusBadge tone="neutral" size="xs">
                                                <span className="font-mono">{device.ip_address || 'Unknown'}</span>
                                            </StatusBadge>
                                        </td>
                                        <td data-label="Blocked Count" className="py-3 px-4 text-center">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{device.blocked_count || 0}</span>
                                        </td>
                                        <td data-label="Blocked At" className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(device.blocked_at)}
                                        </td>
                                        <td data-label="Reason" className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[150px] truncate font-medium">
                                            {device.reason || 'No reason provided'}
                                        </td>
                                        <td data-label="Status" className="py-3 px-4">
                                            <StatusBadge tone={device.status === 'blocked' ? 'rose' : 'emerald'} dot size="xs">
                                                {device.status === 'blocked' ? 'Blocked' : 'Unblocked'}
                                            </StatusBadge>
                                        </td>
                                        <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {device.status === 'blocked' && (
                                                    <CrudActionButton action="restore" label="Unblock" title="Unblock Device" onClick={() => onUnblockDevice(device.id, device.email)} />
                                                )}
                                                <CrudActionButton action="delete" title="Delete Record" onClick={() => onDeleteDevice(device.id)} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* pagination footer */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {devices.length} blocked devices
                </span>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
        </div>
    );
};
