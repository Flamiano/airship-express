'use client';

import { VerificationJob } from '../modals/UploadReceiptModal';

interface ReceiptProcessingIndicatorProps {
    job: VerificationJob | null;
    onClick: () => void;
    onDismiss?: () => void;
}

export function ReceiptProcessingIndicator({
    job,
    onClick,
    onDismiss,
}: ReceiptProcessingIndicatorProps) {
    if (!job) return null;

    const isProcessing = job.status === 'processing';
    const isMatched = job.status === 'matched';
    const isMismatched = job.status === 'mismatched';
    const isForced = job.status === 'forced';

    return (
        <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-5 duration-300">
            <div
                onClick={onClick}
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
                        <span className="font-mono text-[10px] opacity-75">#{job.poNumber}</span>
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
