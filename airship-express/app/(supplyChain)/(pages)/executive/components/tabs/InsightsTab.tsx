"use client";

import Link from "next/link";
import { ExecutiveDataPayload } from "../../hooks/useExecutiveData";

interface InsightsTabProps {
    data: ExecutiveDataPayload;
    onOpenModal?: (reportType: string) => void;
}

function getInsightRaindropStyles(type?: string) {
    if (type === 'warning') {
        return {
            pillBg: 'bg-amber-50 dark:bg-amber-950/40',
            pillBorder: 'border-amber-200 dark:border-amber-800/40',
            pillIcon: 'text-amber-600 dark:text-amber-400',
            pillGlow: 'shadow-[0_2px_10px_rgba(245,158,11,0.18)]',
            icon: 'fa-triangle-exclamation',
            badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40',
            badgeText: 'Anomaly / Warning',
            hoverBorder: 'hover:border-amber-300/80 dark:hover:border-amber-700/80',
        };
    }
    if (type === 'positive') {
        return {
            pillBg: 'bg-emerald-50 dark:bg-emerald-950/40',
            pillBorder: 'border-emerald-200 dark:border-emerald-800/40',
            pillIcon: 'text-emerald-600 dark:text-emerald-400',
            pillGlow: 'shadow-[0_2px_10px_rgba(16,185,129,0.18)]',
            icon: 'fa-circle-check',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40',
            badgeText: 'Optimization Win',
            hoverBorder: 'hover:border-emerald-300/80 dark:hover:border-emerald-700/80',
        };
    }
    return {
        pillBg: 'bg-indigo-50 dark:bg-indigo-950/40',
        pillBorder: 'border-indigo-200 dark:border-indigo-800/40',
        pillIcon: 'text-indigo-600 dark:text-indigo-400',
        pillGlow: 'shadow-[0_2px_10px_rgba(99,102,241,0.18)]',
        icon: 'fa-brain',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/40',
        badgeText: 'Intelligence Note',
        hoverBorder: 'hover:border-indigo-300/80 dark:hover:border-indigo-700/80',
    };
}

export default function InsightsTab({ data }: InsightsTabProps) {
    return (
        <div className="space-y-4">
            {/* Header Raindrop Banner (Compact) */}
            <div className="p-3.5 sm:p-4 rounded-[20px] bg-white/95 dark:bg-[#202128]/95 backdrop-blur-xl border border-slate-200/80 dark:border-[#353746] shadow-[0_6px_25px_-8px_rgba(0,0,0,0.05),inset_0_1px_0_#ffffff] dark:shadow-[0_6px_25px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Compact Raindrop Icon Pill */}
                    <div className="w-9 h-9 rounded-[12px] bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-sm shadow-[0_2px_10px_rgba(236,72,153,0.15)] shrink-0">
                        <i className="fas fa-lightbulb" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            AI-Generated Operational Insights
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Automated pattern recognition &amp; anomaly detection across operations and spend.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                        AI Neural Engine Active
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                        • {data.insights.length} Discoveries
                    </span>
                </div>
            </div>

            {/* Insights Cards Grid (Compact & Sleek Raindrop Design) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {data.insights.map((item) => {
                    const styles = getInsightRaindropStyles(item.type);

                    return (
                        <div
                            key={item.id}
                            className={`p-4 sm:p-4.5 rounded-[20px] bg-white/95 dark:bg-[#202128]/95 backdrop-blur-xl border border-slate-200/80 dark:border-[#353746] shadow-[0_6px_25px_-8px_rgba(0,0,0,0.05),inset_0_1px_0_#ffffff] dark:shadow-[0_6px_25px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08),inset_0_1px_0_#ffffff] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] ${styles.hoverBorder} hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between space-y-3 group`}
                        >
                            {/* Card Header with Compact Raindrop Pill & Category Badge */}
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2.5">
                                        {/* Compact Raindrop Icon Pill */}
                                        <div
                                            className={`w-10 h-10 rounded-[14px] ${styles.pillBg} ${styles.pillBorder} ${styles.pillGlow} border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105`}
                                        >
                                            <i className={`fas ${styles.icon} text-sm ${styles.pillIcon}`} />
                                        </div>
                                        <div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${styles.badgeBg}`}>
                                                {styles.badgeText}
                                            </span>
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                                {item.title}
                                            </h3>
                                        </div>
                                    </div>

                                    {item.metric && (
                                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shrink-0 shadow-2xs">
                                            {item.metric}
                                        </span>
                                    )}
                                </div>

                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-0.5 line-clamp-3">
                                    {item.description}
                                </p>
                            </div>

                            {/* Action Footer */}
                            {item.actionable && item.actionLink ? (
                                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                        <i className="fas fa-bolt text-pink-500 text-[9px]" />
                                        Recommendation
                                    </span>
                                    <Link
                                        href={item.actionLink}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[12px] text-[11px] font-bold text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40 hover:bg-pink-600 hover:text-white dark:hover:bg-pink-600 dark:hover:text-white hover:border-transparent transition-all shadow-2xs group/btn cursor-pointer"
                                    >
                                        <span>{item.actionText || 'Take Action'}</span>
                                        <i className="fas fa-arrow-right text-[9px] group-hover/btn:translate-x-0.5 transition-transform" />
                                    </Link>
                                </div>
                            ) : (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        Audited by AI Model
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <i className="fas fa-shield-check text-[9px]" />
                                        Logged
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
