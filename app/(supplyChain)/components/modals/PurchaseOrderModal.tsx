"use client";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { buildEmailTemplate } from "@/app/(supplyChain)/(pages)/procurement/api/send-email/template";
import { PurchaseRequestItem, PurchaseOrderModalProps } from "@/app/(supplyChain)/(pages)/procurement/types/index";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import Portal from "@/app/(supplyChain)/components/client/Portal";

export function PurchaseOrderModal({
    isOpen,
    onClose,
    request,
    onOrderCreated,
}: PurchaseOrderModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);
    
    // Email template mode: 'standard' | 'ai'
    const [emailMode, setEmailMode] = useState<'standard' | 'ai'>('standard');
    const [aiMessage, setAiMessage] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    
    const [supplierEmail, setSupplierEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [poCreated, setPoCreated] = useState(false);
    
    // Expand / Full View Modal state
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);

    const poNumber = useMemo(() => {
        return request ? `PO-${Date.now().toString().slice(-6)}` : "";
    }, [request?.id]);

    const getAiCacheKey = (reqId?: string, poNum?: string) => {
        if (reqId) return `po_ai_compose_req_${reqId}`;
        if (poNum) return `po_ai_compose_po_${poNum}`;
        return 'po_ai_compose_temp';
    };

    const [formData, setFormData] = useState({
        delivery_date: "",
        notes: "",
        items: [] as Array<
            PurchaseRequestItem & {
                unit_price: number;
                total: number;
            }
        >,
    });

    useEffect(() => {
        if (request) {
            const rawItems = request.items || [];
            const reqAmount = Number(request.amount) || 0;
            let mappedItems = rawItems.map((item: any) => {
                const itemName = item.item_name || item.name || item.description || request.description || request.type || 'Inventory Item';
                const quantity = Math.max(1, Number(item.quantity) || 1);
                let unit_price = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                if (unit_price <= 0 && reqAmount > 0 && rawItems.length === 1) {
                    unit_price = reqAmount / quantity;
                }
                const total = unit_price > 0 ? unit_price * quantity : 0;
                return {
                    ...item,
                    name: itemName,
                    item_name: itemName,
                    quantity,
                    unit_price,
                    total,
                };
            });

            // If rawItems was empty, synthesize an item using request details
            if (mappedItems.length === 0) {
                const defaultName = request.description || request.type || "General Request Item";
                mappedItems = [{
                    name: defaultName,
                    item_name: defaultName,
                    quantity: 1,
                    unit_price: reqAmount > 0 ? reqAmount : 0,
                    total: reqAmount > 0 ? reqAmount : 0,
                }];
            }

            // If unit prices were 0 across all items but request has an approved amount, allocate proportionally
            const totalFromItems = mappedItems.reduce((sum, it) => sum + it.total, 0);
            if (totalFromItems === 0 && reqAmount > 0 && mappedItems.length > 0) {
                const perItemTotal = reqAmount / mappedItems.length;
                mappedItems.forEach((it) => {
                    it.unit_price = Number((perItemTotal / it.quantity).toFixed(2));
                    it.total = Number((it.unit_price * it.quantity).toFixed(2));
                });
            }

            setFormData({
                delivery_date: "",
                notes: "",
                items: mappedItems,
            });
            setStep(1);
            setSupplierEmail('');
            setPoCreated(false);

            // Check localStorage for previously composed AI content for this request
            const cacheKey = getAiCacheKey(request.id, poNumber);
            const cachedAi = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
            if (cachedAi) {
                setAiMessage(cachedAi);
                setEmailMode('ai');
            } else {
                setAiMessage('');
                setEmailMode('standard');
            }

            if (request.supplier_id) {
                fetchSupplierDetails(request.supplier_id);
            }
        }
    }, [request]);

    const handleAiTextChange = (text: string) => {
        setAiMessage(text);
        if (request) {
            const cacheKey = getAiCacheKey(request.id, poNumber);
            if (typeof window !== 'undefined') {
                localStorage.setItem(cacheKey, text);
            }
        }
    };

    const handleClearAiCache = () => {
        if (request) {
            const cacheKey = getAiCacheKey(request.id, poNumber);
            if (typeof window !== 'undefined') {
                localStorage.removeItem(cacheKey);
            }
            setAiMessage('');
            setEmailMode('standard');
            toast.info('Cleared cached AI composition.');
        }
    };

    const fetchSupplierDetails = async (supplierId: string) => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('email')
                .eq('id', supplierId)
                .single();

            if (!error && data) {
                setSupplierEmail(data.email || '');
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
                setEmailMode('ai');
                // Store in localStorage
                const cacheKey = getAiCacheKey(request.id, poNumber);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(cacheKey, data.message);
                }
                toast.success('AI message generated & saved locally!');
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
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
        const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

        if (emailMode === 'ai' && aiMessage) {
            return `${aiMessage}\n\n---\n\n **Confirm this order:** ${confirmLink}\n\nPlease click the link above to confirm this purchase order.`;
        }

        return `Hello ${request?.supplier_name || 'Vendor'},\n\nPlease review Purchase Order #${poNumber} for a total of ₱${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\nExpected Delivery: ${formData.delivery_date || 'Standard Timeline'}\n\n---\n\n Confirm this order: ${confirmLink}`;
    };

    const getSanitizedItems = () => {
        const itemsToProcess = formData.items.length > 0
            ? formData.items
            : [{
                name: request?.description || request?.type || "Purchase Order Item",
                item_name: request?.description || request?.type || "Purchase Order Item",
                quantity: 1,
                unit_price: totalAmount > 0 ? totalAmount : 0,
                total: totalAmount > 0 ? totalAmount : 0,
            }];

        return itemsToProcess.map((item: any) => {
            const itemName = item.item_name || item.name || item.description || request?.description || request?.type || "Inventory Item";
            const quantity = Math.max(1, Number(item.quantity) || 1);
            const unit_price = Number(item.unit_price ?? item.price ?? 0);
            const total = item.total ? Number(item.total) : Number((quantity * unit_price).toFixed(2));
            return {
                ...item,
                name: itemName,
                item_name: itemName,
                quantity,
                unit_price,
                total,
            };
        });
    };

    const createPurchaseOrder = async (status: 'Draft' | 'Sent' = 'Sent'): Promise<boolean> => {
        if (!request) return false;
        if (poCreated) return true;

        try {
            const sanitizedItems = getSanitizedItems();
            const orderData = {
                po_number: poNumber,
                request_id: request.id,
                supplier_id: request.supplier_id,
                supplier_name: request.supplier_name,
                total_amount: totalAmount,
                status: status,
                delivery_date: formData.delivery_date || new Date().toISOString().split("T")[0],
                notes: formData.notes,
                items: sanitizedItems,
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
        const emailTo = supplierEmail.trim();
        if (!emailTo) {
            toast.warning('Please enter a valid supplier email address.');
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
            const poCreatedSuccess = await createPurchaseOrder('Sent');
            if (!poCreatedSuccess) {
                toast.error('Failed to create Purchase Order', {
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

            const fullMessage = getFullMessage();
            const sanitizedItems = getSanitizedItems();
            const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
            const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
            const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

            const emailHtml = buildEmailTemplate({
                poNumber: poNumber,
                supplierName: request?.supplier_name || 'Valued Supplier',
                items: sanitizedItems,
                totalAmount: totalAmount,
                deliveryDate: formData.delivery_date || 'As agreed in procurement contract',
                notes: formData.notes || 'None',
                confirmLink: confirmLink,
                customBodyText: emailMode === 'ai' && aiMessage ? aiMessage : undefined,
                senderName: user.getName(),
                senderRole: user.getRole(),
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
                toast.success(`PO Created & Email dispatched to ${emailTo}!`, {
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
                }, 1500);
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

    const handleCreatePOOnly = async () => {
        if (!request || isSending || submitting) return;
        setSubmitting(true);
        try {
            const success = await createPurchaseOrder('Draft');
            if (success) {
                toast.success('PO Created successfully as Draft!');
                setTimeout(() => {
                    setSubmitting(false);
                    onClose();
                }, 500);
            } else {
                setSubmitting(false);
            }
        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create PO');
            setSubmitting(false);
        }
    };

    const handleCopyOnly = async () => {
        const fullMessage = getFullMessage();
        try {
            await navigator.clipboard.writeText(fullMessage);
            toast.success('Message copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy message');
        }
    };

    if (!isOpen || !request) return null;

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
    const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

    return (
        <Portal>
            <div className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
                <div className="bg-[#ebf0f7] dark:bg-[#151620] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-[12px_12px_30px_rgba(166,175,195,0.4),-10px_-10px_25px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.65),-4px_-4px_14px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200/60 dark:border-white/[0.06]">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-2xl bg-white dark:bg-[#1a1b26] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] text-pink-600 dark:text-pink-400 flex items-center justify-center">
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
                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <i className="fas fa-times text-xs" />
                        </AppButton>
                    </div>

                    {/* Step 1: Items & Delivery Details */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-2xl p-4 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Supplier
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                                            {request.supplier_name}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            PO Number
                                        </span>
                                        <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                                            {poNumber}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Priority
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                                            {request.priority}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                            Created By
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                                            {user.getName()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                    Items & Unit Prices
                                </label>
                                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                    {formData.items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#1a1c27] rounded-xl border border-white dark:border-white/[0.06] shadow-[3px_3px_8px_rgba(166,175,195,0.3),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5)]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 block truncate">
                                                    {item.name || item.item_name || "Item"}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    Qty: <strong className="text-slate-700 dark:text-slate-300">{item.quantity}</strong>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-400">₱</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="Unit price"
                                                        className="w-24 bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-lg px-2.5 py-1 text-right text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                                        value={item.unit_price === 0 ? "" : item.unit_price}
                                                        onChange={(e) => updateItem(index, e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-24 text-right">
                                                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        ₱{item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Delivery Date & Grand Total */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Expected Delivery Date
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                        value={formData.delivery_date}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, delivery_date: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center justify-end">
                                    <div className="text-right">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                            Grand Total
                                        </span>
                                        <span className="text-xl font-bold font-mono text-pink-600 dark:text-pink-400">
                                            ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Notes & Instructions
                                </label>
                                <textarea
                                    className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                    rows={2}
                                    placeholder="Add any specific instructions or delivery guidelines..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <AppButton type="button" variant="neutral" size="md" onClick={onClose}>
                                    Cancel
                                </AppButton>
                                <AppButton type="button" variant="primary" size="md" onClick={handleNext}>
                                    <span>Next: Dispatch & Review</span>
                                    <i className="fas fa-arrow-right text-xs" />
                                </AppButton>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Email Template, AI Compose & Dispatch Options */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            
                            {/* Email Mode Selector & Status Indicator */}
                            <div className="bg-slate-50/80 dark:bg-[#13141d] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                                            Email Dispatch Content
                                        </h4>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                                            Standard formal layout or AI customized explanation
                                        </span>
                                    </div>

                                    {/* Minimalist Active Mode Indicator & Full View */}
                                    <div className="flex items-center gap-2">
                                        {emailMode === 'ai' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/40">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span>AI Content Active</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                <span>Standard Template</span>
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setIsFullPreviewOpen(true)}
                                            className="px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#181924] border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                                            title="View Full Expanded Text & Email Preview"
                                        >
                                            <span>Full View</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Minimalist Mode Switcher Tabs */}
                                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setEmailMode('standard')}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            emailMode === 'standard'
                                                ? 'bg-white dark:bg-[#1c1e2b] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span>Standard</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEmailMode('ai');
                                            if (!aiMessage && !isGeneratingAI) {
                                                generateAIMessage();
                                            }
                                        }}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            emailMode === 'ai'
                                                ? 'bg-white dark:bg-[#1c1e2b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800/40'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                    >
                                        <span>AI Content</span>
                                    </button>
                                </div>

                                {/* Content Preview Area */}
                                {emailMode === 'standard' ? (
                                    <div className="bg-white dark:bg-[#181924] rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                                            "Hello <strong>{request.supplier_name}</strong>, please review and accept this official purchase order for the item(s) listed below. Confirm availability and expected delivery schedule at your earliest convenience."
                                        </p>
                                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                                            <span>Includes item breakdown table, total (₱{totalAmount.toLocaleString()}), and confirmation button.</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsFullPreviewOpen(true)}
                                                className="text-slate-600 dark:text-slate-300 hover:underline font-medium cursor-pointer"
                                            >
                                                View all
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#181924] rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                                AI Generated Text
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="xs"
                                                    onClick={generateAIMessage}
                                                    disabled={isGeneratingAI || isSending}
                                                >
                                                    {isGeneratingAI ? (
                                                        <i className="fas fa-spinner fa-spin text-[10px]" />
                                                    ) : (
                                                        <i className="fas fa-arrows-rotate text-[10px]" />
                                                    )}
                                                    <span>{isGeneratingAI ? 'Generating...' : 'Regenerate'}</span>
                                                </AppButton>
                                                {aiMessage && (
                                                    <>
                                                        <AppButton
                                                            type="button"
                                                            variant="neutral"
                                                            size="xs"
                                                            onClick={handleCopyOnly}
                                                            disabled={isSending}
                                                        >
                                                            <i className="fas fa-copy text-[10px]" />
                                                            <span>Copy</span>
                                                        </AppButton>
                                                        <button
                                                            type="button"
                                                            onClick={handleClearAiCache}
                                                            className="w-6 h-6 rounded-md text-slate-400 hover:text-rose-500 flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                                                            title="Clear Cache"
                                                        >
                                                            <i className="fas fa-trash-alt" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isGeneratingAI ? (
                                            <div className="flex flex-col items-center justify-center h-24 text-slate-500 gap-2">
                                                <i className="fas fa-spinner fa-spin text-base" />
                                                <span className="text-xs">Drafting supplier message...</span>
                                            </div>
                                        ) : aiMessage ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={aiMessage}
                                                    onChange={(e) => handleAiTextChange(e.target.value)}
                                                    rows={5}
                                                    className="w-full bg-slate-50 dark:bg-[#13141d] p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 font-sans transition-all resize-y leading-relaxed"
                                                    placeholder="Edit AI message..."
                                                />
                                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                    <span>Saved locally in browser</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsFullPreviewOpen(true)}
                                                        className="text-slate-600 dark:text-slate-300 hover:underline font-medium cursor-pointer"
                                                    >
                                                        Expand view
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-5">
                                                <p className="text-slate-400 text-xs mb-2">
                                                    No AI content generated yet.
                                                </p>
                                                <AppButton
                                                    type="button"
                                                    variant="primary"
                                                    size="xs"
                                                    onClick={generateAIMessage}
                                                >
                                                    <span>Generate with AI</span>
                                                </AppButton>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Supplier Email Input & Verification */}
                                <div className="pt-1">
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Supplier Email Address (Gmail / Direct)
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                            <i className="fas fa-envelope text-xs" />
                                        </div>
                                        <input
                                            type="email"
                                            value={supplierEmail}
                                            onChange={(e) => setSupplierEmail(e.target.value)}
                                            placeholder="supplier@company.com"
                                            className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-[#1a1c27] rounded-xl border border-white dark:border-white/[0.08] shadow-[3px_3px_8px_rgba(166,175,195,0.3),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5)] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono transition-all"
                                        />
                                    </div>
                                    {!supplierEmail && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                                            <i className="fas fa-info-circle text-[9px]" />
                                            Enter the recipient's email address above to enable sending via Gmail.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="md"
                                        onClick={handleBack}
                                        disabled={isSending || submitting}
                                    >
                                        <i className="fas fa-arrow-left text-xs" />
                                        <span>Back</span>
                                    </AppButton>

                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="md"
                                        onClick={handleCreatePOOnly}
                                        disabled={isSending || submitting}
                                        title="Create PO in system without sending email"
                                    >
                                        {submitting ? (
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                        ) : (
                                            <i className="fas fa-save text-xs" />
                                        )}
                                        <span>Save as Draft</span>
                                    </AppButton>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleEmail}
                                        disabled={isSending || submitting || !supplierEmail.trim()}
                                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 border border-pink-400/80 rounded-xl shadow-[0_4px_12px_rgba(236,72,153,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                    >
                                        {isSending ? (
                                            <i className="fas fa-spinner fa-spin text-white" />
                                        ) : (
                                            <i className="fas fa-paper-plane text-white text-xs" />
                                        )}
                                        <span>{isSending ? 'Dispatching...' : 'Send PO via Gmail'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Full View Modal for Email Template & AI Text */}
            {isFullPreviewOpen && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4 overflow-y-auto animate-in fade-in duration-200"
                        onClick={() => setIsFullPreviewOpen(false)}
                    >
                        <div
                            className="bg-[#ebf0f7] dark:bg-[#151620] rounded-3xl max-w-3xl w-full my-auto shadow-[14px_14px_40px_rgba(0,0,0,0.65)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Full View Header */}
                            <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between bg-[#e5ebf5]/90 dark:bg-[#12131b]/90 backdrop-blur-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 flex items-center justify-center text-sm shadow-xs">
                                        <i className="fas fa-file-invoice-dollar" />
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                                            Full Email & Content Preview
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Exact layout and text dispatched to supplier ({emailMode === 'ai' ? 'AI Content Active' : 'Standard Template Active'})
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <AppButton type="button" variant="neutral" size="xs" onClick={handleCopyOnly}>
                                        <i className="fas fa-copy text-[10px]" />
                                        <span>Copy Text</span>
                                    </AppButton>
                                    <button
                                        type="button"
                                        onClick={() => setIsFullPreviewOpen(false)}
                                        className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#1a1b26] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-xs cursor-pointer ml-1"
                                        aria-label="Close Preview"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            </div>

                            {/* Full Content Body */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                
                                {/* Email Meta Bar */}
                                <div className="bg-[#e9eef6] dark:bg-[#13141d] p-3.5 rounded-xl border border-white/60 dark:border-white/[0.04] text-xs space-y-1.5 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                        <span><strong>To:</strong> {supplierEmail || request.supplier_name}</span>
                                        <span><strong>From:</strong> AirshipExpress Supply Chain ({user.getName()})</span>
                                    </div>
                                    <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                                        <strong>Subject:</strong> Purchase Order {poNumber} - {request.supplier_name}
                                    </div>
                                </div>

                                {/* Formatted Letter View */}
                                <div className="bg-[#f6f9fc] dark:bg-[#191b26] p-6 rounded-2xl border border-white dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.35),-6px_-6px_16px_rgba(255,255,255,0.95)] dark:shadow-[6px_6px_20px_rgba(0,0,0,0.5)] space-y-5">
                                    
                                    {/* Letterhead */}
                                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-pink-600 text-white font-black text-xs flex items-center justify-center">
                                                AE
                                            </div>
                                            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                                Airship<span className="text-pink-600 dark:text-pink-400">Express</span>
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{poNumber}</span>
                                        </div>
                                    </div>

                                    {/* Text Body: AI or Standard */}
                                    <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {emailMode === 'ai' && aiMessage ? (
                                            <div className="whitespace-pre-wrap font-sans bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                                                {aiMessage}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p>Dear <strong>{request.supplier_name}</strong>,</p>
                                                <p>
                                                    Please review and process the following official purchase order on behalf of AirshipExpress Supply Chain & Procurement Department. Kindly confirm item availability and estimated delivery schedule.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Full Itemized Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b-2 border-slate-200/80 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                                    <th className="py-2 text-left">Item Description</th>
                                                    <th className="py-2 text-center w-16">Qty</th>
                                                    <th className="py-2 text-right w-24">Unit Price</th>
                                                    <th className="py-2 text-right w-28">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.05] text-slate-700 dark:text-slate-300">
                                                {formData.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                                            {item.name || item.item_name || 'Procurement Item'}
                                                        </td>
                                                        <td className="py-2.5 text-center font-semibold">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                            ₱{item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                            ₱{item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Total & Delivery Row */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] text-xs">
                                        <div className="text-slate-600 dark:text-slate-400">
                                            <span><strong>Expected Delivery:</strong> {formData.delivery_date || 'Standard Timeline'}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2 font-medium">Grand Total:</span>
                                            <span className="text-lg font-mono font-extrabold text-pink-600 dark:text-pink-400">
                                                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Confirmation Link CTA */}
                                    <div className="bg-[#e9eef6] dark:bg-[#13141d] p-3 rounded-xl border border-white/60 dark:border-white/[0.04] flex items-center justify-between gap-3 text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 truncate">
                                            <i className="fas fa-link mr-1.5 text-pink-500" />
                                            {confirmLink}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                                            Supplier CTA Button
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Full View Footer */}
                            <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-white/[0.06] bg-[#e5ebf5]/90 dark:bg-[#12131b]/90 flex items-center justify-end gap-2">
                                <AppButton type="button" variant="primary" size="sm" onClick={() => setIsFullPreviewOpen(false)}>
                                    Done & Return
                                </AppButton>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </Portal>
    );
}
