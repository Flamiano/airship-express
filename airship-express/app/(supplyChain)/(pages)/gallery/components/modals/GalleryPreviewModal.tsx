// preview modal viewer with embeddeddocviewer, zoom, rotate, pan, and metadata drawer
'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Tag, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize2, User, Calendar, HardDrive, Download } from 'lucide-react';
import { MediaItem } from '../../types';
import { AppButton } from '../../../../components/ui/AppButton';
import EmbeddedDocViewer, { getFileTypeInfo } from '../../../../components/ui/EmbeddedDocViewer';
import Portal from '../../../../components/client/Portal';

export interface GalleryPreviewModalProps {
    isOpen: boolean;
    selectedItem: MediaItem | null;
    selectedItemIndex: number;
    totalItems: number;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    onDownload: (item: MediaItem) => void;
    onImageError: (id: string) => void;
    hasError: boolean;
}

export function GalleryPreviewModal({
    isOpen,
    selectedItem,
    selectedItemIndex,
    totalItems,
    onClose,
    onNext,
    onPrev,
    onDownload,
    onImageError,
    hasError
}: GalleryPreviewModalProps) {
    // viewer transform state
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const viewerContainerRef = useRef<HTMLDivElement>(null);

    const selectedTypeInfo = useMemo(() => {
        if (!selectedItem) return null;
        return getFileTypeInfo(selectedItem.file_type, selectedItem.title, selectedItem.storage_path, selectedItem.imageUrl);
    }, [selectedItem]);

    // reset view on image change or close
    const resetZoomAndPan = useCallback(() => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setIsDragging(false);
    }, []);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 0.25, 4));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(prev - 0.25, 0.5);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const handleRotateCw = useCallback(() => {
        setRotation(prev => (prev + 90) % 360);
    }, []);

    const handleRotateCcw = useCallback(() => {
        setRotation(prev => (prev - 90 + 360) % 360);
    }, []);

    // handle next and previous image transitions with zoom reset
    const handleNext = useCallback(() => {
        onNext();
        resetZoomAndPan();
    }, [onNext, resetZoomAndPan]);

    const handlePrev = useCallback(() => {
        onPrev();
        resetZoomAndPan();
    }, [onPrev, resetZoomAndPan]);

    // keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === '+' || e.key === '=') {
                handleZoomIn();
            } else if (e.key === '-') {
                handleZoomOut();
            } else if (e.key === '0') {
                resetZoomAndPan();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleNext, handlePrev, handleZoomIn, handleZoomOut, resetZoomAndPan, onClose]);

    // non-passive wheel zoom listener
    const handleWheelZoom = useCallback((e: WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            setZoom(prev => Math.min(prev + 0.15, 4));
        } else {
            setZoom(prev => {
                const next = Math.max(prev - 0.15, 0.5);
                if (next <= 1) setPan({ x: 0, y: 0 });
                return next;
            });
        }
    }, []);

    useEffect(() => {
        const el = viewerContainerRef.current;
        if (!el || !selectedTypeInfo?.isImage || !isOpen) return;
        el.addEventListener('wheel', handleWheelZoom, { passive: false });
        return () => el.removeEventListener('wheel', handleWheelZoom);
    }, [handleWheelZoom, selectedTypeInfo?.isImage, isOpen]);

    // mouse drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || zoom <= 1) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleDoubleClick = () => {
        if (zoom > 1) {
            resetZoomAndPan();
        } else {
            setZoom(2);
        }
    };

    if (!isOpen || !selectedItem) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
                onClick={onClose}
                role="dialog"
                aria-modal="true"
                aria-labelledby="preview-modal-title"
            >
                <div
                    className="flex flex-col w-full max-w-5xl max-h-[94vh] overflow-hidden rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-3.5 bg-[#f0f3f8]/95 dark:bg-[#191a24]/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="inline-flex items-center shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs">
                                <Tag className="w-3 h-3 mr-1 text-pink-500" />
                                {selectedItem.category}
                            </span>
                            <h2 id="preview-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight" title={selectedItem.title}>
                                {selectedItem.title}
                            </h2>
                        </div>

                        <div className="flex items-center gap-2">
                            {selectedItemIndex >= 0 && (
                                <span className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 mr-2 hidden sm:inline">
                                    {selectedItemIndex + 1} / {totalItems}
                                </span>
                            )}
                            <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close preview">
                                <X className="w-4 h-4" />
                            </AppButton>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div
                            ref={viewerContainerRef}
                            className="relative min-h-[440px] sm:min-h-[560px] flex items-center justify-center p-2 sm:p-4 bg-slate-900 dark:bg-black overflow-hidden border-b border-slate-200/60 dark:border-slate-800/80"
                            onMouseDown={selectedTypeInfo?.isImage ? handleMouseDown : undefined}
                            onMouseMove={selectedTypeInfo?.isImage ? handleMouseMove : undefined}
                            onMouseUp={selectedTypeInfo?.isImage ? handleMouseUp : undefined}
                            onMouseLeave={selectedTypeInfo?.isImage ? handleMouseUp : undefined}
                            onDoubleClick={selectedTypeInfo?.isImage ? handleDoubleClick : undefined}
                            style={{ cursor: selectedTypeInfo?.isImage && zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                        >
                            {selectedItemIndex > 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrev();
                                    }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 hover:border-pink-500 shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                                    title="Previous Item (← Left Arrow)"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}

                            {selectedItemIndex < totalItems - 1 && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleNext();
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 hover:border-pink-500 shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                                    title="Next Item (→ Right Arrow)"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            )}

                            <EmbeddedDocViewer
                                url={selectedItem.imageUrl}
                                fileName={selectedItem.title}
                                title={selectedItem.title}
                                fileType={selectedItem.file_type}
                                storagePath={selectedItem.storage_path}
                                onDownload={() => onDownload(selectedItem)}
                                zoom={zoom}
                                rotation={rotation}
                                pan={pan}
                                onImageError={() => onImageError(selectedItem.id)}
                                minHeight="min-h-[440px] sm:min-h-[560px]"
                            />

                            {selectedTypeInfo?.isImage && !hasError && (
                                <div
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-white text-xs font-semibold"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={handleZoomOut}
                                        disabled={zoom <= 0.5}
                                        className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                                        title="Zoom Out (-)"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={resetZoomAndPan}
                                        className="px-2.5 py-1 hover:bg-slate-800 rounded-xl font-mono text-[11px] text-pink-400 transition-colors cursor-pointer"
                                        title="Reset Zoom (0 or double click)"
                                    >
                                        {Math.round(zoom * 100)}%
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleZoomIn}
                                        disabled={zoom >= 4}
                                        className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                                        title="Zoom In (+)"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>

                                    <span className="w-px h-4 bg-slate-700 mx-1" />

                                    <button
                                        type="button"
                                        onClick={handleRotateCcw}
                                        className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                        title="Rotate Counterclockwise"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRotateCw}
                                        className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                        title="Rotate Clockwise"
                                    >
                                        <RotateCw className="w-4 h-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={resetZoomAndPan}
                                        className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                        title="Fit to Screen"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-[#f0f3f8] dark:bg-[#191a24] space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200/60 dark:border-slate-800/80">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                    {selectedItem.supplier && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs">
                                            <User className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
                                            {selectedItem.supplier}
                                        </span>
                                    )}

                                    {selectedItem.po_number && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-2xs font-mono">
                                            PO: {selectedItem.po_number}
                                        </span>
                                    )}

                                    {selectedItem.uploadDate && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                            {selectedItem.uploadDate}
                                        </span>
                                    )}

                                    {selectedItem.fileSize && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                                            <HardDrive className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                            {selectedItem.fileSize}
                                        </span>
                                    )}
                                </div>

                                <AppButton type="button" variant="primary" size="sm" onClick={() => onDownload(selectedItem)}>
                                    <Download className="w-4 h-4" />
                                    <span>Download Asset</span>
                                </AppButton>
                            </div>

                            {(selectedItem.parcel_batch || selectedItem.notes) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    {selectedItem.parcel_batch && (
                                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                            <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Parcel Batch
                                            </span>
                                            <p className="font-bold text-slate-800 dark:text-slate-100">
                                                {selectedItem.parcel_batch}
                                            </p>
                                        </div>
                                    )}

                                    {selectedItem.notes && (
                                        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 sm:col-span-2 shadow-2xs">
                                            <span className="block mb-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                Notes
                                            </span>
                                            <p className="leading-relaxed text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                                                {selectedItem.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedItem.uploader && (
                                <div className="pt-2 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={selectedItem.uploader.avatar}
                                            alt={selectedItem.uploader.name}
                                            className="w-10 h-10 rounded-full object-cover border border-slate-200/60 dark:border-slate-700 shadow-2xs"
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {selectedItem.uploader.name}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>{selectedItem.uploader.role}</span>
                                                {selectedItem.uploader.email && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{selectedItem.uploader.email}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
