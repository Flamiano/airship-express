"use client";

import {
    ChartDetailModalProps,
    PurchaseOrder,
} from "@/app/(supplyChain)/(pages)/procurement/types/index";

const getPOStatusColor = (status: string) => {
    switch (status) {
        case 'Draft': return 'bg-slate-100 text-slate-600';
        case 'Sent': return 'bg-blue-100 text-blue-600';
        case 'Confirmed': return 'bg-emerald-100 text-emerald-600';
        case 'Delivered': return 'bg-pink-100 text-pink-600';
        default: return 'bg-red-100 text-red-600';
    }
};

export function ChartDetailModal({
    isOpen,
    onClose,
    month,
    monthIndex,
    orders,
    totalAmount,
}: ChartDetailModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                            {month} Orders
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {orders.length} order{orders.length !== 1 ? 's' : ''} • Total: ₱{totalAmount.toLocaleString()}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                            <i className="fas fa-shopping-cart text-4xl mb-3 opacity-30" />
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No orders in {month}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">No purchase orders were completed this month.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Orders</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{orders.length}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Spent</p>
                                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₱{totalAmount.toLocaleString()}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unique Suppliers</p>
                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                                        {new Set(orders.map(o => o.supplier_id)).size}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Order Details</p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {orders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        {order.po_number}
                                                    </span>
                                                    <span className={`inline-flex items-center px-1.5 py-0.3 rounded text-[10px] font-medium ${getPOStatusColor(order.status)} border border-transparent`}>
                                                        {order.status}
                                                    </span>
                                                    {order.paid && (
                                                        <span className="inline-flex items-center px-1.5 py-0.3 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                                                            Paid
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={order.supplier_name}>
                                                    {order.supplier_name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3 shrink-0">
                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                    ₱{order.total_amount.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {new Date(order.delivery_date || order.created_at || '').toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
