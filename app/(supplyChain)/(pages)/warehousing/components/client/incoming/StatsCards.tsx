"use client";

interface StatsCardsProps {
    scanned: number;
    topCourier: string;
}

export function StatsCards({ scanned, topCourier }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 self-center w-full">
            <div className="bg-slate-50/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Scanned
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                    {scanned ?? 0}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-barcode text-[9px]"></i>
                    <span>total processed</span>
                </div>
            </div>

            <div className="bg-slate-50/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all p-3.5 sm:p-4 rounded-2xl text-center flex flex-col items-center justify-center shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Top Courier
                </span>
                <div
                    className="text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 tracking-tight mt-1 truncate max-w-full px-1"
                    title={topCourier || "N/A"}
                >
                    {topCourier || "—"}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <i className="fas fa-truck text-[9px]"></i>
                    <span>highest volume</span>
                </div>
            </div>
        </div>
    );
}