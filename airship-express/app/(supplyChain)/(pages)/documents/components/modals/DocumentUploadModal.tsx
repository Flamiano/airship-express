import React, { useState } from 'react';
import { Supplier } from '../../types';
import { formatFileSize, getFileColor, getFileIcon } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { 
    SelectedFilesGridModal, 
    getCachedFilePreviewUrl, 
    revokeCachedFilePreviewUrl, 
    clearAllCachedFilePreviewUrls 
} from './SelectedFilesGridModal';

interface DocumentUploadModalProps {
    isOpen: boolean;
    isUploading: boolean;
    uploadProgress: number;
    selectedFiles: File[];
    suppliers: Supplier[];
    userName: string;
    userRole?: string;
    maxFiles?: number;
    dropZoneRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onFileSelect: (files: FileList | null) => void;
    onRemoveFile: (index: number) => void;
    onClearAllFiles?: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    ocrWarning?: string | null;
    onConfirmForceUpload?: () => void;
}

export function DocumentUploadModal({
    isOpen,
    isUploading,
    uploadProgress,
    selectedFiles,
    suppliers,
    userName,
    userRole = 'Employee',
    maxFiles = 10,
    dropZoneRef,
    onClose,
    onFileSelect,
    onRemoveFile,
    onClearAllFiles,
    onSubmit,
    ocrWarning,
    onConfirmForceUpload
}: DocumentUploadModalProps) {
    const [createWithoutFile, setCreateWithoutFile] = useState(false);
    const [isGridModalOpen, setIsGridModalOpen] = useState(false);
    const isPrivileged = ['Executive', 'Admin'].includes(userRole);

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
                                    {createWithoutFile ? 'Create Document Record (No File)' : 'Upload Documents & Photos'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {createWithoutFile ? 'Record document metadata now and attach file later' : 'Upload files with automatic Gemini OCR validation (Max 10 files)'}
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

                        {/* OCR Warning Banner (Admin / Executive override) */}
                        {ocrWarning && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                                <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                                    <i className="fas fa-triangle-exclamation"></i>
                                    <span>AI OCR Validation Notice (Admin / Executive Warning)</span>
                                </div>
                                <p className="leading-relaxed text-[11px]">{ocrWarning}</p>
                                {isPrivileged && onConfirmForceUpload && (
                                    <div className="pt-1.5 flex justify-end">
                                        <AppButton
                                            type="button"
                                            variant="primary"
                                            size="xs"
                                            onClick={onConfirmForceUpload}
                                            disabled={isUploading}
                                            loading={isUploading}
                                        >
                                            <i className="fas fa-shield-halved text-xs"></i>
                                            <span>Proceed with Admin Override &amp; Upload</span>
                                        </AppButton>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Toggle: Upload with File vs Create Without File */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs">
                            <div className="flex items-center gap-2.5">
                                <i className="fas fa-file-circle-plus text-pink-500 text-sm"></i>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                        Create record without file
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        Save document info now; attach file later (reminds creator every 5 min)
                                    </div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="isPendingFile"
                                    checked={createWithoutFile}
                                    onChange={(e) => setCreateWithoutFile(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                            </label>
                        </div>

                        {/* dropzone area (shown only when NOT creating without file) */}
                        {!createWithoutFile && (
                            <div
                                ref={dropZoneRef}
                                className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-5 text-center hover:border-pink-400 dark:hover:border-pink-500/60 transition-all cursor-pointer bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]"
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
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 flex-wrap justify-center">
                                        <span>PDF, JPG, PNG, HEIC, DOC, XLS</span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span className="font-bold text-pink-600 dark:text-pink-400">Max {maxFiles} files</span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span>10MB each</span>
                                    </div>

                                    {/* Selected files preview / grid trigger */}
                                    {selectedFiles.length > 0 && (
                                        <div className="w-full max-w-lg mt-3 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                                            {/* Preview header */}
                                            <div className="flex items-center justify-between pb-1 px-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        Selected Files
                                                    </span>
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 font-mono">
                                                        {selectedFiles.length} / {maxFiles}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsGridModalOpen(true)}
                                                    className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 transition-all hover:scale-105"
                                                >
                                                    <i className="fas fa-grid-2 text-xs"></i>
                                                    <span>View Grid ({selectedFiles.length})</span>
                                                </button>
                                            </div>

                                            {/* Compact grid preview */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {selectedFiles.slice(0, 5).map((file, index) => {
                                                    const isImage = file.type.startsWith('image/');
                                                    const fileExt = file.name.split('.').pop() || '';
                                                    const cachedThumb = isImage ? getCachedFilePreviewUrl(file) : null;

                                                    return (
                                                        <div
                                                            key={`${file.name}-${file.size}-${index}`}
                                                            onClick={() => setIsGridModalOpen(true)}
                                                            className="flex items-center justify-between p-2 bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] rounded-xl text-xs hover:border-pink-400 transition-all cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 pr-1">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border shrink-0 overflow-hidden ${cachedThumb ? 'p-0 bg-black/20 border-slate-300 dark:border-slate-700' : getFileColor(file.type || fileExt)}`}>
                                                                    {cachedThumb ? (
                                                                        <img
                                                                            src={cachedThumb}
                                                                            alt={file.name}
                                                                            loading="lazy"
                                                                            decoding="async"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <i className={`fas ${getFileIcon(file.type || fileExt)}`}></i>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[90px]">
                                                                        {file.name}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                                        {formatFileSize(file.size)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <AppButton
                                                                type="button"
                                                                variant="neutral"
                                                                size="icon-xs"
                                                                onClick={(e) => {
                                                                    e?.stopPropagation();
                                                                    revokeCachedFilePreviewUrl(file);
                                                                    onRemoveFile(index);
                                                                }}
                                                                aria-label={`Remove ${file.name}`}
                                                            >
                                                                <i className="fas fa-times text-[10px]"></i>
                                                            </AppButton>
                                                        </div>
                                                    );
                                                })}

                                                {/* More files card */}
                                                {selectedFiles.length > 5 && (
                                                    <div
                                                        onClick={() => setIsGridModalOpen(true)}
                                                        className="flex flex-col items-center justify-center p-2 bg-pink-500/10 border border-pink-500/30 rounded-xl text-xs text-pink-600 dark:text-pink-400 font-bold hover:bg-pink-500/20 transition-all cursor-pointer text-center"
                                                    >
                                                        <i className="fas fa-ellipsis text-base mb-0.5"></i>
                                                        <span>+{selectedFiles.length - 5} more files</span>
                                                    </div>
                                                )}
                                            </div>
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
                                                <span>Uploading &amp; Verifying...</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* fields grid */}
                        <div className="space-y-3.5 pt-1">
                            {/* Document Title */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Document Title {createWithoutFile && <span className="text-pink-500">*</span>}
                                </label>
                                <input
                                    name="title"
                                    required={createWithoutFile}
                                    placeholder={createWithoutFile ? "e.g. Official Receipt - Supplier ABC" : "Auto-generated from file name or custom title"}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
                                    <select name="category" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
                                        <option value="documents" className="dark:bg-slate-900">Documents</option>
                                        <option value="photos" className="dark:bg-slate-900">Photos</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Document Type</label>
                                    <select name="documentType" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
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
                                    <select name="supplier" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer">
                                        <option value="" className="dark:bg-slate-900 text-slate-400">Select supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">PO Number</label>
                                    <input name="poNumber" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="e.g. PO-2026-0031" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Parcel Batch</label>
                                    <input name="parcelBatch" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="e.g. PB-2026-045" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Price (PHP)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">₱</span>
                                        <input
                                            name="price"
                                            type="text"
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 pl-6 pr-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-mono"
                                            placeholder="e.g. 1,500.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Uploaded By <span className="text-[10px] text-slate-400 font-normal lowercase">(read only)</span>
                                    </label>
                                    <input
                                        name="uploadedBy"
                                        value={userName}
                                        readOnly
                                        className="w-full bg-[#e2e8f0]/60 dark:bg-[#101118] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)] rounded-lg py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none focus:outline-none"
                                        placeholder="Your name"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Notes</label>
                                    <input name="notes" className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="Additional details" />
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
                                disabled={isUploading || (!createWithoutFile && selectedFiles.length === 0)}
                                loading={isUploading}
                            >
                                <i className={`fas ${createWithoutFile ? 'fa-plus' : 'fa-upload'} text-xs`}></i>
                                <span>
                                    {createWithoutFile
                                        ? 'Create Record (No File)'
                                        : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                                </span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>

            {/* Selected files grid view & management modal - only rendered when active */}
            {isGridModalOpen && (
                <SelectedFilesGridModal
                    isOpen={isGridModalOpen}
                    files={selectedFiles}
                    maxFiles={maxFiles}
                    onClose={() => setIsGridModalOpen(false)}
                    onRemoveFile={(idx) => {
                        if (selectedFiles[idx]) {
                            revokeCachedFilePreviewUrl(selectedFiles[idx]);
                        }
                        onRemoveFile(idx);
                    }}
                    onClearAll={() => {
                        clearAllCachedFilePreviewUrls();
                        if (onClearAllFiles) {
                            onClearAllFiles();
                        }
                    }}
                />
            )}
        </Portal>
    );
}
