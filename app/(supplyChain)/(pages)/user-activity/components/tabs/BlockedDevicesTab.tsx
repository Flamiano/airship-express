'use client';

import React from 'react';
import { Undo, Trash2, Loader2 } from 'lucide-react';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableRowsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
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

export const BlockedDevicesTab: React.FC<BlockedDevicesTabProps> = ({
    devices,
    isLoading,
    selectedDevices,
    onToggleSelectDevice,
    onSelectAllDevices,
    onUnblockDevice,
    onDeleteDevice,
    onBulkUnblock,
    onBulkDelete,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const allBlockedSelected = devices.length > 0 && selectedDevices.size === devices.length;
    const someBlockedSelected = selectedDevices.size > 0 && selectedDevices.size < devices.length;

    return (
        <div className="bg-white dark:bg-[#1c1d25] rounded-2xl border border-slate-200/90 dark:border-[#353746] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Bulk Actions Banner */}
            {selectedDevices.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {selectedDevices.size} device(s) selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <AppButton
                            type="button"
                            variant="success"
                            size="xs"
                            onClick={onBulkUnblock}
                        >
                            <Undo className="w-3 h-3" />
                            <span>Unblock Selected</span>
                        </AppButton>
                        <AppButton
                            type="button"
                            variant="danger"
                            size="xs"
                            onClick={onBulkDelete}
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Selected</span>
                        </AppButton>
                    </div>
                </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
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
                                <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                                    <i className="fas fa-check-circle text-emerald-500 dark:text-emerald-400 text-base mr-2"></i>
                                    No blocked devices found
                                </td>
                            </tr>
                        ) : (
                            devices.map((device) => {
                                const isSelected = selectedDevices.has(device.id);
                                return (
                                    <tr
                                        key={device.id}
                                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                            }`}
                                    >
                                        <td className="py-3 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleSelectDevice(device.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                            />
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                            {device.device_name || 'Unknown Device'}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={device.user_agent}>
                                            {device.user_agent}
                                        </td>
                                        <td className="py-3 px-4">
                                            <StatusBadge tone="neutral" size="xs">
                                                <span className="font-mono">{device.ip_address || 'Unknown'}</span>
                                            </StatusBadge>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{device.blocked_count || 0}</span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(device.blocked_at)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[150px] truncate">
                                            {device.reason || 'No reason provided'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <StatusBadge
                                                tone={device.status === 'blocked' ? 'rose' : 'emerald'}
                                                dot
                                                size="xs"
                                            >
                                                {device.status === 'blocked' ? 'Blocked' : 'Unblocked'}
                                            </StatusBadge>
                                        </td>
                                        <td className="py-3 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {device.status === 'blocked' && (
                                                    <CrudActionButton
                                                        action="restore"
                                                        label="Unblock"
                                                        title="Unblock Device"
                                                        onClick={() => onUnblockDevice(device.id, device.email)}
                                                    />
                                                )}
                                                <CrudActionButton
                                                    action="delete"
                                                    title="Delete Record"
                                                    onClick={() => onDeleteDevice(device.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {devices.length} blocked devices
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
