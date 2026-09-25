"use client";

import { useState } from "react";
import ViewLink from "../../../components/global/Links";
import { CrudActionButton } from "../../../components/ui/CrudActionButton";
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
        <div className="bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-5 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] flex flex-col justify-between transition-all">
            <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2.5 font-extrabold text-slate-900 dark:text-white text-sm">
                        <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                            <i className="fas fa-shopping-cart text-xs"></i>
                        </div>
                        <span>Procurement</span>
                    </div>
                    <ViewLink link="/procurement" name="view" />
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
                                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                    {row.valStr}
                                </span>
                                <CrudActionButton
                                    action="view"
                                    ariaLabel={`View details for ${row.label}`}
                                    onClick={() => setSelectedItem(row.modalDetail)}
                                />
                            </div>
                        </li>
                    ))}

                    {/* Progress bar section */}
                    <li className="pt-3.5 pb-1 px-2">
                        <div className="flex justify-between items-center text-xs mb-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Approval Completion Rate</span>
                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{utilPct}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#ebf0f7] dark:bg-[#12131b] rounded-full overflow-hidden p-0.5 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]">
                            <div
                                className="h-full bg-gradient-to-r from-pink-500 to-pink-600 rounded-full transition-all duration-500 shadow-[0_2px_6px_rgba(236,72,153,0.4)]"
                                style={{ width: `${Math.min(utilPct, 100)}%` }}
                            ></div>
                        </div>
                    </li>
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