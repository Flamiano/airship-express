'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Supplier } from '../../types';

interface PurchaseRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    suppliers: Supplier[];
}

interface PurchaseRequestItem {
    name: string;
    quantity: number;
}

export function PurchaseRequestModal({ isOpen, onClose, suppliers }: PurchaseRequestModalProps) {
    const [formData, setFormData] = useState({
        requested_by: '',
        supplier: suppliers.length > 0 ? suppliers[0].name : '',
        items: [{ name: '', quantity: 0 }] as PurchaseRequestItem[],
        reason: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        if (!formData.requested_by || !formData.supplier || !formData.reason) {
            toast.warning('Please fill in all required fields');
            return;
        }

        const hasEmptyItem = formData.items.some(item => !item.name || item.quantity <= 0);
        if (hasEmptyItem) {
            toast.warning('Please fill in all item names and quantities');
            return;
        }

        // Here you would typically save to database
        toast.success('Purchase request submitted successfully!');
        onClose();
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { name: '', quantity: 0 }]
        });
    };

    const removeItem = (index: number) => {
        if (formData.items.length === 1) {
            toast.warning('At least one item is required');
            return;
        }
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index)
        });
    };

    const updateItem = (index: number, field: keyof PurchaseRequestItem, value: string | number) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-ink rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-ink/20 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-ink/20">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                                <i className="fas fa-shopping-cart text-sm"></i>
                            </span>
                            Create Purchase Request
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Request new inventory items from suppliers</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all flex items-center justify-center"
                    >
                        <i className="fas fa-times text-sm"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Requested By <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all"
                            placeholder="Your name"
                            value={formData.requested_by}
                            onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Supplier <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all appearance-none"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundPosition: 'right 0.75rem center',
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: '1.25em 1.25em'
                            }}
                            value={formData.supplier}
                            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                            required
                        >
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Items <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <div className="space-y-2">
                            {formData.items.map((item, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        className="flex-1 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all"
                                        placeholder="Item name"
                                        value={item.name}
                                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                                        required
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-24 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all"
                                        placeholder="Qty"
                                        value={item.quantity || ''}
                                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="px-3 py-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                                        onClick={() => removeItem(index)}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="text-sm text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300 transition-colors flex items-center gap-1.5"
                                onClick={addItem}
                            >
                                <i className="fas fa-plus"></i> Add Item
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Reason <span className="text-pink-500 dark:text-pink-400">*</span>
                        </label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all resize-none"
                            rows={3}
                            placeholder="Reason for purchase request"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-ink/20">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium bg-transparent border border-slate-200 dark:border-ink/30 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:border-slate-300 dark:hover:border-ink/40 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-purple-500 dark:from-purple-600 dark:to-purple-500 hover:from-purple-500 dark:hover:from-purple-500 hover:to-purple-400 dark:hover:to-purple-400 text-white rounded-xl transition-all shadow-md shadow-purple-500/25 active:scale-[0.98] flex items-center gap-2"
                        >
                            <i className="fas fa-paper-plane w-4 h-4"></i>
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}