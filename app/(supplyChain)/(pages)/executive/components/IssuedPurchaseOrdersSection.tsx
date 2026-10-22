"use client";

import React, { useState, useMemo } from "react";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";
import { type IssuedPOsAnalyticsData, type IssuedPOAnalyticsItem } from "../hooks/useExecutiveData";
import ExecutiveInfoModal, { ExecutiveModalContentType } from "./modals/ExecutiveInfoModal";

interface IssuedPurchaseOrdersSectionProps {
    data?: IssuedPOsAnalyticsData;
    isLoading?: boolean;
}

export default function IssuedPurchaseOrdersSection({
    data,
    isLoading = false
}: IssuedPurchaseOrdersSectionProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedPO, setSelectedPO] = useState<IssuedPOAnalyticsItem | null>(null);
    const [infoModalContent, setInfoModalContent] = useState<ExecutiveModalContentType | null>(null);

    const issuedList = data?.issuedOrdersList || [];

    const filteredOrders = useMemo(() => {
        let list = [...issuedList];
        if (statusFilter !== "all") {
            list = list.filter((po) => po.delivery_status === statusFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (po) =>
                    po.po_number.toLowerCase().includes(q) ||
                    po.supplier_name.toLowerCase().includes(q) ||
                    po.distinct_items.some((it) => it.toLowerCase().includes(q))
            );
        }
        return list;
    }, [issuedList, statusFilter, searchQuery]);

    const getDeliveryStatusTone = (status: string): BadgeTone => {
        switch (status) {
            case "Fully Received":
                return "emerald";
            case "Partially Received":
                return "amber";
            case "Awaiting Delivery":
                return "blue";
            default:
                return "neutral";
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Toolbar */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                            <i className="fas fa-file-invoice-dollar text-base" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                                Issued Purchase Orders Intelligence
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                    Authoritative Financial Workflow
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Counted strictly upon reaching verified issued status. Authoritative totals exclude drafts, pending reviews, and cancellations.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setInfoModalContent({
                                type: "info",
                                data: {
                                    title: "Executive Procurement & PO Governance",
                                    subtitle: "Authorized Workflow & Segregation of Duties",
                                    icon: "fa-stamp",
                                    description:
                                        "Executive role accounts monitor all authoritative purchase orders committed with external suppliers. Full requisition origination, supplier bidding, and quotation awarding occur in the procurement department, with all finalized purchase orders immediately synced into this dashboard in real-time.",
                                    details: [
                                        { label: "Active Issued Orders", value: `${data?.issuedOrdersCount ?? 0} POs`, tone: "emerald" },
                                        { label: "Committed Approved Value", value: `₱${(data?.totalApprovedValue ?? 0).toLocaleString()}`, tone: "blue" },
                                        { label: "Real-time Verification", value: "Active", tone: "emerald" }
                                    ],
                                    note: "Click 'Inspect' on any individual purchase order row to view its complete item breakdown and fulfillment status."
                                }
                            })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] hover:text-pink-700 transition-colors cursor-pointer w-fit"
                    >
                        <i className="fas fa-circle-info text-[11px]" />
                        <span>Procurement Oversight</span>
                    </button>
                </div>

                {/* 2. Top-Level Metric KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                    {/* Card 1: Issued Count */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <i className="fas fa-stamp text-pink-500" /> Issued PO Orders
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                            {data?.issuedOrdersCount || 0}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                            Approved & Active In Pipeline
                        </div>
                    </div>

                    {/* Card 2: Total Approved Value */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <i className="fas fa-peso-sign text-emerald-500" /> Total Approved Value
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            ₱{(data?.totalApprovedValue || 0).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                            Authoritative Stored PO Total
                        </div>
                    </div>

                    {/* Card 3: Distinct SKUs Ordered */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <i className="fas fa-cubes text-blue-500" /> Distinct Items Ordered
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                            {data?.distinctItemsOrderedCount || 0}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                            Unique Catalog SKUs Tracked
                        </div>
                    </div>

                    {/* Card 4: Delivery Posture */}
                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <i className="fas fa-truck text-purple-500" /> Fulfillment Status
                        </span>
                        <div className="flex items-center gap-2 pt-0.5 text-xs font-semibold">
                            <span className="text-emerald-600 font-bold font-mono">{data?.fullyReceivedCount || 0}</span>
                            <span className="text-slate-400 text-[10px]">Delivered</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-600 font-bold font-mono">{data?.awaitingDeliveryCount || 0}</span>
                            <span className="text-slate-400 text-[10px]">Awaiting</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                            {data?.partiallyReceivedCount || 0} orders partially fulfilled
                        </div>
                    </div>
                </div>

                {/* Workflow Inconsistency Flag (if any) */}
                {data && data.inconsistentApprovalCount > 0 ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
                        <i className="fas fa-triangle-exclamation text-amber-500 text-sm shrink-0" />
                        <div>
                            <strong>Workflow State Inconsistency Detected:</strong> {data.inconsistentApprovalCount} purchase orders have conflicting financial approval vs operational fulfillment states. These records are isolated and surfaced below for executive audit.
                        </div>
                    </div>
                ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <i className="fas fa-check-circle text-emerald-500" />
                        <span><strong>Workflow Verified:</strong> Financial approvals and purchase order fulfillment statuses are 100% synchronized with no contradictory states.</span>
                    </div>
                )}
            </div>

            {/* AI Tab Summary: Issued POs */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 text-xs">
                    <i className="fas fa-wand-magic-sparkles" />
                </div>
                <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>AI Tab Summary: Issued Purchase Orders Intelligence</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                            Automated Synthesis
                        </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Total committed procurement outlay across <strong>{data?.issuedOrdersCount || 0} issued purchase orders</strong> stands at <strong>₱{(data?.totalApprovedValue || 0).toLocaleString()}</strong> representing {data?.distinctItemsOrderedCount || 0} distinct inventory catalog items.
                        Currently, <strong>{data?.fullyReceivedCount || 0} orders</strong> are completely delivered, <strong>{data?.partiallyReceivedCount || 0} orders</strong> are partially received, and <strong>{data?.awaitingDeliveryCount || 0} orders</strong> remain in transit from suppliers.
                        {data && data.inconsistentApprovalCount > 0 ? ` ${data.inconsistentApprovalCount} orders require administrative review for workflow timing discrepancies.` : ` All order states comply 100% with financial sign-off controls.`}
                    </p>
                </div>
            </div>

            {/* 3. Monthly Issuance Trend Section */}
            {data?.monthlyTrend && data.monthlyTrend.length > 0 && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[10px_10px_24px_rgba(166,175,195,0.25),-10px_-10px_24px_rgba(255,255,255,0.85)] dark:shadow-[10px_10px_24px_rgba(0,0,0,0.6)] space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-chart-column text-pink-500" />
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                Monthly Issued Purchase Order Trend & Committed Value
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                            Audited by Order Creation Month
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {data.monthlyTrend.map((t) => (
                            <div
                                key={t.month}
                                className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-between text-xs"
                            >
                                <div>
                                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                        {t.month}
                                    </span>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {t.count} purchase order{t.count === 1 ? "" : "s"}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-pink-600 dark:text-pink-400 font-mono">
                                        ₱{t.value.toLocaleString()}
                                    </span>
                                    <div className="text-[9px] text-slate-400">Approved</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Issued Purchase Orders Master Table */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[10px_10px_24px_rgba(166,175,195,0.25),-10px_-10px_24px_rgba(255,255,255,0.85)] dark:shadow-[10px_10px_24px_rgba(0,0,0,0.6)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-list-check text-pink-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Issued Purchase Orders Register ({filteredOrders.length} records)
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative">
                            <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs" />
                            <input
                                type="text"
                                placeholder="Search PO #, supplier, or items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] text-slate-800 dark:text-white w-52 sm:w-64"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] text-slate-800 dark:text-white font-medium"
                        >
                            <option value="all">All Delivery States</option>
                            <option value="Fully Received">Fully Received</option>
                            <option value="Partially Received">Partially Received</option>
                            <option value="Awaiting Delivery">Awaiting Delivery</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
                    <table className="table-pro w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-slate-800">
                                <th className="py-3 px-3.5">PO Number</th>
                                <th className="py-3 px-3.5">Supplier Name</th>
                                <th className="py-3 px-3.5 text-right">Authoritative Total (₱)</th>
                                <th className="py-3 px-3.5">Ordered Items</th>
                                <th className="py-3 px-3.5 text-center">Delivery Status</th>
                                <th className="py-3 px-3.5 text-center">Financial Approval</th>
                                <th className="py-3 px-3.5 text-center">Target Delivery Date</th>
                                <th className="py-3 px-3.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400 italic block w-full md:table-cell">
                                        No issued purchase order records match the criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((po) => (
                                    <tr
                                        key={po.id}
                                        className="hover:bg-pink-50/50 dark:hover:bg-pink-950/15 transition-colors"
                                    >
                                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white" data-label="PO Number">
                                            {po.po_number}
                                            {po.has_approval_inconsistency && (
                                                <span
                                                    title={po.inconsistency_reason}
                                                    className="ml-1.5 inline-block text-amber-500 cursor-help"
                                                >
                                                    <i className="fas fa-triangle-exclamation text-[10px]" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-slate-200" data-label="Supplier Name">
                                            {po.supplier_name}
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-black font-mono text-pink-600 dark:text-pink-400" data-label="Authoritative Total">
                                            ₱{po.total_amount.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3.5" data-label="Ordered Items">
                                            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                {po.distinct_items.length > 0 ? po.distinct_items.join(", ") : "Standard Supply"}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {po.items_count} line item{po.items_count === 1 ? "" : "s"}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3.5 text-center" data-label="Delivery Status">
                                            <StatusBadge
                                                tone={getDeliveryStatusTone(po.delivery_status)}
                                                dot
                                            >
                                                {po.delivery_status}
                                            </StatusBadge>
                                        </td>
                                        <td className="py-3 px-3.5 text-center" data-label="Financial Approval">
                                            <StatusBadge
                                                tone={po.financial_approval === "Approved" ? "emerald" : "amber"}
                                            >
                                                {po.financial_approval || "Pending"}
                                            </StatusBadge>
                                        </td>
                                        <td className="py-3 px-3.5 text-center font-mono text-[11px] text-slate-500" data-label="Target Delivery Date">
                                            {po.delivery_date || "Open Schedule"}
                                        </td>
                                        <td className="py-3 px-3.5 text-center" data-label="Action">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPO(po)}
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

            <ExecutiveInfoModal
                isOpen={!!selectedPO || !!infoModalContent}
                onClose={() => {
                    setSelectedPO(null);
                    setInfoModalContent(null);
                }}
                content={selectedPO ? { type: "po", data: selectedPO } : infoModalContent}
            />
        </div>
    );
}
