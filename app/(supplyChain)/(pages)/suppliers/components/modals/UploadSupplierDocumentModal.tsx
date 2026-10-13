"use client";

import React, { useState, useRef } from "react";
import Portal from "../../../../components/client/Portal";
import { toast } from "sonner";
import { 
    X, 
    Upload, 
    FileText, 
    Building2, 
    Check, 
    AlertCircle, 
    Loader2,
    Tag,
    Paperclip
} from "lucide-react";
import { Supplier } from "../../types";

interface UploadSupplierDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    suppliers: Supplier[];
    initialSupplierId?: number;
    onDocumentUploaded: () => void;
}

const DOCUMENT_TYPES = [
    { label: "Contract & Service Agreement", value: "Contract" },
    { label: "Quotation & Price Proposal", value: "Quotation Proposal" },
    { label: "Business Permit / Mayor's Permit", value: "Business Permit" },
    { label: "BIR Certificate of Registration (2303)", value: "BIR 2303" },
    { label: "DTI / SEC Registration", value: "DTI/SEC Registration" },
    { label: "Non-Disclosure Agreement (NDA)", value: "NDA" },
    { label: "Service Level Agreement (SLA)", value: "SLA" },
    { label: "Accreditation Certificate", value: "Accreditation" },
    { label: "Other Supporting Document", value: "General Document" },
];

export function UploadSupplierDocumentModal({
    isOpen,
    onClose,
    suppliers,
    initialSupplierId,
    onDocumentUploaded,
}: UploadSupplierDocumentModalProps) {
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
        initialSupplierId ? String(initialSupplierId) : (suppliers[0]?.id ? String(suppliers[0].id) : "")
    );
    const [documentType, setDocumentType] = useState<string>("Contract");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (file: File) => {
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            toast.error("File size exceeds 25MB limit.");
            return;
        }
        setSelectedFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSupplierId) {
            toast.error("Please select a supplier.");
            return;
        }

        if (!selectedFile) {
            toast.error("Please select a document file to upload.");
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("supplier_id", selectedSupplierId);
            formData.append("document_type", documentType);
            formData.append("file", selectedFile);
            formData.append("uploaded_by", "Supply Chain Officer");

            const res = await fetch("/api/suppliers/documents", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to upload document.");
            }

            toast.success(`Document "${selectedFile.name}" registered successfully.`);
            onDocumentUploaded();
            onClose();
        } catch (err: any) {
            console.error("Upload document error:", err);
            toast.error(err.message || "Failed to upload document.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[150] bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-lg bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                <Upload className="w-5 h-5 drop-shadow" />
                            </div>
                            <div>
                                <h3 className="font-black text-base text-slate-900 dark:text-white">
                                    Upload Supplier Document
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Record contracts, price proposals, or compliance files
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1d1f2e] text-slate-500 hover:text-rose-600 border border-white/80 dark:border-white/5 cursor-pointer transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
                        {/* 1. Supplier Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Select Supplier *
                            </label>
                            <select
                                value={selectedSupplierId}
                                onChange={(e) => setSelectedSupplierId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                required
                            >
                                <option value="" disabled>-- Select a Supplier --</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={String(s.id)}>
                                        {s.name} ({s.category || "General"})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Document Type */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Document Category / Type *
                            </label>
                            <select
                                value={documentType}
                                onChange={(e) => setDocumentType(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                required
                            >
                                {DOCUMENT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. File Dropzone */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Document Attachment (PDF, Image, DOC) *
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                className="hidden"
                            />

                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 ${
                                    isDragging
                                        ? "border-pink-500 bg-pink-50/50 dark:bg-pink-950/20"
                                        : selectedFile
                                        ? "border-pink-500/60 bg-pink-50/20 dark:bg-pink-950/10"
                                        : "border-slate-300 dark:border-white/10 bg-[#e6edf7] dark:bg-[#11121a] hover:border-pink-400"
                                } shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                                    <Paperclip className="w-5 h-5" />
                                </div>

                                {selectedFile ? (
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[260px]">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-[11px] text-pink-600 dark:text-pink-400 font-medium">
                                            {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to replace
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            Drag &amp; drop document here, or <span className="text-pink-600 dark:text-pink-400 underline">browse</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Supports PDF, JPEG, PNG, DOCX up to 25MB
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isUploading}
                                className="px-5 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isUploading || !selectedFile || !selectedSupplierId}
                                className="px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        <span>Save Document</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
