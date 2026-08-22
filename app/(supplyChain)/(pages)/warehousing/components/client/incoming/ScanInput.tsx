"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { scanBarcode } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/scanInput"
import BarcodeScanner from "./BarcodeScanner";
import { sanitizeBarcode } from "@/app/(supplyChain)/components/global/sanitize";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

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
        const sanitized = sanitizeBarcode(scannedBarcode);
        if (sanitized) {
            processBarcode(sanitized);
        }
    };

    useEffect(() => {
        if (isListening) {
            inputRef.current?.focus();
        }
    }, [isListening]);

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
                            disabled={isScanning}
                            readOnly={!isListening}
                            placeholder={
                                isListening
                                    ? "Scan barcode or type and press Enter..."
                                    : "Click Start to enable scanning mode"
                            }
                            className={`w-full rounded-xl border py-2.5 pl-10 pr-24 text-sm font-mono text-slate-800 dark:text-slate-200 transition-all outline-hidden ${isListening
                                ? 'border-emerald-500 dark:border-emerald-600 focus-visible:ring-emerald-500/20'
                                : 'border-slate-300 dark:border-slate-800 focus-visible:border-pink-500 focus-visible:ring-pink-500/20'
                                } ${isScanning ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 opacity-75' : ''}`}
                        />

                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
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

                <div className="flex shrink-0 gap-2.5">
                    <AppButton
                        type="button"
                        variant={isListening ? "warning" : "success"}
                        size="md"
                        onClick={handleStart}
                    >
                        {isListening ? (
                            <i className="fas fa-pause text-xs" />
                        ) : (
                            <i className="fas fa-play text-xs" />
                        )}
                        <span>{isListening ? 'Pause' : 'Start'}</span>
                    </AppButton>

                    <AppButton
                        type="button"
                        variant="pink"
                        size="md"
                        onClick={() => setShowScanner(true)}
                    >
                        <i className="fas fa-camera text-xs" />
                        <span>Camera</span>
                    </AppButton>
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