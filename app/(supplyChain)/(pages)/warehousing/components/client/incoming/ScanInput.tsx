"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { scanBarcode } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/scanInput"
import BarcodeScanner from "./BarcodeScanner";
import { sanitizeBarcode } from "@/app/(supplyChain)/components/global/sanitize";

interface ScanInputProps {
    onScan?: () => void;
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

    const processBarcode = useCallback(async (barcodeValue: string) => {
        const sanitized = sanitizeBarcode(barcodeValue);

        if (!sanitized || isScanning) return;

        setIsScanning(true);
        const toastId = toast.loading('Processing...');

        try {
            const result = await scanBarcode(sanitized);

            if (!result.success) {
                if (result.data?.existsIn === 'queue') {
                    toast.error(`Already in queue`, {
                        id: toastId,
                        description: `Status: ${result.data.status}`,
                        duration: 3000,
                    });
                } else if (result.data?.existsIn === 'parcels') {
                    toast.error(`Already received`, {
                        id: toastId,
                        description: `Received on ${result.data.receivedAt ? new Date(result.data.receivedAt).toLocaleDateString() : 'earlier'}`,
                        duration: 3000,
                    });
                } else {
                    toast.error(result.error || 'Failed to add', {
                        id: toastId,
                        duration: 3000,
                    });
                }
                setIsScanning(false);
                setBarcode("");
                return;
            }

            toast.success(`Parcel added! Tracking: ${result.data?.trackingNumber}`, {
                id: toastId,
                duration: 2000,
            });

            setBarcode("");
            onScan?.();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to add parcel', {
                id: toastId,
                duration: 3000,
            });
        } finally {
            setIsScanning(false);
            if (isListening) {
                inputRef.current?.focus();
            }
        }
    }, [isScanning, isListening, onScan]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isListening) {
            if (e.key === ' ') {
                e.preventDefault();
                return;
            }
            if (e.key.length === 1 && !/[a-zA-Z0-9-]/.test(e.key)) {
                e.preventDefault();
                return;
            }
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
            }, 50);
        }

        if (e.key.length === 1 && !/[a-zA-Z0-9-]/.test(e.key)) {
            e.preventDefault();
            return;
        }
    }, [isListening, barcode, processBarcode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = sanitizeBarcode(e.target.value);
        setBarcode(sanitized);
        if (isListening) {
            bufferRef.current = sanitized;
        }
    };

    const handleStart = () => {
        if (isListening) {
            onStopListening?.();
            bufferRef.current = "";
            toast.info('Scanner paused', { duration: 1500 });
        } else {
            onStartListening?.();
            setBarcode("");
            bufferRef.current = "";
            inputRef.current?.focus();
            toast.info('Scanner ready', { duration: 1500 });
        }
    };

    const handleCameraScan = (scannedBarcode: string) => {
        processBarcode(scannedBarcode);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 text-slate-900 dark:text-slate-100">
                <div className="flex-1">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        <svg
                            className="h-3.5 w-3.5 text-pink-500 dark:text-pink-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                            />
                        </svg>
                        <span>Barcode</span>
                    </label>

                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={barcode}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            readOnly={isScanning}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            placeholder={isListening ? 'Scanning...' : 'Type or scan barcode'}
                            className={`h-11 w-full rounded-xl border bg-white dark:bg-slate-900 pl-3.5 pr-28 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus-visible:outline-none focus-visible:ring-2 ${isListening
                                ? 'border-emerald-500 dark:border-emerald-600 focus-visible:ring-emerald-500/20'
                                : 'border-slate-300 dark:border-slate-800 focus-visible:border-pink-500 focus-visible:ring-pink-500/20'
                                } ${isScanning ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 opacity-75' : ''}`}
                        />

                        <span
                            className={`absolute right-2.5 inline-flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono font-semibold transition-colors ${isListening
                                ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${isListening ? 'animate-pulse bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'
                                    }`}
                            />
                            {isListening ? (isScanning ? '...' : 'listening') : 'paused'}
                        </span>
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

                <div className="flex shrink-0 gap-3">
                    <button
                        type="button"
                        onClick={handleStart}
                        className={`group relative inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold text-white transition-all duration-75 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 sm:flex-initial cursor-pointer ${isListening
                            ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/30'
                            : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30'
                            }`}
                    >
                        {isListening ? (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                        ) : (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                        <span className="tracking-wide">{isListening ? 'Pause' : 'Start'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="group relative inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 px-5 text-xs font-semibold text-white transition-all duration-75 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/30 sm:flex-initial cursor-pointer"
                    >
                        <svg
                            className="h-4 w-4 text-pink-100"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        <span className="tracking-wide">Camera</span>
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