// recent purchase history table component displaying the latest 10 orders (view only)

"use client";

import React from "react";
import { PurchaseOrder } from "../../types";
import { getStatusBadge, getPaidBadge } from "../../utils/formatters";
import { CrudActionButton } from "../../../../components/ui/CrudActionButton";
import { Pagination } from "../../../../components/global/pagination";
import { PurchaseHistorySkeleton } from "../../../../components/ui/SkeletonLoader";

interface RecentPurchaseHistoryTableProps {
    isLoading: boolean;
    purchaseOrders: PurchaseOrder[];
    paginatedPurchaseOrders: PurchaseOrder[];
    currentPOPage: number;
    POTotalPages: number;
    POItemsPerPage: number;
    setCurrentPOPage: (page: number) => void;
    onViewPurchaseOrder: (order: PurchaseOrder) => void;
}

export function RecentPurchaseHistoryTable({
    isLoading,
    purchaseOrders,
    paginatedPurchaseOrders,
    currentPOPage,
    POTotalPages,
    POItemsPerPage,
    setCurrentPOPage,
    onViewPurchaseOrder,
}: RecentPurchaseHistoryTableProps) {
    return (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col">
            <div className="flex-shrink-0 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                            <i className="fas fa-history text-xs" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Recent Purchase History
                        </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Latest orders placed with suppliers
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 px-3 py-1 rounded-2xl border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                        {purchaseOrders?.length || 0} Total
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto md:max-h-[300px]">
                {isLoading ? (
                    <PurchaseHistorySkeleton rows={5} />
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.25)]">
                        <table className="table-pro w-full text-left text-xs border-collapse p-1" id="purchaseOrderTableId">
                            <thead className="bg-[#e4ebf5] dark:bg-[#14151c] border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                                <tr>
                                    <th className="py-3.5 px-4">Order #</th>
                                    <th className="py-3.5 px-4">Supplier</th>
                                    <th className="py-3.5 px-4">Total</th>
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Payment</th>
                                    <th className="py-3.5 px-4 text-right! sm:w-[80px] sm:min-w-[80px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                {paginatedPurchaseOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-2">
                                                    <i className="fas fa-shopping-cart text-lg" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No purchase orders found</span>
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500">Orders placed will appear here automatically.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedPurchaseOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            onClick={() => onViewPurchaseOrder(order)}
                                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer"
                                        >
                                            <td data-label="Order #" className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                <div className="text-right sm:text-left font-mono font-bold">
                                                    {order.po_number}
                                                </div>
                                            </td>
                                            <td data-label="Supplier" className="py-3.5 px-4">
                                                <div className="text-right sm:text-left font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-none ml-auto sm:ml-0">
                                                    {order.supplier_name}
                                                </div>
                                            </td>
                                            <td data-label="Total" className="py-3.5 px-4">
                                                <div className="text-right sm:text-left font-semibold text-slate-900 dark:text-slate-100 font-mono">
                                                    {order.total_amount?.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    }) || '0.00'}
                                                </div>
                                            </td>
                                            <td data-label="Date" className="py-3.5 px-4">
                                                <div className="text-right sm:text-left text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                    {new Date(order.created_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </div>
                                            </td>
                                            <td data-label="Status" className="py-3.5 px-4">
                                                <div className="flex justify-end sm:justify-start">
                                                    {getStatusBadge(order.status)}
                                                </div>
                                            </td>
                                            <td data-label="Payment" className="py-3.5 px-4">
                                                <div className="flex justify-end sm:justify-start">
                                                    {getPaidBadge(order.paid || false)}
                                                </div>
                                            </td>
                                            <td data-label="Actions" className="py-3.5 px-4 text-right sm:w-[80px] sm:min-w-[80px] w-full" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end w-full sm:w-auto">
                                                    <CrudActionButton
                                                        action="view"
                                                        ariaLabel={`View purchase order ${order.po_number}`}
                                                        onClick={() => onViewPurchaseOrder(order)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 border-t border-slate-100 dark:border-slate-900">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-800 dark:text-white">
                            {purchaseOrders.length > 0 ? ((currentPOPage - 1) * POItemsPerPage) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                            {Math.min(currentPOPage * POItemsPerPage, purchaseOrders.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                            {purchaseOrders.length}
                        </span> orders
                    </span>
                </div>

                <Pagination currentPage={currentPOPage} totalPages={POTotalPages} onPageChange={setCurrentPOPage} />
            </div>
        </div>
    );
}
