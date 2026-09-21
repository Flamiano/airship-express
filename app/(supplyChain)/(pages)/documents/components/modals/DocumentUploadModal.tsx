// modal for uploading single or batch documents and photos with metadata
'use client';

import React from 'react';
import { Supplier } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

interface DocumentUploadModalProps {
    isOpen: boolean;
    isUploading: boolean;
    uploadProgress: number;
    selectedFiles: File[];
    suppliers: Supplier[];
    userName: string;
    dropZoneRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onFileSelect: (files: FileList | null) => void;
    onRemoveFile: (index: number) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function DocumentUploadModal({
    isOpen,
    isUploading,
    uploadProgress,
    selectedFiles,
    suppliers,
    userName,
    dropZoneRef,
    onClose,
    onFileSelect,
    onRemoveFile,
    onSubmit
}: DocumentUploadModalProps) {
    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* modal header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-upload text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Upload Files
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Upload documents, receipts, or photos for tracking
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

                    {/* form body */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

                        {/* dropzone area */}
                        <div
                            ref={dropZoneRef}
                            className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-6 text-center hover:border-pink-400 dark:hover:border-pink-500/60 transition-all cursor-pointer bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]"
                            onClick={() => document.getElementById('fileInput')?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add('border-pink-400', 'bg-pink-500/5');
                            }}
                            onDragLeave={(e) => {
                                e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/5');
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/5');
                                onFileSelect(e.dataTransfer.files);
                            }}
                        >
                            <input
                                id="fileInput"
                                type="file"
                                className="hidden"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => onFileSelect(e.target.files)}
                            />
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] text-pink-500 dark:text-pink-400 flex items-center justify-center mb-1 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-cloud-upload-alt text-xl"></i>
                                </div>
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Drop files here or <span className="text-pink-600 dark:text-pink-400 underline">browse</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    Supports PDF, JPG, PNG, HEIC, DOC, XLS (Max 10MB each)
                                </div>

                                {selectedFiles.length > 0 && (
                                    <div className="w-full max-w-md mt-3 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                                        {selectedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2.5 bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] rounded-xl text-xs">
                                                <span className="flex items-center gap-2 truncate pr-2">
                                                    <i className="fas fa-file-alt text-slate-400 dark:text-slate-500"></i>
                                                    <span className="truncate max-w-[220px] text-slate-800 dark:text-slate-200 font-semibold">{file.name}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">({formatFileSize(file.size)})</span>
                                                </span>
                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="icon-xs"
                                                    onClick={(e) => { e?.stopPropagation(); onRemoveFile(index); }}
                                                    aria-label="Remove file"
                                                >
                                                    <i className="fas fa-times text-[10px]"></i>
                                                </AppButton>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {uploadProgress > 0 && (
                                    <div className="w-full max-w-md mt-3">
                                        <div className="w-full bg-[#ebf0f7] dark:bg-[#14151e] rounded-full h-2 overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                                            <div
                                                className="bg-gradient-to-r from-pink-500 to-pink-600 h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                                            <span>Uploading...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* fields grid */}
                        <div className="space-y-3.5 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
                                    <select name="category" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
                                        <option value="documents" className="dark:bg-slate-900">Documents</option>
                                        <option value="photos" className="dark:bg-slate-900">Photos</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Document Type</label>
                                    <select name="documentType" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
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

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Supplier</label>
                                    <select name="supplier" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
                                        <option value="" className="dark:bg-slate-900 text-slate-400">Select supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">PO Number</label>
                                    <input name="poNumber" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="e.g. PO-2026-0031" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Parcel Batch</label>
                                    <input name="parcelBatch" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="e.g. PB-2026-045" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Uploaded By</label>
                                    <input name="uploadedBy" defaultValue={userName} className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="Your name" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Notes</label>
                                    <input name="notes" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl py-2 px-3.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="Additional details" />
                                </div>
                            </div>
                        </div>

                        {/* modal actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06] mt-2">
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
                                disabled={isUploading || selectedFiles.length === 0}
                                loading={isUploading}
                            >
                                <i className="fas fa-upload text-xs"></i>
                                <span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
