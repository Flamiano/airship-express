"use client";

import { useState } from "react";
import ViewLink from "@/app/(supplyChain)/components/global/Links";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { ProcurementSummaryData } from "../hooks/useExecutiveData";
import ItemDetailModal, { ItemDetailRecord } from "./modals/ItemDetailModal";

interface ProcurementCardProps {
    data?: ProcurementSummaryData;
}

export default function ProcurementCard({ data }: ProcurementCardProps) {
    const [selectedItem, setSelectedItem] = useState<ItemDetailRecord | null>(null);

    const openPOs = data?.openPOs ?? 0;
    const pendingApprovals = data?.pendingApprovals ?? 0;
    const mtdSpendNum = data?.mtdSpend ?? 0;
    const mtdSpend = `₱ ${mtdSpendNum.toLocaleString()}`;
    const utilPct = data?.budgetUtilizationPct ?? 0;

    const rows = [
        {
            key: 'pos',
            label: 'Open POs',
            valStr: `${openPOs} orders`,
            infoText: 'Active purchase orders pending supplier fulfillment or delivery.',
            modalDetail: {
                title: 'Open Purchase Orders Audit',
                referenceId: 'PO-OPEN-STAGE',
                status: 'In Progress',
                amount: mtdSpend,
                description: `There are currently ${openPOs} open purchase orders registered in purchase_orders.`,
            }
        },
        {
            key: 'pending',
            label: 'Pending Approvals',
            valStr: `${pendingApprovals} pending`,
            infoText: 'Requisitions in purchase_requests awaiting manager sign-off.',
            modalDetail: {
                title: 'Pending Purchase Requisitions',
                referenceId: 'PR-PENDING-STAGE',
                status: 'Awaiting Sign-off',
                description: `${pendingApprovals} purchase requests in purchase_requests require approval.`,
            }
        },
        {
            key: 'spend',
            label: 'MTD Spend',
            valStr: mtdSpend,
            infoText: 'Total committed procurement financial outlay this month.',
            modalDetail: {
                title: 'Month-to-Date Spend Breakdown',
                referenceId: 'MTD-SPEND-COMMITTED',
                status: 'Recorded Financials',
                amount: mtdSpend,
                description: `Aggregated total from purchase_orders created in the current monthly period.`,
            }
        }
    ];

    return (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-sm">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                        <i className="fas fa-shopping-cart text-xs"></i>
                    </div>
                    <span>Procurement</span>
                </div>
                <ViewLink link="/procurement" name="view" />
            </div>

            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {rows.map((row) => (
                    <li key={row.key} className="py-2.5 flex justify-between items-center group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-2">
                            {/* Hover detail effect (! badge with popover tooltip) */}
                            <div className="relative group/tooltip inline-block">
                                <button
                                    type="button"
                                    onClick={() => setSelectedItem(row.modalDetail)}
                                    className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 text-[10px] font-bold flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                                    title="Hover/Click for info (!)"
                                >
                                    !
                                </button>
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-20 pointer-events-none border border-slate-700">
                                    <p className="font-semibold text-pink-400">{row.label}</p>
                                    <p className="text-slate-300 mt-0.5">{row.infoText}</p>
                                </div>
                            </div>
                            <span className="font-medium text-slate-600 dark:text-slate-400">{row.label}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{row.valStr}</span>
                            <CrudActionButton
                                action="view"
                                ariaLabel={`View details for ${row.label}`}
                                onClick={() => setSelectedItem(row.modalDetail)}
                            />
                        </div>
                    </li>
                ))}

                {/* Progress bar section */}
                <li className="pt-3 pb-1 px-2">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Approval Completion Rate</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{utilPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/40 dark:border-slate-700/40">
                        <div
                            className="h-full bg-pink-500 dark:bg-pink-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(utilPct, 100)}%` }}
                        ></div>
                    </div>
                </li>
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