"use client";

import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface KpisTabProps {
    data: ExecutiveDataPayload;
    onOpenModal: (reportType: string) => void;
}

export default function KpisTab({ data, onOpenModal }: KpisTabProps) {
    const handleKpiClick = (kpiId: string) => {
        switch (kpiId) {
            case 'total-parcels':
            case 'delivery-rate':
                onOpenModal('parcels');
                break;
            case 'active-couriers':
                onOpenModal('couriers');
                break;
            case 'inventory-items':
                onOpenModal('inventory');
                break;
            case 'pending-requests':
                onOpenModal('procurement');
                break;
            case 'documents':
                onOpenModal('documents');
                break;
            default:
                onOpenModal('executive');
                break;
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.kpis.map((kpi) => (
                    <div
                        key={kpi.id}
                        onClick={() => handleKpiClick(kpi.id)}
                        className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-pink-300 dark:hover:border-pink-900/50 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {kpi.label}
                                </span>
                                {/* Hover info badge ! with details about this KPI */}
                                <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                        aria-label="KPI information"
                                    >
                                        !
                                    </button>
                                    <div className="tooltip-popover">
                                        <p className="font-bold text-pink-400">{kpi.label} Metric</p>
                                        <p className="text-slate-200 dark:text-slate-300 mt-1">{kpi.description}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                                <i className={`fas ${kpi.icon} ${kpi.color} text-sm`} />
                            </div>
                        </div>

                        <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {kpi.value}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                            <span className={`font-semibold px-2 py-0.5 rounded-full ${
                                kpi.changeType === 'up'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : kpi.changeType === 'down'
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                                {kpi.change}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] group-hover:text-pink-500 transition-colors font-medium">
                                Click for deep dive &rarr;
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Deep Dive Action Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/60 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <i className="fas fa-microscope text-pink-400"></i>
                        <span>Executive Intelligence Deep Dive</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                        Filter metrics by department, operational status, or custom export specs. View line-by-line audit manifests.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onOpenModal('executive')}
                    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs transition-all shadow-md shrink-0 cursor-pointer"
                >
                    Open Deep Dive Filter
                </button>
            </div>
        </div>
    );
}
