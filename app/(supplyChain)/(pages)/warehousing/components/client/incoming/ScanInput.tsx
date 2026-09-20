"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { scanBarcode } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/scanInput";
import BarcodeScanner from "./BarcodeScanner";
import { sanitizeBarcode } from "@/app/(supplyChain)/components/global/sanitize";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { addOfflineScan } from "./offlineStorage";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";

interface ScanInputProps {
    onScan?: (barcode?: string, isOffline?: boolean) => void;
    isListening?: boolean;
    onStartListening?: () => void;
    onStopListening?: () => void;
    totalScanned?: number;
}

export default function ScanInput({
    onScan,
    isListening = false,
    onStartListening,
    onStopListening,
    totalScanned = 0
}: ScanInputProps) {
    const [barcode, setBarcode] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const bufferRef = useRef<string>("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab');
    const isIncomingTab = currentTab === 'incoming' || !currentTab;

    const processBarcode = useCallback(async (barcodeValue: string) => {
        if (!isIncomingTab) return;

        const sanitized = sanitizeBarcode(barcodeValue);
        if (!sanitized) return;

        // Instantly clear input & buffer so the scanner can scan the next parcel with zero delay
        setBarcode("");
        bufferRef.current = "";

        // Check if browser is currently offline
        const isCurrentlyOffline = typeof window !== 'undefined' && !navigator.onLine;

        if (isCurrentlyOffline) {
            const { added } = addOfflineScan(sanitized);
            onScan?.(sanitized, true);
            if (added) {
                toast.info(`Scanned offline: ${sanitized}`, {
                    description: 'Added to table as "Not Synced". When online, click "Fetch Data" then "Add in Queue".',
                    duration: 3000,
                });
            } else {
                toast.info(`Already in offline scans: ${sanitized}`, { duration: 2000 });
            }
            inputRef.current?.focus();
            return;
        }

        // Online scan: trigger optimistic row in UI
        onScan?.(sanitized, false);
        setIsScanning(true);

        try {
            const currentUserId = user.getUserId() || user.getName() || undefined;
            const result = await scanBarcode(sanitized, currentUserId);

            if (!result.success) {
                if (result.data?.existsIn === 'queue') {
                    toast.error(`Already in queue: ${sanitized}`, {
                        description: `Status: ${result.data.status}`,
                        duration: 3000,
                    });
                } else if (result.data?.existsIn === 'parcels') {
                    toast.error(`Already received: ${sanitized}`, {
                        description: `Received on ${result.data.receivedAt ? new Date(result.data.receivedAt).toLocaleDateString() : 'earlier'}`,
                        duration: 3000,
                    });
                } else {
                    toast.error(result.error || `Failed to add ${sanitized}`, {
                        duration: 3000,
                    });
                }
                return;
            }

            toast.success(`Scanned: ${sanitized}`, {
                description: `Tracking: ${result.data?.trackingNumber}`,
                duration: 2000,
            });
        } catch (error) {
            console.error('Error scanning barcode, saving to offline queue:', error);
            // Auto fallback to offline queue on network failure
            const { added } = addOfflineScan(sanitized);
            onScan?.(sanitized, true);
            if (added) {
                toast.info(`Saved offline: ${sanitized}`, {
                    description: 'Network drop detected. Added to table as "Not Synced".',
                    duration: 3500,
                });
            }
        } finally {
            setIsScanning(false);
            // Ensure input stays focused for continuous scanning
            inputRef.current?.focus();
        }
    }, [onScan, isIncomingTab]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isIncomingTab || !isListening) {
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const value = bufferRef.current || barcode;
            bufferRef.current = "";
            setBarcode("");
            if (value.trim()) {
                processBarcode(value);
            }
            return;
        }

        if (e.key.length === 1 && /[a-zA-Z0-9-]/.test(e.key)) {
            bufferRef.current += e.key;

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                bufferRef.current = "";
            }, 80);
        }

        if (e.key.length === 1 && !/[a-zA-Z0-9-]/.test(e.key)) {
            e.preventDefault();
            return;
        }
    }, [isListening, barcode, processBarcode, isIncomingTab]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isIncomingTab) return;
        const sanitized = sanitizeBarcode(e.target.value);
        setBarcode(sanitized);
        if (isListening) {
            bufferRef.current = sanitized;
        }
    };

    const handleStart = () => {
        if (!isIncomingTab) return;
        if (isListening) {
            onStopListening?.();
            bufferRef.current = "";
            toast.info('Scanner paused', { duration: 1500 });
        } else {
            onStartListening?.();
            setBarcode("");
            bufferRef.current = "";
            toast.info('Scanner ready', { duration: 1500 });
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    };

    const handleCameraScan = (scannedBarcode: string) => {
        if (!isIncomingTab) return;
        const sanitized = sanitizeBarcode(scannedBarcode);
        if (sanitized) {
            processBarcode(sanitized);
        }
    };

    // Auto-focus when scanner is listening and active, and when tab changes to incoming
    useEffect(() => {
        if (isIncomingTab && isListening && !isScanning && !showScanner) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isListening, isScanning, showScanner, isIncomingTab]);

    // Keep focus on window/tab activation
    useEffect(() => {
        const handleWindowFocus = () => {
            if (isIncomingTab && isListening && !isScanning && !showScanner) {
                inputRef.current?.focus();
            }
        };
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [isListening, isScanning, showScanner, isIncomingTab]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <div className="relative">
                        <i
                            className={`fas fa-barcode absolute left-3.5 top-1/2 -translate-y-1/2 text-sm transition-colors ${isListening ? 'text-emerald-500' : 'text-slate-400'
                                }`}
                            aria-hidden="true"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={barcode}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            readOnly={!isListening}
                            placeholder={
                                isListening
                                    ? "Scan barcode or type and press Enter..."
                                    : "Click Start to enable scanning mode"
                            }
                            className={`w-full rounded-xl border py-2.5 pl-10 pr-24 text-sm font-mono text-slate-800 dark:text-slate-200 transition-colors outline-hidden bg-slate-50 dark:bg-slate-800/80 ${isListening
                                ? 'border-emerald-500/80 dark:border-emerald-600/80 focus:border-emerald-500'
                                : 'border-slate-200 dark:border-slate-700'
                                }`}
                        />

                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <StatusBadge
                                tone={isListening ? "emerald" : "neutral"}
                                dot
                                size="xs"
                            >
                                {isListening ? (isScanning ? '...' : 'listening') : 'paused'}
                            </StatusBadge>
                        </div>
                    </div>

                    {isListening && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 transition-all">
                            <span className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                Scanner active and ready
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={handleStart}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            isListening
                                ? 'bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600'
                        }`}
                    >
                        {isListening ? (
                            <i className="fas fa-pause text-xs" />
                        ) : (
                            <i className="fas fa-play text-xs" />
                        )}
                        <span>{isListening ? 'Pause' : 'Start'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white border border-pink-600 transition-colors cursor-pointer"
                    >
                        <i className="fas fa-camera text-xs" />
                        <span>Camera</span>
                    </button>
                </div>
            </div>

            <BarcodeScanner
                isOpen={showScanner}
                onScan={handleCameraScan}
                onClose={() => setShowScanner(false)}
                scannedCount={totalScanned}
            />
        </>
    );
}