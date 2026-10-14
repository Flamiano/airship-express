"use client";

import Cards from '../../../components/global/Cards';
import { DownloadBtn } from "../../../components/global/Buttons";
import AiQuestions from "../../../components/global/AiQuestions";
import ExecutiveCharts from './ExecutiveCharts';
import { useExecutiveData } from '../hooks/useExecutiveData';
import { CardsSkeleton, ChartsSkeleton } from '../../../components/ui/SkeletonLoader';
import ExecutivePdfExportModal from './modals/ExecutivePdfExportModal';
import ExecutiveAiSummaryPanel from './ExecutiveAiSummaryPanel';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ExecutiveClientPage() {
    const { data, loading, isRefreshing, isLoadedFromCache, isRealtimeActive, refresh, applyDateFilter, resetDateFilter, activeDateRange } = useExecutiveData();
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    // Synchronize inputs and selected year with active filter
    useEffect(() => {
        if (activeDateRange?.from) {
            setDateFrom(activeDateRange.from);
            setDateTo(activeDateRange.to || activeDateRange.from);
            const y = parseInt(activeDateRange.from.slice(0, 4));
            if (!isNaN(y)) setSelectedYear(y);
        } else {
            setDateFrom('');
            setDateTo('');
        }
    }, [activeDateRange]);

    const handleApplyFilter = () => {
        let from = dateFrom?.trim();
        let to = dateTo?.trim();
        if (!from && !to) return;
        if (!from && to) from = to;
        if (from && !to) to = from;
        if (from > to) {
            const temp = from;
            from = to;
            to = temp;
            setDateFrom(from);
            setDateTo(to);
        }
        applyDateFilter({ from, to });
    };

    const handleResetFilter = () => {
        setDateFrom('');
        setDateTo('');
        resetDateFilter();
    };

    // Determine active month info if activeDateRange matches a full month
    const activeMonthInfo = (() => {
        if (!activeDateRange?.from || !activeDateRange?.to) return null;
        const fromY = activeDateRange.from.slice(0, 4);
        const fromM = activeDateRange.from.slice(5, 7);
        const toY = activeDateRange.to.slice(0, 4);
        const toM = activeDateRange.to.slice(5, 7);
        if (fromY === toY && fromM === toM) {
            const mIdx = parseInt(fromM, 10) - 1;
            const lastDay = new Date(parseInt(fromY, 10), mIdx + 1, 0).getDate();
            if (activeDateRange.from.endsWith('-01') && activeDateRange.to.endsWith(`-${String(lastDay).padStart(2, '0')}`)) {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                return {
                    monthName: months[mIdx],
                    year: parseInt(fromY, 10),
                    fullName: `${months[mIdx]} ${fromY}`,
                    monthIndex: mIdx,
                };
            }
        }
        return null;
    })();

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0 mr-1 flex-wrap">
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

                        {/* Active Month Indicator Tag */}
                        {activeMonthInfo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white shadow-[0_2px_8px_rgba(236,72,153,0.4)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Active: {activeMonthInfo.fullName}
                            </span>
                        ) : activeDateRange ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-[0_2px_8px_rgba(147,51,234,0.35)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Custom Filter Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                All-Time Live
                            </span>
                        )}

                        {/* Year Stepper */}
                        <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] border border-slate-200/40 dark:border-slate-800/60">
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y - 1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 cursor-pointer transition-colors active:scale-90"
                                title="Previous year"
                            >
                                <i className="fas fa-chevron-left text-[9px]" />
                            </button>
                            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 px-1 select-none">
                                {selectedYear}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y + 1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 cursor-pointer transition-colors active:scale-90"
                                title="Next year"
                            >
                                <i className="fas fa-chevron-right text-[9px]" />
                            </button>
                        </div>
                    </div>

                    {/* Month Buttons: Jan - Dec */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            return monthNames.map((name, idx) => {
                                const monthNum = String(idx + 1).padStart(2, '0');
                                const lastDay = new Date(selectedYear, idx + 1, 0).getDate();
                                const fromVal = `${selectedYear}-${monthNum}-01`;
                                const toVal   = `${selectedYear}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
                                const isActive = activeDateRange?.from === fromVal && activeDateRange?.to === toVal;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => {
                                            if (isActive) {
                                                handleResetFilter();
                                            } else {
                                                setDateFrom(fromVal);
                                                setDateTo(toVal);
                                                applyDateFilter({ from: fromVal, to: toVal });
                                            }
                                        }}
                                        title={isActive ? `Click to clear ${name} ${selectedYear} filter (Active)` : `Filter executive metrics for ${name} ${selectedYear}`}
                                        className={`h-7 px-2.5 sm:px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-all duration-200 neu-btn-raised active:scale-95 flex items-center gap-1.5 ${
                                            isActive
                                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-[0_2px_10px_rgba(236,72,153,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] ring-2 ring-pink-400/70 scale-105'
                                                : 'text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1a1b26] shadow-[3px_3px_7px_rgba(166,175,195,0.45),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.45),-3px_-3px_7px_rgba(255,255,255,0.04)] hover:text-pink-500 dark:hover:text-pink-400 hover:shadow-[1px_1px_4px_rgba(166,175,195,0.5)]'
                                        }`}
                                    >
                                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs animate-pulse" />}
                                        <span>{name}</span>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200/70 dark:bg-white/[0.05]" />

                {/* Row 2 — Custom date range + apply/reset */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
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

                        {/* From */}
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilter(); }}
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
                                onChange={(e) => setDateTo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilter(); }}
                                className="neu-date-input"
                            />
                        </div>

                        {/* Apply btn */}
                        <button
                            type="button"
                            onClick={handleApplyFilter}
                            disabled={!dateFrom && !dateTo}
                            className="neu-btn-raised h-8 px-4 rounded-xl text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 flex items-center gap-1.5 cursor-pointer shadow-[4px_4px_10px_rgba(236,72,153,0.4),-2px_-2px_6px_rgba(255,255,255,0.15)] dark:shadow-[4px_4px_10px_rgba(236,72,153,0.35),-2px_-2px_6px_rgba(255,255,255,0.04)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-95 transition-all"
                        >
                            <i className="fas fa-check text-[10px]" />
                            Apply
                        </button>

                        {/* Reset btn — only when active */}
                        {activeDateRange && (
                            <button
                                type="button"
                                onClick={handleResetFilter}
                                className="neu-btn-raised h-8 px-3.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1a1b26] flex items-center gap-1.5 cursor-pointer shadow-[4px_4px_10px_rgba(166,175,195,0.5),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.04)] hover:text-pink-500 dark:hover:text-pink-400 active:scale-95 transition-all"
                            >
                                <i className="fas fa-times text-[10px]" />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Active filter badge */}
                    {activeDateRange && (
                        <div className="flex items-center gap-2">
                            <span className="
                                inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold
                                text-pink-600 dark:text-pink-400
                                bg-[#ebf0f7] dark:bg-[#12131b]
                                shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]
                                dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]
                                border border-pink-200/60 dark:border-pink-900/40
                            ">
                                <i className="fas fa-filter text-[10px] text-pink-500" />
                                <span>{activeDateRange.from} → {activeDateRange.to}</span>
                                <button
                                    type="button"
                                    onClick={handleResetFilter}
                                    title="Clear date filter"
                                    className="ml-1 w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-pink-600 hover:bg-pink-100 dark:hover:bg-pink-950/60 transition-colors cursor-pointer"
                                >
                                    <i className="fas fa-times text-[9px]" />
                                </button>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Filter Scope Notification Banner */}
            {activeDateRange ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-5 sm:py-3 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 dark:from-pink-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 border border-pink-400/40 dark:border-pink-500/30 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <i className="fas fa-calendar-check text-xs" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                    {activeMonthInfo ? `Active Month: ${activeMonthInfo.fullName}` : `Active Custom Range: ${activeDateRange.from} to ${activeDateRange.to}`}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800">
                                    Period Filter
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {pageKpis.openPOs === 0 && pageKpis.inventorySkus === 0 && pageKpis.activeSuppliers === 0
                                    ? `Database queries executed for ${activeMonthInfo?.fullName || `${activeDateRange.from} → ${activeDateRange.to}`}: No records exist in database for this period (0 data found).`
                                    : `Showing warehouse storage, inventory items, purchase orders, and breakdown charts strictly recorded between ${activeDateRange.from} and ${activeDateRange.to}.`}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleResetFilter}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800/60 hover:bg-pink-50 dark:hover:bg-pink-950/50 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                        <i className="fas fa-times text-[10px]" />
                        <span>Clear Filter (All-Time)</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active Scope: <strong className="text-slate-800 dark:text-slate-200">All-Time Cumulative Data</strong>. Click any month in Quick Month or pick a Custom Range to isolate period metrics.</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">No Filter Applied</span>
                </div>
            )}


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
                        description={activeDateRange?.from ? `₱${pageKpis.mtdSpend.toLocaleString()} period spend` : `₱${pageKpis.mtdSpend.toLocaleString()} committed spend`}
                        backHeader={activeDateRange?.from ? "Period Fulfillment" : "PO Fulfillment"}
                        backDescription={activeDateRange?.from
                            ? `Purchase orders recorded in period: ${pageKpis.openPOs}.\nPeriod PO spend: ₱${pageKpis.mtdSpend.toLocaleString()}.`
                            : `Open purchase orders with suppliers: ${pageKpis.openPOs}.\nMTD PO committed spend: ₱${pageKpis.mtdSpend.toLocaleString()}.`
                        }
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
