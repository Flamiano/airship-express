"use client";

import { useState } from "react";
import ViewLink from "../../../components/global/Links";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { CrudActionButton } from "../../../components/ui/CrudActionButton";
import { ExecutiveTransaction } from "../hooks/useExecutiveData";
import ItemDetailModal, { ItemDetailRecord } from "./modals/ItemDetailModal";

interface RecentTransactionsProps {
    transactions?: ExecutiveTransaction[];
}

const getTxTone = (status: string): "pink" | "amber" | "emerald" | "purple" | "neutral" => {
    const s = status.toLowerCase();
    if (s.includes("received")) return "pink";
    if (s.includes("wait") || s.includes("sort")) return "amber";
    if (s.includes("deliver") || s.includes("dispatched")) return "emerald";
    if (s.includes("ready") || s.includes("picked")) return "purple";
    return "neutral";
};

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
    const [selectedItem, setSelectedItem] = useState<ItemDetailRecord | null>(null);

    const list = transactions || [];

    const handleViewItem = (tx: ExecutiveTransaction) => {
        setSelectedItem({
            title: `Parcel Tracking #${tx.id}`,
            referenceId: tx.id,
            barcode: tx.id,
            status: tx.status,
            courierOrSupplier: tx.courier,
            locationOrArea: tx.area,
            consignee: tx.consignee,
            timestamp: tx.received,
            description: `Destination consignee: ${tx.consignee}. Assigned to courier partner ${tx.courier} at ${tx.area}. Verified in incoming queue.`,
            isParcel: true,
        });
    };

    return (
        <div className="xl:col-span-2 bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-5 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] overflow-hidden transition-all">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5 font-extrabold text-slate-900 dark:text-white text-sm">
                    <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                        <i className="fas fa-list text-xs"></i>
                    </div>
                    <span>Recent transactions</span>
                </div>
                <ViewLink link="/warehousing" name="Open warehousing" />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto mt-2">
                <table className="table-pro w-full text-xs text-left border-collapse">
                    <thead className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200/60 dark:border-white/[0.04]">
                        <tr>
                            <th className="px-5 py-3">Reference</th>
                            <th className="px-5 py-3">Consignee</th>
                            <th className="px-5 py-3">Courier</th>
                            <th className="px-5 py-3">Area / Location</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Received</th>
                            <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] font-medium">
                        {list.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-medium text-xs">
                                    No transaction records found in database.
                                </td>
                            </tr>
                        ) : (
                            list.slice(0, 8).map((tx, index) => (
                                <tr
                                    key={tx.id || index}
                                    className="hover:bg-[#ebf0f7]/60 dark:hover:bg-[#14151e]/60 transition-all duration-150 group"
                                >
                                    <td data-label="Reference" className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span>{tx.id}</span>
                                            {/* Hover detail effect (! icon with popover tooltip) */}
                                            <div className="info-badge-container">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewItem(tx)}
                                                    className="w-4 h-4 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-pink-300/80 dark:border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-extrabold flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),0_1px_3px_rgba(236,72,153,0.15)] hover:scale-110 transition-transform cursor-pointer"
                                                    title="Hover/Click for info (!)"
                                                >
                                                    !
                                                </button>
                                                <div className="tooltip-popover">
                                                    <p className="font-bold text-pink-400">{tx.id}</p>
                                                    <p className="text-slate-200 dark:text-slate-300 mt-0.5">{tx.consignee}</p>
                                                    <p className="text-[10px] text-slate-300 mt-1">Courier: {tx.courier}</p>
                                                    <p className="text-[10px] text-slate-300">Area: {tx.area}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label="Consignee" className="px-5 py-3 text-slate-900 dark:text-white font-medium sm:max-w-[180px]">
                                        <span className="block truncate text-right ml-auto" title={tx.consignee}>
                                            {tx.consignee}
                                        </span>
                                    </td>
                                    <td data-label="Courier" className="px-5 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{tx.courier}</td>
                                    <td data-label="Area / Location" className="px-5 py-3 text-slate-500 dark:text-slate-400 sm:max-w-[220px]">
                                        <span className="block truncate text-right ml-auto" title={tx.area}>
                                            {tx.area}
                                        </span>
                                    </td>
                                    <td data-label="Status" className="px-5 py-3">
                                        <StatusBadge tone={getTxTone(tx.status)} dot size="xs">
                                            {tx.status}
                                        </StatusBadge>
                                    </td>
                                    <td data-label="Received" className="px-5 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{tx.received}</td>
                                    <td data-label="Actions" className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end">
                                            <CrudActionButton
                                                action="view"
                                                ariaLabel="View parcel details"
                                                onClick={() => handleViewItem(tx)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal details on demand */}
            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}