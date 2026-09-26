"use client";

import { useEffect, useState } from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { toast } from "sonner";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";
import { exportExecutiveReport, ExecutiveExportScope } from "../../lib/executiveExportUtils";

interface ExecutivePdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ExecutiveDataPayload;
    initialTab?: string;
}

const TAB_SCOPES: { id: ExecutiveExportScope; label: string; icon: string; desc: string }[] = [
    { id: 'all', label: 'All Tabs (Master)', icon: 'fa-layer-group', desc: 'Unified briefing across all operational domains' },
    { id: 'overview', label: 'Overview', icon: 'fa-chart-pie', desc: 'High-level scorecard, daily trends, and quick summaries' },
    { id: 'operations', label: 'Operations', icon: 'fa-truck', desc: 'Warehouse queues, courier allocation, and status distribution' },
    { id: 'kpis', label: 'KPI Deep Dive', icon: 'fa-tachometer-alt', desc: 'Complete 8-metric scorecard and strategic takeaways' },
    { id: 'forecast', label: 'Forecast', icon: 'fa-chart-line', desc: '7-day parcel intake predictions and monthly spend forecast' },
    { id: 'reports', label: 'Reports / Ledger', icon: 'fa-file-csv', desc: 'Verified parcel manifests and audit transactions' },
];

export default function ExecutivePdfExportModal({
    isOpen,
    onClose,
    data,
    initialTab = 'overview',
}: ExecutivePdfExportModalProps) {
    const [selectedScope, setSelectedScope] = useState<ExecutiveExportScope>(
        (initialTab as ExecutiveExportScope) || 'overview'
    );
    const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'word' | 'excel'>('pdf');
    const [includeCharts, setIncludeCharts] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    // Sync initial tab when modal opens
    useEffect(() => {
        if (isOpen && initialTab) {
            const validScope = TAB_SCOPES.find(t => t.id === initialTab)?.id;
            if (validScope) {
                setSelectedScope(validScope);
            }
        }
    }, [isOpen, initialTab]);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isExporting) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isExporting, onClose]);

    if (!isOpen) return null;

    const handleExecuteExport = async () => {
        setIsExporting(true);
        try {
            await exportExecutiveReport(data, {
                scope: selectedScope,
                format: selectedFormat,
                includeCharts,
            });

            const scopeName = TAB_SCOPES.find(t => t.id === selectedScope)?.label || 'Executive';
            const formatName = selectedFormat === 'pdf' ? 'PDF' : selectedFormat === 'word' ? 'Word' : 'Excel';
            toast.success(`Exported ${scopeName} report in ${formatName}!`);
            onClose();
        } catch (err: any) {
            console.error("Executive export error:", err);
            toast.error(err?.message || "Failed to generate report export.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                    if (e.target === e.currentTarget && !isExporting) onClose();
                }}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh]"
                    data-lenis-prevent
                >
                    {/* Header */}
                    <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-800 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                                <img
                                    src="/images/logo-remove-bg.png"
                                    alt="Airship Express Logo"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                        Export Executive Intelligence
                                    </h2>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 uppercase tracking-wider">
                                        Multi-Tab
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Export any operational tab or generate a master briefing report
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            disabled={isExporting}
                            aria-label="Close export modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 overflow-y-auto">
                        {/* 1. Tab Scope Selection */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                1. Select Report Scope & Tab Content
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {TAB_SCOPES.map((scope) => {
                                    const isSelected = selectedScope === scope.id;
                                    return (
                                        <button
                                            key={scope.id}
                                            type="button"
                                            onClick={() => setSelectedScope(scope.id)}
                                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-pink-50/80 dark:bg-pink-950/30 border-pink-400 dark:border-pink-600 shadow-[inset_1.5px_1.5px_3px_rgba(236,72,153,0.15)] ring-2 ring-pink-500/20'
                                                    : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                                                    isSelected ? 'bg-pink-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    <i className={`fas ${scope.icon}`}></i>
                                                </div>
                                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                    {scope.label}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-snug">
                                                {scope.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Format Selection */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                2. Select Export Format
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {/* PDF */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('pdf')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'pdf'
                                            ? 'bg-pink-50/80 dark:bg-pink-950/30 border-pink-400 dark:border-pink-600 shadow-[inset_1.5px_1.5px_3px_rgba(236,72,153,0.15)] ring-2 ring-pink-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                                        selectedFormat === 'pdf' ? 'bg-pink-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-pdf"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">PDF Document</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Instant Print Overlay</span>
                                </button>

                                {/* Word */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('word')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'word'
                                            ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-[inset_1.5px_1.5px_3px_rgba(59,130,246,0.15)] ring-2 ring-blue-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                                        selectedFormat === 'word' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-word"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">Word (.doc)</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Editable Document</span>
                                </button>

                                {/* Excel */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('excel')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'excel'
                                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-[inset_1.5px_1.5px_3px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                                        selectedFormat === 'excel' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-excel"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">Excel (.xls)</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Structured Workbook</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Visual Layout Preference */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                3. Content Layout Options
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                    onClick={() => setIncludeCharts(true)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        includeCharts
                                            ? 'bg-pink-50/60 dark:bg-pink-950/20 border-pink-400 dark:border-pink-600'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 opacity-75 hover:opacity-100'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                        includeCharts ? 'border-pink-500 bg-pink-500 text-white' : 'border-slate-400'
                                    }`}>
                                        {includeCharts && <i className="fas fa-check text-[8px]"></i>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <i className="fas fa-chart-line text-pink-500 text-xs"></i>
                                            <span>Include Charts & Visuals</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Captures high-resolution visual curves, volume distributions, and graphs.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setIncludeCharts(false)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        !includeCharts
                                            ? 'bg-pink-50/60 dark:bg-pink-950/20 border-pink-400 dark:border-pink-600'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 opacity-75 hover:opacity-100'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                        !includeCharts ? 'border-pink-500 bg-pink-500 text-white' : 'border-slate-400'
                                    }`}>
                                        {!includeCharts && <i className="fas fa-check text-[8px]"></i>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <i className="fas fa-table-list text-pink-500 text-xs"></i>
                                            <span>Text & Tables Only</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Instant & compact. Pure data tables, audit ledgers, and scorecards with no graphics.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Box */}
                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <i className="fas fa-info-circle text-pink-500"></i>
                                <span>Export Scope Summary:</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Target: <strong>{TAB_SCOPES.find(t => t.id === selectedScope)?.label}</strong> · {data.parcels?.length || 0} parcels indexed · SLA Rate: {data.pageKpis?.ontimeRate || '0.0%'} · {Object.keys(data.courierBreakdown || {}).length} active couriers.
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 bg-[#ebf0f7]/50 dark:bg-[#14151c]/50 flex items-center justify-end gap-2.5">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onClose}
                            disabled={isExporting}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            type="button"
                            variant="pink"
                            size="sm"
                            onClick={handleExecuteExport}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <>
                                    <i className="fas fa-circle-notch fa-spin text-xs"></i>
                                    <span>Generating Export...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-download text-xs"></i>
                                    <span>Export Report</span>
                                </>
                            )}
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
