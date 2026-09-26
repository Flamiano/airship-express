'use client';

import React, { useRef } from 'react';
import Portal from '../client/Portal';
import { AppButton } from '../ui/AppButton';
import { toast } from 'sonner';

export interface DigitalReceiptData {
    id?: string;
    po_number: string;
    supplier_name: string;
    supplier_email?: string;
    supplier_phone?: string;
    total_amount: number;
    status: string;
    delivery_date?: string;
    notes?: string;
    items?: Array<{
        name?: string;
        item_name?: string;
        quantity: number;
        unit_price?: number;
        price?: number;
        total?: number;
    }>;
    created_at?: string;
    created_by?: string;
    paid?: boolean;
    verification?: any;
}

interface DigitalReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    order?: DigitalReceiptData | null;
    purchaseOrder?: DigitalReceiptData | null;
}

export function DigitalReceiptModal({ isOpen, onClose, order: propOrder, purchaseOrder }: DigitalReceiptModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const order = propOrder || purchaseOrder || null;

    if (!isOpen || !order) return null;

    const formattedDate = order.created_at
        ? new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          });

    const items = (order.items && order.items.length > 0)
        ? order.items
        : [{
              name: order.notes || 'Purchase Order Items',
              item_name: order.notes || 'Purchase Order Items',
              quantity: 1,
              unit_price: order.total_amount,
              total: order.total_amount,
          }];

    const calculatedSubtotal = items.reduce((sum, it) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.unit_price ?? it.price ?? 0);
        return sum + (it.total ? Number(it.total) : qty * price);
    }, 0);

    const grandTotal = order.total_amount || calculatedSubtotal;

    const handlePrint = () => {
        window.print();
    };

    const handleCopyDetails = async () => {
        const text = `AIRSHIP EXPRESS - OFFICIAL DIGITAL RECEIPT
PO Number: ${order.po_number}
Supplier: ${order.supplier_name}
Date: ${formattedDate}
Status: ${order.status}
Total: ₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Items:
${items.map(i => `- ${i.name || i.item_name || 'Item'} (Qty: ${i.quantity}) @ ₱${(i.unit_price || 0).toLocaleString()} = ₱${(i.total || (i.quantity * (i.unit_price || 0))).toLocaleString()}`).join('\n')}
Expected Delivery: ${order.delivery_date || 'Standard Schedule'}
`;
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Receipt details copied');
        } catch (e) {
            toast.error('Failed to copy receipt');
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 overflow-y-auto animate-in fade-in duration-150"
                onClick={onClose}
            >
                <div
                    className="bg-[#f8fafc] dark:bg-[#111218] rounded-2xl max-w-2xl w-full my-auto shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Minimalist Header Toolbar */}
                    <div className="print:hidden px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/70 dark:bg-[#161720]/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                Digital Receipt
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                · {order.po_number}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <AppButton type="button" variant="neutral" size="xs" onClick={handleCopyDetails}>
                                <i className="fas fa-copy text-[10px]" />
                                <span>Copy</span>
                            </AppButton>
                            <AppButton type="button" variant="primary" size="xs" onClick={handlePrint}>
                                <i className="fas fa-print text-[10px]" />
                                <span>Print</span>
                            </AppButton>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer ml-1"
                                aria-label="Close"
                            >
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    </div>

                    {/* Printable Receipt Container */}
                    <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh]">
                        <div
                            ref={receiptRef}
                            id="printable-digital-receipt"
                            className="bg-white dark:bg-[#161722] text-slate-900 dark:text-slate-100 p-6 sm:p-8 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm font-sans relative print:p-0 print:border-none print:shadow-none print:bg-white print:text-black"
                        >
                            {/* Minimalist Brand Header */}
                            <div className="border-b border-slate-200/80 dark:border-slate-800 pb-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/images/logo-remove-bg.png"
                                        alt="Airship Express"
                                        className="h-8 w-auto object-contain dark:brightness-0 dark:invert"
                                    />
                                    <div>
                                        <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block leading-tight">
                                            Airship<span className="text-pink-600 dark:text-pink-400 font-semibold">Express</span>
                                        </span>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mt-0.5">
                                            Procurement & Supply Chain
                                        </p>
                                    </div>
                                </div>

                                <div className="sm:text-right">
                                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200/80 dark:border-slate-700/60 inline-block">
                                        {order.po_number}
                                    </span>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                        Date: {formattedDate}
                                    </p>
                                </div>
                            </div>

                            {/* Clean Meta Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs bg-slate-50/70 dark:bg-slate-900/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/60">
                                <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Supplier
                                    </span>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {order.supplier_name}
                                    </p>
                                    {order.supplier_email && (
                                        <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                            {order.supplier_email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Delivery Date
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300">
                                        {order.delivery_date || 'Standard'}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Status
                                    </span>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                        {order.status}
                                    </p>
                                </div>
                            </div>

                            {/* Minimalist Itemized Table */}
                            <div className="mb-6 overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                                            <th className="py-2 text-left">Item Description</th>
                                            <th className="py-2 text-center w-14">Qty</th>
                                            <th className="py-2 text-right w-24">Price</th>
                                            <th className="py-2 text-right w-28">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                                        {items.map((item, idx) => {
                                            const qty = Number(item.quantity) || 1;
                                            const unitPrice = Number(item.unit_price ?? item.price ?? 0);
                                            const total = item.total ? Number(item.total) : qty * unitPrice;
                                            return (
                                                <tr key={idx}>
                                                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                                        {item.name || item.item_name || 'Item'}
                                                    </td>
                                                    <td className="py-2.5 text-center text-slate-600 dark:text-slate-400">
                                                        {qty}
                                                    </td>
                                                    <td className="py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                                                        ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                                                        ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Minimalist Totals & Notes */}
                            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="max-w-xs text-xs text-slate-500">
                                    {order.notes && (
                                        <div>
                                            <span className="text-[10px] font-medium uppercase text-slate-400 block mb-0.5">
                                                Notes
                                            </span>
                                            <p className="italic text-slate-600 dark:text-slate-400">{order.notes}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full sm:w-52 space-y-1.5 text-xs text-right">
                                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                        <span>Subtotal:</span>
                                        <span className="font-mono">
                                            ₱{calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span>Total:</span>
                                        <span className="font-mono text-slate-900 dark:text-white">
                                            ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Minimalist Signature Lines */}
                            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-xs">
                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-8">
                                        <span>Authorized By</span>
                                    </div>
                                    <div className="border-t border-slate-300 dark:border-slate-700 pt-1.5">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                            {order.created_by || 'Authorized Manager'}
                                        </p>
                                        <p className="text-[10px] text-slate-400">Procurement Manager</p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-8">
                                        <span>Received By</span>
                                    </div>
                                    <div className="border-t border-slate-300 dark:border-slate-700 pt-1.5">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                            {order.supplier_name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">Supplier Representative</p>
                                    </div>
                                </div>
                            </div>

                            {/* Minimalist Footer Note */}
                            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/40 text-center text-[10px] text-slate-400">
                                <span>AirshipExpress Supply Chain Management System · Digital Record</span>
                            </div>
                        </div>
                    </div>

                    {/* Minimalist Footer Close */}
                    <div className="print:hidden px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-[#161720]/70 flex items-center justify-end">
                        <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                            Close
                        </AppButton>
                    </div>
                </div>
            </div>

            {/* Global Print Style for clean printing */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-digital-receipt, #printable-digital-receipt * {
                        visibility: visible !important;
                    }
                    #printable-digital-receipt {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 24px !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    #printable-digital-receipt table,
                    #printable-digital-receipt th,
                    #printable-digital-receipt td,
                    #printable-digital-receipt p,
                    #printable-digital-receipt span,
                    #printable-digital-receipt div {
                        color: #000000 !important;
                        border-color: #e2e8f0 !important;
                        background: transparent !important;
                    }
                }
            `}</style>
        </Portal>
    );
}
