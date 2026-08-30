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
            color: 'text-pink-500',
            bg: 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30',
            desc: 'Aggregated high-level snapshot of supply chain activity, document logs, inventory capacity, and total procurement commitments.',
            count: `${data.parcels.length} parcels • ${data.inventory.length} SKUs`,
            infoText: 'Generates aggregated executive overview manifest covering logistics, warehouse stock, and PO commitments.',
        },
        {
            type: 'parcels',
            title: 'Parcel Performance Report',
            subtitle: 'Tracking parcel lifecycle, clearance rate & couriers',
            icon: 'fa-box',
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30',
            desc: 'Detailed analysis of incoming cargo volume, fulfillment timeline, clearance bottlenecks, and courier handoffs in warehousing/inventory format.',
            count: `${data.pageKpis.ontimeRate} SLA fulfillment`,
            infoText: 'Detailed parcel manifest including barcode tracking numbers, status badges, consignees, and courier partners.',
        },
        {
            type: 'inventory',
            title: 'Inventory & Stock Health Audit',
            subtitle: 'Stock levels, min threshold alerts & SKU turnover',
            icon: 'fa-warehouse',
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30',
            desc: 'Complete catalog breakdown showing stock balances, storage bin assignments, low-stock warnings, and valuation.',
            count: `${data.inventory.filter(i => i.current_stock <= i.minimum_stock).length} low-stock alerts`,
            infoText: 'Warehouse inventory audit listing item names, category classifications, and reorder warnings.',
        },
        {
            type: 'procurement',
            title: 'Procurement & Spend Intelligence',
            subtitle: 'PO commitments, approval queues & departmental spend',
            icon: 'fa-shopping-cart',
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30',
            desc: 'Purchase request tracking, vendor PO totals, approval statuses, and monthly budget utilization.',
            count: `₱ ${data.procurementSummary.mtdSpend.toLocaleString()} total committed`,
            infoText: 'Financial spend audit detailing purchase orders, vendor names, and approval stages.',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Executive Intelligence Reports
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Generate and download structured CSV reports with line-by-line manifests and strategic takeaway notes.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportCards.map((report) => (
                    <div
                        key={report.type}
                        onClick={() => onOpenModal(report.type)}
                        className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-pink-300 dark:hover:border-pink-900/50 transition-all cursor-pointer flex flex-col justify-between group"
                    >
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${report.bg} ${report.color}`}>
                                    <i className={`fas ${report.icon} text-base`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            {report.title}
                                        </h3>
                                        {/* Hover info badge ! with details about this report */}
                                        <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                                aria-label="Report information"
                                            >
                                                !
                                            </button>
                                            <div className="tooltip-popover">
                                                <p className="font-bold text-pink-400">Report Details</p>
                                                <p className="text-slate-200 dark:text-slate-300 mt-1">{report.infoText}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {report.subtitle}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                                {report.desc}
                            </p>

                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <i className="fas fa-database text-[10px] mr-1.5 text-pink-500" />
                                {report.count}
                            </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenModal(report.type); }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40 hover:bg-pink-100 dark:hover:bg-pink-900/60 transition-colors cursor-pointer"
                            >
                                <span>Preview &amp; Export Report</span>
                                <i className="fas fa-arrow-right text-[10px]" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
