"use client";

import { LinkBtn } from "@/app/(supplyChain)/components/global/Buttons";

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
                <div className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center mr-2 border border-pink-100 dark:border-pink-900/30">
                    <i className="fas fa-bolt text-xs"></i>
                </div>
                <span>Quick actions</span>
            </div>

            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl 
                            border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                    <LinkBtn
                        link='/warehousing'
                        icon='fas fa-scan mr-1.5 text-xs'
                        label='Scan Parcel'
                        className="flex items-center justify-center px-3 py-2.5 rounded-xl 
                                   border border-slate-200/80 dark:border-slate-700/70 
                                   bg-white dark:bg-slate-800 
                                   hover:bg-slate-900 dark:hover:bg-pink-500 
                                   hover:text-white dark:hover:text-white 
                                   text-slate-800 dark:text-slate-200 
                                   text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                    />
                    <LinkBtn
                        link='/purchase-orders'
                        icon='fas fa-file-invoice mr-1.5 text-xs'
                        label='Create PO'
                        className="flex items-center justify-center px-3 py-2.5 rounded-xl 
                                   border border-slate-200/80 dark:border-slate-700/70 
                                   bg-white dark:bg-slate-800 
                                   hover:bg-slate-900 dark:hover:bg-pink-500 
                                   hover:text-white dark:hover:text-white 
                                   text-slate-800 dark:text-slate-200 
                                   text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                    />
                    <LinkBtn
                        link='/documents?modal=upload'
                        icon='fas fa-upload mr-1.5 text-xs'
                        label='Upload document'
                        className="flex items-center justify-center px-3 py-2.5 rounded-xl 
                                   border border-slate-200/80 dark:border-slate-700/70 
                                   bg-white dark:bg-slate-800 
                                   hover:bg-slate-900 dark:hover:bg-pink-500 
                                   hover:text-white dark:hover:text-white 
                                   text-slate-800 dark:text-slate-200 
                                   text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                    />
                    <button
                        onClick={() => handleAction('view-forecast')}
                        className="flex items-center justify-center px-3 py-2.5 rounded-xl 
                                   border border-slate-200/80 dark:border-slate-700/70 
                                   bg-white dark:bg-slate-800 
                                   hover:bg-slate-900 dark:hover:bg-pink-500 
                                   hover:text-white dark:hover:text-white 
                                   text-slate-800 dark:text-slate-200 
                                   text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                    >
                        <i className="fas fa-chart-line mr-1.5 text-xs"></i> View forecast
                    </button>
                </div>

                <div className="mt-5 border-t border-slate-200/80 dark:border-slate-800 pt-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center mb-4">
                        <i className="fas fa-history mr-2 text-xs text-pink-500 dark:text-pink-400"></i> Recent activity
                    </div>

                    <ul className="space-y-4 text-xs relative 
                                   before:absolute before:left-[3.5px] 
                                   before:top-2 before:bottom-2 before:w-px 
                                   before:bg-slate-200 dark:before:bg-slate-800">
                        {activities.map((activity) => (
                            <li key={activity.id} className="flex gap-3 relative items-start">
                                <div className={`w-2 h-2 mt-1 rounded-full ${activity.dotColor} 
                                                ring-4 ring-slate-50 dark:ring-slate-900 shrink-0`}></div>
                                <div>
                                    <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                        {activity.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        {activity.time} · <span className="text-slate-500 dark:text-slate-400 font-medium">{activity.user}</span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}