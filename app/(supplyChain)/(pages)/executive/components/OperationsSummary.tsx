"use client";

import { useState } from "react";
import ViewLink from "@/app/(supplyChain)/components/global/Links";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
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
            badgeStyle: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
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
            badgeStyle: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60',
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
            badgeStyle: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
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
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60',
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
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs dark:shadow-none transition-all">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                        <i className="fas fa-warehouse text-xs"></i>
                    </div>
                    <span>Operations Summary</span>
                </div>
                <ViewLink link="/warehousing" name="view" />
            </div>

            <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {rows.map((row) => (
                    <li key={row.key} className="py-3 flex justify-between items-center group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-2">
                            {/* Hover detail effect (! badge with popover tooltip) */}
                            <div className="relative group/tooltip inline-block">
                                <button
                                    type="button"
                                    onClick={() => setSelectedItem(row.modalDetail)}
                                    className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                                    title="Hover/Click for info (!)"
                                >
                                    !
                                </button>
                                <div className="absolute left-0 top-full mt-2 hidden group-hover/tooltip:block group-focus-within/tooltip:block w-56 p-3 bg-slate-900 text-white dark:bg-slate-950 dark:text-slate-100 text-[11px] rounded-xl shadow-2xl z-50 pointer-events-none border border-slate-700 leading-snug">
                                    <p className="font-bold text-pink-400">{row.label}</p>
                                    <p className="text-slate-200 dark:text-slate-300 mt-1">{row.infoText}</p>
                                </div>
                            </div>

                            <span className="font-medium text-slate-600 dark:text-slate-400">{row.label}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-xl border ${row.badgeStyle}`}>
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