"use client";

import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface KpisTabProps {
    data: ExecutiveDataPayload;
    onOpenModal: (reportType: string) => void;
}

// Map each KPI id to matching Raindrop pill colors & icons
function getKpiRaindropStyles(kpiId: string) {
    switch (kpiId) {
        case 'total-parcels':
            return {
                bg: 'bg-pink-50 dark:bg-pink-950/40',
                border: 'border-pink-200 dark:border-pink-800/40',
                iconColor: 'text-pink-600 dark:text-pink-400',
                glow: 'shadow-[0_2px_10px_rgba(236,72,153,0.15)]',
                icon: 'fa-box',
                accentLine: 'from-pink-500 to-rose-500'
            };
        case 'active-couriers':
            return {
                bg: 'bg-indigo-50 dark:bg-indigo-950/40',
                border: 'border-indigo-200 dark:border-indigo-800/40',
                iconColor: 'text-indigo-600 dark:text-indigo-400',
                glow: 'shadow-[0_2px_10px_rgba(99,102,241,0.15)]',
                icon: 'fa-truck-fast',
                accentLine: 'from-indigo-500 to-purple-500'
            };
        case 'delivery-rate':
            return {
                bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                border: 'border-emerald-200 dark:border-emerald-800/40',
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                glow: 'shadow-[0_2px_10px_rgba(16,185,129,0.15)]',
                icon: 'fa-circle-check',
                accentLine: 'from-emerald-500 to-teal-500'
            };
        case 'inventory-items':
            return {
                bg: 'bg-amber-50 dark:bg-amber-950/40',
                border: 'border-amber-200 dark:border-amber-800/40',
                iconColor: 'text-amber-600 dark:text-amber-400',
                glow: 'shadow-[0_2px_10px_rgba(245,158,11,0.15)]',
                icon: 'fa-warehouse',
                accentLine: 'from-amber-500 to-orange-500'
            };
        case 'pending-requests':
            return {
                bg: 'bg-purple-50 dark:bg-purple-950/40',
                border: 'border-purple-200 dark:border-purple-800/40',
                iconColor: 'text-purple-600 dark:text-purple-400',
                glow: 'shadow-[0_2px_10px_rgba(168,85,247,0.15)]',
                icon: 'fa-file-invoice-dollar',
                accentLine: 'from-purple-500 to-indigo-500'
            };
        case 'documents':
            return {
                bg: 'bg-cyan-50 dark:bg-cyan-950/40',
                border: 'border-cyan-200 dark:border-cyan-800/40',
                iconColor: 'text-cyan-600 dark:text-cyan-400',
                glow: 'shadow-[0_2px_10px_rgba(6,182,212,0.15)]',
                icon: 'fa-folder-open',
                accentLine: 'from-cyan-500 to-blue-500'
            };
        default:
            return {
                bg: 'bg-pink-50 dark:bg-pink-950/40',
                border: 'border-pink-200 dark:border-pink-800/40',
                iconColor: 'text-pink-600 dark:text-pink-400',
                glow: 'shadow-[0_2px_10px_rgba(236,72,153,0.12)]',
                icon: 'fa-tachometer-alt',
                accentLine: 'from-pink-500 to-rose-500'
            };
    }
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
        <div className="space-y-4">
            {/* Header Raindrop Banner (Compact) */}
            <div className="p-3.5 sm:p-4 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Compact Icon Pill */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-sm shadow-[0_2px_8px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                        <i className="fas fa-tachometer-alt" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Executive KPI Performance &amp; Deep Dive
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Real-time core performance indicators across logistics, inventory capacity, and procurement.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-pink-700 dark:text-pink-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                        {data.kpis.length} Key Metrics
                    </span>
                </div>
            </div>

            {/* KPI Cards Grid (Compact & Sleek Neumorphic Design) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {data.kpis.map((kpi) => {
                    const styles = getKpiRaindropStyles(kpi.id);

                    return (
                        <div
                            key={kpi.id}
                            onClick={() => handleKpiClick(kpi.id)}
                            className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#1c1d28] border border-white/80 dark:border-[#2c2d3c] shadow-[5px_5px_14px_rgba(166,175,195,0.35),-5px_-5px_14px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_18px_rgba(0,0,0,0.6),-4px_-4px_14px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_4px_rgba(166,175,195,0.5),-1px_-1px_4px_rgba(255,255,255,0.95)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-3"
                        >
                            {/* Card Top Row: Label & Compact Icon Pill */}
                            <div>
                                <div className="flex items-start justify-between gap-2.5 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            {kpi.label}
                                        </span>
                                        {/* Hover info badge */}
                                        <div className="info-badge-container" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900 text-[9px] font-bold flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 shadow-2xs"
                                                aria-label="KPI information"
                                            >
                                                !
                                            </button>
                                            <div className="tooltip-popover">
                                                <p className="font-bold text-pink-400">{kpi.label} Metric</p>
                                                <p className="text-slate-200 dark:text-slate-300 mt-0.5 text-[11px]">{kpi.description}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Compact Icon Pill */}
                                    <div
                                        className={`w-9 h-9 rounded-xl ${styles.bg} ${styles.border} ${styles.glow} border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}
                                    >
                                        <i className={`fas ${styles.icon} text-xs ${styles.iconColor}`} />
                                    </div>
                                </div>

                                {/* Metric Number */}
                                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                    {kpi.value}
                                </div>
                            </div>

                            {/* Card Bottom Row: Change Delta Badge & Deep Dive Link */}
                            <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                                <span
                                    className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full border shadow-2xs ${
                                        kpi.changeType === 'up'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                                            : kpi.changeType === 'down'
                                                ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                                                : 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60'
                                    }`}
                                >
                                    <i
                                        className={`fas ${
                                            kpi.changeType === 'up'
                                                ? 'fa-arrow-trend-up'
                                                : kpi.changeType === 'down'
                                                    ? 'fa-arrow-trend-down'
                                                    : 'fa-minus'
                                        } text-[8px]`}
                                    />
                                    <span>{kpi.change}</span>
                                </span>

                                <span className="text-slate-400 dark:text-slate-500 text-[11px] group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors font-semibold flex items-center gap-1">
                                    <span>Deep dive</span>
                                    <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Deep Dive Action Card (Compact Neumorphic Banner) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] text-slate-900 dark:text-white border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    {/* Compact Icon Pill */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-base shadow-[0_2px_10px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
                        <i className="fas fa-microscope" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Executive Intelligence Deep Dive</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl leading-relaxed">
                            Filter metrics by department, operational status, or custom export specs with instant CSV extraction.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onOpenModal('executive')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold text-xs transition-all shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                    <span>Open Deep Dive</span>
                    <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                </button>
            </div>
        </div>
    );
}
