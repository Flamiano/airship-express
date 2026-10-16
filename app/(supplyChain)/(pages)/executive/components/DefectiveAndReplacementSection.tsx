"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";
import {
    type ExecutiveDataPayload,
    type DefectiveItemsAnalyticsData,
    type ReplacementItemsAnalyticsData,
    type DefectiveIncidentAnalyticsItem,
    type ReplacementCaseAnalyticsItem
} from "../hooks/useExecutiveData";
import ExecutiveInfoModal, { ExecutiveModalContentType } from "./modals/ExecutiveInfoModal";

interface DefectiveAndReplacementSectionProps {
    data?: ExecutiveDataPayload;
    defectiveData?: DefectiveItemsAnalyticsData;
    replacementData?: ReplacementItemsAnalyticsData;
    isLoading?: boolean;
}

export default function DefectiveAndReplacementSection({
    data,
    defectiveData,
    replacementData,
    isLoading = false
}: DefectiveAndReplacementSectionProps) {
    const defective = defectiveData || data?.defectiveItemsAnalytics;
    const replacement = replacementData || data?.replacementAnalytics;

    const [activeSubTab, setActiveSubTab] = useState<"defects" | "replacements">("defects");
    const [defectSearch, setDefectSearch] = useState("");
    const [defectStatusFilter, setDefectStatusFilter] = useState<string>("all");

    const [replacementSearch, setReplacementSearch] = useState("");
    const [replacementStatusFilter, setReplacementStatusFilter] = useState<string>("all");

    const [selectedIncident, setSelectedIncident] = useState<DefectiveIncidentAnalyticsItem | null>(null);
    const [selectedReturn, setSelectedReturn] = useState<ReplacementCaseAnalyticsItem | null>(null);
    const [infoModalContent, setInfoModalContent] = useState<ExecutiveModalContentType | null>(null);

    // Defective Incidents Filtering
    const allIncidents = useMemo(() => {
        if (!defective) return [];
        return [...(defective.unresolvedCases || []), ...(defective.completedCases || [])];
    }, [defective]);

    const filteredIncidents = useMemo(() => {
        let list = [...allIncidents];
        if (defectStatusFilter !== "all") {
            list = list.filter((item) => {
                const s = (item.status || "").toLowerCase();
                if (defectStatusFilter === "unresolved") {
                    return !s.includes("resolved") && !s.includes("replaced") && !s.includes("returned");
                }
                if (defectStatusFilter === "quarantined") {
                    return s.includes("quarantine");
                }
                if (defectStatusFilter === "approved_return") {
                    return s.includes("return");
                }
                if (defectStatusFilter === "resolved") {
                    return s.includes("resolved") || s.includes("replaced");
                }
                return true;
            });
        }
        if (defectSearch.trim()) {
            const q = defectSearch.toLowerCase().trim();
            list = list.filter(
                (item) =>
                    item.incident_number.toLowerCase().includes(q) ||
                    item.item_name.toLowerCase().includes(q) ||
                    item.item_code.toLowerCase().includes(q) ||
                    item.supplier_name.toLowerCase().includes(q) ||
                    item.po_number.toLowerCase().includes(q) ||
                    item.discrepancy_type.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allIncidents, defectStatusFilter, defectSearch]);

    // Replacement Cases Filtering
    const allReplacements = useMemo(() => {
        return replacement?.replacementCases || [];
    }, [replacement]);

    const filteredReplacements = useMemo(() => {
        let list = [...allReplacements];
        if (replacementStatusFilter !== "all") {
            list = list.filter((item) => {
                if (replacementStatusFilter === "fulfilled") {
                    return item.outstanding_quantity === 0 && item.replacement_quantity_received > 0;
                }
                if (replacementStatusFilter === "partial") {
                    return item.replacement_quantity_received > 0 && item.outstanding_quantity > 0;
                }
                if (replacementStatusFilter === "awaiting") {
                    return item.replacement_quantity_received === 0;
                }
                return true;
            });
        }
        if (replacementSearch.trim()) {
            const q = replacementSearch.toLowerCase().trim();
            list = list.filter(
                (item) =>
                    item.return_request_number.toLowerCase().includes(q) ||
                    item.po_number.toLowerCase().includes(q) ||
                    item.supplier_name.toLowerCase().includes(q) ||
                    item.item_name.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allReplacements, replacementStatusFilter, replacementSearch]);

    const getIncidentBadgeTone = (status: string): BadgeTone => {
        const s = (status || "").toLowerCase();
        if (s.includes("resolved") || s.includes("replaced")) return "emerald";
        if (s.includes("approved")) return "blue";
        if (s.includes("quarantine")) return "amber";
        if (s.includes("review") || s.includes("report")) return "rose";
        return "neutral";
    };

    const getReplacementBadge = (item: ReplacementCaseAnalyticsItem) => {
        if (item.outstanding_quantity === 0 && item.replacement_quantity_received > 0) {
            return { label: "Fully Replaced", tone: "emerald" as BadgeTone };
        }
        if (item.replacement_quantity_received > 0 && item.outstanding_quantity > 0) {
            return {
                label: `Partially Replaced (${item.replacement_quantity_received}/${item.defective_quantity})`,
                tone: "amber" as BadgeTone
            };
        }
        return { label: "Awaiting Delivery", tone: "rose" as BadgeTone };
    };

    return (
        <div className="space-y-6">
            {/* Header Toolbar & Sub-navigation */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                            <i className="fas fa-shield-halved text-base" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                Defective & Replacement Inventory Analytics
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                    Warehouse Verification
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Tracking receiving discrepancies, supplier RMA returns, and physically inspected replacement stock.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="?tab=operations"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] hover:text-pink-600 transition-colors"
                            title="Switch to Operations Tab"
                        >
                            <i className="fas fa-boxes-stacked text-[10px]" />
                            <span>Operations</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab("replacements")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] hover:text-pink-700 transition-colors cursor-pointer"
                        >
                            <i className="fas fa-arrows-rotate text-[10px]" />
                            <span>Supplier Returns</span>
                        </button>
                    </div>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab("defects")}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === "defects"
                                ? "bg-pink-600 text-white shadow-[0_4px_12px_rgba(236,72,153,0.35)]"
                                : "bg-[#ebf0f7] dark:bg-[#12131b] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] hover:bg-[#e2e8f0] dark:hover:bg-[#1c1d29]"
                        }`}
                    >
                        <i className="fas fa-triangle-exclamation text-xs" />
                        <span>Defective Items Received</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            activeSubTab === "defects" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        }`}>
                            {defective?.totalDefectiveUnits ?? 0} units
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab("replacements")}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === "replacements"
                                ? "bg-pink-600 text-white shadow-[0_4px_12px_rgba(236,72,153,0.35)]"
                                : "bg-[#ebf0f7] dark:bg-[#12131b] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] hover:bg-[#e2e8f0] dark:hover:bg-[#1c1d29]"
                        }`}
                    >
                        <i className="fas fa-arrows-rotate text-xs" />
                        <span>Replacement Items Received</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            activeSubTab === "replacements" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                            {replacement?.totalReplacementsReceived ?? 0} units
                        </span>
                    </button>
                </div>
            </div>

            {/* TAB 1: DEFECTIVE ITEMS RECEIVED */}
            {activeSubTab === "defects" && (
                <div className="space-y-6">
                    {/* AI Tab Summary: Defective Items */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 text-xs">
                            <i className="fas fa-wand-magic-sparkles" />
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>AI Tab Summary: Receiving Discrepancies & Warehouse Defect Audit</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    Quality Assurance
                                </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                Receiving inspections have recorded <strong>{defective?.totalDefectiveUnits ?? 0} defective units</strong> across <strong>{defective?.affectedItemsCount ?? 0} distinct inventory items</strong>.
                                Currently, <strong>{defective?.quarantinedUnits ?? 0} units</strong> are segregated under quarantine, <strong>{defective?.approvedForReturnUnits ?? 0} units</strong> are authorized for RMA vendor dispatch, and <strong>{defective?.actuallyReturnedUnits ?? 0} units</strong> have reached completed settlement or credit.
                            </p>
                        </div>
                    </div>

                    {/* Defect KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Total Defective Units
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                    {defective?.totalDefectiveUnits ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">units flagged</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Across {allIncidents.length} verified incident records
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                In Quarantine Zone
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                    {defective?.quarantinedUnits ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">quarantined</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Isolated from sellable stock
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Approved For Return (RMA)
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                    {defective?.approvedForReturnUnits ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">approved RMA</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Pending dispatch to supplier
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Returned / Replaced
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {defective?.actuallyReturnedUnits ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">units settled</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Replaced, credited, or closed
                            </span>
                        </div>
                    </div>

                    {/* Breakdown & Suppliers Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Defect Categories */}
                        <div className="p-5 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <i className="fas fa-boxes-packing text-pink-500" />
                                Defect Categories Breakdown
                            </h3>
                            {Object.keys(defective?.categoriesBreakdown || {}).length === 0 ? (
                                <p className="text-xs text-slate-400 py-4 text-center">No categorized defect incidents recorded.</p>
                            ) : (
                                <div className="space-y-2">
                                    {Object.entries(defective?.categoriesBreakdown || {}).map(([cat, qty]) => {
                                        const total = defective?.totalDefectiveUnits || 1;
                                        const pct = Math.round((qty / total) * 100);
                                        return (
                                            <div key={cat} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{cat}</span>
                                                    <span className="font-mono text-slate-500">{qty} units ({pct}%)</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-pink-500 rounded-full"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Top Defective Suppliers */}
                        <div className="p-5 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)] space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <i className="fas fa-truck-ramp-box text-pink-500" />
                                Top Suppliers with Defective Deliveries
                            </h3>
                            {(defective?.topSuppliers || []).length === 0 ? (
                                <p className="text-xs text-slate-400 py-4 text-center">No supplier defect records found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {(defective?.topSuppliers || []).map((sup, idx) => (
                                        <div
                                            key={sup.supplier}
                                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/60 dark:border-white/[0.03]"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-[10px] font-black flex items-center justify-center">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {sup.supplier}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                                                    {sup.defectiveUnits} units
                                                </span>
                                                <span className="text-[10px] text-slate-500 block">
                                                    {sup.incidentCount} incidents
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Defect Incidents Audit Table */}
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-list-check text-pink-500" />
                                Warehouse Receiving Discrepancies & Damage Incidents
                                <span className="text-xs text-slate-500 font-normal">
                                    ({filteredIncidents.length} records)
                                </span>
                            </h3>

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[200px]">
                                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                    <input
                                        type="text"
                                        placeholder="Search incident, item, supplier..."
                                        value={defectSearch}
                                        onChange={(e) => setDefectSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    />
                                </div>

                                <select
                                    value={defectStatusFilter}
                                    onChange={(e) => setDefectStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.25)] text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
                                >
                                    <option value="all">All Incident Statuses</option>
                                    <option value="unresolved">Unresolved Only</option>
                                    <option value="quarantined">Quarantined Only</option>
                                    <option value="approved_return">Approved For Return</option>
                                    <option value="resolved">Resolved / Replaced</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#ebf0f7] dark:bg-[#12131b] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                                        <th className="py-3 px-4">Incident ID</th>
                                        <th className="py-3 px-4">Item & Code</th>
                                        <th className="py-3 px-4">Supplier & PO</th>
                                        <th className="py-3 px-4 text-center">Defective Qty</th>
                                        <th className="py-3 px-4">Discrepancy / Severity</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                                    {filteredIncidents.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-400">
                                                No damage incidents match the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredIncidents.map((inc) => (
                                            <tr key={inc.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                    {inc.incident_number}
                                                    <span className="block text-[10px] text-slate-500 font-sans font-normal">
                                                        {inc.reported_at ? new Date(inc.reported_at).toLocaleDateString() : "-"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                                                    {inc.item_name}
                                                    <span className="block text-[10px] font-mono text-slate-500 font-normal">
                                                        {inc.item_code}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold">{inc.supplier_name}</span>
                                                    <span className="block text-[10px] font-mono text-slate-500">
                                                        {inc.po_number || "No PO linked"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                                                        {inc.quantity}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 ml-1">{inc.unit}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {inc.discrepancy_type}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-500">
                                                        Severity: <strong className="capitalize">{inc.severity}</strong>
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <StatusBadge tone={getIncidentBadgeTone(inc.status)}>
                                                        {inc.status}
                                                    </StatusBadge>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedIncident(inc)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] hover:text-pink-700 cursor-pointer active:scale-95 transition-all"
                                                    >
                                                        <span>Inspect</span>
                                                        <i className="fas fa-chevron-right text-[9px]" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: REPLACEMENT ITEMS RECEIVED */}
            {activeSubTab === "replacements" && (
                <div className="space-y-6">
                    {/* AI Tab Summary: Replacement Items */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs">
                            <i className="fas fa-wand-magic-sparkles" />
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>AI Tab Summary: Physical Replacement Fulfillment & QC Audit</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    Inventory Restock
                                </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                Physical replacement fulfillment has verified <strong>{replacement?.totalReplacementsReceived ?? 0} replacement units physically delivered and restocked</strong> across <strong>{replacement?.replacementDeliveriesCount ?? 0} supplier shipments</strong>.
                                Currently, <strong>{replacement?.acceptedAfterInspectionUnits ?? 0} units</strong> have cleared mandatory receiving quality checks, while <strong>{replacement?.awaitingFulfillmentCount ?? 0} warranty claims</strong> remain pending vendor delivery.
                            </p>
                        </div>
                    </div>

                    {/* Replacement KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Physically Received Units
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {replacement?.totalReplacementsReceived ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">restocked</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Verified physical deliveries received
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Replacement Deliveries
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-white">
                                    {replacement?.replacementDeliveriesCount ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">deliveries</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Shipments delivered by suppliers
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                Awaiting Supplier Delivery
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                    {replacement?.awaitingFulfillmentCount ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">pending</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                RMA claims awaiting fulfillment
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[4px_4px_10px_rgba(166,175,195,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                QC Inspection Acceptance
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                    {replacement?.acceptedAfterInspectionUnits ?? 0}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">passed QC</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                Fully inspected & fit for circulation
                            </span>
                        </div>
                    </div>

                    {/* Replacement Tracking Table with Partial Replacement Tracking */}
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-boxes-stacked text-pink-500" />
                                Supplier Replacement Delivery & QC Verification
                                <span className="text-xs text-slate-500 font-normal">
                                    ({filteredReplacements.length} cases)
                                </span>
                            </h3>

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[200px]">
                                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                    <input
                                        type="text"
                                        placeholder="Search return #, PO, item, supplier..."
                                        value={replacementSearch}
                                        onChange={(e) => setReplacementSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    />
                                </div>

                                <select
                                    value={replacementStatusFilter}
                                    onChange={(e) => setReplacementStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.25)] text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
                                >
                                    <option value="all">All Fulfillment Statuses</option>
                                    <option value="fulfilled">Fully Replaced</option>
                                    <option value="partial">Partially Replaced</option>
                                    <option value="awaiting">Awaiting Delivery</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#ebf0f7] dark:bg-[#12131b] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                                        <th className="py-3 px-4">Return Request #</th>
                                        <th className="py-3 px-4">Original PO #</th>
                                        <th className="py-3 px-4">Supplier & Item</th>
                                        <th className="py-3 px-4 text-center">Defective Qty</th>
                                        <th className="py-3 px-4 text-center">Received Qty</th>
                                        <th className="py-3 px-4 text-center">Outstanding</th>
                                        <th className="py-3 px-4">Receipt Date</th>
                                        <th className="py-3 px-4">Fulfillment Status</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                                    {filteredReplacements.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-400">
                                                No replacement records match the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredReplacements.map((rep) => {
                                            const badge = getReplacementBadge(rep);
                                            return (
                                                <tr key={rep.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                        {rep.return_request_number}
                                                        <span className="block text-[10px] text-slate-500 font-sans font-normal">
                                                            {rep.created_at ? new Date(rep.created_at).toLocaleDateString() : "-"}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                        {rep.po_number || "Direct RMA"}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                                            {rep.item_name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {rep.supplier_name}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                                                        {rep.defective_quantity}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">
                                                        {rep.replacement_quantity_received}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {rep.outstanding_quantity > 0 ? (
                                                            <span className="font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40">
                                                                {rep.outstanding_quantity} due
                                                            </span>
                                                        ) : (
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                0 (Complete)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                        {rep.replacement_received_date
                                                            ? new Date(rep.replacement_received_date).toLocaleDateString()
                                                            : (
                                                                <span className="text-amber-500 text-[10px] font-medium">
                                                                    Pending delivery
                                                                </span>
                                                            )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <StatusBadge tone={badge.tone}>
                                                            {badge.label}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReturn(rep)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_4px_rgba(166,175,195,0.25)] hover:text-pink-700 cursor-pointer active:scale-95 transition-all"
                                                        >
                                                            <span>Inspect</span>
                                                            <i className="fas fa-chevron-right text-[9px]" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <ExecutiveInfoModal
                isOpen={!!selectedIncident || !!selectedReturn || !!infoModalContent}
                onClose={() => {
                    setSelectedIncident(null);
                    setSelectedReturn(null);
                    setInfoModalContent(null);
                }}
                content={
                    selectedIncident
                        ? { type: "incident", data: selectedIncident }
                        : selectedReturn
                        ? { type: "return", data: selectedReturn }
                        : infoModalContent
                }
            />
        </div>
    );
}
