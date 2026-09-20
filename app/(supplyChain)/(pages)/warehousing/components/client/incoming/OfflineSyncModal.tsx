"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    LocalOfflineScan,
    getOfflineScans,
    removeOfflineScan,
    clearOfflineScans,
    addOfflineScan
} from "./offlineStorage";
import {
    fetchBatchMockParcels,
    batchInsertOfflineParcels,
    OfflineParcelItem
} from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/offlineActions";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";

interface OfflineSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncSuccess?: () => void;
}

export default function OfflineSyncModal({
    isOpen,
    onClose,
    onSyncSuccess
}: OfflineSyncModalProps) {
    const [offlineItems, setOfflineItems] = useState<LocalOfflineScan[]>([]);
    const [previewItems, setPreviewItems] = useState<OfflineParcelItem[]>([]);
    const [isOnline, setIsOnline] = useState(true);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [isQueueing, setIsQueueing] = useState(false);
    const [manualCode, setManualCode] = useState("");

    const loadScans = () => {
        const items = getOfflineScans();
        setOfflineItems(items);
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine);
            const handleOnline = () => setIsOnline(true);
            const handleOffline = () => setIsOnline(false);
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadScans();
            setPreviewItems([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDeleteItem = (barcode: string) => {
        const next = removeOfflineScan(barcode);
        setOfflineItems(next);
        setPreviewItems(prev => prev.filter(p => p.barcode !== barcode));
        toast.info(`Removed ${barcode} from offline queue`);
    };

    const handleClearAll = () => {
        if (window.confirm("Are you sure you want to clear all offline scanned barcodes?")) {
            clearOfflineScans();
            setOfflineItems([]);
            setPreviewItems([]);
            toast.info("Offline queue cleared");
        }
    };

    const handleAddManualBarcode = (e: React.FormEvent) => {
        e.preventDefault();
        const code = manualCode.trim().toUpperCase();
        if (!code) return;
        const res = addOfflineScan(code);
        if (res.added) {
            setOfflineItems(res.scans);
            setManualCode("");
            toast.success(`Added ${code} to offline queue`);
        } else {
            toast.warning(`Barcode ${code} is already in offline queue`);
        }
    };

    // Step 1: Fetch mock third-party details for all offline barcodes
    const handleFetchThirdPartyDetails = async () => {
        if (!isOnline) {
            toast.error("Internet connection is offline. Connect to the internet to fetch parcel details.");
            return;
        }

        if (offlineItems.length === 0) {
            toast.info("No offline scans to fetch");
            return;
        }

        setIsFetchingData(true);
        try {
            const barcodes = offlineItems.map(item => item.barcode);
            const result = await fetchBatchMockParcels(barcodes);

            if (!result.success) {
                toast.error(result.error || "Failed to fetch third-party parcel data");
                return;
            }

            // Merge scanned_at timestamps
            const scanMap = new Map(offlineItems.map(i => [i.barcode, i.scanned_at]));
            const merged: OfflineParcelItem[] = (result.data || []).map(p => ({
                ...p,
                scanned_at: scanMap.get(p.barcode) || new Date().toISOString()
            }));

            setPreviewItems(merged);
            const foundCount = merged.filter(m => m.foundMock).length;
            toast.success(`Fetched details for ${merged.length} parcel(s) (${foundCount} found in third-party database)`);
        } catch (error) {
            console.error("Error fetching third-party parcel details:", error);
            toast.error("Error connecting to server to fetch parcel details");
        } finally {
            setIsFetchingData(false);
        }
    };

    // Step 2: Batch insert into receiving_queue
    const handleQueueAll = async () => {
        if (!isOnline) {
            toast.error("Internet connection is offline. Connect to the internet to push to queue.");
            return;
        }

        // If preview has not been generated yet, generate fallback items
        let itemsToInsert: OfflineParcelItem[] = previewItems;
        if (itemsToInsert.length === 0) {
            itemsToInsert = offlineItems.map(item => ({
                barcode: item.barcode,
                scanned_at: item.scanned_at,
            }));
        }

        const filtered = itemsToInsert.filter(i => !i.alreadyInQueue && !i.alreadyInParcels);

        if (filtered.length === 0) {
            toast.warning("All offline items already exist in receiving queue or inventory.");
            return;
        }

        setIsQueueing(true);
        try {
            const currentUserId = user.getUserId() || user.getName() || undefined;
            const result = await batchInsertOfflineParcels(filtered, currentUserId);

            if (!result.success) {
                toast.error(result.error || "Failed to queue parcels into database");
                return;
            }

            toast.success(`Successfully queued ${result.insertedCount} parcel(s) into Receiving Queue!`);
            clearOfflineScans();
            setOfflineItems([]);
            setPreviewItems([]);
            onSyncSuccess?.();
            onClose();
        } catch (error) {
            console.error("Error batch inserting parcels:", error);
            toast.error("Failed to insert parcels into receiving queue");
        } finally {
            setIsQueueing(false);
        }
    };

    const hasPreview = previewItems.length > 0;
    const readyToQueueCount = hasPreview
        ? previewItems.filter(p => !p.alreadyInQueue && !p.alreadyInParcels).length
        : offlineItems.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] shadow-[10px_10px_30px_rgba(166,175,195,0.5),-10px_-10px_30px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] overflow-hidden">
                
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] flex items-center justify-center text-pink-600 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65),inset_-1px_-1px_3px_rgba(255,255,255,0.05)]">
                            <i className="fas fa-satellite-dish text-lg"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                    Offline Scans Manager
                                </h3>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isOnline 
                                        ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                        : "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse"
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                    {isOnline ? "Online" : "Offline"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {offlineItems.length} scan(s) stored locally in browser
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                        <i className="fas fa-times text-sm"></i>
                    </button>
                </div>

                {/* Subheader / Add Barcode & Actions */}
                <div className="p-4 sm:p-5 bg-slate-100/50 dark:bg-[#14151c]/40 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                    <form onSubmit={handleAddManualBarcode} className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <input
                            type="text"
                            placeholder="Add barcode to offline queue..."
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl text-xs font-mono bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-300/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-hidden shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]"
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-semibold shrink-0 cursor-pointer shadow-sm transition-all"
                        >
                            <i className="fas fa-plus mr-1 text-[10px]"></i> Add
                        </button>
                    </form>

                    <div className="flex items-center gap-2 shrink-0">
                        {offlineItems.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                                <i className="fas fa-trash-alt mr-1 text-[10px]"></i> Clear All
                            </button>
                        )}
                    </div>
                </div>

                {/* Body List / Table */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[220px]">
                    {offlineItems.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400">
                                <i className="fas fa-barcode text-xl"></i>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                No offline scans saved
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                When offline, any barcodes scanned with your scanner gun will automatically save here so you never lose data.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {hasPreview ? (
                                previewItems.map((item, idx) => (
                                    <div
                                        key={item.barcode}
                                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                            item.alreadyInQueue || item.alreadyInParcels
                                                ? "bg-amber-500/5 border-amber-300/60 dark:border-amber-900/50"
                                                : item.foundMock
                                                ? "bg-emerald-500/5 border-emerald-300/60 dark:border-emerald-900/50"
                                                : "bg-[#ebf0f7]/70 dark:bg-[#15161f] border-slate-200/80 dark:border-[#272836]"
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                                    {item.barcode}
                                                </span>
                                                {item.foundMock && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                                        <i className="fas fa-check-circle mr-1"></i> Data Found
                                                    </span>
                                                )}
                                                {item.alreadyInQueue && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                                        Already in Queue
                                                    </span>
                                                )}
                                                {item.alreadyInParcels && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                                                        Already in Inventory
                                                    </span>
                                                )}
                                                {item.courier && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {item.courier}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                                {item.customer_name && <span>Customer: <strong className="text-slate-700 dark:text-slate-200">{item.customer_name}</strong></span>}
                                                {item.destination && <span>Dest: <strong className="text-slate-700 dark:text-slate-200">{item.destination}</strong></span>}
                                                {item.tracking_number && <span>Trk: <strong className="text-slate-700 dark:text-slate-200">{item.tracking_number}</strong></span>}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem(item.barcode)}
                                            className="self-end sm:self-center p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                            title="Remove from list"
                                        >
                                            <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                offlineItems.map((item, idx) => (
                                    <div
                                        key={item.barcode}
                                        className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#272836] bg-[#ebf0f7]/70 dark:bg-[#15161f] flex items-center justify-between gap-3 shadow-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5">
                                                #{idx + 1}
                                            </span>
                                            <div>
                                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                                    {item.barcode}
                                                </span>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <i className="far fa-clock text-[9px]"></i>
                                                    Scanned: {new Date(item.scanned_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem(item.barcode)}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                            title="Remove from list"
                                        >
                                            <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#14151c]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {hasPreview ? (
                            <span>
                                Ready to queue: <strong className="text-emerald-600 dark:text-emerald-400">{readyToQueueCount}</strong> of {previewItems.length}
                            </span>
                        ) : (
                            <span>{offlineItems.length} item(s) waiting for sync</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Step 1: Fetch Mock 3rd Party Data */}
                        <button
                            type="button"
                            onClick={handleFetchThirdPartyDetails}
                            disabled={offlineItems.length === 0 || isFetchingData || !isOnline}
                            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                                offlineItems.length === 0 || isFetchingData || !isOnline
                                    ? "opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400"
                                    : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-800 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-pink-300"
                            }`}
                        >
                            <i className={`fas ${isFetchingData ? "fa-spinner fa-spin" : "fa-satellite-dish"} text-xs text-pink-500`}></i>
                            <span>{isFetchingData ? "Fetching Data..." : "1. Fetch Details (Mock DB)"}</span>
                        </button>

                        {/* Step 2: Queue into Database */}
                        <button
                            type="button"
                            onClick={handleQueueAll}
                            disabled={offlineItems.length === 0 || isQueueing || !isOnline}
                            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                                offlineItems.length === 0 || isQueueing || !isOnline
                                    ? "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-500"
                                    : "bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95"
                            }`}
                        >
                            <i className={`fas ${isQueueing ? "fa-spinner fa-spin" : "fa-inbox"} text-xs`}></i>
                            <span>{isQueueing ? "Queueing..." : "2. Push to Queue List"}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
