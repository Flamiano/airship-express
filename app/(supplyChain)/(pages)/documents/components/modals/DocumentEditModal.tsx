// modal for editing document metadata with read-only media preview and version bump
'use client';

import React from 'react';
import { Document, Supplier } from '../../types';
import { getFileIcon, getFileColor, formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

interface DocumentEditModalProps {
    isOpen: boolean;
    editingDoc: Document | null;
    editPreviewLoading: boolean;
    editPreviewUrl: string | null;
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onDownloadFile: (doc: Document) => void;
}

export function DocumentEditModal({
    isOpen,
    editingDoc,
    editPreviewLoading,
    editPreviewUrl,
    suppliers,
    onClose,
    onSubmit,
    onDownloadFile
}: DocumentEditModalProps) {
    if (!isOpen || !editingDoc) return null;

    const isImage = editingDoc.file_type.toLowerCase().includes('jpg') ||
        editingDoc.file_type.toLowerCase().includes('jpeg') ||
        editingDoc.file_type.toLowerCase().includes('png') ||
        editingDoc.file_type.toLowerCase().includes('heic');

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* modal header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-edit text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Edit Document
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Update document metadata (image is read-only)
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

                    {/* modal body / form */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4.5">
                        {isImage ? (
                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                    Current Image (Read Only)
                                </label>
                                <div className="flex items-center justify-center min-h-[200px] bg-[#f0f3f8] dark:bg-[#191a24] rounded-xl border border-slate-200/60 dark:border-white/[0.06] p-2 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.2)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                    {editPreviewLoading ? (
                                        <div className="text-center py-6">
                                            <i className="fas fa-spinner fa-spin text-2xl text-pink-500 dark:text-pink-400 mb-2"></i>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Loading image...</p>
                                        </div>
                                    ) : editPreviewUrl ? (
                                        <img
                                            src={editPreviewUrl}
                                            alt={editingDoc.title}
                                            className="max-w-full max-h-[280px] object-contain rounded-lg shadow-sm"
                                        />
                                    ) : (
                                        <div className="text-center text-slate-400 dark:text-slate-500 p-4">
                                            <i className="fas fa-image text-3xl mb-2"></i>
                                            <p className="text-xs font-medium">Image preview not available</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center font-medium">
                                    <i className="fas fa-info-circle mr-1.5 text-slate-400"></i>
                                    Image cannot be edited directly. To change it, delete and re-upload.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                    Current File (Read Only)
                                </label>
                                <div className="flex items-center gap-3 p-3 bg-[#f0f3f8] dark:bg-[#191a24] rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base border shrink-0 ${getFileColor(editingDoc.file_type)}`}>
                                        <i className={`fas ${getFileIcon(editingDoc.file_type)}`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">{editingDoc.file_name}</div>
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatFileSize(editingDoc.file_size)}</div>
                                    </div>
                                    <AppButton
                                        type="button"
                                        variant="pink"
                                        size="xs"
                                        onClick={() => onDownloadFile(editingDoc)}
                                    >
                                        <i className="fas fa-download text-[10px]"></i>
                                        <span>Download</span>
                                    </AppButton>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center font-medium">
                                    <i className="fas fa-info-circle mr-1.5 text-slate-400"></i>
                                    File cannot be edited directly. To change it, delete and re-upload.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Title <span className="text-pink-500">*</span>
                            </label>
                            <input
                                name="title"
                                defaultValue={editingDoc.title}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Category
                                </label>
                                <select
                                    name="category"
                                    defaultValue={editingDoc.category}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer"
                                >
                                    <option value="documents" className="dark:bg-slate-900">Documents</option>
                                    <option value="photos" className="dark:bg-slate-900">Photos</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Document Type
                                </label>
                                <select
                                    name="documentType"
                                    defaultValue={editingDoc.document_type}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer"
                                >
                                    <option value="Official Receipt" className="dark:bg-slate-900">Official Receipt</option>
                                    <option value="Invoice" className="dark:bg-slate-900">Invoice</option>
                                    <option value="Delivery Receipt" className="dark:bg-slate-900">Delivery Receipt</option>
                                    <option value="Parcel Condition" className="dark:bg-slate-900">Parcel Condition</option>
                                    <option value="Courier Handover" className="dark:bg-slate-900">Courier Handover</option>
                                    <option value="Vehicle Maintenance" className="dark:bg-slate-900">Vehicle Maintenance</option>
                                    <option value="Other" className="dark:bg-slate-900">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Supplier
                                </label>
                                <select
                                    name="supplier"
                                    defaultValue={editingDoc.supplier || ''}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer"
                                >
                                    <option value="" className="dark:bg-slate-900 text-slate-400">Select supplier</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    PO Number
                                </label>
                                <input
                                    name="poNumber"
                                    defaultValue={editingDoc.po_number || ''}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                    placeholder="e.g. PO-2026-0031"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Parcel Batch
                                </label>
                                <input
                                    name="parcelBatch"
                                    defaultValue={editingDoc.parcel_batch || ''}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                    placeholder="e.g. PB-2026-045"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Uploaded By
                                </label>
                                <input
                                    name="uploadedBy"
                                    defaultValue={editingDoc.uploaded_by || ''}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Version
                                </label>
                                <input
                                    value={`v${(editingDoc.version || 0) + 1}`}
                                    className="w-full bg-[#e2e8f0]/60 dark:bg-[#101118] border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                                    disabled
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                defaultValue={editingDoc.notes || ''}
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="Additional details or remarks"
                            />
                        </div>

                        {/* modal actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={onClose}
                            >
                                Cancel
                            </AppButton>
                            <AppButton
                                type="submit"
                                variant="primary"
                                size="md"
                            >
                                <i className="fas fa-save text-xs"></i>
                                <span>Update Document</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
