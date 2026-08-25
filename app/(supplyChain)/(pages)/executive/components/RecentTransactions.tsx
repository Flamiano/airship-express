"use client";

import { useState } from "react";
import ViewLink from "@/app/(supplyChain)/components/global/Links";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
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
        <div className="card xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs dark:shadow-xl overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-white text-sm">
                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30 shadow-2xs">
                        <i className="fas fa-list text-xs"></i>
                    </div>
                    <span>Recent transactions</span>
                </div>
                <ViewLink link="/warehousing" name="Open warehousing" />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200/80 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-3.5">Reference</th>
                            <th className="px-6 py-3.5">Consignee</th>
                            <th className="px-6 py-3.5">Courier</th>
                            <th className="px-6 py-3.5">Area / Location</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5">Received</th>
                            <th className="px-6 py-3.5 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {list.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium text-xs">
                                    No transaction records found in database.
                                </td>
                            </tr>
                        ) : (
                            list.slice(0, 8).map((tx, index) => (
                                <tr
                                    key={tx.id || index}
                                    className={`${index % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'} 
                                               hover:bg-pink-50/40 dark:hover:bg-slate-800/60 
                                               transition-all duration-150 group`}
                                >
                                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span>{tx.id}</span>
                                            {/* Hover detail effect (! icon with popover tooltip) */}
                                            <div className="info-badge-container">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewItem(tx)}
                                                    className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-2xs"
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
                                    <td className="px-6 py-3.5 text-slate-900 dark:text-white">{tx.consignee}</td>
                                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{tx.courier}</td>
                                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">{tx.area}</td>
                                    <td className="px-6 py-3.5">
                                        <StatusBadge tone={getTxTone(tx.status)} dot size="xs">
                                            {tx.status}
                                        </StatusBadge>
                                    </td>
                                    <td className="px-6 py-3.5 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{tx.received}</td>
                                    <td className="px-6 py-3.5 text-right">
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