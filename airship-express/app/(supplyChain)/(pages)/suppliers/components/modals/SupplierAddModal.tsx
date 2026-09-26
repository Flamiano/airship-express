// modal component for registering a new vendor profile

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { sanitizeText } from "../../../../components/global/sanitize";
import { NewSupplierFormState } from "../../types";

interface SupplierAddModalProps {
    isOpen: boolean;
    isSubmitting: boolean;
    categories: string[];
    newSupplier: NewSupplierFormState;
    setNewSupplier: React.Dispatch<React.SetStateAction<NewSupplierFormState>>;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function SupplierAddModal({
    isOpen,
    isSubmitting,
    categories,
    newSupplier,
    setNewSupplier,
    onClose,
    onSubmit,
}: SupplierAddModalProps) {
    if (!isOpen) return null;

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
                                <i className="fas fa-plus text-sm" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Add New Supplier
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Register and manage a procurement vendor profile
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
                                    placeholder="e.g. Apex Tire & Auto Supplies"
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
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
                                        value={newSupplier.category}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                                        required
                                    >
                                        <option value="" disabled className="dark:bg-slate-900 text-slate-400">
                                            Select category
                                        </option>
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
                                    placeholder="Full Name"
                                    value={newSupplier.contact_person}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: sanitizeText(e.target.value) })}
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
                                    placeholder="+63 912 345 6789"
                                    value={newSupplier.phone}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
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
                                    placeholder="contact@gmail.com"
                                    value={newSupplier.email}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
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
                                    placeholder="City, Province"
                                    value={newSupplier.location}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, location: sanitizeText(e.target.value) })}
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
                                value={newSupplier.fb_link}
                                onChange={(e) => setNewSupplier({ ...newSupplier, fb_link: sanitizeText(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Products / Services Offered
                            </label>
                            <textarea
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="e.g. Heavy equipment tires, brake pads, routine maintenance services"
                                value={newSupplier.products}
                                onChange={(e) => setNewSupplier({ ...newSupplier, products: sanitizeText(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Internal Notes
                            </label>
                            <textarea
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="Payment terms, delivery lead times, or special remarks"
                                value={newSupplier.notes}
                                onChange={(e) => setNewSupplier({ ...newSupplier, notes: sanitizeText(e.target.value) })}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                            <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                                Cancel
                            </AppButton>
                            <AppButton type="submit" variant="primary" size="sm" disabled={isSubmitting} loading={isSubmitting}>
                                <span>Add Supplier</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
