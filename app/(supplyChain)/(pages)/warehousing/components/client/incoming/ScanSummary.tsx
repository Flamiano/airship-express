"use client";

interface ScanSummaryProps {
    lastScan: string;
    trackingNumber?: string;
    lastScanStatus?: string;
}

export function ScanSummary({ lastScan, trackingNumber, lastScanStatus }: ScanSummaryProps) {
    const getStatusColor = (status?: string) => {
        if (!status) return 'text-slate-500';
        switch (status) {
            case 'verified':
                return 'text-emerald-600';
            case 'rejected':
                return 'text-red-600';
            default:
                return 'text-yellow-600';
        }
    };

    const getStatusIcon = (status?: string) => {
        if (!status) return 'fa-circle';
        switch (status) {
            case 'verified':
                return 'fa-check-circle';
            case 'rejected':
                return 'fa-times-circle';
            default:
                return 'fa-clock';
        }
    };


    return (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 sm:gap-4 font-medium">
            <span>
                Last scan: <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">{lastScan}</span>
                {trackingNumber && (
                    <span className="ml-1 text-slate-400 dark:text-slate-500">
                        (TRK: <span className="font-mono text-slate-600 dark:text-slate-300">{trackingNumber}</span>)
                    </span>
                )}
                {lastScanStatus && (
                    <span className={`ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusColor(lastScanStatus)}`}>
                        <i className={`fas ${getStatusIcon(lastScanStatus)} text-[10px]`}></i>
                        <span>{lastScanStatus}</span>
                    </span>
                )}
            </span>
        </div>
    );
}