"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";
import Portal from "@/app/(supplyChain)/components/client/Portal";

interface BarcodeScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
    isOpen: boolean;
    scannedCount?: number;
}

type ScannerStatus = 'idle' | 'initializing' | 'scanning' | 'processing' | 'cooldown' | 'error';

export default function BarcodeScanner({
    onScan,
    onClose,
    isOpen,
    scannedCount = 0
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<ScannerStatus>('idle');
    const [error, setError] = useState<string>("");
    const [lastScanned, setLastScanned] = useState<string>("");
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isProcessingRef = useRef(false);
    const isCleaningUpRef = useRef(false);
    const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const cleanupScanner = () => {
        if (isCleaningUpRef.current) return;
        isCleaningUpRef.current = true;

        console.log("Cleaning up scanner...");

        if (cooldownTimeoutRef.current) {
            clearTimeout(cooldownTimeoutRef.current);
            cooldownTimeoutRef.current = null;
        }

        if (streamRef.current) {
            const tracks = streamRef.current.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log(`Track stopped: ${track.kind}`);
            });
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.pause();
            videoRef.current.src = "";
            videoRef.current.load();
        }

        if (readerRef.current) {
            readerRef.current = null;
        }

        setStatus('idle');
        isProcessingRef.current = false;

        setTimeout(() => {
            isCleaningUpRef.current = false;
        }, 100);
    };

    useEffect(() => {
        if (!isOpen) {
            cleanupScanner();
            return;
        }

        isCleaningUpRef.current = false;

        const initScanner = async () => {
            try {
                setError("");
                setStatus('initializing');

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setError("Camera not supported on this device");
                    setStatus('error');
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment",
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    console.log("Camera started successfully");
                }

                const reader = new BrowserMultiFormatReader();
                readerRef.current = reader;

                setStatus('scanning');

                await reader.decodeFromVideoDevice(
                    undefined,
                    videoRef.current!,
                    (result, error) => {
                        if (result && !isProcessingRef.current && !isCleaningUpRef.current) {
                            isProcessingRef.current = true;

                            const barcode = result.getText();
                            console.log("Barcode detected:", barcode);

                            const cleaned = barcode.replace(/\s/g, '').replace(/[^a-zA-Z0-9-]/g, '');

                            if (cleaned && cleaned.length >= 3) {
                                setStatus('processing');
                                setLastScanned(cleaned);

                                onScan(cleaned);

                                toast.success(`Barcode scanned: ${cleaned}`, {
                                    duration: 1500,
                                });

                                setStatus('cooldown');

                                if (cooldownTimeoutRef.current) {
                                    clearTimeout(cooldownTimeoutRef.current);
                                }

                                cooldownTimeoutRef.current = setTimeout(() => {
                                    setStatus('scanning');
                                    isProcessingRef.current = false;
                                    cooldownTimeoutRef.current = null;
                                }, 1500);
                            } else {
                                toast.warning("Invalid barcode format", { duration: 1500 });
                                isProcessingRef.current = false;
                            }
                        }

                        if (error && error.name !== "NotFoundException") {
                            console.error("Scan error:", error);
                            isProcessingRef.current = false;
                        }
                    }
                );

            } catch (err) {
                console.error("Camera error:", err);
                if (err instanceof Error) {
                    if (err.message.includes("Permission denied")) {
                        setError("Camera permission denied. Please allow camera access.");
                    } else if (err.message.includes("Not found") || err.message.includes("NotFoundError")) {
                        setError("No camera found on this device.");
                    } else {
                        setError(`Camera error: ${err.message}`);
                    }
                }
                setStatus('error');
                toast.error("Failed to start camera");
            }
        };

        initScanner();

        return () => {
            cleanupScanner();
        };
    }, [isOpen]);

    const handleClose = () => {
        cleanupScanner();
        setTimeout(() => {
            onClose();
        }, 100);
    };

    const getStatusText = (): string => {
        switch (status) {
            case 'scanning': return 'Ready to scan';
            case 'processing': return 'Processing...';
            case 'cooldown': return 'Please wait...';
            case 'error': return 'Error';
            case 'initializing': return 'Initializing...';
            default: return 'Idle';
        }
    };

    const getStatusColor = (): string => {
        switch (status) {
            case 'scanning': return 'text-emerald-400';
            case 'processing': return 'text-yellow-400';
            case 'cooldown': return 'text-blue-400';
            case 'error': return 'text-red-400';
            case 'initializing': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusIcon = (): string => {
        switch (status) {
            case 'scanning': return 'fa-circle text-[6px]';
            case 'processing': return 'fa-spinner fa-spin';
            case 'cooldown': return 'fa-clock';
            case 'error': return 'fa-exclamation-circle';
            case 'initializing': return 'fa-spinner fa-spin';
            default: return 'fa-circle text-[6px]';
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-200 text-slate-900 dark:text-slate-100">
                <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl dark:shadow-black/60 border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-4 pb-1">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                <i className="fas fa-camera text-base"></i>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                    Scan Barcode
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Align barcode within the target frame
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-full font-semibold">
                                <i className="fas fa-circle-check text-[10px]"></i>
                                {scannedCount} scanned
                            </span>
                            <button
                                type="button"
                                onClick={handleClose}
                                aria-label="Close modal"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
                            >
                                <i className="fas fa-xmark text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video shadow-inner flex items-center justify-center border border-slate-800">
                        {status === "error" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 bg-slate-900">
                                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
                                    <i className="fas fa-triangle-exclamation text-xl"></i>
                                </div>
                                <p className="text-center text-xs font-medium text-slate-300 max-w-xs">
                                    {error || "Unable to access camera device."}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                                >
                                    Close Window
                                </button>
                            </div>
                        ) : (
                            <>
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover"
                                    playsInline
                                    muted
                                />

                                {status === "initializing" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white">
                                        <i className="fas fa-spinner fa-spin text-2xl text-pink-500 mb-2"></i>
                                        <p className="text-xs font-medium text-slate-400">
                                            Initializing camera feed...
                                        </p>
                                    </div>
                                )}

                                {(status === "processing" || status === "cooldown") && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs pointer-events-none z-10">
                                        <div className="text-white text-center bg-slate-900/90 dark:bg-slate-900 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/10 dark:border-slate-800 shadow-lg">
                                            <div className="flex items-center gap-3">
                                                {status === "processing" ? (
                                                    <i className="fas fa-arrows-rotate fa-spin text-xl text-amber-400"></i>
                                                ) : (
                                                    <i className="fas fa-clock text-xl text-sky-400"></i>
                                                )}
                                                <div className="text-left">
                                                    <p className="text-xs font-bold">
                                                        {status === "processing" ? "Reading barcode..." : "Cooldown..."}
                                                    </p>
                                                    {lastScanned && (
                                                        <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                                                            {lastScanned}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className="relative w-52 h-52 border-2 border-pink-500/40 rounded-xl bg-pink-500/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.5)]">
                                        <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-pink-500 rounded-tl"></div>
                                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-pink-500 rounded-tr"></div>
                                        <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-pink-500 rounded-bl"></div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-pink-500 rounded-br"></div>

                                        {status === "scanning" && (
                                            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_8px_#ec4899] animate-pulse"></div>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute top-3 right-3 bg-slate-900/90 dark:bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-2 border border-white/10 dark:border-slate-800 z-10">
                                    <span
                                        className={`w-2 h-2 rounded-full ${status === "scanning"
                                            ? "bg-emerald-400 animate-pulse"
                                            : status === "processing"
                                                ? "bg-amber-400 animate-pulse"
                                                : status === "cooldown"
                                                    ? "bg-sky-400"
                                                    : "bg-slate-400"
                                            }`}
                                    ></span>
                                    <span className="capitalize">
                                        {status === "scanning" ? "Ready" : status}
                                    </span>
                                </div>

                                <div className="absolute bottom-2 inset-x-3 bg-slate-900/90 dark:bg-slate-900/80 backdrop-blur-md text-white px-3.5 py-2 rounded-lg text-xs flex items-center justify-between border border-white/10 dark:border-slate-800 z-10">
                                    <span className={`flex items-center gap-1.5 font-medium ${getStatusColor?.() || "text-slate-300"}`}>
                                        <i className={`fas ${getStatusIcon?.() || "fa-camera"}`}></i>
                                        {getStatusText?.() || "Position barcode inside frame"}
                                    </span>

                                    {lastScanned && status !== "idle" && (
                                        <span className="text-slate-300 text-[11px] font-mono pl-2 border-l border-white/20">
                                            Last: <strong className="text-white">{lastScanned}</strong>
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-4 pt-1">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white font-semibold text-xs transition-all shadow-sm shadow-pink-600/20 active:scale-[0.99] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                        >
                            <i className="fas fa-check text-xs"></i>
                            <span>Done Scanning</span>
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}