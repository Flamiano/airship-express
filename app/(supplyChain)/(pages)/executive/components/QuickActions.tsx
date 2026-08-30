"use client";

import Link from "next/link";

export default function QuickActions() {
    const handleAction = (action: string) => {
        console.log(`Action triggered: ${action}`);
    };

    return (
        <div className="card p-5 
                        bg-white dark:bg-slate-900 
                        border border-slate-200/80 dark:border-slate-800 
                        rounded-2xl shadow-sm">
            <div className="font-semibold text-sm text-slate-900 dark:text-white mb-3.5 flex items-center">
                <div className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center mr-2 border border-pink-100 dark:border-pink-900/30 shadow-2xs">
                    <i className="fas fa-bolt text-xs"></i>
                </div>
                <span>Quick actions</span>
            </div>

            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl 
                            border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                    <Link
                        href="/warehousing"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold
                        bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200
                        border border-slate-200/90 dark:border-slate-800
                        shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] 
                        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]
                        hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700
                        hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                        <i className="fas fa-scan text-pink-500 dark:text-pink-400 text-xs"></i>
                        <span>Scan Parcel</span>
                    </Link>
                    <Link
                        href="/purchase-orders"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold
                        bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200
                        border border-slate-200/90 dark:border-slate-800
                        shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] 
                        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]
                        hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700
                        hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                        <i className="fas fa-file-invoice text-pink-500 dark:text-pink-400 text-xs"></i>
                        <span>Create PO</span>
                    </Link>
                    <Link
                        href="/documents?modal=upload"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold
                        bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200
                        border border-slate-200/90 dark:border-slate-800
                        shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] 
                        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]
                        hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700
                        hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                        <i className="fas fa-upload text-pink-500 dark:text-pink-400 text-xs"></i>
                        <span>Upload document</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => handleAction('view-forecast')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold
                        bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200
                        border border-slate-200/90 dark:border-slate-800
                        shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] 
                        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]
                        hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700
                        hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                        <i className="fas fa-chart-line text-pink-500 dark:text-pink-400 text-xs"></i>
                        <span>View forecast</span>
                    </button>
                </div>
            </div>
        </div>
    );
}