"use client";

import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

interface ScanSummaryProps {
    lastScan: string;
    trackingNumber?: string;
    lastScanStatus?: string;
}

export function ScanSummary({ lastScan, trackingNumber, lastScanStatus }: ScanSummaryProps) {
    const getStatusTone = (status?: string) => {
        if (!status) return 'neutral' as const;
        switch (status) {
            case 'verified':
            case 'received':
                return 'emerald' as const;
            case 'rejected':
                return 'rose' as const;
            default:
                return 'amber' as const;
        }
    };

    const getStatusIcon = (status?: string) => {
        if (!status) return 'fa-circle';
        switch (status) {
            case 'verified':
            case 'received':
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
                    <span className="ml-2 inline-flex align-middle">
                        <StatusBadge
                            tone={getStatusTone(lastScanStatus)}
                            icon={`fas ${getStatusIcon(lastScanStatus)}`}
                            size="xs"
                        >
                            {lastScanStatus}
                        </StatusBadge>
                    </span>
                )}
            </span>
        </div>
    );
}