// modal for previewing documents with embeddeddocviewer, download, print, and metadata drawer
'use client';

import React from 'react';
import { Document } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import EmbeddedDocViewer from "../../../../components/ui/EmbeddedDocViewer";
import Portal from '../../../../components/client/Portal';

interface DocumentPreviewModalProps {
    isOpen: boolean;
    selectedDoc: Document | null;
    previewLoading: boolean;
    previewUrl: string | null;
    onClose: () => void;
    onDownload: (doc: Document) => void;
}

export function DocumentPreviewModal({
    isOpen,
    selectedDoc,
    previewLoading,
    previewUrl,
    onClose,
    onDownload
}: DocumentPreviewModalProps) {
    if (!isOpen || !selectedDoc) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-6xl max-h-[90vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* modal header */}
                    <div className="flex items-start justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-file-alt text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate max-w-2xl tracking-tight">
                                    {selectedDoc.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    <span className="font-mono">{selectedDoc.id}</span> · {selectedDoc.document_type}
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* modal body */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* left: preview area */}
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl flex items-center justify-center min-h-[480px] sm:min-h-[540px] flex-1 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] relative overflow-hidden">
                                    {previewLoading ? (
                                        <div className="text-center py-12">
                                            <i className="fas fa-spinner fa-spin text-3xl text-pink-500 dark:text-pink-400 mb-3"></i>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading preview...</p>
                                        </div>
                                    ) : previewUrl ? (
                                        <EmbeddedDocViewer
                                            url={previewUrl}
                                            fileName={selectedDoc.file_name}
                                            title={selectedDoc.title}
                                            fileType={selectedDoc.file_type}
                                            storagePath={selectedDoc.storage_path}
                                            onDownload={() => onDownload(selectedDoc)}
                                            minHeight="min-h-[480px] sm:min-h-[540px]"
                                        />
                                    ) : (
                                        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                                <i className="fas fa-file-alt text-3xl"></i>
                                            </div>
                                            <p className="text-xs font-medium">Preview not available</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* right: metadata & info panel */}
                            <div className="space-y-4 flex flex-col justify-between">
                                <div className="space-y-4">
                                    {/* file information */}
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                        <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
                                            <i className="fas fa-info-circle text-slate-400 dark:text-slate-500"></i>
                                            <span>File Information</span>
                                        </h4>
                                        <dl className="mt-2.5 space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">ID:</dt>
                                                <dd className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{selectedDoc.id.substring(0, 8)}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Type:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 font-semibold">{selectedDoc.document_type}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Size:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 font-semibold">{formatFileSize(selectedDoc.file_size)}</dd>
                                            </div>
                                            {selectedDoc.Price && (
                                                <div className="flex justify-between items-center">
                                                    <dt className="text-slate-500 dark:text-slate-400 font-medium">Price:</dt>
                                                    <dd className="text-pink-600 dark:text-pink-400 font-bold font-mono">₱{selectedDoc.Price}</dd>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Version:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 font-semibold">v{selectedDoc.version || 1}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Uploaded:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 font-semibold">{new Date(selectedDoc.created_at).toLocaleDateString()}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">By:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 font-semibold">{selectedDoc.uploaded_by || 'Unknown'}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    {/* related records */}
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                        <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
                                            <i className="fas fa-link text-slate-400 dark:text-slate-500"></i>
                                            <span>Related Records</span>
                                        </h4>
                                        <dl className="mt-2.5 space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">PO:</dt>
                                                <dd className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{selectedDoc.po_number || '-'}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Supplier:</dt>
                                                <dd className="text-slate-800 dark:text-slate-200 truncate max-w-[150px] font-semibold" title={selectedDoc.supplier || '-'}>{selectedDoc.supplier || '-'}</dd>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <dt className="text-slate-500 dark:text-slate-400 font-medium">Parcel:</dt>
                                                <dd className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{selectedDoc.parcel_batch || '-'}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    {/* notes */}
                                    {selectedDoc.notes && (
                                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
                                                <i className="fas fa-sticky-note text-slate-400 dark:text-slate-500"></i>
                                                <span>Notes</span>
                                            </h4>
                                            <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {selectedDoc.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* action buttons footer */}
                                <div className="flex gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                                    <AppButton
                                        type="button"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                        onClick={() => onDownload(selectedDoc)}
                                    >
                                        <i className="fas fa-download text-xs"></i>
                                        <span>Download</span>
                                    </AppButton>
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="md"
                                        className="flex-1"
                                        onClick={() => window.print()}
                                    >
                                        <i className="fas fa-print text-xs"></i>
                                        <span>Print</span>
                                    </AppButton>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </Portal>
    );
}
