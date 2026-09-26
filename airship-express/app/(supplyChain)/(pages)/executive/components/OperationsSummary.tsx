"use client";

import { useState } from "react";
import ViewLink from "../../../components/global/Links";
import { CrudActionButton } from "../../../components/ui/CrudActionButton";
import { OperationsSummaryData } from "../hooks/useExecutiveData";
import ItemDetailModal, { ItemDetailRecord } from "./modals/ItemDetailModal";

interface OperationsSummaryProps {
    data?: OperationsSummaryData;
}

export default function OperationsSummary({ data }: OperationsSummaryProps) {
    const [selectedItem, setSelectedItem] = useState<ItemDetailRecord | null>(null);

    const queuePending = data?.receivingQueuePending ?? 0;
    const sortingCount = data?.sortingParcels ?? 0;
    const deliveredCount = data?.deliveredParcels ?? 0;
    const anomalies = data?.anomaliesCount ?? 0;

    const rows = [
        {
            key: 'receiving',
            label: 'Receiving Queue Pending',
            valStr: `${queuePending.toLocaleString()} items`,
            badgeText: `${queuePending} pending`,
            badgeStyle: 'bg-[#ebf0f7] dark:bg-[#12131b] border-white/80 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]',
            infoText: 'Parcels scanned in receiving queue awaiting sort verification.',
            modalDetail: {
                title: 'Receiving Queue Inspection',
                referenceId: 'RCV-QUEUE-STAGE',
                status: 'Pending Verification',
                locationOrArea: 'Inbound Dock Bay 1-3',
                description: `Currently ${queuePending} items are held in the receiving queue. Pending automated line scan.`,
            }
        },
        {
            key: 'sorting',
            label: 'Parcels Currently Sorting',
            valStr: `${sortingCount.toLocaleString()} parcels`,
            badgeText: `${sortingCount} in line`,
            badgeStyle: 'bg-[#ebf0f7] dark:bg-[#12131b] border-amber-300/80 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25),0_1px_3px_rgba(245,158,11,0.1)]',
            infoText: 'Parcels undergoing optical barcode classification in sorting lanes.',
            modalDetail: {
                title: 'Sorting Stage Breakdown',
                referenceId: 'SRT-STAGE-ACTIVE',
                status: 'Active Sorting',
                locationOrArea: 'Sorting Facility Hub',
                description: `${sortingCount} parcels actively routing through conveyor belts to destination distribution bins.`,
            }
        },
        {
            key: 'delivered',
            label: 'Parcels Successfully Delivered',
            valStr: deliveredCount.toLocaleString(),
            badgeText: `${deliveredCount} completed`,
            badgeStyle: 'bg-[#ebf0f7] dark:bg-[#12131b] border-emerald-300/80 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25),0_1px_3px_rgba(16,185,129,0.1)]',
            infoText: 'Total parcels delivered to destination consignees.',
            modalDetail: {
                title: 'Delivered Shipment Audit',
                referenceId: 'DLV-STAGE-METRIC',
                status: 'Fulfilled',
                locationOrArea: 'Last Mile Carrier Handoff',
                description: `${deliveredCount} parcels confirmed delivered with verified proof of receipt.`,
            }
        },
        {
            key: 'anomalies',
            label: 'Stock Shortage Alerts',
            valStr: `${anomalies} items`,
            badgeText: `${anomalies} flagged`,
            badgeStyle: anomalies > 0
                ? 'bg-[#ebf0f7] dark:bg-[#12131b] border-rose-300/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25),0_1px_3px_rgba(244,63,94,0.15)]'
                : 'bg-[#ebf0f7] dark:bg-[#12131b] border-white/80 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]',
            infoText: 'Inventory items at or below safety minimum stock threshold.',
            modalDetail: {
                title: 'Stock Shortage Audit',
                referenceId: 'INV-ALERT-THRESHOLD',
                status: anomalies > 0 ? 'Low Stock Warning' : 'Healthy Stock',
                locationOrArea: 'Warehouse Storage Rack',
                description: `${anomalies} SKUs in inventory_items require restocking purchase requests.`,
            }
        }
    ];

    return (
        <div className="bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-5 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] flex flex-col justify-between transition-all">
            <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2.5 font-extrabold text-slate-900 dark:text-white text-sm">
                        <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                            <i className="fas fa-warehouse text-xs"></i>
                        </div>
                        <span>Operations Summary</span>
                    </div>
                    <ViewLink link="/warehousing" name="view" />
                </div>

                <ul className="mt-3 divide-y divide-slate-200/50 dark:divide-white/[0.04] text-xs">
                    {rows.map((row) => (
                        <li key={row.key} className="py-3 flex justify-between items-center group hover:bg-[#ebf0f7]/60 dark:hover:bg-[#14151e]/60 px-2 rounded-2xl transition-colors">
                            <div className="flex items-center gap-2.5">
                                {/* Hover detail effect (! badge with popover tooltip) */}
                                <div className="info-badge-container">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedItem(row.modalDetail)}
                                        className="w-5 h-5 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-pink-300/80 dark:border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-extrabold flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),0_1px_3px_rgba(236,72,153,0.15)] hover:scale-110 transition-transform cursor-pointer"
                                        title="Hover/Click for info (!)"
                                    >
                                        !
                                    </button>
                                    <div className="tooltip-popover">
                                        <p className="font-bold text-pink-400">{row.label}</p>
                                        <p className="text-slate-200 dark:text-slate-300 mt-1">{row.infoText}</p>
                                    </div>
                                </div>

                                <span className="font-bold text-slate-700 dark:text-slate-300">{row.label}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`font-bold font-mono text-[11px] px-2.5 py-1 rounded-xl border ${row.badgeStyle}`}>
                                    {row.badgeText}
                                </span>
                                <CrudActionButton
                                    action="view"
                                    ariaLabel={`View details for ${row.label}`}
                                    onClick={() => setSelectedItem(row.modalDetail)}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Modal detail on demand */}
            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}