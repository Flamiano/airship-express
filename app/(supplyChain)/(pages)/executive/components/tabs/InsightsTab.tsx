"use client";

import Link from "next/link";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface InsightsTabProps {
    data: ExecutiveDataPayload;
    onOpenModal?: (reportType: string) => void;
}

export default function InsightsTab({ data }: InsightsTabProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        AI-Generated Operational Insights
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Automated pattern recognition & anomaly detection across parcels, inventory, and procurement.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.insights.map((item) => (
                    <div
                        key={item.id}
                        className={`p-5 rounded-2xl border transition-all ${
                            item.type === 'warning'
                                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40'
                                : item.type === 'positive'
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40'
                                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                    item.type === 'warning' ? 'bg-amber-500' : item.type === 'positive' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                                    {item.title}
                                </h3>
                            </div>
                            {item.metric && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                    {item.metric}
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                            {item.description}
                        </p>

                        {item.actionable && item.actionLink && (
                            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex justify-end">
                                <Link
                                    href={item.actionLink}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                                >
                                    <span>{item.actionText || 'Take Action'}</span>
                                    <i className="fas fa-arrow-right text-[10px]" />
                                </Link>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
