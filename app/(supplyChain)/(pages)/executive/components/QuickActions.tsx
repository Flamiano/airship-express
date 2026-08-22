"use client";

import Link from "next/link";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";

interface Activity {
    id: number;
    title: React.ReactNode;
    time: string;
    user: string;
    dotColor: string;
}

const activities: Activity[] = [
    {
        id: 1,
        title: (
            <>
                Manifest <b className="font-mono text-slate-900 dark:text-white font-semibold">MF-0421</b> generated for J&amp;T Express
            </>
        ),
        time: "2 minutes ago",
        user: "Joana D.",
        dotColor: "bg-slate-900 dark:bg-white"
    },
    {
        id: 2,
        title: <>PR-2026-001 approved</>,
        time: "14 minutes ago",
        user: "Ramon A.",
        dotColor: "bg-slate-600 dark:bg-slate-400"
    },
    {
        id: 3,
        title: <>VH-004 flagged for maintenance</>,
        time: "1 hour ago",
        user: "Fleet bot",
        dotColor: "bg-slate-400 dark:bg-slate-500"
    },
    {
        id: 4,
        title: <>214 parcels moved to Area B</>,
        time: "2 hours ago",
        user: "Sorting team",
        dotColor: "bg-slate-300 dark:bg-slate-600"
    }
];

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

                <div className="mt-5 border-t border-slate-200/80 dark:border-slate-800 pt-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center mb-4">
                        <i className="fas fa-history mr-2 text-xs text-pink-500 dark:text-pink-400"></i> Recent activity
                    </div>
                    <div className="space-y-3.5">
                        {activities.map((act) => (
                            <div key={act.id} className="flex items-start gap-3 text-xs">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.dotColor}`}></div>
                                <div className="flex-1">
                                    <div className="text-slate-700 dark:text-slate-300">{act.title}</div>
                                    <div className="text-slate-400 text-[10px] mt-0.5">{act.time} • by {act.user}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}