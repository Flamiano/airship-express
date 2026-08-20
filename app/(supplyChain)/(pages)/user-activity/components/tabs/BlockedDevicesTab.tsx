'use client';

import React from 'react';
import { Undo, Trash2, Loader2 } from 'lucide-react';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-2xl dark:shadow-black/60 overflow-hidden">
            {/* Bulk Actions Banner */}
            {selectedDevices.size > 0 && (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {selectedDevices.size} device(s) selected
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={onBulkUnblock}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Undo className="w-3 h-3" />
                            Unblock Selected
                        </button>
                        <button
                            onClick={onBulkDelete}
                            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Trash2 className="w-3 h-3" />
                            Delete Selected
                        </button>
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
                            <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {isLoading ? (
                            <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                                    <Loader2 className="animate-spin h-5 w-5 inline mr-2 text-pink-500" />
                                    Loading blocked devices...
                                </td>
                            </tr>
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
                                            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
                                                {device.ip_address || 'Unknown'}
                                            </code>
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
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${device.status === 'blocked'
                                                ? 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/40'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'blocked' ? 'bg-red-500 dark:bg-red-400' : 'bg-emerald-500 dark:bg-emerald-400'
                                                    }`} />
                                                <span>{device.status === 'blocked' ? 'Blocked' : 'Unblocked'}</span>
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {device.status === 'blocked' && (
                                                    <button
                                                        onClick={() => onUnblockDevice(device.id, device.email)}
                                                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Undo className="w-3 h-3" />
                                                        <span>Unblock</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onDeleteDevice(device.id)}
                                                    className="px-2.5 py-1 text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Delete</span>
                                                </button>
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
