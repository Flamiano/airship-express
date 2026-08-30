"use client";

import Cards from '@/app/(supplyChain)/components/global/Cards';
import { DownloadBtn } from "@/app/(supplyChain)/components/global/Buttons";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import ExecutiveCharts from './ExecutiveCharts';
import { useExecutiveData } from '../hooks/useExecutiveData';
import { CardsSkeleton, ChartsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';

export default function ExecutiveClientPage() {
    const { data, loading, isRefreshing, isLoadedFromCache, refresh } = useExecutiveData();

    const pageKpis = data?.pageKpis || {
        parcelsToday: 0,
        parcelsChangePct: "0% vs yesterday",
        readyForDispatch: 0,
        readyPct: "0.0% of total queue",
        dispatchedMtd: 0,
        dispatchedChangePct: "0 shipments this month",
        ontimeRate: "0.0%",
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 fade-in bgCard dark:bg-[#2a2a2e]">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0">
                        <i className="fa-solid fa-chart-pie"></i>
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Executive Overview
                            </h1>
                            {/* SWR Cache / Live Status Badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className={`w-2 h-2 rounded-full ${
                                    isRefreshing ? 'bg-amber-500 animate-ping' : isLoadedFromCache ? 'bg-emerald-500' : 'bg-blue-500'
                                }`} />
                                <span>
                                    {isRefreshing
                                        ? "Syncing Live..."
                                        : isLoadedFromCache
                                            ? "Cached"
                                            : loading ? "Loading" : "Live"}
                                </span>
                                {data?.lastUpdated && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        • {data.lastUpdated}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={refresh}
                                    disabled={isRefreshing}
                                    title="Force refresh executive data from server"
                                    className="ml-1 text-slate-400 hover:text-pink-500 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <i className={`fas fa-sync-alt text-[10px] ${isRefreshing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Real-time snapshot of parcel flow, operations, procurement, and inventory derived strictly from database tables.
                        </p>
                    </div>
                </div>

                <div className="shrink-0 self-stretch sm:self-auto flex items-center justify-end">
                    <DownloadBtn />
                </div>
            </div>

            {/* KPI Cards Grid */}
            {loading && !data ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Cards
                        header="Parcels received today"
                        data={pageKpis.parcelsToday.toLocaleString()}
                        description={pageKpis.parcelsChangePct}
                        backHeader="Today Ingestion Log"
                        backDescription={`Parcels created today: ${pageKpis.parcelsToday}\nTrend: ${pageKpis.parcelsChangePct}`}
                    />
                    <Cards
                        header="Ready for dispatch"
                        data={pageKpis.readyForDispatch.toLocaleString()}
                        description={pageKpis.readyPct}
                        backHeader="Outbound Queue"
                        backDescription={`Parcels in ready/sorting state: ${pageKpis.readyForDispatch}\nQueue Ratio: ${pageKpis.readyPct}`}
                    />
                    <Cards
                        header="Dispatched (MTD)"
                        data={pageKpis.dispatchedMtd.toLocaleString()}
                        description={pageKpis.dispatchedChangePct}
                        backHeader="Monthly Dispatched Volume"
                        backDescription={`Month-to-date dispatched shipments: ${pageKpis.dispatchedMtd}`}
                    />
                    <Cards
                        header="Fulfillment Delivery Rate"
                        data={pageKpis.ontimeRate}
                        description={`${data?.parcels.filter(p => p.status === 'delivered').length || 0} total delivered`}
                        backHeader="Delivery SLA Status"
                        backDescription={`Ratio of delivered parcels out of total database records: ${pageKpis.ontimeRate}`}
                    />
                </div>
            )}

            {/* AI Questions */}
            <AiQuestions />

            {/* Executive Charts Container */}
            {loading && !data ? (
                <ChartsSkeleton layout="dual-line-doughnut" />
            ) : (
                data && <ExecutiveCharts data={data} />
            )}
        </div>
    );
}
