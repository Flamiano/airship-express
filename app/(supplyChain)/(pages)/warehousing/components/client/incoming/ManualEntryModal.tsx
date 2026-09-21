"use client";

import { useEffect, useRef } from "react";
import { AppButton } from "../../../../../components/ui/AppButton";
import Portal from "../../../../../components/client/Portal";

export default function ManualEntryModal() {
    const modalRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: string = "info") => {
        alert(message);
    };

    useEffect(() => {
        // modal functions
        window.openManualEntryModal = function () {
            const modal = document.getElementById("manualEntryModal");
            if (modal) {
                modal.classList.remove("hidden");
                document.body.style.overflow = "hidden";
            }
        };

        window.closeManualEntryModal = function () {
            const modal = document.getElementById("manualEntryModal");
            if (modal) {
                modal.classList.add("hidden");
                document.body.style.overflow = "auto";
                // reset form
                const inputs = modal.querySelectorAll("input, textarea, select");
                inputs.forEach((input: any) => {
                    if (input.type === "text" || input.type === "textarea") {
                        input.value = "";
                    } else if (input.tagName === "SELECT") {
                        input.value = "";
                    }
                });
                const statusSelect = document.getElementById(
                    "manualStatus"
                ) as HTMLSelectElement;
                if (statusSelect) statusSelect.value = "Received";
            }
        };

        window.handleManualEntry = function () {
            const barcode = (document.getElementById("manualBarcode") as HTMLInputElement)
                ?.value;
            const tracking = (
                document.getElementById("manualTracking") as HTMLInputElement
            )?.value;
            const destination = (
                document.getElementById("manualDestination") as HTMLInputElement
            )?.value;

            if (!barcode || !tracking || !destination) {
                showToast("Please fill in all required fields", "error");
                return;
            }

            if (window.closeManualEntryModal) {
                window.closeManualEntryModal();
            }
            showToast("Parcel " + barcode + " added successfully!", "info");

            setTimeout(() => {
                showToast(" Parcel is now in the sorting queue", "info");
            }, 1000);
        };

        // close on backdrop
        const modal = document.getElementById("manualEntryModal");
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === e.currentTarget && window.closeManualEntryModal) {
                    window.closeManualEntryModal();
                }
            });
        }

        // close on esc
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && window.closeManualEntryModal) {
                window.closeManualEntryModal();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);

    }, []);

    return (
        <Portal>
            <div
                id="manualEntryModal"
                ref={modalRef}
                className="fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 hidden"
            >
                <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl shadow-[16px_16px_40px_rgba(0,0,0,0.35)] w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/80 dark:border-[#2c2d3c] overflow-hidden transform transition-all duration-300">

                    {/* header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                <i className="fas fa-pen text-sm"></i>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Manual Entry
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Enter parcel details manually into the system
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={() => {
                                if (window.closeManualEntryModal) window.closeManualEntryModal();
                            }}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* body */}
                    <form
                        className="flex-1 overflow-y-auto p-6 space-y-4.5 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (window.handleManualEntry) window.handleManualEntry();
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-barcode mr-1 opacity-70"></i> Barcode <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="manualBarcode"
                                    className="w-full px-3.5 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all font-mono"
                                    placeholder="e.g. AX-1023"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-hashtag mr-1 opacity-70"></i> Tracking Number <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="manualTracking"
                                    className="w-full px-3.5 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all font-mono"
                                    placeholder="e.g. TRK-8821"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-user mr-1 opacity-70"></i> Sender
                                </label>
                                <input
                                    type="text"
                                    id="manualSender"
                                    className="w-full px-3.5 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                    placeholder="Sender name"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-map-pin mr-1 opacity-70"></i> Destination <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="manualDestination"
                                    className="w-full px-3.5 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                    placeholder="e.g. Makati"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-truck mr-1 opacity-70"></i> Courier
                                </label>
                                <div className="relative">
                                    <select
                                        id="manualCourier"
                                        className="w-full px-3.5 py-2.5 pr-9 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                                        defaultValue=""
                                    >
                                        <option value="" disabled className="dark:bg-slate-900 text-slate-400">Select courier</option>
                                        <option value="J&T Express" className="dark:bg-slate-900 dark:text-slate-200">J&T Express</option>
                                        <option value="LBC Express" className="dark:bg-slate-900 dark:text-slate-200">LBC Express</option>
                                        <option value="Flash Express" className="dark:bg-slate-900 dark:text-slate-200">Flash Express</option>
                                        <option value="Air21" className="dark:bg-slate-900 dark:text-slate-200">Air21</option>
                                        <option value="JRS Express" className="dark:bg-slate-900 dark:text-slate-200">JRS Express</option>
                                        <option value="Shopee" className="dark:bg-slate-900 dark:text-slate-200">Shopee</option>
                                    </select>
                                    <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    <i className="fas fa-tag mr-1 opacity-70"></i> Status
                                </label>
                                <div className="relative">
                                    <select
                                        id="manualStatus"
                                        className="w-full px-3.5 py-2.5 pr-9 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                                        defaultValue="Received"
                                    >
                                        <option value="Received" className="dark:bg-slate-900 dark:text-slate-200">Received</option>
                                        <option value="Sorting" className="dark:bg-slate-900 dark:text-slate-200">Sorting</option>
                                        <option value="Ready for Pickup" className="dark:bg-slate-900 dark:text-slate-200">Ready for Pickup</option>
                                        <option value="In Transit" className="dark:bg-slate-900 dark:text-slate-200">In Transit</option>
                                        <option value="Delivered" className="dark:bg-slate-900 dark:text-slate-200">Delivered</option>
                                    </select>
                                    <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-sticky-note mr-1 opacity-70"></i> Notes
                            </label>
                            <textarea
                                id="manualNotes"
                                className="w-full px-3.5 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all resize-none"
                                rows={2}
                                placeholder="Additional details about this parcel"
                            ></textarea>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={() => {
                                    if (window.closeManualEntryModal) window.closeManualEntryModal();
                                }}
                            >
                                <i className="fas fa-times text-xs"></i>
                                <span>Cancel</span>
                            </AppButton>
                            <AppButton
                                type="submit"
                                variant="primary"
                                size="sm"
                            >
                                <i className="fas fa-save text-xs"></i>
                                <span>Save Parcel</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}