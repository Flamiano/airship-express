"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import ExecutiveChartModal from "../../../components/modals/ExecutiveChartModal";
import OverviewTab from "./tabs/OverviewTab";
import OperationsTab from "./tabs/OperationsTab";
import KpisTab from "./tabs/KpisTab";
import ReportsTab from "./tabs/ReportsTab";
import { ExecutiveDataPayload } from "../hooks/useExecutiveData";
import { buildExecutiveModalConfig, ModalConfig } from "../lib/executiveModalConfig";
import { ChartsSkeleton } from "../../../components/ui/SkeletonLoader";

// Lazy-load heavy tabs with Chart.js / WASM / Prompt logic on-demand
const ForecastTab = dynamic(() => import("./tabs/ForecastTab"), {
    loading: () => <ChartsSkeleton layout="dual-line-doughnut" />,
    ssr: false,
});

const AiChartGeneratorTab = dynamic(() => import("./tabs/AiChartGeneratorTab"), {
    loading: () => <ChartsSkeleton layout="grid-2" />,
    ssr: false,
});

export type TabType = 'overview' | 'operations' | 'kpis' | 'forecast' | 'reports' | 'ai-charts';

export const TABS: { readonly key: TabType; readonly label: string; readonly icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { key: 'operations', label: 'Operations', icon: 'fa-truck' },
    { key: 'kpis', label: 'KPI Deep Dive', icon: 'fa-tachometer-alt' },
    { key: 'ai-charts', label: 'AI Custom Charts', icon: 'fa-wand-magic-sparkles' },
    { key: 'forecast', label: 'Forecast', icon: 'fa-chart-line' },
    { key: 'reports', label: 'Reports', icon: 'fa-file-csv' },
] as const;

interface ExecutiveChartsProps {
    data: ExecutiveDataPayload;
}

export default function ExecutiveCharts({ data }: ExecutiveChartsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [activeChartModal, setActiveChartModal] = useState<ModalConfig | null>(null);

    // Sync tab with URL param
    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabType;
        if (tabParam && TABS.some(t => t.key === tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Recalculate Lenis scroll boundaries smoothly when tab changes
    useEffect(() => {
        const timer = setTimeout(() => {
            (window as any).__lenis?.resize();
        }, 100);
        return () => clearTimeout(timer);
    }, [activeTab]);

    // Switch tab using router.replace (prevents polluting navigation history stack)
    const handleTabChange = useCallback((tab: TabType) => {
        if (tab === activeTab) return;
        setActiveTab(tab);
        router.replace(`?tab=${tab}`, { scroll: false });
    }, [activeTab, router]);

    // Open modal with pre-configured domain reports
    const openReportModal = useCallback((reportType: string, extraData?: any) => {
        const config = buildExecutiveModalConfig(reportType, data, extraData);
        if (config) {
            setActiveChartModal(config);
        }
    }, [data]);

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto max-w-full sm:w-fit p-1.5 rounded-2xl bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] border border-slate-200/50 dark:border-slate-800/60 no-scrollbar touch-pan-x">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => handleTabChange(tab.key)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                                isActive
                                    ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]'
                                    : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                            }`}
                        >
                            <i className={`fas ${tab.icon} text-xs ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Views */}
            {activeTab === 'overview' && (
                <OverviewTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'operations' && (
                <OperationsTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'kpis' && (
                <KpisTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'ai-charts' && (
                <AiChartGeneratorTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'forecast' && (
                <ForecastTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'reports' && (
                <ReportsTab data={data} onOpenModal={openReportModal} />
            )}

            {/* Chart Detail / Manifest Modal */}
            {activeChartModal && (
                <ExecutiveChartModal
                    isOpen={!!activeChartModal}
                    onClose={() => setActiveChartModal(null)}
                    {...activeChartModal}
                />
            )}
        </div>
    );
}