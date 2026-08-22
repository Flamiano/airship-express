"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sanitizeText, sanitizeNumber } from "@/app/(supplyChain)/components/global/sanitize";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import {
    Supplier,
    PurchaseRequestItem,
    PurchaseRequestModalProps
} from "@/app/(supplyChain)/(pages)/procurement/types/index";

export function PurchaseRequestModal({
    isOpen,
    onClose,
    suppliers,
    onRequestSubmitted,
    editData,
    isEdit = false,
}: PurchaseRequestModalProps) {
    const defaultFormState = {
        requested_by: "",
        supplier_id: "",
        items: [{ name: "", quantity: 1 }] as PurchaseRequestItem[],
        reason: "",
        department: "Fleet",
        priority: "Normal",
        amount: 0,
    };

    const [formData, setFormData] = useState(defaultFormState);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEdit && editData) {
                setFormData({
                    requested_by: editData.requested_by || "",
                    supplier_id: editData.supplier_id || "",
                    items: editData.items?.length ? editData.items : [{ name: "", quantity: 1 }],
                    reason: editData.reason || "",
                    department: editData.department || "Fleet",
                    priority: editData.priority || "Normal",
                    amount: editData.amount || 0,
                });
            } else {
                setFormData(defaultFormState);
            }
        }
    }, [isOpen, editData, isEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        const sanitizedRequestedBy = sanitizeText(formData.requested_by);
        const sanitizedReason = sanitizeText(formData.reason);

        if (!sanitizedRequestedBy || !formData.supplier_id || !sanitizedReason) {
            toast.warning("Please fill in all required fields");
            return;
        }

        const hasEmptyItem = formData.items.some(
            (item) => !sanitizeText(item.name) || sanitizeNumber(item.quantity) <= 0
        );
        if (hasEmptyItem) {
            toast.warning("Please fill in all item names and valid quantities");
            return;
        }

        const selectedSupplier = suppliers.find((s) => String(s.id) === String(formData.supplier_id));
        if (!selectedSupplier) {
            toast.warning("Please select a valid supplier");
            return;
        }

        const sanitizedItems = formData.items.map((item) => ({
            name: sanitizeText(item.name),
            quantity: sanitizeNumber(item.quantity),
        }));

        const requestData = {
            id: isEdit ? editData?.id : undefined,
            request_number: isEdit ? editData?.request_number : undefined,
            type: isEdit ? editData?.type : "New Request",
            description: sanitizedItems.map((i) => `${i.name} (${i.quantity})`).join(", "),
            requested_by: sanitizedRequestedBy,
            department: formData.department,
            supplier_id: formData.supplier_id,
            supplier_name: selectedSupplier.name,
            amount: formData.amount || 0,
            priority: formData.priority,
            date: isEdit ? editData?.date : new Date().toISOString().split("T")[0],
            status: isEdit ? editData?.status : "Pending",
            items: sanitizedItems,
            reason: sanitizedReason,
        };

        try {
            setSubmitting(true);
            await onRequestSubmitted?.(requestData);
        } finally {
            setSubmitting(false);
        }
    };

    const addItem = () => {
        setFormData((prev) => ({
            ...prev,
            items: [...prev.items, { name: "", quantity: 1 }],
        }));
    };

    const removeItem = (index: number) => {
        if (formData.items.length === 1) {
            toast.warning("At least one item is required");
            return;
        }
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const updateItem = (index: number, field: keyof PurchaseRequestItem, value: string | number) => {
        setFormData((prev) => {
            const updatedItems = [...prev.items];
            if (field === "name") {
                updatedItems[index] = { ...updatedItems[index], name: sanitizeText(value as string) };
            } else if (field === "quantity") {
                updatedItems[index] = { ...updatedItems[index], quantity: sanitizeNumber(value as number) };
            }
            return { ...prev, items: updatedItems };
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl dark:shadow-black/60 border border-slate-100 dark:border-white/10 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-pink-100/50 dark:border-pink-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                {isEdit ? "Edit Purchase Request" : "Create Purchase Request"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isEdit ? `Editing request #${editData?.request_number || editData?.id}` : "Request new inventory items from suppliers"}
                            </p>
                        </div>
                    </div>
                    <AppButton
                        variant="neutral"
                        size="icon-sm"
                        onClick={onClose}
                        aria-label="Close modal"
                        title="Close"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </AppButton>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Requested By <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none"
                            placeholder="Your full name"
                            value={formData.requested_by}
                            onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                            required
                            maxLength={150}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Supplier <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none cursor-pointer"
                            value={formData.supplier_id}
                            onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                            required
                        >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                                Select a supplier...
                            </option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Department
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none cursor-pointer"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            >
                                <option value="Fleet" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Fleet</option>
                                <option value="Warehouse" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Warehouse</option>
                                <option value="Operations" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Operations</option>
                                <option value="Office" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Office</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Priority
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none cursor-pointer"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            >
                                <option value="Normal" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Normal</option>
                                <option value="Urgent" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Urgent</option>
                                <option value="Critical" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Critical</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Estimated Amount (₱)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none"
                            placeholder="0.00"
                            value={formData.amount || ""}
                            onChange={(e) =>
                                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                            }
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Items List <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <div className="space-y-2">
                            {formData.items.map((item, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none"
                                        placeholder="Item name"
                                        value={item.name}
                                        onChange={(e) => updateItem(index, "name", e.target.value)}
                                        required
                                        maxLength={100}
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-24 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none text-center"
                                        placeholder="Qty"
                                        value={item.quantity || ""}
                                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors shrink-0 cursor-pointer"
                                        onClick={() => removeItem(index)}
                                        title="Remove item"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <AppButton
                                type="button"
                                variant="pink"
                                size="xs"
                                onClick={addItem}
                                className="flex"
                            >
                                <span>+ Add more</span>
                            </AppButton>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Reason <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all outline-none resize-none"
                            rows={3}
                            placeholder="Provide a brief reason for this request..."
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            required
                            maxLength={500}
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-white/10">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            type="submit"
                            variant="primary"
                            size="md"
                            disabled={submitting}
                            loading={submitting}
                        >
                            {!submitting }
                            <span>{isEdit ? "Update" : "Submit"}</span>
                        </AppButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
