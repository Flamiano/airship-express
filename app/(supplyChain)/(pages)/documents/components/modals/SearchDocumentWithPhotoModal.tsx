// interactive modal for Google Lens style photo/document search across system database
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera,
    Upload,
    X,
    FileText,
    Image as ImageIcon,
    Search,
    CheckCircle2,
    AlertCircle,
    Download,
    Eye,
    Building2,
    Receipt,
    Sparkles,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import { user } from '../../../../lib/services/Class/user';
import { Document } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

export interface MatchedDocumentResult {
    id: string;
    title: string;
    file_name: string;
    category: string;
    document_type: string;
    supplier: string;
    po_number: string;
    parcel_batch?: string | null;
    uploaded_by: string;
    created_at: string;
    storage_path?: string | null;
    public_url?: string | null;
    file_url?: string | null;
    file_type?: string;
    file_size?: number | null;
    notes?: string | null;
    source_type?: string;
    target_label?: string;
    is_gallery: boolean;
    view_link?: string;
    price?: string | null;
    match_score?: number;
    match_reason?: string;
    matched_criteria?: {
        label: string;
        inserted_value: string;
        matched_value: string;
    }[];
    extracted?: {
        text?: string | null;
        description?: string | null;
        visual_objects?: string[];
        vendor_name?: string | null;
        po_number?: string | null;
        price?: string | null;
        document_type?: string | null;
        category?: string | null;
        [key: string]: any;
    } | null;
}

interface SearchDocumentWithPhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onViewDocument?: (doc: Document) => void;
    onApplySearchTerm?: (term: string) => void;
    onSelectSupplier?: (supplierName: string) => void;
}

export function SearchDocumentWithPhotoModal({
    isOpen,
    onClose,
    onViewDocument,
    onApplySearchTerm,
    onSelectSupplier,
}: SearchDocumentWithPhotoModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [userNotes, setUserNotes] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchProgressStep, setSearchProgressStep] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [matchedDocuments, setMatchedDocuments] = useState<MatchedDocumentResult[]>([]);
    const [analysisResult, setAnalysisResult] = useState<any | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [showExtractedDetails, setShowExtractedDetails] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // reset state
    const handleReset = useCallback(() => {
        setSelectedFile(null);
        setFilePreview(null);
        setUserNotes('');
        setIsSearching(false);
        setSearchProgressStep('');
        setErrorMessage(null);
        setMatchedDocuments([]);
        setAnalysisResult(null);
        setHasSearched(false);
        setShowExtractedDetails(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // handle file selection
    const handleFile = useCallback((file: File) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('File size must be under 10MB.');
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!validTypes.some(t => file.type.includes(t.split('/')[1]))) {
            setErrorMessage('Please select a JPG, PNG, WEBP, or PDF file.');
            return;
        }

        setErrorMessage(null);
        setSelectedFile(file);
        setHasSearched(false);
        setMatchedDocuments([]);
        setAnalysisResult(null);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFilePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }
    }, []);

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    // run photo search
    const executePhotoSearch = async () => {
        if (!selectedFile) return;

        setIsSearching(true);
        setErrorMessage(null);
        setSearchProgressStep('Reading document with Google Lens AI OCR...');

        try {
            // Read file to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });
            reader.readAsDataURL(selectedFile);
            const base64Data = await base64Promise;

            setSearchProgressStep('Analyzing invoice, PO #, and supplier details...');

            const currentRole = user.getRole() || 'User';
            const currentUserName = user.getName() || 'User';
            const currentUserEmail = user.getEmail() || '';
            const currentUserId = user.getUserId() || '';

            const res = await fetch('/ai/api/analyze-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: {
                        name: selectedFile.name,
                        type: selectedFile.type,
                        size: selectedFile.size,
                        base64: base64Data,
                    },
                    mode: 'search_document',
                    userPrompt: userNotes.trim() || `Search document in database with photo: ${selectedFile.name}`,
                    userId: currentUserId,
                    role: currentRole,
                    userName: currentUserName,
                    userEmail: currentUserEmail,
                }),
            });

            const data = await res.json();

            if (res.status === 429 || data.rateLimited) {
                const retrySecs = data.retryAfter || 60;
                setErrorMessage(`Rate limit reached: Document analysis is limited to 3 requests per 5 minutes. Please wait ${retrySecs}s.`);
                return;
            }

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to search database with photo.');
            }

            setAnalysisResult(data.analysis || null);

            const matches: MatchedDocumentResult[] = data.matchedDocuments && data.matchedDocuments.length > 0
                ? data.matchedDocuments
                : (data.matchedDocument ? [data.matchedDocument] : []);

            setMatchedDocuments(matches);
            setHasSearched(true);
        } catch (err: any) {
            console.error('Photo search error:', err);
            setErrorMessage(err.message || 'An error occurred while matching the document.');
        } finally {
            setIsSearching(false);
            setSearchProgressStep('');
        }
    };

    // download matched document
    const handleDownloadMatched = async (doc: MatchedDocumentResult) => {
        const url = doc.public_url || doc.file_url;
        if (!url) return;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = doc.file_name || doc.title || 'document';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            window.open(url, '_blank');
        }
    };

    // convert matched document to Document interface for preview
    const handleViewMatched = (matched: MatchedDocumentResult) => {
        if (onViewDocument) {
            const docObj: Document = {
                id: matched.id,
                title: matched.title || matched.file_name,
                file_name: matched.file_name,
                file_size: matched.file_size || 0,
                file_type: matched.file_type || 'image/jpeg',
                storage_path: matched.storage_path || '',
                category: matched.category || 'documents',
                document_type: matched.document_type || 'Document',
                supplier: matched.supplier || null,
                po_number: matched.po_number || null,
                parcel_batch: matched.parcel_batch || null,
                uploaded_by: matched.uploaded_by || null,
                file_url: matched.file_url || matched.public_url || null,
                notes: matched.notes || null,
                created_at: matched.created_at || new Date().toISOString(),
                updated_at: matched.created_at || new Date().toISOString(),
                version: 1,
                Price: matched.price || null,
                extracted: matched.extracted || null,
            };
            onViewDocument(docObj);
            onClose();
        } else if (matched.public_url || matched.file_url) {
            const targetUrl = matched.public_url || matched.file_url;
            if (targetUrl) {
                window.open(targetUrl, '_blank');
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <AnimatePresence>
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-2xl bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] flex items-center justify-center text-pink-500 dark:text-pink-400 shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>Search Document with Photo</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                            Google Lens AI
                                        </span>
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Upload a photo or receipt to match and identify records in your database
                                    </p>
                                </div>
                            </div>

                            <AppButton
                                type="button"
                                variant="neutral"
                                size="icon-sm"
                                onClick={() => {
                                    handleReset();
                                    onClose();
                                }}
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </AppButton>
                        </div>

                        {/* Content Scrollable Body */}
                        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                                onChange={onFileInputChange}
                                className="hidden"
                            />

                            {/* File Upload / Drag & Drop Area */}
                            {!selectedFile ? (
                                <div
                                    ref={dropZoneRef}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] ${
                                        isDragging
                                            ? 'border-pink-500 bg-pink-500/10'
                                            : 'border-slate-300 dark:border-white/10 hover:border-pink-400 dark:hover:border-pink-500/60'
                                    }`}
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center text-pink-500 dark:text-pink-400">
                                        <Upload className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                            Click to select or drag and drop photo
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                                            Supports JPG, PNG, WEBP, or PDF (Max 10MB)
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        {filePreview ? (
                                            <img
                                                src={filePreview}
                                                alt="Preview"
                                                className="w-14 h-14 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shadow-inner shrink-0"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-xl bg-[#e2e8f0]/60 dark:bg-[#101118] text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)]">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {formatFileSize(selectedFile.size)} • Ready for AI Vision Matching
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] cursor-pointer transition-all"
                                        >
                                            Change
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] transition-all cursor-pointer"
                                            title="Remove photo"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Optional search hint / notes */}
                            {selectedFile && !hasSearched && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Optional Notes or Search Hint:
                                    </label>
                                    <input
                                        type="text"
                                        value={userNotes}
                                        onChange={(e) => setUserNotes(e.target.value)}
                                        placeholder="e.g. Filter by specific supplier or PO number (optional)..."
                                        className="w-full px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-medium"
                                    />
                                </div>
                            )}

                            {/* Error message */}
                            {errorMessage && (
                                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            {/* Searching progress state */}
                            {isSearching && (
                                <div className="p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151e] border border-pink-500/30 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] text-center space-y-3">
                                    <div className="relative w-12 h-12 mx-auto">
                                        <div className="w-12 h-12 rounded-full border-3 border-pink-200 dark:border-pink-900 border-t-pink-600 dark:border-t-pink-500 animate-spin" />
                                        <Sparkles className="w-5 h-5 text-pink-500 absolute inset-0 m-auto animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                            Google Lens Vision Matcher
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 animate-pulse">
                                            {searchProgressStep || 'Scanning image and matching against database records...'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Match Results View */}
                            {hasSearched && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                            <span>Search Results</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                matchedDocuments.length > 0
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}>
                                                {matchedDocuments.length} Record{matchedDocuments.length === 1 ? '' : 's'} Found
                                            </span>
                                        </h3>

                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>New Photo Search</span>
                                        </button>
                                    </div>

                                    {matchedDocuments.length > 0 ? (
                                        <div className="space-y-3">
                                            {matchedDocuments.map((doc, idx) => (
                                                <div
                                                    key={doc.id || idx}
                                                    className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2.5px_2.5px_6px_rgba(166,175,195,0.35),-2.5px_-2.5px_6px_rgba(255,255,255,0.9)] dark:shadow-[2.5px_2.5px_6px_rgba(0,0,0,0.6)] space-y-3 transition-all"
                                                >
                                                    {/* Header info */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            {(doc.public_url || doc.file_url) && (doc.is_gallery || doc.file_type?.startsWith('image/')) ? (
                                                                <img
                                                                    src={doc.public_url || doc.file_url!}
                                                                    alt={doc.title}
                                                                    className="w-12 h-12 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shadow-inner shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-xl bg-[#e2e8f0]/60 dark:bg-[#101118] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)]">
                                                                    <FileText className="w-6 h-6" />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                        {doc.title || doc.file_name}
                                                                    </h4>
                                                                    {doc.match_score ? (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                            {Math.min(99, Math.max(65, doc.match_score))}% Match
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                                                    {doc.supplier && (
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                                            <Building2 className="w-3 h-3 text-pink-500" />
                                                                            {doc.supplier}
                                                                        </span>
                                                                    )}
                                                                    {doc.file_name && (
                                                                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1" title={doc.file_name}>
                                                                            <FileText className="w-3 h-3 text-slate-400" />
                                                                            <span className="truncate max-w-[180px]">{doc.file_name}</span>
                                                                        </span>
                                                                    )}
                                                                    {doc.po_number && (
                                                                        <span className="font-mono text-[11px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                            PO: {doc.po_number}
                                                                        </span>
                                                                    )}
                                                                    {doc.price && (
                                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                                                                            ₱{doc.price}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <StatusBadge tone="emerald" size="xs">
                                                            {doc.document_type || doc.category || 'Matched Record'}
                                                        </StatusBadge>
                                                    </div>

                                                    {/* Match reason & criteria */}
                                                    {doc.match_reason && (
                                                        <div className="p-2.5 rounded-xl bg-[#e2e8f0]/60 dark:bg-[#101118]/80 border border-slate-200/60 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] text-xs text-emerald-800 dark:text-emerald-300">
                                                            <div className="flex items-center gap-1.5 font-bold mb-1">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span>Match Verification:</span>
                                                            </div>
                                                            <p className="text-[11px] leading-relaxed">
                                                                {doc.match_reason}
                                                            </p>
                                                            {doc.matched_criteria && doc.matched_criteria.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t border-slate-300/60 dark:border-white/[0.08] space-y-1">
                                                                    {doc.matched_criteria.map((crit, cIdx) => (
                                                                        <div key={cIdx} className="text-[10px] flex items-center gap-1.5 flex-wrap">
                                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{crit.label}:</span>
                                                                            <span className="bg-[#ebf0f7] dark:bg-[#191a24] border border-white/60 dark:border-white/[0.06] shadow-sm px-1.5 py-0.5 rounded font-mono text-slate-800 dark:text-slate-200">
                                                                                {crit.inserted_value}
                                                                            </span>
                                                                            <span className="text-slate-400">⇄</span>
                                                                            <span className="bg-[#ebf0f7] dark:bg-[#191a24] border border-white/60 dark:border-white/[0.06] shadow-sm px-1.5 py-0.5 rounded font-mono text-slate-800 dark:text-slate-200">
                                                                                {crit.matched_value}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                                        {onApplySearchTerm && (doc.file_name || doc.title || doc.po_number) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (onSelectSupplier && doc.supplier) {
                                                                        onSelectSupplier(doc.supplier);
                                                                    }
                                                                    const termToFilter = doc.file_name || doc.title || doc.po_number;
                                                                    onApplySearchTerm(termToFilter);
                                                                    onClose();
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
                                                                title={`Filter documents list by file name: ${doc.file_name || doc.title}`}
                                                            >
                                                                <Search className="w-3 h-3 text-pink-500" />
                                                                <span>Filter in List</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadMatched(doc)}
                                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            <span>Download</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewMatched(doc)}
                                                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-[2px_2px_6px_rgba(236,72,153,0.35)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>View Document</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] text-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center mx-auto text-slate-400">
                                                <Search className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                    No Exact Database Match Found
                                                </h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed font-medium">
                                                    We analyzed the text and visual content of your photo, but could not find a matching document or purchase order record in the current database.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Extracted OCR inspection toggle */}
                                    {analysisResult && (
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                            <button
                                                type="button"
                                                onClick={() => setShowExtractedDetails(!showExtractedDetails)}
                                                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-2 cursor-pointer"
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Google Lens OCR &amp; Visual Extraction Details</span>
                                                </span>
                                                {showExtractedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>

                                            {showExtractedDetails && (
                                                <div className="mt-2 p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-xs space-y-2 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                                    {analysisResult.document_type && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 dark:text-slate-400">Document Type: </span>
                                                            <span className="text-slate-800 dark:text-white font-semibold">{analysisResult.document_type}</span>
                                                        </div>
                                                    )}
                                                    {analysisResult.supplier && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 dark:text-slate-400">Supplier Detected: </span>
                                                            <span className="text-slate-800 dark:text-white font-semibold">{analysisResult.supplier}</span>
                                                        </div>
                                                    )}
                                                    {analysisResult.po_number && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 dark:text-slate-400">Reference / PO #: </span>
                                                            <span className="text-slate-800 dark:text-white font-mono">{analysisResult.po_number}</span>
                                                        </div>
                                                    )}
                                                    {analysisResult.ocr_text && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Extracted OCR Text:</span>
                                                            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/30 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-200/60 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]">
                                                                {analysisResult.ocr_text}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {analysisResult.visual_objects && analysisResult.visual_objects.length > 0 && (
                                                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">Visual Objects: </span>
                                                            {analysisResult.visual_objects.map((obj: string, i: number) => (
                                                                <span key={i} className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 text-[10px] font-medium">
                                                                    {obj}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 sm:p-6 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                            <button
                                type="button"
                                onClick={() => {
                                    handleReset();
                                    onClose();
                                }}
                                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] cursor-pointer transition-all"
                            >
                                Close
                            </button>

                            {selectedFile && !hasSearched && (
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    onClick={executePhotoSearch}
                                    disabled={isSearching}
                                >
                                    <Camera className="w-4 h-4 mr-1.5" />
                                    <span>{isSearching ? 'Matching...' : 'Search with Photo'}</span>
                                </AppButton>
                            )}
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </Portal>
    );
}
