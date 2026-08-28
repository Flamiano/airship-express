"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface CardsProps {
    frontIcon?: string;
    header?: string;
    data?: string;
    arrow?: string;
    description?: string;
    backBg?: string;
    backHeader?: string;
    backDescription?: string;
    headerTextColor?: string;
    tooltip?: string;
    tooltipLink?: string;
    badge?: string;
    backIcon?: string;
    frontTextColor?: string;
    descriptionTextColor?: string;
}

export default function Cards({
    frontIcon = "fas fa-box mr-1",
    header = "Statistic",
    data = "0",
    arrow = "fas fa-arrow-up mr-1",
    description = "No change",
    backBg = "bg-slate-900 dark:bg-slate-900",
    backHeader = "Details",
    backDescription = "No additional information available.",
    headerTextColor = "text-slate-400 dark:text-slate-400",
    tooltip,
    tooltipLink,
    badge,
    backIcon = "fas fa-circle-info",
    frontTextColor = "text-slate-500 dark:text-slate-400",
    descriptionTextColor = "text-emerald-600 dark:text-emerald-400"
}: CardsProps) {
    const [flipped, setFlipped] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);

    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const backCardRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Native non-passive wheel listener: completely locks page scroll while cursor is over the back card
    useEffect(() => {
        const backEl = backCardRef.current;
        const scrollEl = scrollContainerRef.current;
        if (!backEl || !flipped) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight) {
                scrollEl.scrollTop += e.deltaY;
            }
        };

        backEl.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            backEl.removeEventListener("wheel", handleWheel);
        };
    }, [flipped]);

    const handleMouseEnter = () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            if (!isHoveringTooltip) {
                setShowTooltip(false);
            }
        }, 100);
    };

    const handleTooltipMouseEnter = () => {
        setIsHoveringTooltip(true);
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
        setShowTooltip(true);
    };

    const handleTooltipMouseLeave = () => {
        setIsHoveringTooltip(false);
        setShowTooltip(false);
    };

    const handleTooltipClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (tooltipLink) {
            window.location.href = tooltipLink;
        }
    };

    useEffect(() => {
        return () => {
            if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = null;
            }
        };
    }, []);

    const toggleFlip = () => {
        setFlipped((prev) => !prev);
    };

    return (
        <div
            className="relative cursor-pointer perspective h-40 group select-none transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]"
            data-interactive="true"
            data-lenis-prevent="true"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={toggleFlip}
        >
            {/* Hover Tooltip Popup */}
            {tooltip && showTooltip && (
                <div
                    className={`absolute -top-10 left-1/2 -translate-x-1/2 z-50 
                            bg-slate-900/95 dark:bg-[#1c1d25]/95 
                            text-white text-[11px] px-3 py-1 
                            rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] 
                            dark:shadow-[0_10px_30px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
                            border border-slate-700/60 dark:border-[#67224c]
                            backdrop-blur-md whitespace-nowrap pointer-events-auto 
                            transition-all duration-200 flex items-center gap-1.5 
                            ${tooltipLink ? 'cursor-pointer hover:scale-[1.02] active:scale-95 group/tip' : 'cursor-default select-none'}`}
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                    onClick={handleTooltipClick}
                >
                    {tooltipLink ? (
                        <>
                            <i className="fas fa-arrow-up-right-from-square text-[9px] text-pink-400 shrink-0"></i>
                            <span className="underline underline-offset-4 decoration-pink-400/80 group-hover/tip:decoration-pink-300 font-semibold text-pink-100 group-hover/tip:text-white transition-colors">
                                {tooltip}
                            </span>
                            <i className="fas fa-chevron-right text-[8px] text-pink-400/80 group-hover/tip:translate-x-0.5 transition-transform shrink-0"></i>
                        </>
                    ) : (
                        <>
                            <i className="fas fa-circle-info text-[9px] text-sky-400 shrink-0"></i>
                            <span className="font-medium text-slate-200 no-underline">
                                {tooltip}
                            </span>
                        </>
                    )}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 
                                    bg-slate-900 dark:bg-[#1c1d25] border-r border-b border-slate-700/60 dark:border-[#67224c] rotate-45"></div>
                </div>
            )}

            {/* Corner Badge */}
            {badge && (
                <div className="absolute -top-2 -right-2 z-10 
                                bg-gradient-to-tr from-pink-600 to-rose-500 text-white text-[9px] font-bold 
                                px-2 py-0.5 rounded-full shadow-[0_2px_8px_rgba(244,63,94,0.4),inset_0_1px_0_rgba(255,255,255,0.35)] 
                                border border-pink-400/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse"></span>
                    {badge}
                </div>
            )}

            <div className={`relative w-full h-full duration-500 preserve-3d ${flipped ? 'rotate-y-180' : ''}`}>
                {/* Front Card */}
                <div
                    className={`absolute inset-0 backface-hidden card kpi bg-white/95 dark:bg-[#181920]/95 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-[#353746] shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between group-hover:shadow-[0_8px_30px_rgba(244,63,94,0.12),inset_0_1px_0_#ffffff] dark:group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:border-pink-300 dark:group-hover:border-[#67224c] transition-all duration-200 ${flipped ? 'pointer-events-none' : 'pointer-events-auto'}`}
                >
                    {/* Header & Icon */}
                    <div className={`label text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${frontTextColor}`}>
                        <i className={frontIcon} />
                        <span className="truncate">{header}</span>
                    </div>

                    {/* Metric Value */}
                    <div className="value text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 my-0.5">
                        {data}
                    </div>

                    {/* Delta & Footer */}
                    <div className={`delta text-[11px] sm:text-xs flex items-center gap-1.5 ${descriptionTextColor}`}>
                        <i className={`${arrow} text-[10px]`} />
                        <span className="font-semibold truncate">{description}</span>

                        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors shrink-0">
                            <i className="fas fa-rotate text-[10px]" title="Click to flip card" />
                        </span>
                    </div>
                </div>

                {/* Back Card */}
                <div
                    ref={backCardRef}
                    data-lenis-prevent="true"
                    className={`absolute inset-0 backface-hidden rotate-y-180 bg-slate-900/95 dark:bg-[#181920]/95 text-white dark:text-slate-100 p-3 sm:p-3.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-slate-800 dark:border-[#353746] flex flex-col justify-between overflow-hidden ${flipped ? 'pointer-events-auto' : 'pointer-events-none'}`}
                >
                    {/* Header */}
                    <div
                        className={`text-[11px] font-bold tracking-wider ${headerTextColor} dark:text-pink-400 uppercase flex items-center justify-between shrink-0 pb-1 border-b border-white/10 dark:border-white/10 mb-1.5 gap-1.5`}
                    >
                        <div className="flex items-center gap-1.5 truncate">
                            <i className={`${backIcon} text-[10px]`} />
                            <span className="truncate">{backHeader}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {tooltipLink && (
                                <Link
                                    href={tooltipLink}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-pink-600 hover:bg-pink-500 text-white transition-all cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span>Action</span>
                                    <i className="fas fa-arrow-up-right-from-square text-[8px]" />
                                </Link>
                            )}
                            <span
                                className="text-[9px] text-white/50 hover:text-white dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 transition-colors cursor-pointer select-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFlipped(false);
                                }}
                            >
                                <i className="fas fa-xmark text-[9px]" />
                            </span>
                        </div>
                    </div>

                    {/* Content (Scrollable with maximum space, no bottom footer taking room) */}
                    <div
                        ref={scrollContainerRef}
                        data-lenis-prevent="true"
                        className="flex-1 overflow-y-auto pr-1 text-[10px] sm:text-[11px] text-slate-200 dark:text-slate-300 space-y-1 leading-normal min-h-0 overscroll-contain"
                    >
                        {backDescription.split('\n').map((line, i) => {
                            const formattedLine = line
                                .replace(/📦/g, '<i class="fas fa-box text-white/70 dark:text-slate-400 mr-1"></i>')
                                .replace(/📊/g, '<i class="fas fa-chart-bar text-white/70 dark:text-slate-400 mr-1"></i>')
                                .replace(/🏆/g, '<i class="fas fa-trophy text-yellow-300 dark:text-yellow-400 mr-1.5"></i>')
                                .replace(/⏰/g, '<i class="fas fa-clock text-blue-300 dark:text-sky-400 mr-1"></i>')
                                .replace(/📈/g, '<i class="fas fa-chart-line text-emerald-300 dark:text-emerald-400 mr-1"></i>')
                                .replace(/📅/g, '<i class="fas fa-calendar-day text-purple-300 dark:text-purple-400 mr-1"></i>')
                                .replace(/🚚/g, '<i class="fas fa-truck text-amber-300 dark:text-amber-400 mr-1"></i>');

                            return (
                                <p key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}