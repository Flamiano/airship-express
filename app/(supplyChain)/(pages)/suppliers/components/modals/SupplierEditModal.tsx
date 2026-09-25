// modal component for editing vendor records and operational status

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { sanitizeText } from "../../../../components/global/sanitize";
import { Supplier } from "../../types";

interface SupplierEditModalProps {
    isOpen: boolean;
    isSubmitting: boolean;
    editingSupplier: Supplier | null;
    categories: string[];
    setEditingSupplier: React.Dispatch<React.SetStateAction<Supplier | null>>;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function SupplierEditModal({
    isOpen,
    isSubmitting,
    editingSupplier,
    categories,
    setEditingSupplier,
    onClose,
    onSubmit,
}: SupplierEditModalProps) {
    if (!isOpen || !editingSupplier) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-edit text-sm" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Edit Supplier
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Update vendor records and operational status
                                </p>
                            </div>
                        </div>

                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Supplier Name <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                    value={editingSupplier.name || ""}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Category <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 pr-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                                        value={editingSupplier.category || ""}
                                        onChange={(e) => setEditingSupplier({ ...editingSupplier, category: e.target.value })}
                                        required
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                                {cat}
                                            </option>
                                        ))}
                                        <option value="Other" className="dark:bg-slate-900 dark:text-slate-200">
                                            Other
                                        </option>
                                    </select>
                                    <svg className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Contact Person <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                    value={editingSupplier.contact_person || ""}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Phone Number <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="tel"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                    value={editingSupplier.phone || ""}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Email Address <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                    value={editingSupplier.email || ""}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Location / Address <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                    value={editingSupplier.location || ""}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, location: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Facebook Link
                            </label>
                            <input
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                                placeholder="https://www.facebook.com/share/12345446/"
                                value={editingSupplier.fb_link || ""}
                                onChange={(e) => setEditingSupplier({ ...editingSupplier, fb_link: sanitizeText(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Products / Services Offered
                            </label>
                            <textarea
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="List products or services offered (comma separated)"
                                value={editingSupplier.products || ""}
                                onChange={(e) => setEditingSupplier({ ...editingSupplier, products: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Internal Notes
                            </label>
                            <textarea
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="Additional supplier details or terms"
                                value={editingSupplier.notes || ""}
                                onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                            />
                        </div>

                        <div className="p-3.5 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={Boolean(editingSupplier.is_active)}
                                    onChange={(e) => setEditingSupplier({ ...editingSupplier, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500/20 border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Active Vendor Status
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {editingSupplier.is_active
                                            ? "This supplier is active and available for purchase orders."
                                            : "Inactive suppliers will be hidden from procurement selection."}
                                    </span>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                            <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                                Cancel
                            </AppButton>
                            <AppButton type="submit" variant="primary" size="sm" disabled={isSubmitting} loading={isSubmitting}>
                                <span>Save Changes</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
