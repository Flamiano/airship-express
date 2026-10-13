"use client";

import Cards from '../../../components/global/Cards';
import { DownloadBtn } from "../../../components/global/Buttons";
import AiQuestions from "../../../components/global/AiQuestions";
import ExecutiveCharts from './ExecutiveCharts';
import { useExecutiveData } from '../hooks/useExecutiveData';
import { CardsSkeleton, ChartsSkeleton } from '../../../components/ui/SkeletonLoader';
import ExecutivePdfExportModal from './modals/ExecutivePdfExportModal';
import ExecutiveAiSummaryPanel from './ExecutiveAiSummaryPanel';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ExecutiveClientPage() {
    const { data, loading, isRefreshing, isLoadedFromCache, isRealtimeActive, refresh, applyDateFilter, resetDateFilter, activeDateRange } = useExecutiveData();
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    const handleApplyFilter = () => {
        if (!dateFrom && !dateTo) return;
        applyDateFilter({ from: dateFrom, to: dateTo || dateFrom });
    };

    const handleResetFilter = () => {
        setDateFrom('');
        setDateTo('');
        resetDateFilter();
    };

    const pageKpis = data?.pageKpis || {
        totalStockUnits: 0,
        totalStockUnitsFormatted: "0 Units",
        inventorySkus: 0,
        lowStockAlerts: 0,
        openPOs: 0,
        mtdSpend: 0,
        mtdSpendFormatted: "₱0",
        activeSuppliers: 0,
        totalSuppliers: 0,
        parcelsToday: 0,
        parcelsChangePct: "0% vs yesterday",
        readyForDispatch: 0,
        readyPct: "0.0%",
        dispatchedMtd: 0,
        dispatchedChangePct: "0 shipments",
        ontimeRate: "0.0%",
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 fade-in bgCard dark:bg-[#2a2a2e]">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                        <img
                            src="/images/logo-remove-bg.png"
                            alt="Airship Express"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Executive Intelligence
                            </h1>
                            {/* SWR Cache / Live Status Badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span className={`w-2 h-2 rounded-full ${
                                    isRefreshing
                                        ? 'bg-amber-500 animate-ping'
                                        : isRealtimeActive
                                            ? 'bg-emerald-500 animate-pulse'
                                            : isLoadedFromCache
                                                ? 'bg-blue-500'
                                                : 'bg-emerald-500'
                                }`} />
                                <span>
                                    {isRefreshing
                                        ? "Syncing Live..."
                                        : isRealtimeActive
                                            ? "Realtime Live"
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
                            Real-time snapshot of warehouse storage, inventory SKUs, purchase orders, and supplier procurement derived strictly from database tables.
                        </p>
                    </div>
                </div>

                <div className="shrink-0 self-stretch sm:self-auto flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={() => {
                            const el = document.getElementById('executive-ai-summary-panel');
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2');
                                setTimeout(() => {
                                    el.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2');
                                }, 2000);
                            }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 shadow-[0_3px_10px_rgba(236,72,153,0.35)] transition-all cursor-pointer active:scale-95"
                        title="Jump to Executive AI Cross-Tab Summary Matrix"
                    >
                        <i className="fas fa-wand-magic-sparkles text-xs" />
                        <span>AI Tab Summary</span>
                    </button>
                    <DownloadBtn onClick={() => setIsPdfModalOpen(true)} />
                </div>
            </div>

            {/* Date Range Filter Bar — Neumorphic */}
            <div className="
                rounded-2xl px-5 py-4
                bg-[#e8edf4] dark:bg-[#1a1b26]
                shadow-[6px_6px_14px_rgba(166,175,195,0.5),-6px_-6px_14px_rgba(255,255,255,0.9)]
                dark:shadow-[6px_6px_14px_rgba(0,0,0,0.5),-6px_-6px_14px_rgba(255,255,255,0.04)]
                flex flex-col gap-3
            ">
                {/* Row 1 — Month quick-filter */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 shrink-0 mr-1">
                        <div className="
                            w-7 h-7 rounded-xl flex items-center justify-center text-pink-500 dark:text-pink-400
                            bg-[#e8edf4] dark:bg-[#1a1b26]
                            shadow-[3px_3px_7px_rgba(166,175,195,0.5),-3px_-3px_7px_rgba(255,255,255,0.9)]
                            dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-3px_-3px_7px_rgba(255,255,255,0.04)]
                        ">
                            <i className="fas fa-layer-group text-[10px]" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            Quick Month
                        </span>
                    </div>
                    {(() => {
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const currentMonth = now.getMonth(); // 0-indexed
                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return monthNames.slice(0, currentMonth + 1).map((name, idx) => {
                            const monthNum = String(idx + 1).padStart(2, '0');
                            const lastDay = new Date(currentYear, idx + 1, 0).getDate();
                            const fromVal = `${currentYear}-${monthNum}-01`;
                            const toVal   = `${currentYear}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
                            const isActive = activeDateRange?.from === fromVal && activeDateRange?.to === toVal;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                        setDateFrom(fromVal);
                                        setDateTo(toVal);
                                        applyDateFilter({ from: fromVal, to: toVal });
                                    }}
                                    className={`h-7 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-all neu-btn-raised ${
                                        isActive
                                            ? 'bg-pink-500 text-white shadow-[2px_2px_6px_rgba(236,72,153,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)]'
                                            : 'text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1a1b26] shadow-[3px_3px_7px_rgba(166,175,195,0.45),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.45),-3px_-3px_7px_rgba(255,255,255,0.04)] hover:text-pink-500 dark:hover:text-pink-400'
                                    }`}
                                >
                                    {name}
                                </button>
                            );
                        });
                    })()}
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200/70 dark:bg-white/[0.05]" />

                {/* Row 2 — Custom date range + apply/reset */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="
                            w-8 h-8 rounded-xl flex items-center justify-center text-pink-500 dark:text-pink-400
                            bg-[#e8edf4] dark:bg-[#1a1b26]
                            shadow-[3px_3px_7px_rgba(166,175,195,0.5),-3px_-3px_7px_rgba(255,255,255,0.9)]
                            dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5),-3px_-3px_7px_rgba(255,255,255,0.04)]
                        ">
                            <i className="fas fa-calendar-alt text-xs" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Custom range
                        </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* From */}
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="neu-date-input"
                            />
                        </div>

                        {/* arrow */}
                        <i className="fas fa-arrow-right text-[10px] text-slate-400 dark:text-slate-600" />

                        {/* To */}
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="neu-date-input"
                            />
                        </div>

                        {/* Apply btn */}
                        <button
                            type="button"
                            onClick={handleApplyFilter}
                            disabled={!dateFrom && !dateTo}
                            className="neu-btn-raised h-8 px-4 rounded-xl text-xs font-bold text-white bg-pink-500 flex items-center gap-1.5 cursor-pointer shadow-[4px_4px_10px_rgba(236,72,153,0.4),-2px_-2px_6px_rgba(255,255,255,0.15)] dark:shadow-[4px_4px_10px_rgba(236,72,153,0.35),-2px_-2px_6px_rgba(255,255,255,0.04)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <i className="fas fa-check text-[10px]" />
                            Apply
                        </button>

                        {/* Reset btn — only when active */}
                        {activeDateRange && (
                            <button
                                type="button"
                                onClick={handleResetFilter}
                                className="neu-btn-raised h-8 px-3.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1a1b26] flex items-center gap-1.5 cursor-pointer shadow-[4px_4px_10px_rgba(166,175,195,0.5),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.04)] hover:text-pink-500 dark:hover:text-pink-400"
                            >
                                <i className="fas fa-times text-[10px]" />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Active filter badge */}
                    {activeDateRange && (
                        <span className="
                            inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold
                            text-pink-600 dark:text-pink-400
                            bg-[#e8edf4] dark:bg-[#1a1b26]
                            shadow-[inset_2px_2px_5px_rgba(166,175,195,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]
                            dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]
                        ">
                            <i className="fas fa-filter text-[9px]" />
                            {activeDateRange.from} → {activeDateRange.to}
                        </span>
                    )}
                </div>
            </div>


            {loading && !data ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Cards
                        header="Warehouse Total Stock Units"
                        data={pageKpis.totalStockUnits.toLocaleString()}
                        description={`${pageKpis.inventorySkus} catalogued SKUs`}
                        backHeader="Warehousing Storage"
                        backDescription={`Total physical units in warehouse storage bins: ${pageKpis.totalStockUnits.toLocaleString()}.\nSKUs tracked: ${pageKpis.inventorySkus}.`}
                    />
                    <Cards
                        header="Inventory Catalog SKUs"
                        data={pageKpis.inventorySkus.toLocaleString()}
                        description={pageKpis.lowStockAlerts > 0 ? `${pageKpis.lowStockAlerts} low-stock alerts` : 'All items optimal'}
                        backHeader="Inventory Health"
                        backDescription={`Catalogued inventory SKUs: ${pageKpis.inventorySkus}.\nItems at or below safety minimum: ${pageKpis.lowStockAlerts}.`}
                    />
                    <Cards
                        header={activeDateRange?.from ? "Purchase Orders (Period)" : "Active Purchase Orders"}
                        data={pageKpis.openPOs.toLocaleString()}
                        description={`₱${pageKpis.mtdSpend.toLocaleString()} committed spend`}
                        backHeader="PO Fulfillment"
                        backDescription={`Open purchase orders with suppliers: ${pageKpis.openPOs}.\nMTD PO committed spend: ₱${pageKpis.mtdSpend.toLocaleString()}.`}
                    />
                    <Cards
                        header="Approved Suppliers Network"
                        data={pageKpis.activeSuppliers.toLocaleString()}
                        description={`${pageKpis.totalSuppliers} registered vendors`}
                        backHeader="Vendor Catalog"
                        backDescription={`Verified active suppliers: ${pageKpis.activeSuppliers} of ${pageKpis.totalSuppliers} registered partners.`}
                    />
                </div>

            )}

            <AiQuestions />

            {/* AI Cross-Tab Summary & Executive Briefing */}
            {data && !loading && (
                <ExecutiveAiSummaryPanel
                    data={data}
                    activeDashboardTab={currentTab}
                />
            )}

            {/* Executive Charts Container */}
            {loading && !data ? (
                <ChartsSkeleton layout="dual-line-doughnut" />
            ) : (
                data && <ExecutiveCharts data={data} />
            )}

            {/* Executive Official Multi-Tab Export Modal */}
            {data && (
                <ExecutivePdfExportModal
                    isOpen={isPdfModalOpen}
                    onClose={() => setIsPdfModalOpen(false)}
                    data={data}
                    initialTab={currentTab}
                />
            )}
        </div>
    );
}
