"use client";

import { useState } from "react";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";
import { toast } from "sonner";
import { exportForecastReport, ForecastReportData } from "../lib/forecastExportUtils";

interface ForecastExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    forecastData: ForecastReportData | null;
    chartCanvases?: {
        parcelChart?: HTMLCanvasElement | null;
        expenseChart?: HTMLCanvasElement | null;
        courierChart?: HTMLCanvasElement | null;
    };
}

export default function ForecastExportModal({
    isOpen,
    onClose,
    forecastData,
    chartCanvases,
}: ForecastExportModalProps) {
    const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'word' | 'excel'>('pdf');
    const [includeCharts, setIncludeCharts] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    if (!isOpen || !forecastData) return null;

    const handleExecuteExport = async () => {
        setIsExporting(true);
        try {
            await exportForecastReport(forecastData, {
                format: selectedFormat,
                includeCharts,
                chartCanvases,
            });

            const formatNames = {
                pdf: 'PDF (Print & Save)',
                word: 'Microsoft Word (.doc)',
                excel: 'Microsoft Excel (.xls)',
            };
            toast.success(`Forecast report generated in ${formatNames[selectedFormat]}!`);
            onClose();
        } catch (err: any) {
            console.error("Export error:", err);
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
                    className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] max-w-xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
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
                                        Export Forecast Report
                                    </h2>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 uppercase tracking-wider">
                                        Airship Express
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Select document format and chart visualization layout
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
                    <div className="p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300">
                        {/* 1. Format Selection */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                1. Select Export Format
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {/* PDF */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('pdf')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'pdf'
                                            ? 'bg-pink-50/80 dark:bg-pink-950/30 border-pink-400 dark:border-pink-600 shadow-[inset_1.5px_1.5px_3px_rgba(236,72,153,0.15)] ring-2 ring-pink-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                                        selectedFormat === 'pdf' ? 'bg-pink-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-pdf"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">PDF Document</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Print & Save</span>
                                </button>

                                {/* Word */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('word')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'word'
                                            ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-[inset_1.5px_1.5px_3px_rgba(59,130,246,0.15)] ring-2 ring-blue-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                                        selectedFormat === 'word' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-word"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">Word (.doc)</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Editable Report</span>
                                </button>

                                {/* Excel */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedFormat('excel')}
                                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                                        selectedFormat === 'excel'
                                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-[inset_1.5px_1.5px_3px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                                        selectedFormat === 'excel' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <i className="fas fa-file-excel"></i>
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">Excel (.xls)</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Spreadsheet Data</span>
                                </button>
                            </div>
                        </div>

                        {/* 2. Visual Content Preference */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                2. Content Layout Options
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* With Charts */}
                                <div
                                    onClick={() => setIncludeCharts(true)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        includeCharts
                                            ? 'bg-pink-50/60 dark:bg-pink-950/20 border-pink-400 dark:border-pink-600'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 opacity-75 hover:opacity-100'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                        includeCharts ? 'border-pink-500 bg-pink-500 text-white' : 'border-slate-400'
                                    }`}>
                                        {includeCharts && <i className="fas fa-check text-[9px]"></i>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <i className="fas fa-chart-line text-pink-500 text-xs"></i>
                                            <span>Include Charts & Visuals</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Captures snapshots of trend charts, outlay graphs, and courier shares alongside data tables.
                                        </p>
                                    </div>
                                </div>

                                {/* Text & Tables Only */}
                                <div
                                    onClick={() => setIncludeCharts(false)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                        !includeCharts
                                            ? 'bg-pink-50/60 dark:bg-pink-950/20 border-pink-400 dark:border-pink-600'
                                            : 'bg-[#ebf0f7] dark:bg-[#14151c] border-slate-200/60 dark:border-slate-800 opacity-75 hover:opacity-100'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                        !includeCharts ? 'border-pink-500 bg-pink-500 text-white' : 'border-slate-400'
                                    }`}>
                                        {!includeCharts && <i className="fas fa-check text-[9px]"></i>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <i className="fas fa-table-list text-pink-500 text-xs"></i>
                                            <span>Text & Tables Only</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            Compact, clean tabular breakdown with no images. Best for quick audits and small file sizes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary of export content */}
                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <i className="fas fa-info-circle text-pink-500"></i>
                                <span>Export Contents Summary:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
                                <li><strong>7-Day Parcel Forecast:</strong> {forecastData.parcel_7_day.total_next_week.toLocaleString()} projected parcels ({forecastData.parcel_7_day.model_used || 'Holt-Winters'})</li>
                                <li><strong>Procurement Forecast:</strong> ₱{forecastData.expense_next_month.prediction.toLocaleString()} estimated next month outlay</li>
                                <li><strong>Operational Peaks:</strong> Busiest month, peak incoming day, and rush hour window</li>
                                <li><strong>Courier Leaderboard:</strong> Distribution share of active courier dispatch partners</li>
                            </ul>
                        </div>
                    </div>

                    {/* Footer / Actions */}
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
                                    <span>Generating Report...</span>
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
