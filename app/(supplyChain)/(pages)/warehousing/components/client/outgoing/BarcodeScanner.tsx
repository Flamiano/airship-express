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

export default function BarcodeScanner({
    onScan,
    onClose,
    isOpen,
    scannedCount = 0
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string>("");
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isProcessingRef = useRef(false);
    const isCleaningUpRef = useRef(false);

    const cleanupScanner = () => {
        if (isCleaningUpRef.current) return;
        isCleaningUpRef.current = true;

        console.log("Cleaning up scanner...");

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

        readerRef.current = null;
        setIsScanning(false);
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
                setIsScanning(true);

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setError("Camera not supported on this device");
                    setIsScanning(false);
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

                await reader.decodeFromVideoDevice(
                    undefined,
                    videoRef.current!,
                    (result, error) => {
                        if (result && !isProcessingRef.current && !isCleaningUpRef.current) {
                            isProcessingRef.current = true;
                            const barcode = result.getText();
                            const cleaned = barcode.replace(/\s/g, '').replace(/[^a-zA-Z0-9-]/g, '');
                            if (cleaned && cleaned.length >= 3) {
                                onScan(cleaned);
                                toast.success(`Barcode scanned: ${cleaned}`, { duration: 1500 });
                                setTimeout(() => {
                                    isProcessingRef.current = false;
                                }, 2000);
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
                setIsScanning(false);
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

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <i className="fas fa-camera text-pink-500"></i>
                                Scan Barcode
                            </h2>
                            <span className="text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded-full font-semibold">
                                {scannedCount} scanned
                            </span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <i className="fas fa-times text-xl"></i>
                        </button>
                    </div>

                    <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                        {error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                                <i className="fas fa-exclamation-circle text-4xl text-red-400 mb-3"></i>
                                <p className="text-center text-sm">{error}</p>
                                <button
                                    onClick={handleClose}
                                    className="mt-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg text-white text-sm font-semibold transition-colors"
                                >
                                    Close
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
                                {!isScanning && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <div className="text-white text-center">
                                            <i className="fas fa-spinner fa-spin text-3xl mb-2"></i>
                                            <p>Initializing camera...</p>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-pink-500 rounded-lg">
                                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-pink-500"></div>
                                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-pink-500"></div>
                                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-pink-500"></div>
                                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-pink-500"></div>
                                    </div>
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-xs flex items-center gap-3">
                                    <i className="fas fa-camera mr-1"></i>
                                    Point camera at barcode
                                    <span className="w-px h-4 bg-white/30"></span>
                                    <span className="text-emerald-400">
                                        <i className="fas fa-circle text-[6px] mr-1"></i>
                                        scanning
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold text-sm transition-colors"
                        >
                            <i className="fas fa-check mr-2"></i>
                            Done Scanning
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}