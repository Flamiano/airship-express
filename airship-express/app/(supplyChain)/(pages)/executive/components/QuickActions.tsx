"use client";

import Link from "next/link";

export default function QuickActions() {
    const handleAction = (action: string) => {
        console.log(`Action triggered: ${action}`);
    };

    return (
        <div className="bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-5 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] flex flex-col justify-between transition-all">
            <div>
                <div className="flex items-center pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06] mb-4">
                    <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center mr-3 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] shrink-0">
                        <i className="fas fa-bolt text-xs"></i>
                    </div>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Quick actions</span>
                </div>

                <div className="p-4 bg-[#ebf0f7] dark:bg-[#12131b] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)]">
                    <div className="grid grid-cols-2 gap-2.5">
                        <Link
                            href="/warehousing"
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                            bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                            border border-white/90 dark:border-white/[0.08]
                            shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                            dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                            hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                            active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                            active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <i className="fas fa-scan text-pink-500 dark:text-pink-400 text-xs"></i>
                            <span>Scan Parcel</span>
                        </Link>
                        <Link
                            href="/purchase-orders"
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                            bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                            border border-white/90 dark:border-white/[0.08]
                            shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                            dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                            hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                            active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                            active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <i className="fas fa-file-invoice text-pink-500 dark:text-pink-400 text-xs"></i>
                            <span>Create PO</span>
                        </Link>
                        <Link
                            href="/documents?modal=upload"
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                            bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                            border border-white/90 dark:border-white/[0.08]
                            shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                            dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                            hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                            active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                            active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <i className="fas fa-upload text-pink-500 dark:text-pink-400 text-xs"></i>
                            <span>Upload doc</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => handleAction('view-forecast')}
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                            bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                            border border-white/90 dark:border-white/[0.08]
                            shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                            dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                            hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                            active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                            active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <i className="fas fa-chart-line text-pink-500 dark:text-pink-400 text-xs"></i>
                            <span>View forecast</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}