"use client";

import React from "react";
import { 
    ArrowDownToLine, 
    ArrowUpFromLine, 
    Warehouse, 
    AlertTriangle 
} from "lucide-react";

export type WarehousingTabId = "receive" | "issue" | "locations" | "damages";

interface TabsWrapperProps {
    activeTab: WarehousingTabId;
    onTabChange: (tab: WarehousingTabId) => void;
    counts?: {
        pendingInbound: number;
        approvedRequests: number;
        totalLocations: number;
        incidentsCount: number;
    };
}

export function WarehousingTabsNav({
    activeTab,
    onTabChange,
    counts = {
        pendingInbound: 0,
        approvedRequests: 0,
        totalLocations: 0,
        incidentsCount: 0,
    },
}: TabsWrapperProps) {
    const tabs: Array<{
        id: WarehousingTabId;
        label: string;
        shortLabel: string;
        icon: string;
        iconComponent: React.ComponentType<{ className?: string }>;
        badgeCount?: number;
    }> = [
        {
            id: "receive",
            label: "Receive supplies from suppliers",
            shortLabel: "Receive Supplies",
            icon: "fa-truck-ramp-box",
            iconComponent: ArrowDownToLine,
            badgeCount: counts.pendingInbound,
        },
        {
            id: "issue",
            label: "Issue approved requests to departments",
            shortLabel: "Issue Requests",
            icon: "fa-dolly-flatbed",
            iconComponent: ArrowUpFromLine,
            badgeCount: counts.approvedRequests,
        },
        {
            id: "locations",
            label: "Manage storage locations",
            shortLabel: "Storage Locations",
            icon: "fa-warehouse",
            iconComponent: Warehouse,
            badgeCount: counts.totalLocations > 0 ? counts.totalLocations : undefined,
        },
        {
            id: "damages",
            label: "Record damaged or missing supplies",
            shortLabel: "Damaged / Missing",
            icon: "fa-triangle-exclamation",
            iconComponent: AlertTriangle,
            badgeCount: counts.incidentsCount,
        },
    ];

    return (
        <div className="w-full flex items-center justify-start overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-full overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const IconComp = tab.iconComponent;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 relative cursor-pointer active:scale-95 shrink-0 select-none ${isActive
                                ? "bg-pink-500 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold"
                                : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]"
                            }`}
                        >
                            <IconComp className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                            <span className="hidden md:inline">{tab.label}</span>
                            <span className="inline md:hidden">{tab.shortLabel}</span>
                            {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono ${
                                    isActive ? "bg-white text-pink-600 shadow-xs" : "bg-pink-500 text-white"
                                }`}>
                                    {tab.badgeCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default WarehousingTabsNav;

