import React, { useState, useMemo, useEffect, useRef } from 'react';
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

const STANDARD_DOC_TYPES = [
    "Official Receipt",
    "Invoice",
    "Delivery Receipt",
    "Parcel Condition",
    "Logistics Handover",
    "Vehicle Maintenance",
    "Other",
];

interface DocumentUploadModalProps {
    isOpen: boolean;
    isUploading: boolean;
    uploadProgress: number;
    selectedFiles: File[];
    suppliers: Supplier[];
    purchaseOrders?: Array<{ id: string; po_number: string; supplier_id?: number | null; supplier_name?: string }>;
    userName: string;
    userRole?: string;
    maxFiles?: number;
    defaultSupplier?: string;
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
    purchaseOrders = [],
    userName,
    userRole = 'Employee',
    maxFiles = 5,
    defaultSupplier,
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
    const [selectedSupplierName, setSelectedSupplierName] = useState(defaultSupplier || "");
    const [selectedPoNumber, setSelectedPoNumber] = useState("");
    const [isCustomPo, setIsCustomPo] = useState(false);

    // Form inputs state for auto-filling and editing
    const [docTitle, setDocTitle] = useState("");
    const [docCategory, setDocCategory] = useState("documents");
    const [docType, setDocType] = useState("Official Receipt");
    const [docPrice, setDocPrice] = useState("");
    const [docNotes, setDocNotes] = useState("");

    // Live AI Scanning state
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any | null>(null);
    const [showOcrText, setShowOcrText] = useState(false);
    const lastScannedKeyRef = useRef<string | null>(null);

    const isPrivileged = ['Executive', 'Admin'].includes(userRole);

    // Reset when modal closes or opens
    useEffect(() => {
        if (!isOpen) {
            setDocTitle("");
            setDocCategory("documents");
            setDocType("Official Receipt");
            setDocPrice("");
            setDocNotes("");
            setScanResult(null);
            setIsScanning(false);
            setShowOcrText(false);
            lastScannedKeyRef.current = null;
            setSelectedSupplierName(defaultSupplier || "");
            setSelectedPoNumber("");
            setIsCustomPo(false);
            setCreateWithoutFile(false);
        }
    }, [isOpen, defaultSupplier]);

    useEffect(() => {
        if (defaultSupplier) {
            setSelectedSupplierName(defaultSupplier);
        }
    }, [defaultSupplier]);

    const filteredPos = useMemo(() => {
        if (!selectedSupplierName) return purchaseOrders;
        const matched = purchaseOrders.filter(
            (p) => (p.supplier_name || '').toLowerCase() === selectedSupplierName.toLowerCase()
        );
        return matched.length > 0 ? matched : purchaseOrders;
    }, [purchaseOrders, selectedSupplierName]);

    // Live AI OCR & Vision Scanner runner
    const runScan = async (file: File) => {
        const isImageOrPdf = file.type.startsWith('image/') || file.type === 'application/pdf' || /\.(jpe?g|png|webp|heic|pdf)$/i.test(file.name);
        if (!isImageOrPdf) return;

        setIsScanning(true);
        try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            const fileBase64 = await base64Promise;

            const res = await fetch('/ai/api/verify-document-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileBase64,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    userRole,
                    userName,
                }),
            });

            if (!res.ok) {
                console.warn('[Pre-upload OCR] OCR response status:', res.status);
                return;
            }

            const data = await res.json();
            if (data?.success) {
                const extractedPayload = data.extracted || {
                    text: data.extracted_text || null,
                    description: data.photo_description || data.summary || null,
                    visual_objects: Array.isArray(data.visual_objects) ? data.visual_objects : [],
                    vendor_name: data.extracted_supplier || null,
                    po_number: data.extracted_po_number || null,
                    price: data.extracted_price || null,
                    summary: data.summary || null,
                    document_type: data.detected_type || 'Official Receipt',
                    category: data.detected_category || 'documents',
                    confidence_score: data.confidence_score || 95,
                    extracted_at: new Date().toISOString(),
                };

                setScanResult(extractedPayload);

                // Auto-fill title if empty or default
                if (data.extracted_title) {
                    setDocTitle(data.extracted_title);
                } else if (!docTitle) {
                    setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
                }

                // Auto-fill category
                if (data.detected_category) {
                    const cat = data.detected_category.toLowerCase();
                    setDocCategory(cat === 'photos' ? 'photos' : 'documents');
                }

                // Auto-fill document type
                if (data.detected_type) {
                    setDocType(data.detected_type);
                }

                // Auto-fill price
                if (data.extracted_price) {
                    setDocPrice(String(data.extracted_price).replace(/[^\d.,]/g, ''));
                }

                // Auto-fill supplier
                if (data.extracted_supplier) {
                    const matchedSupplier = suppliers.find(
                        s => s.name.toLowerCase() === data.extracted_supplier.toLowerCase() ||
                             s.name.toLowerCase().includes(data.extracted_supplier.toLowerCase()) ||
                             data.extracted_supplier.toLowerCase().includes(s.name.toLowerCase())
                    );
                    if (matchedSupplier) {
                        setSelectedSupplierName(matchedSupplier.name);
                    }
                }

                // Auto-fill PO number
                if (data.extracted_po_number) {
                    setSelectedPoNumber(data.extracted_po_number);
                    const hasPo = purchaseOrders.some(
                        p => p.po_number.toLowerCase() === data.extracted_po_number.toLowerCase()
                    );
                    if (!hasPo) {
                        setIsCustomPo(true);
                    }
                }
            }
        } catch (err) {
            console.warn('[Pre-upload OCR] Error scanning file:', err);
        } finally {
            setIsScanning(false);
        }
    };

    // Trigger AI scan as soon as files are selected
    useEffect(() => {
        if (createWithoutFile || selectedFiles.length === 0) {
            if (selectedFiles.length === 0) {
                setScanResult(null);
                lastScannedKeyRef.current = null;
            }
            return;
        }

        const primaryFile = selectedFiles[0];
        const fileKey = `${primaryFile.name}-${primaryFile.size}-${primaryFile.lastModified}`;
        if (lastScannedKeyRef.current === fileKey) return;
        lastScannedKeyRef.current = fileKey;

        runScan(primaryFile);
    }, [selectedFiles, createWithoutFile]);

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* modal header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] ${isUploading ? 'text-pink-600 dark:text-pink-400 animate-pulse' : 'text-pink-500 dark:text-pink-400'}`}>
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'} text-sm`}></i>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <span>{createWithoutFile ? 'Create Document Record (No File)' : 'Upload Documents & Photos'}</span>
                                    {isUploading && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 animate-pulse">
                                            Uploading...
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {createWithoutFile ? 'Record document metadata now and attach file later' : 'Upload documents and photos freely (Max 5 files)'}
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            disabled={isUploading}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* form body */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Hidden input carrying instant AI scan metadata */}
                        <input
                            type="hidden"
                            name="preExtractedData"
                            value={scanResult ? JSON.stringify(scanResult) : ''}
                        />

                        {/* Upload Progress Status Banner */}
                        {isUploading && (
                            <div className="p-4 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-300 dark:border-pink-800/60 text-xs space-y-2.5 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-pink-600 dark:text-pink-400">
                                        <i className="fas fa-circle-notch fa-spin text-sm"></i>
                                        <span>AI OCR Validation &amp; Upload in Progress</span>
                                    </div>
                                    <span className="font-mono font-bold text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/40 px-2.5 py-0.5 rounded-md border border-pink-300 dark:border-pink-700/50">
                                        {uploadProgress}%
                                    </span>
                                </div>
                                <div className="w-full bg-pink-100/80 dark:bg-pink-950/60 rounded-full h-2.5 overflow-hidden shadow-inner border border-pink-200/60 dark:border-pink-900/40">
                                    <div
                                        className="bg-pink-600 dark:bg-pink-500 h-2.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                                        style={{ width: `${Math.max(5, uploadProgress)}%` }}
                                    ></div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    <span>Processing {selectedFiles.length} file(s)...</span>
                                    <span className="text-pink-600 dark:text-pink-400 font-semibold flex items-center gap-1">
                                        <i className="fas fa-lock text-[10px]"></i> Inputs locked
                                    </span>
                                </div>
                            </div>
                        )}

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
                        <div className={`flex items-center justify-between p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
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
                            <label className={`relative inline-flex items-center ${isUploading ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    name="isPendingFile"
                                    checked={createWithoutFile}
                                    disabled={isUploading}
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
                                className={`border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-5 text-center transition-all bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] ${
                                    isUploading 
                                        ? 'opacity-60 cursor-not-allowed pointer-events-none' 
                                        : 'hover:border-pink-400 dark:hover:border-pink-500/60 cursor-pointer'
                                }`}
                                onClick={() => {
                                    if (isUploading) return;
                                    document.getElementById('fileInput')?.click();
                                }}
                                onDragOver={(e) => {
                                    if (isUploading) return;
                                    e.preventDefault();
                                    e.currentTarget.classList.add('border-pink-400', 'bg-pink-500/5');
                                }}
                                onDragLeave={(e) => {
                                    if (isUploading) return;
                                    e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/5');
                                }}
                                onDrop={(e) => {
                                    if (isUploading) return;
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
                                    disabled={isUploading}
                                    accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
                                    onChange={(e) => onFileSelect(e.target.files)}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] text-pink-500 dark:text-pink-400 flex items-center justify-center mb-1 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'} text-xl`}></i>
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {isUploading ? (
                                            <span className="text-pink-600 dark:text-pink-400">Uploading files in progress...</span>
                                        ) : (
                                            <>Drop files here or <span className="text-pink-600 dark:text-pink-400 underline">browse</span></>
                                        )}
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
                                                    disabled={isUploading}
                                                    onClick={() => setIsGridModalOpen(true)}
                                                    className={`text-xs font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-pink-700 dark:hover:text-pink-300 hover:scale-105'}`}
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
                                                            onClick={() => {
                                                                if (!isUploading) setIsGridModalOpen(true);
                                                            }}
                                                            className={`flex items-center justify-between p-2 bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] rounded-xl text-xs transition-all ${isUploading ? 'opacity-70 cursor-not-allowed' : 'hover:border-pink-400 cursor-pointer group'}`}
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
                                                                disabled={isUploading}
                                                                onClick={(e) => {
                                                                    e?.stopPropagation();
                                                                    if (isUploading) return;
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
                                                        onClick={() => {
                                                            if (!isUploading) setIsGridModalOpen(true);
                                                        }}
                                                        className={`flex flex-col items-center justify-center p-2 bg-pink-500/10 border border-pink-500/30 rounded-xl text-xs text-pink-600 dark:text-pink-400 font-bold transition-all text-center ${isUploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-pink-500/20 cursor-pointer'}`}
                                                    >
                                                        <i className="fas fa-ellipsis text-base mb-0.5"></i>
                                                        <span>+{selectedFiles.length - 5} more files</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AI Live Scanning & Inspection Feedback Section */}
                        {isScanning && (
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-pink-500/30 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#ebf0f7] dark:bg-[#191a24] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_4px_rgba(166,175,195,0.3),-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.5)]">
                                        <i className="fas fa-wand-magic-sparkles fa-spin text-sm"></i>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <span>AI Vision &amp; OCR Live Scanning...</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-300 border border-pink-500/20 font-medium">Gemini Lens</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                            Analyzing visual contents, transcribing text, auto-filling document metadata...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isScanning && scanResult && (
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#191a24] text-pink-500 dark:text-pink-400 flex items-center justify-center text-xs border border-white/80 dark:border-white/[0.06] shadow-[1.5px_1.5px_3px_rgba(166,175,195,0.3),-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                            <i className="fas fa-wand-magic-sparkles"></i>
                                        </div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            AI Scanned Content &amp; Explanation
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            {scanResult.confidence_score || 95}% Match
                                        </span>
                                    </div>
                                    {selectedFiles.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                lastScannedKeyRef.current = null;
                                                runScan(selectedFiles[0]);
                                            }}
                                            className="px-2.5 py-1 rounded-xl text-[11px] text-pink-600 dark:text-pink-400 font-semibold bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_4px_rgba(166,175,195,0.3),-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                            <i className="fas fa-arrows-rotate text-[10px]"></i>
                                            <span>Re-scan</span>
                                        </button>
                                    )}
                                </div>

                                {scanResult.description && (
                                    <div className="bg-[#e2e8f0]/60 dark:bg-[#101118]/80 p-3 rounded-xl border border-slate-200/60 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] text-xs">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                                            <i className="fas fa-eye text-pink-500"></i>
                                            <span>Image Explanation &amp; Content</span>
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                                            {scanResult.description}
                                        </p>
                                    </div>
                                )}

                                {Array.isArray(scanResult.visual_objects) && scanResult.visual_objects.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                                            <i className="fas fa-cube text-purple-500"></i>
                                            <span>Visual Objects Recognized</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {scanResult.visual_objects.map((obj: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#ebf0f7] dark:bg-[#191a24] text-purple-600 dark:text-purple-300 border border-white/70 dark:border-white/[0.06] shadow-[1px_1px_2px_rgba(166,175,195,0.25)]"
                                                >
                                                    {obj}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {scanResult.text && (
                                    <div className="bg-[#e2e8f0]/60 dark:bg-[#101118]/80 p-3 rounded-xl border border-slate-200/60 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                <i className="fas fa-file-lines text-blue-500"></i>
                                                <span>Extracted OCR Text</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowOcrText(!showOcrText)}
                                                className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline font-semibold"
                                            >
                                                {showOcrText ? "Collapse" : "Show Full Text"}
                                            </button>
                                        </div>
                                        <p className={`text-[11px] text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed ${showOcrText ? 'max-h-40 overflow-y-auto' : 'line-clamp-2'}`}>
                                            {scanResult.text}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* fields grid */}
                        <div className={`space-y-3.5 pt-1 ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                            {/* Document Title */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Document Title {createWithoutFile && <span className="text-pink-500">*</span>}
                                </label>
                                <input
                                    name="title"
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    disabled={isUploading}
                                    required={createWithoutFile}
                                    placeholder={createWithoutFile ? "e.g. Official Receipt - Supplier ABC" : "Auto-generated from file name or custom title"}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
                                    <select
                                        name="category"
                                        value={docCategory}
                                        onChange={(e) => setDocCategory(e.target.value)}
                                        disabled={isUploading}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <option value="documents" className="dark:bg-slate-900">Documents</option>
                                        <option value="photos" className="dark:bg-slate-900">Photos</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Document Type</label>
                                    <select
                                        name="documentType"
                                        value={docType}
                                        onChange={(e) => setDocType(e.target.value)}
                                        disabled={isUploading}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {STANDARD_DOC_TYPES.map((t) => (
                                            <option key={t} value={t} className="dark:bg-slate-900">{t}</option>
                                        ))}
                                        {docType && !STANDARD_DOC_TYPES.includes(docType) && (
                                            <option value={docType} className="dark:bg-slate-900">{docType} (AI Detected)</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Supplier</label>
                                    <select
                                        name="supplier"
                                        value={selectedSupplierName}
                                        onChange={(e) => setSelectedSupplierName(e.target.value)}
                                        disabled={isUploading}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <option value="" className="dark:bg-slate-900 text-slate-400">Select supplier</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">PO Number</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomPo(!isCustomPo);
                                                setSelectedPoNumber("");
                                            }}
                                            className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline font-semibold"
                                        >
                                            {isCustomPo ? "Choose from list" : "+ Enter custom PO"}
                                        </button>
                                    </div>
                                    {isCustomPo ? (
                                        <input
                                            name="poNumber"
                                            value={selectedPoNumber}
                                            onChange={(e) => setSelectedPoNumber(e.target.value)}
                                            disabled={isUploading}
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:cursor-not-allowed"
                                            placeholder="e.g. PO-2026-0031"
                                        />
                                    ) : (
                                        <select
                                            name="poNumber"
                                            value={selectedPoNumber}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setIsCustomPo(true);
                                                    setSelectedPoNumber("");
                                                } else {
                                                    setSelectedPoNumber(e.target.value);
                                                }
                                            }}
                                            disabled={isUploading}
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            <option value="" className="dark:bg-slate-900 text-slate-400">Select PO Number</option>
                                            {filteredPos.map((po) => (
                                                <option key={po.id || po.po_number} value={po.po_number} className="dark:bg-slate-900">
                                                    {po.po_number} {po.supplier_name ? `(${po.supplier_name})` : ''}
                                                </option>
                                            ))}
                                            <option value="__custom__" className="dark:bg-slate-900 font-semibold text-pink-600 dark:text-pink-400">
                                                + Enter custom PO Number
                                            </option>
                                        </select>
                                    )}
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
                                            value={docPrice}
                                            onChange={(e) => setDocPrice(e.target.value)}
                                            disabled={isUploading}
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 pl-6 pr-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-mono disabled:cursor-not-allowed"
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
                                        disabled={isUploading}
                                        className="w-full bg-[#e2e8f0]/60 dark:bg-[#101118] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)] rounded-lg py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none focus:outline-none"
                                        placeholder="Your name"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Notes</label>
                                    <input
                                        name="notes"
                                        value={docNotes}
                                        onChange={(e) => setDocNotes(e.target.value)}
                                        disabled={isUploading}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-lg py-2 px-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:cursor-not-allowed"
                                        placeholder="Additional details"
                                    />
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
                                disabled={isUploading}
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
                                    {isUploading 
                                        ? 'Uploading & Verifying...' 
                                        : (createWithoutFile
                                            ? 'Create Record (No File)'
                                            : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`)}
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
                    isUploading={isUploading}
                    onClose={() => setIsGridModalOpen(false)}
                    onRemoveFile={(idx) => {
                        if (isUploading) return;
                        if (selectedFiles[idx]) {
                            revokeCachedFilePreviewUrl(selectedFiles[idx]);
                        }
                        onRemoveFile(idx);
                    }}
                    onClearAll={() => {
                        if (isUploading) return;
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
