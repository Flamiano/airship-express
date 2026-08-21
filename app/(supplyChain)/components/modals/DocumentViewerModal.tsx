'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';

export interface ViewDocumentData {
    id?: string;
    title?: string;
    fileName?: string;
    fileUrl?: string;
    storagePath?: string;
    fileType?: string;
    poNumber?: string;
    supplierName?: string;
    verifiedStatus?: 'matched' | 'mismatched' | 'forced' | 'pending' | null;
    totalAmount?: number | string;
    date?: string;
    notes?: string;
    uploadedBy?: string;
}

interface DocumentViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ViewDocumentData | null;
}

export default function DocumentViewerModal({ isOpen, onClose, data }: DocumentViewerModalProps) {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    // reset view settings and load document url
    useEffect(() => {
        if (!isOpen || !data) {
            setResolvedUrl(null);
            setIsLoading(false);
            setHasError(false);
            setZoom(1);
            setRotation(0);
            setIsDownloading(false);
            return;
        }

        setIsLoading(true);
        setHasError(false);
        setZoom(1);
        setRotation(0);
        setIsDownloading(false);

        let isMounted = true;

        async function resolveUrl() {
            try {
                if (data?.fileUrl && data.fileUrl.startsWith('http')) {
                    if (isMounted) {
                        setResolvedUrl(data.fileUrl);
                        setIsLoading(false);
                    }
                    return;
                }

                if (data?.storagePath) {
                    // get public url from documents bucket
                    const { data: publicUrlData } = supabase.storage
                        .from('documents')
                        .getPublicUrl(data.storagePath);

                    if (publicUrlData?.publicUrl) {
                        if (isMounted) {
                            setResolvedUrl(publicUrlData.publicUrl);
                            setIsLoading(false);
                        }
                        return;
                    }
                }

                if (isMounted) {
                    setResolvedUrl(data?.fileUrl || null);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Failed to resolve document URL:', err);
                if (isMounted) {
                    setHasError(true);
                    setIsLoading(false);
                }
            }
        }

        resolveUrl();

        return () => {
            isMounted = false;
        };
    }, [isOpen, data]);

    if (!isOpen || !data) return null;

    const isPdf =
        data.fileType?.includes('pdf') ||
        data.fileName?.toLowerCase().endsWith('.pdf') ||
        data.storagePath?.toLowerCase().endsWith('.pdf') ||
        resolvedUrl?.toLowerCase().includes('.pdf');

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
    const handleResetZoom = () => {
        setZoom(1);
        setRotation(0);
    };
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleDownload = async () => {
        if (!resolvedUrl || isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await fetch(resolvedUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = data.fileName || `receipt_${data.poNumber || 'document'}.${isPdf ? 'pdf' : 'png'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        } catch (err) {
            console.error('Direct download error, attempting storage download fallback:', err);
            if (data?.storagePath) {
                const { data: blobData, error: dlErr } = await supabase.storage
                    .from('documents')
                    .download(data.storagePath);
                if (blobData && !dlErr) {
                    const blobUrl = window.URL.createObjectURL(blobData);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = data.fileName || `receipt_${data.poNumber || 'document'}.${isPdf ? 'pdf' : 'png'}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
                    setIsDownloading(false);
                    return;
                }
            }
            // fallback to browser download
            const a = document.createElement('a');
            a.href = resolvedUrl;
            a.download = data.fileName || `receipt_${data.poNumber || 'document'}.png`;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl h-[92vh] max-h-[900px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/50 border border-pink-200 dark:border-pink-800/40 flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0 shadow-xs">
                            <i className={isPdf ? 'fas fa-file-pdf text-lg text-rose-500' : 'fas fa-file-invoice text-lg text-pink-500'} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    {data.title || `Receipt - PO #${data.poNumber || 'Document'}`}
                                </h3>
                                {data.verifiedStatus === 'matched' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                                        <i className="fas fa-check-circle text-[9px]" /> Matched ✓
                                    </span>
                                )}
                                {data.verifiedStatus === 'mismatched' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40">
                                        <i className="fas fa-exclamation-triangle text-[9px]" /> Mismatch ⚠
                                    </span>
                                )}
                                {data.verifiedStatus === 'forced' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40">
                                        <i className="fas fa-shield-check text-[9px]" /> Admin Forced ✓
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {data.supplierName ? `${data.supplierName} · ` : ''}
                                {data.poNumber ? `PO #${data.poNumber} · ` : ''}
                                {data.fileName || 'Receipt Attachment'}
                            </p>
                        </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {!isPdf && resolvedUrl && (
                            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                                <button
                                    type="button"
                                    onClick={handleZoomOut}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                                    title="Zoom Out"
                                >
                                    <i className="fas fa-search-minus text-xs" />
                                </button>
                                <span className="text-[11px] font-mono px-1 font-semibold text-slate-600 dark:text-slate-300 select-none">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={handleZoomIn}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                                    title="Zoom In"
                                >
                                    <i className="fas fa-search-plus text-xs" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRotate}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer border-l border-slate-200 dark:border-slate-700 pl-2"
                                    title="Rotate 90°"
                                >
                                    <i className="fas fa-redo text-xs" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetZoom}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer text-[10px]"
                                    title="Reset"
                                >
                                    Reset
                                </button>
                            </div>
                        )}

                        {resolvedUrl && (
                            <>
                                <a
                                    href={resolvedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs"
                                    title="Open in new tab"
                                >
                                    <i className="fas fa-external-link-alt text-xs" />
                                </a>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                    title="Download Document directly to device"
                                >
                                    {isDownloading ? (
                                        <i className="fas fa-spinner fa-spin text-xs text-pink-500" />
                                    ) : (
                                        <i className="fas fa-download text-xs" />
                                    )}
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer ml-1"
                            title="Close preview"
                        >
                            <i className="fas fa-times text-sm" />
                        </button>
                    </div>
                </div>

                {/* Content Viewer Body */}
                <div className="flex-1 min-h-0 bg-slate-900/95 dark:bg-slate-950 relative overflow-auto flex items-center justify-center p-4">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-12">
                            <div className="w-10 h-10 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-medium tracking-wide">Loading document preview...</span>
                        </div>
                    )}

                    {hasError && !isLoading && (
                        <div className="flex flex-col items-center justify-center gap-2 text-center p-6 max-w-sm">
                            <i className="fas fa-exclamation-triangle text-3xl text-amber-500 mb-2" />
                            <p className="text-sm font-semibold text-white">Could not load document preview</p>
                            <p className="text-xs text-slate-400">
                                The file may be private or undergoing verification processing.
                            </p>
                            {resolvedUrl && (
                                <a
                                    href={resolvedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 px-3.5 py-1.5 bg-pink-500 text-white rounded-xl text-xs font-semibold hover:bg-pink-600 transition-all shadow-xs"
                                >
                                    Open Link Directly
                                </a>
                            )}
                        </div>
                    )}

                    {!isLoading && !hasError && resolvedUrl && (
                        <>
                            {isPdf ? (
                                <iframe
                                    src={resolvedUrl}
                                    title={data.title || 'PDF Document'}
                                    className="w-full h-full rounded-xl border border-slate-800 bg-white"
                                />
                            ) : (
                                <div
                                    className="transition-transform duration-150 ease-out max-w-full max-h-full flex items-center justify-center select-none"
                                    style={{
                                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    }}
                                >
                                    {/* Image rendered ONLY when viewing modal is open */}
                                    <img
                                        src={resolvedUrl}
                                        alt={data.title || 'Receipt Image'}
                                        className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-white/10"
                                        onLoad={() => setIsLoading(false)}
                                        onError={() => setHasError(true)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Info Strip */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                    <div className="flex items-center gap-4 flex-wrap">
                        {data.totalAmount !== undefined && (
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Total: </span>
                                <span className="font-bold text-pink-600 dark:text-pink-400">
                                    ₱{Number(data.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        {data.uploadedBy && (
                            <div>
                                <span className="text-slate-400">Uploaded by: </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{data.uploadedBy}</span>
                            </div>
                        )}
                        {data.notes && (
                            <div className="italic text-[11px] text-slate-500 truncate max-w-md">
                                {data.notes}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-semibold transition-all cursor-pointer text-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
