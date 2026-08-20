"use client";

import { useEffect, useRef } from "react";

export default function ManualEntryModal() {
    const modalRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: string = "info") => {
        alert(message);
    };

    useEffect(() => {
        // Manual Entry Modal functions
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
                // Reset form
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

        // Close modal on backdrop click
        const modal = document.getElementById("manualEntryModal");
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === e.currentTarget && window.closeManualEntryModal) {
                    window.closeManualEntryModal();
                }
            });
        }

        // Close modal on Escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && window.closeManualEntryModal) {
                window.closeManualEntryModal();
            }
        });

    }, []);

    return (
        <div
            id="manualEntryModal"
            ref={modalRef}
            className="fixed inset-0 z-[90] bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 hidden"
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                            <i className="fas fa-pen text-sm"></i>
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Manual Entry
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Enter parcel details manually into the system
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (window.closeManualEntryModal) window.closeManualEntryModal();
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <i className="fas fa-times text-base"></i>
                    </button>
                </div>

                {/* Form Body */}
                <form
                    className="flex-1 overflow-y-auto p-6 space-y-4.5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (window.handleManualEntry) window.handleManualEntry();
                    }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-barcode mr-1 opacity-70"></i> Barcode <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="manualBarcode"
                                className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs"
                                placeholder="e.g. AX-1023"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-hashtag mr-1 opacity-70"></i> Tracking Number <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="manualTracking"
                                className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs"
                                placeholder="e.g. TRK-8821"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-user mr-1 opacity-70"></i> Sender
                            </label>
                            <input
                                type="text"
                                id="manualSender"
                                className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs"
                                placeholder="Sender name"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-map-pin mr-1 opacity-70"></i> Destination <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="manualDestination"
                                className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs"
                                placeholder="e.g. Makati"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-truck mr-1 opacity-70"></i> Courier
                            </label>
                            <div className="relative">
                                <select
                                    id="manualCourier"
                                    className="w-full px-3.5 py-2 pr-9 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all appearance-none cursor-pointer shadow-2xs"
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
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                <i className="fas fa-tag mr-1 opacity-70"></i> Status
                            </label>
                            <div className="relative">
                                <select
                                    id="manualStatus"
                                    className="w-full px-3.5 py-2 pr-9 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all appearance-none cursor-pointer shadow-2xs"
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
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                            <i className="fas fa-sticky-note mr-1 opacity-70"></i> Notes
                        </label>
                        <textarea
                            id="manualNotes"
                            className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs"
                            rows={2}
                            placeholder="Additional details about this parcel"
                        ></textarea>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                            type="button"
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all cursor-pointer"
                            onClick={() => {
                                if (window.closeManualEntryModal) window.closeManualEntryModal();
                            }}
                        >
                            <i className="fas fa-times mr-1.5"></i> Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-pink-500 hover:bg-pink-600 active:bg-pink-700 transition-all shadow-xs shadow-pink-500/20 cursor-pointer"
                        >
                            <i className="fas fa-save mr-1"></i> Save Parcel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}