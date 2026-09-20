"use client";

interface StatsCardsProps {
    scanned: number;
    topCourier: string;
}

export function StatsCards({ scanned, topCourier }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 self-center w-full">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors p-3.5 sm:p-4 text-center flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Scanned
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
                    {scanned ?? 0}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-barcode text-[9px] text-pink-500"></i>
                    <span>total processed</span>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors p-3.5 sm:p-4 text-center flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Top Courier
                </span>
                <div
                    className="text-xl sm:text-2xl font-bold text-pink-600 dark:text-pink-400 tracking-tight mt-1 truncate max-w-full px-1"
                    title={topCourier || "N/A"}
                >
                    {topCourier || "—"}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-truck text-[9px] text-pink-500"></i>
                    <span>highest volume</span>
                </div>
            </div>
        </div>
    );
}