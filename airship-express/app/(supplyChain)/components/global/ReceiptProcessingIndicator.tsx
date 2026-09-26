'use client';

import React, { useState } from 'react';
import { VerificationJob, ReceiptQueueItem } from '../modals/UploadReceiptModal';

interface ReceiptProcessingIndicatorProps {
    job?: VerificationJob | null;
    queue?: ReceiptQueueItem[];
    onClick?: (poId?: string) => void;
    onDismiss?: () => void;
    onClearCompleted?: () => void;
}

export function ReceiptProcessingIndicator({
    job,
    queue = [],
    onClick,
    onDismiss,
    onClearCompleted,
}: ReceiptProcessingIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasQueue = queue && queue.length > 0;
    if (!hasQueue && !job) return null;

    // Multi-item Queue View
    if (hasQueue) {
        const activeItems = queue.filter(q => q.status === 'queued' || q.status === 'processing');
        const completedItems = queue.filter(q => q.status === 'matched' || q.status === 'mismatched' || q.status === 'error');
        const processingItem = queue.find(q => q.status === 'processing');
        const hasActive = activeItems.length > 0;

        return (
            <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-5 duration-300 flex flex-col items-end gap-2">
                {/* Expanded Queue Drawer */}
                {isExpanded && (
                    <div className="w-80 max-h-80 overflow-y-auto bg-slate-900/95 dark:bg-[#12131b]/95 backdrop-blur-xl border border-slate-700/80 dark:border-white/10 rounded-2xl shadow-2xl p-3.5 text-xs text-white space-y-2.5 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 dark:border-white/10">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-layer-group text-pink-400"></i>
                                <span className="font-bold text-slate-200">OCR Verification Queue</span>
                                <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold text-[10px]">
                                    {queue.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsExpanded(false)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white"
                            >
                                <i className="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {queue.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        onClick?.(item.poId);
                                        setIsExpanded(false);
                                    }}
                                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer flex items-center justify-between gap-2 border border-white/5"
                                >
                                    <div className="min-w-0">
                                        <div className="font-bold text-[11px] truncate flex items-center gap-1.5">
                                            <span className="font-mono text-pink-300">#{item.poNumber}</span>
                                            <span className="text-slate-400 truncate">{item.supplierName}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.fileName}</p>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold">
                                        {item.status === 'processing' && (
                                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center gap-1">
                                                <i className="fas fa-spinner fa-spin text-[9px]"></i> Running
                                            </span>
                                        )}
                                        {item.status === 'queued' && (
                                            <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 flex items-center gap-1">
                                                <i className="fas fa-hourglass-start text-[9px]"></i> Queued
                                            </span>
                                        )}
                                        {item.status === 'matched' && (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                                                <i className="fas fa-check text-[9px]"></i> Matched
                                            </span>
                                        )}
                                        {item.status === 'mismatched' && (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                                                <i className="fas fa-triangle-exclamation text-[9px]"></i> Mismatch
                                            </span>
                                        )}
                                        {item.status === 'error' && (
                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 flex items-center gap-1">
                                                <i className="fas fa-times text-[9px]"></i> Error
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {completedItems.length > 0 && onClearCompleted && (
                            <div className="pt-1.5 border-t border-slate-800 dark:border-white/10 flex justify-end">
                                <button
                                    type="button"
                                    onClick={onClearCompleted}
                                    className="text-[10px] text-slate-400 hover:text-pink-400 font-semibold cursor-pointer transition-colors"
                                >
                                    Clear completed items ({completedItems.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Queue Summary Floating Pill */}
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`p-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 cursor-pointer select-none transition-all hover:scale-102 active:scale-98 ${
                        hasActive
                            ? 'bg-slate-900/95 text-white border-pink-500/40 ring-2 ring-pink-500/10'
                            : 'bg-emerald-950/90 text-white border-emerald-500/40'
                    }`}
                >
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                        hasActive
                            ? 'bg-pink-500/20 text-pink-400'
                            : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                        {hasActive ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            <i className="fas fa-layer-group"></i>
                        )}
                    </div>

                    {/* Status Text */}
                    <div className="text-xs pr-1">
                        <div className="font-bold flex items-center gap-1.5 leading-tight">
                            <span>
                                {hasActive
                                    ? `OCR Queue: ${activeItems.length} in progress`
                                    : `OCR Queue: All ${queue.length} completed`}
                            </span>
                            {processingItem && (
                                <span className="font-mono text-[10px] text-pink-300">#{processingItem.poNumber}</span>
                            )}
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">
                            {hasActive
                                ? `Analyzing receipts with Gemini · Click to view queue`
                                : `All queued receipts verified · Click to view`}
                        </p>
                    </div>

                    {/* Toggle indicator / Dismiss */}
                    <div className="flex items-center gap-1 ml-1">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="w-5 h-5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-[10px] cursor-pointer"
                            title="Toggle queue details"
                        >
                            <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                        </button>
                        {onDismiss && !hasActive && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss();
                                }}
                                className="w-5 h-5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-[10px] cursor-pointer"
                                title="Dismiss indicator"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Single Job Fallback
    const isProcessing = job?.status === 'processing';
    const isMatched = job?.status === 'matched';
    const isMismatched = job?.status === 'mismatched';

    return (
        <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-5 duration-300">
            <div
                onClick={() => onClick?.(job?.poId)}
                className={`p-3 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 cursor-pointer select-none transition-all hover:scale-102 active:scale-98 ${
                    isProcessing
                        ? 'bg-slate-900/90 text-white border-slate-700/80'
                        : isMatched
                            ? 'bg-emerald-900/90 text-white border-emerald-500/50 ring-2 ring-emerald-500/20'
                            : isMismatched
                                ? 'bg-amber-900/90 text-white border-amber-500/50 ring-2 ring-amber-500/20'
                                : 'bg-blue-900/90 text-white border-blue-500/50'
                }`}
            >
                {/* Status Icon */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                    isProcessing
                        ? 'bg-white/10 text-pink-400'
                        : isMatched
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isMismatched
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-blue-500/20 text-blue-300'
                }`}>
                    {isProcessing ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : isMatched ? (
                        <i className="fas fa-check"></i>
                    ) : isMismatched ? (
                        <i className="fas fa-triangle-exclamation"></i>
                    ) : (
                        <i className="fas fa-shield-alt"></i>
                    )}
                </div>

                {/* Status Text */}
                <div className="text-xs pr-2">
                    <div className="font-bold flex items-center gap-1.5 leading-tight">
                        <span>
                            {isProcessing
                                ? 'Processing Receipt...'
                                : isMatched
                                    ? 'Receipt Verified ✓'
                                    : isMismatched
                                        ? 'Receipt Mismatch ⚠'
                                        : 'Force Inserted ✓'}
                        </span>
                        <span className="font-mono text-[10px] opacity-75">#{job?.poNumber}</span>
                    </div>
                    <p className="text-[10px] opacity-80 mt-0.5">
                        {isProcessing
                            ? 'Gemini OCR is analyzing document'
                            : isMatched
                                ? 'PO marked as Paid'
                                : isMismatched
                                    ? 'Click to review differences'
                                    : 'Administrative override recorded'}
                    </p>
                </div>

                {/* Dismiss X button */}
                {onDismiss && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss();
                        }}
                        className="w-5 h-5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-[10px] cursor-pointer shrink-0 ml-1"
                        title="Dismiss indicator"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                )}
            </div>
        </div>
    );
}
