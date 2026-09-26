"use client";

import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface ReportsTabProps {
    data: ExecutiveDataPayload;
    onOpenModal: (reportType: string) => void;
}

export default function ReportsTab({ data, onOpenModal }: ReportsTabProps) {
    const reportCards = [
        {
            type: 'executive',
            title: 'Executive Summary Report',
            subtitle: 'Holistic overview of operations, inventory & procurement',
            icon: 'fa-file-alt',
            color: 'text-pink-600 dark:text-pink-400',
            bg: 'bg-pink-50 dark:bg-pink-950/40',
            border: 'border-pink-200 dark:border-pink-800/40',
            glow: 'shadow-[0_2px_12px_rgba(236,72,153,0.18)]',
            desc: 'Aggregated snapshot of supply chain activity, document logs, inventory capacity, and PO commitments.',
            count: `${data.parcels.length} parcels • ${data.inventory.length} SKUs`,
            infoText: 'Generates aggregated executive overview manifest covering logistics, warehouse stock, and PO commitments.',
            badge: 'Overview',
        },
        {
            type: 'parcels',
            title: 'Parcel Performance Report',
            subtitle: 'Tracking parcel lifecycle, clearance rate & couriers',
            icon: 'fa-box',
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-950/40',
            border: 'border-blue-200 dark:border-blue-800/40',
            glow: 'shadow-[0_2px_12px_rgba(59,130,246,0.18)]',
            desc: 'Detailed analysis of incoming cargo volume, fulfillment timeline, bottlenecks, and courier handoffs.',
            count: `${data.pageKpis.ontimeRate} SLA rate`,
            infoText: 'Detailed parcel manifest including barcode tracking numbers, status badges, consignees, and courier partners.',
            badge: 'Logistics',
        },
        {
            type: 'inventory',
            title: 'Inventory & Stock Health Audit',
            subtitle: 'Stock levels, min threshold alerts & SKU turnover',
            icon: 'fa-warehouse',
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/40',
            border: 'border-amber-200 dark:border-amber-800/40',
            glow: 'shadow-[0_2px_12px_rgba(245,158,11,0.18)]',
            desc: 'Complete catalog breakdown showing stock balances, storage bin assignments, and low-stock warnings.',
            count: `${data.inventory.filter(i => i.current_stock <= i.minimum_stock).length} low-stock alerts`,
            infoText: 'Warehouse inventory audit listing item names, category classifications, and reorder warnings.',
            badge: 'Storage',
        },
        {
            type: 'procurement',
            title: 'Procurement & Spend Intelligence',
            subtitle: 'PO commitments, approval queues & departmental spend',
            icon: 'fa-file-invoice-dollar',
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-950/40',
            border: 'border-purple-200 dark:border-purple-800/40',
            glow: 'shadow-[0_2px_12px_rgba(168,85,247,0.18)]',
            desc: 'Purchase request tracking, vendor PO totals, approval statuses, and monthly budget utilization.',
            count: `₱ ${data.procurementSummary.mtdSpend.toLocaleString()} committed`,
            infoText: 'Financial spend audit detailing purchase orders, vendor names, and approval stages.',
            badge: 'Finance',
        },
    ];

    return (
        <div className="space-y-4">
            {/* Header Neumorphic Banner */}
            <div className="p-3.5 sm:p-4 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Compact Icon Pill */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-sm shadow-[0_2px_8px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                        <i className="fas fa-file-csv" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Executive Intelligence Reports &amp; Manifests
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Generate and download structured CSV reports with line-by-line manifests and strategic notes.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-pink-700 dark:text-pink-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                        <i className="fas fa-arrow-down-to-bracket text-[9px]" />
                        4 Export Manifests
                    </span>
                </div>
            </div>

            {/* Reports Cards Grid (Neumorphic Design) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {reportCards.map((report) => (
                    <div
                        key={report.type}
                        onClick={() => onOpenModal(report.type)}
                        className="p-4 sm:p-5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1c1d28] border border-white/80 dark:border-[#2c2d3c] shadow-[5px_5px_14px_rgba(166,175,195,0.35),-5px_-5px_14px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_18px_rgba(0,0,0,0.6),-4px_-4px_14px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_4px_rgba(166,175,195,0.5),-1px_-1px_4px_rgba(255,255,255,0.95)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-pointer space-y-3"
                    >
                        <div>
                            {/* Card Top: Neumorphic Icon & Header */}
                            <div className="flex items-start gap-3 mb-2.5">
                                {/* Compact Icon Pill */}
                                <div
                                    className={`w-11 h-11 rounded-2xl ${report.bg} ${report.border} ${report.glow} border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105`}
                                >
                                    <i className={`fas ${report.icon} text-base ${report.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                            {report.badge}
                                        </span>
                                        {/* Hover info badge */}
                                        <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[9px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                                aria-label="Report information"
                                            >
                                                !
                                            </button>
                                            <div className="tooltip-popover">
                                                <p className="font-bold text-pink-400">Report Details</p>
                                                <p className="text-slate-200 dark:text-slate-300 mt-0.5 text-[11px]">{report.infoText}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                        {report.title}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                        {report.subtitle}
                                    </p>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5 line-clamp-2 pl-0.5">
                                {report.desc}
                            </p>

                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-database text-[9px] mr-1.5 text-pink-500" />
                                {report.count}
                            </div>
                        </div>

                        {/* Card Footer Action */}
                        <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                CSV &amp; Audit Ready
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenModal(report.type); }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#f0f3f8] dark:bg-[#1d1e28] text-pink-600 dark:text-pink-300 border border-white/70 dark:border-[#2a2b38] hover:border-pink-300 dark:hover:border-pink-500/50 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] transition-all active:scale-95 group/btn cursor-pointer"
                            >
                                <span>Preview &amp; Export</span>
                                <i className="fas fa-arrow-right text-[9px] group-hover/btn:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
