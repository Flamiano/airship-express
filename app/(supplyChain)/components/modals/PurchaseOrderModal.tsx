"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { buildEmailTemplate } from "@/app/(supplyChain)/(pages)/procurement/api/send-email/template";
import {
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrderModalProps,
} from "@/app/(supplyChain)/(pages)/procurement/types/index";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";

export function PurchaseOrderModal({
    isOpen,
    onClose,
    request,
    onOrderCreated,
}: PurchaseOrderModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);
    const [aiMessage, setAiMessage] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [supplierEmail, setSupplierEmail] = useState('');
    const [supplierMessenger, setSupplierMessenger] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [poCreated, setPoCreated] = useState(false);

    const poNumber = useMemo(() => {
        return request ? `PO-${Date.now().toString().slice(-6)}` : "";
    }, [request?.id]);

    const [formData, setFormData] = useState({
        delivery_date: "",
        notes: "",
        items: [] as Array<PurchaseRequestItem & { unit_price: number; total: number }>,
    });

    useEffect(() => {
        if (request) {
            setFormData({
                delivery_date: "",
                notes: "",
                items: (request.items || []).map((item) => ({
                    ...item,
                    unit_price: 0,
                    total: 0,
                })),
            });
            setStep(1);
            setAiMessage('');
            setSupplierEmail('');
            setSupplierMessenger('');
            setPoCreated(false);

            if (request.supplier_id) {
                fetchSupplierDetails(request.supplier_id);
            }
        }
    }, [request]);

    const fetchSupplierDetails = async (supplierId: string) => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('email, fb_link')
                .eq('id', supplierId)
                .single();

            if (!error && data) {
                setSupplierEmail(data.email || '');
                setSupplierMessenger(data.fb_link || '');
            }
        } catch (error) {
            console.error('Error fetching supplier details:', error);
        }
    };

    const updateItem = (index: number, valueStr: string) => {
        const unit_price = parseFloat(valueStr) || 0;
        setFormData((prev) => {
            const newItems = [...prev.items];
            newItems[index] = {
                ...newItems[index],
                unit_price,
                total: unit_price * (newItems[index].quantity || 1),
            };
            return { ...prev, items: newItems };
        });
    };

    const totalAmount = formData.items.reduce((sum, item) => sum + item.total, 0);

    const handleNext = () => {
        const hasEmptyPrice = formData.items.some((item) => item.unit_price <= 0);
        if (hasEmptyPrice) {
            toast.warning("Please set a valid unit price for all items");
            return;
        }
        setStep(2);
    };

    const handleBack = () => setStep(1);

    const generateAIMessage = async () => {
        if (!request) return;

        setIsGeneratingAI(true);
        try {
            const response = await fetch('/procurement/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier_name: request.supplier_name,
                    items: formData.items,
                    total_amount: totalAmount,
                    delivery_date: formData.delivery_date,
                    po_number: poNumber,
                    notes: formData.notes,
                    sender_name: user.getName(),
                    sender_position: user.getRole(),
                }),
            });

            const data = await response.json();
            if (data.success) {
                setAiMessage(data.message);
                toast.success('AI message generated!');
            } else {
                toast.error('Failed to generate AI message');
            }
        } catch (error) {
            console.error('Error generating AI message:', error);
            toast.error('Failed to generate AI message');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const getFullMessage = () => {
        if (!aiMessage) return '';
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';

        const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;
        return `${aiMessage}\n\n---\n\n📋 **Confirm this order:** ${confirmLink}\n\nPlease click the link above to confirm this purchase order.`;
    };

    const createPurchaseOrder = async (): Promise<boolean> => {
        if (!request) return false;
        if (poCreated) return true;

        try {
            const orderData = {
                po_number: poNumber,
                request_id: request.id,
                supplier_id: request.supplier_id,
                supplier_name: request.supplier_name,
                total_amount: totalAmount,
                status: "Sent",
                delivery_date: formData.delivery_date || new Date().toISOString().split("T")[0],
                notes: formData.notes,
                items: formData.items,
                created_by: user.getName(),
            };

            await onOrderCreated?.(orderData);
            setPoCreated(true);
            return true;

        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create Purchase Order');
            return false;
        }
    };

    const handleEmail = async () => {
        if (!aiMessage) {
            toast.warning('Please generate a message first');
            return;
        }

        if (isSending) return;

        const toastId = toast.loading('Preparing email...', {
            duration: Infinity,
            position: 'top-center',
        });

        setIsSending(true);

        try {
            toast.loading('Creating Purchase Order...', {
                id: toastId,
                duration: Infinity,
            });

            const poCreated = await createPurchaseOrder();
            if (!poCreated) {
                toast.error('Failed to create Purchase Order', {
                    id: toastId,
                    duration: 5000,
                });
                setIsSending(false);
                return;
            }

            const emailTo = supplierEmail || '';

            if (!emailTo) {
                toast.warning('No email found for supplier. Please add an email address.', {
                    id: toastId,
                    duration: 5000,
                });
                setIsSending(false);
                return;
            }

            toast.info(`Sending email to ${emailTo}...`, {
                id: toastId,
                duration: Infinity,
            });

            const confirmLink = `${window.location.origin}/procurement/confirm?po=${poNumber}`;
            const fullMessage = getFullMessage();

            const emailHtml = buildEmailTemplate({
                poNumber: poNumber,
                supplierName: request?.supplier_name || '',
                items: formData.items,
                totalAmount: totalAmount,
                deliveryDate: formData.delivery_date || 'TBD',
                notes: formData.notes || '',
                confirmLink: confirmLink,
                senderName: user.getName(),
                senderPosition: user.getRole(),
                senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER || '',
            });

            const response = await fetch('/procurement/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailTo,
                    subject: `Purchase Order ${poNumber} - ${request?.supplier_name}`,
                    html: emailHtml,
                    text: fullMessage,
                    po_number: poNumber,
                    supplier_name: request?.supplier_name,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`PO Created & Email sent to ${emailTo}!`, {
                    id: toastId,
                    duration: 6000,
                });

                try {
                    await navigator.clipboard.writeText(fullMessage);
                } catch (clipError) {
                    console.warn('Could not copy to clipboard:', clipError);
                }

                setTimeout(() => {
                    setIsSending(false);
                    onClose();
                }, 2000);

            } else {
                throw new Error(data.error || 'Failed to send email');
            }

        } catch (error: any) {
            console.error('Error sending email:', error);

            toast.error(`${error.message || 'Failed to send email. Please try again.'}`, {
                id: toastId,
                duration: 8000,
            });

            setIsSending(false);
        }
    };

    const handleMessenger = async () => {
        if (!aiMessage) {
            toast.warning('Please generate a message first');
            return;
        }

        if (isSending) return;

        const toastId = toast.loading('Preparing Messenger message...', {
            duration: Infinity,
            position: 'top-center',
        });

        setIsSending(true);

        try {
            toast.loading('Creating Purchase Order...', {
                id: toastId,
                duration: Infinity,
            });

            const poCreated = await createPurchaseOrder();
            if (!poCreated) {
                toast.error('Failed to create Purchase Order', {
                    id: toastId,
                    duration: 5000,
                });
                setIsSending(false);
                return;
            }

            const confirmLink = `${window.location.origin}/procurement/confirm?po=${poNumber}`;
            const message = `${aiMessage}\n\n---\nConfirm this order: ${confirmLink}`;

            toast.loading('Copying message...', {
                id: toastId,
                duration: Infinity,
            });

            try {
                await navigator.clipboard.writeText(message);
            } catch (clipError) {
                console.warn('Could not copy to clipboard:', clipError);
            }

            toast.loading('Opening Messenger...', {
                id: toastId,
                duration: Infinity,
            });

            if (supplierMessenger) {
                window.open(supplierMessenger, '_blank');
                toast.success(`PO Created & Messenger opened for ${request?.supplier_name}`, {
                    id: toastId,
                    duration: 5000,
                });
            } else {
                const messengerUrl = `https://m.me/?text=${encodeURIComponent(message)}`;
                window.open(messengerUrl, '_blank');
                toast.success('PO Created! Message copied to clipboard. Opening Messenger.', {
                    id: toastId,
                    duration: 5000,
                });
            }

            setTimeout(() => {
                setIsSending(false);
                onClose();
            }, 2000);

        } catch (error) {
            console.error('Error sending messenger:', error);
            toast.error('Failed to send via Messenger. Please try again.', {
                id: toastId,
                duration: 8000,
            });
            setIsSending(false);
        }
    };

    const handleCreatePOOnly = async () => {
        if (!request || isSending) return;

        setIsSending(true);
        try {
            const orderData = {
                po_number: poNumber,
                request_id: request.id,
                supplier_id: request.supplier_id,
                supplier_name: request.supplier_name,
                total_amount: totalAmount,
                status: "Draft",
                delivery_date: formData.delivery_date || new Date().toISOString().split("T")[0],
                notes: formData.notes,
                items: formData.items,
                created_by: user.getName(),
            };

            await onOrderCreated?.(orderData);
            setPoCreated(true);
            toast.success('PO Created successfully!');

            setTimeout(() => {
                setIsSending(false);
                onClose();
            }, 500);

        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create PO');
            setIsSending(false);
        }
    };

    const handleCopyOnly = async () => {
        if (!aiMessage) {
            toast.warning('Please generate a message first');
            return;
        }
        const fullMessage = getFullMessage();
        try {
            await navigator.clipboard.writeText(fullMessage);
            toast.success('Message copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy message');
        }
    };

    const handlePrint = () => {
        if (!aiMessage) {
            toast.warning('Please generate a message first');
            return;
        }
        window.print();
    };

    if (!isOpen || !request) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl dark:shadow-black/60 border border-slate-100 dark:border-white/10 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                                <i className="fas fa-file-invoice text-sm" />
                            </span>
                            Create Purchase Order
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            For request:{" "}
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {request.request_number}
                            </span>
                        </p>
                    </div>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="icon-sm"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <i className="fas fa-times text-xs" />
                    </AppButton>
                </div>

                {step === 1 && (
                    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/80 dark:border-white/10">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                        Supplier
                                    </span>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                                        {request.supplier_name}
                                    </p>
                                    {supplierEmail && (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                            📧 {supplierEmail}
                                        </p>
                                    )}
                                    {supplierMessenger && (
                                        <p className="text-[10px] text-sky-400 dark:text-sky-500 mt-0.5 truncate">
                                            💬 Messenger available
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                        Requested By
                                    </span>
                                    <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                                        {request.requested_by}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                        Department
                                    </span>
                                    <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                                        {request.department}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                        Priority
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 mt-1">
                                        {request.priority}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Items & Pricing
                                </label>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formData.items.length} items
                                </span>
                            </div>
                            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                {formData.items.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs hover:border-slate-300 dark:hover:border-white/20 transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Qty:{" "}
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {item.quantity}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="w-36">
                                            <div className="relative rounded-lg shadow-2xs">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                                        ₱
                                                    </span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg pl-6 pr-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                                    placeholder="0.00"
                                                    value={item.unit_price || ""}
                                                    onChange={(e) => updateItem(index, e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="w-28 text-right">
                                            <span className="text-xs text-slate-400 dark:text-slate-500 block">
                                                Total
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                ₱{item.total.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Delivery Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                                    value={formData.delivery_date}
                                    min={new Date().toISOString().split("T")[0]}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            delivery_date: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Total Amount
                                </label>
                                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/30 rounded-xl px-4 py-2 flex items-center justify-between">
                                    <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                                        Grand Total
                                    </span>
                                    <span className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                                        ₱{totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Notes
                            </label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                                rows={2}
                                placeholder="Add any specific instructions or details for this purchase order..."
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                                }
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-white/10">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={onClose}
                            >
                                Cancel
                            </AppButton>
                            <AppButton
                                type="button"
                                variant="success"
                                size="md"
                                onClick={handleNext}
                            >
                                <span>Next</span>
                                <i className="fas fa-arrow-right text-xs" />
                            </AppButton>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <>
                        <div className="bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 sm:p-5 shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                    <span className="p-1.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg flex items-center justify-center shadow-xs">
                                        <i className="fas fa-robot text-xs" />
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-semibold leading-none">
                                            AI Recommended Supplier Message
                                        </h3>
                                        <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 block">
                                            Based on your order details
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="xs"
                                        onClick={generateAIMessage}
                                        disabled={isGeneratingAI || isSending}
                                    >
                                        {isGeneratingAI ? (
                                            <i className="fas fa-spinner fa-spin text-[11px]" />
                                        ) : (
                                            <i className="fas fa-wand-magic-sparkles text-[11px]" />
                                        )}
                                        <span>{isGeneratingAI ? 'Generating...' : 'Generate with AI'}</span>
                                    </AppButton>
                                    {aiMessage && (
                                        <AppButton
                                            type="button"
                                            variant="neutral"
                                            size="xs"
                                            onClick={handleCopyOnly}
                                            disabled={isSending}
                                        >
                                            <i className="fas fa-copy text-[11px]" />
                                            <span>Copy</span>
                                        </AppButton>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-indigo-100/80 dark:border-indigo-800/20 text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-2xs min-h-[120px]">
                                {isGeneratingAI ? (
                                    <div className="flex items-center justify-center h-20">
                                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                            <i className="fas fa-spinner fa-spin text-lg" />
                                            <span>Generating message...</span>
                                        </div>
                                    </div>
                                ) : aiMessage ? (
                                    <div>
                                        <p className="whitespace-pre-wrap">{aiMessage}</p>
                                        <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/30">
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                📋 Confirmation link will be included when you use Email or Messenger
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 dark:text-slate-500 italic text-center py-6">
                                        Click "Generate with AI" to create a professional supplier message
                                    </p>
                                )}
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {supplierEmail && (
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-white/10">
                                        <i className="fas fa-envelope text-blue-400" />
                                        <span>Email: <strong>{supplierEmail}</strong></span>
                                    </div>
                                )}
                                {supplierMessenger && (
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-white/10">
                                        <i className="fab fa-facebook-messenger text-sky-400" />
                                        <span>Messenger: <strong>Available</strong></span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/60 dark:border-white/10">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={handleBack}
                                disabled={submitting || isSending}
                                className="w-full sm:w-auto"
                            >
                                <i className="fas fa-arrow-left text-xs" />
                                <span>Back</span>
                            </AppButton>

                            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-1.5">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="sm"
                                        onClick={handlePrint}
                                        title="Print PO"
                                        disabled={!aiMessage || isSending}
                                    >
                                        <i className="fas fa-print text-slate-500 dark:text-slate-400" />
                                        <span className="hidden sm:inline">Print</span>
                                    </AppButton>
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="sm"
                                        onClick={handleEmail}
                                        title="Send Email (Gmail)"
                                        disabled={!aiMessage || isSending}
                                    >
                                        {isSending ? (
                                            <i className="fas fa-spinner fa-spin text-pink-500" />
                                        ) : (
                                            <i className="fas fa-envelope text-blue-500 dark:text-blue-400" />
                                        )}
                                        <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Gmail'}</span>
                                    </AppButton>
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="sm"
                                        onClick={handleMessenger}
                                        title="Send via Messenger"
                                        disabled={!aiMessage || isSending}
                                    >
                                        {isSending ? (
                                            <i className="fas fa-spinner fa-spin text-sky-500" />
                                        ) : (
                                            <i className="fab fa-facebook-messenger text-sky-500 dark:text-sky-400" />
                                        )}
                                        <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Messenger'}</span>
                                    </AppButton>
                                </div>

                                <AppButton
                                    type="button"
                                    variant="success"
                                    size="md"
                                    onClick={handleCreatePOOnly}
                                    disabled={submitting || isSending}
                                    loading={submitting || isSending}
                                    className="ml-auto sm:ml-0"
                                >
                                    {!submitting && !isSending && (
                                        <i className="fas fa-check text-xs" />
                                    )}
                                    <span>Create PO</span>
                                </AppButton>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
