'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Portal from '../../../components/client/Portal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AppButton } from '../../../components/ui/AppButton';
import { TrashRetentionBadge } from './TrashRetentionBadge';
import EmbeddedDocViewer from '../../../components/ui/EmbeddedDocViewer';
import { supabase } from '../../../lib/services/client/supabase';
import {
    X,
    FileText,
    Copy,
    Check,
    Building2,
    Calendar,
    RotateCcw,
    Trash2,
    Download,
    Eye,
    Tag,
    Info,
    Shield,
    Sparkles,
    Layers,
    Clock,
    Radio,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export interface ArchivedDocument {
    id: string;
    title: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    category: string;
    document_type: string;
    supplier: string | null;
    po_number: string | null;
    parcel_batch: string | null;
    uploaded_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    deleted_at: string;
    deleted_by: string;
    original_id: string;
    role: string | null;
    session_id: string | null;
    user_id?: string | null;
    supplier_id?: number | null;
    file_url?: string | null;
    Price?: string | null;
    extracted?: any;
    extracted_text?: string | null;
    extracted_data?: any;
    force_inserted_by?: string | null;
    document_verification_id?: string | null;
    purchase_id?: string | null;
}

interface ArchivedDocumentViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    doc: ArchivedDocument | null;
    onRestore?: (doc: ArchivedDocument) => Promise<void> | void;
    onPermanentDelete?: (doc: ArchivedDocument) => Promise<void> | void;
}

const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

export function ArchivedDocumentViewModal({
    isOpen,
    onClose,
    doc,
    onRestore,
    onPermanentDelete
}: ArchivedDocumentViewModalProps) {
    const [currentDoc, setCurrentDoc] = useState<ArchivedDocument | null>(doc);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState<boolean>(true);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'preview' | 'metadata' | 'extracted'>('preview');
    const [isRestoring, setIsRestoring] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [realtimePulse, setRealtimePulse] = useState<boolean>(false);

    // Keep currentDoc in sync with prop doc
    useEffect(() => {
        if (doc) {
            setCurrentDoc(doc);
            setIsInitialLoading(true);
            const timer = setTimeout(() => setIsInitialLoading(false), 250);
            return () => clearTimeout(timer);
        } else {
            setCurrentDoc(null);
        }
    }, [doc]);

    // REALTIME SUBSCRIPTION FOR THIS ARCHIVED DOCUMENT
    useEffect(() => {
        if (!isOpen || !currentDoc?.id) return;

        const channelName = `realtime_archived_doc_${currentDoc.id}_${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'documents_archive',
                    filter: `id=eq.${currentDoc.id}`
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        toast.info('This document was purged or removed in realtime.', {
                            icon: <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                        });
                        onClose();
                    } else if (payload.eventType === 'UPDATE' && payload.new) {
                        setCurrentDoc((prev) => ({
                            ...(prev || {}),
                            ...(payload.new as ArchivedDocument)
                        }));
                        setRealtimePulse(true);
                        toast.success('Document updated in realtime', {
                            icon: <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                        });
                        setTimeout(() => setRealtimePulse(false), 2000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, currentDoc?.id, onClose]);

    // Resolve preview url whenever currentDoc changes
    useEffect(() => {
        if (!isOpen || !currentDoc) {
            setPreviewUrl(null);
            setPreviewLoading(false);
            return;
        }

        if (currentDoc.file_url && currentDoc.file_url.startsWith('http')) {
            setPreviewUrl(currentDoc.file_url);
            setPreviewLoading(false);
            return;
        }

        if (currentDoc.storage_path) {
            setPreviewLoading(true);
            try {
                const { data } = supabase.storage
                    .from('documents')
                    .getPublicUrl(currentDoc.storage_path);

                if (data?.publicUrl) {
                    setPreviewUrl(data.publicUrl);
                } else {
                    setPreviewUrl(null);
                }
            } catch (err) {
                console.warn('Error resolving preview URL:', err);
                setPreviewUrl(null);
            } finally {
                setPreviewLoading(false);
            }
        } else {
            setPreviewUrl(null);
            setPreviewLoading(false);
        }
    }, [isOpen, currentDoc]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(label);
        toast.success(`Copied ${label} to clipboard`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownload = async () => {
        if (!currentDoc || isDownloading) return;
        setIsDownloading(true);
        const toastId = toast.loading('Preparing download...');
        try {
            let urlToDownload = previewUrl;

            if (!urlToDownload && currentDoc.storage_path) {
                const { data } = supabase.storage
                    .from('documents')
                    .getPublicUrl(currentDoc.storage_path);
                urlToDownload = data?.publicUrl || null;
            }

            if (!urlToDownload) {
                toast.error('File URL is not available for this record', { id: toastId });
                return;
            }

            const response = await fetch(urlToDownload);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = currentDoc.file_name || `${currentDoc.title}.${(currentDoc.file_type || '').split('/').pop() || 'pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast.success('Download started', { id: toastId });
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download file', { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleRestoreClick = async () => {
        if (!currentDoc || isRestoring || isDeleting) return;
        setIsRestoring(true);
        try {
            if (onRestore) {
                await onRestore(currentDoc);
            }
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!currentDoc || isDeleting || isRestoring) return;
        setIsDeleting(true);
        try {
            if (onPermanentDelete) {
                await onPermanentDelete(currentDoc);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    // Parse extracted data / json
    const parsedExtractedData = useMemo(() => {
        if (!currentDoc) return null;
        if (currentDoc.extracted_data && typeof currentDoc.extracted_data === 'object') return currentDoc.extracted_data;
        if (currentDoc.extracted && typeof currentDoc.extracted === 'object') return currentDoc.extracted;
        try {
            if (typeof currentDoc.extracted_data === 'string') return JSON.parse(currentDoc.extracted_data);
            if (typeof currentDoc.extracted === 'string') return JSON.parse(currentDoc.extracted);
        } catch {
            return null;
        }
        return null;
    }, [currentDoc]);

    if (!isOpen || !currentDoc) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
                {/* Neumorphic Modal Container */}
                <div className={`bg-[#ebf0f7] dark:bg-[#14151e] rounded-3xl shadow-[12px_12px_28px_rgba(166,175,195,0.45),-12px_-12px_28px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_32px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.035)] w-full max-w-6xl max-h-[92vh] flex flex-col border border-white/80 dark:border-white/[0.07] overflow-hidden animate-in zoom-in-95 duration-200 transition-all ${
                    realtimePulse ? 'ring-2 ring-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.3)]' : ''
                }`}>
                    
                    {/* Neumorphic Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/50 dark:border-white/[0.05] bg-[#ebf0f7]/95 dark:bg-[#14151e]/95">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/90 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                                <FileText className="w-5 h-5 text-pink-500" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate max-w-md sm:max-w-xl">
                                        {currentDoc.title || currentDoc.file_name}
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ebf0f7] dark:bg-[#181926] text-pink-600 dark:text-pink-400 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)]">
                                        v{currentDoc.version || 1}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                        {currentDoc.file_name}
                                    </span>
                                    <span>·</span>
                                    <span>{currentDoc.document_type || 'Other'}</span>
                                    <span>·</span>
                                    <span className="capitalize">{currentDoc.category || 'documents'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Realtime Live Pulse Badge & Close Button */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Realtime Sync</span>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isRestoring || isDeleting}
                                className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.55),-2px_-2px_5px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Neumorphic Navigation Tabs Bar */}
                    <div className="px-6 py-2.5 border-b border-slate-200/50 dark:border-white/[0.05] bg-[#ebf0f7]/70 dark:bg-[#14151e]/70 flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/50 dark:border-slate-800/80 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] text-xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                    activeTab === 'preview'
                                        ? 'bg-[#ebf0f7] dark:bg-[#1d1f2c] text-pink-600 dark:text-pink-400 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview & Viewer</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('metadata')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                    activeTab === 'metadata'
                                        ? 'bg-[#ebf0f7] dark:bg-[#1d1f2c] text-pink-600 dark:text-pink-400 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Info className="w-3.5 h-3.5" />
                                <span>Metadata & Audit Details</span>
                            </button>
                            {(currentDoc.extracted_text || parsedExtractedData) && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('extracted')}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        activeTab === 'extracted'
                                            ? 'bg-[#ebf0f7] dark:bg-[#1d1f2c] text-pink-600 dark:text-pink-400 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)]'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Extracted OCR Data</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {previewUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)] hover:text-pink-600 dark:hover:text-pink-400 active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                                    title="Download archived file"
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs sm:text-sm">

                        {/* Archive Retention Banner - Neumorphic Inset Well */}
                        <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-amber-300/40 dark:border-amber-500/25 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.03)] flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#171824] border border-amber-300/60 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                        Archived Document in Trash
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Deleted by <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentDoc.deleted_by || 'Unknown'}</strong> on {formatDate(currentDoc.deleted_at)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <TrashRetentionBadge deletedAt={currentDoc.deleted_at} />
                            </div>
                        </div>

                        {/* INITIAL SKELETON LOADING STATE */}
                        {isInitialLoading ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
                                <div className="lg:col-span-2 h-[480px] rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                                        <p className="text-xs font-semibold text-slate-400">Loading document workspace...</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-44 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]"></div>
                                    <div className="h-44 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Tab 1: Preview & Viewer */}
                                {activeTab === 'preview' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                        {/* Left: Embedded Document Viewer (Neumorphic Inset Display) */}
                                        <div className="lg:col-span-2 flex flex-col">
                                            <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl flex items-center justify-center min-h-[460px] sm:min-h-[520px] flex-1 border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.04)] relative overflow-hidden">
                                                {previewLoading ? (
                                                    <div className="text-center py-12 flex flex-col items-center justify-center">
                                                        <Loader2 className="w-9 h-9 animate-spin text-pink-500 mb-3" />
                                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading document preview...</p>
                                                    </div>
                                                ) : previewUrl ? (
                                                    <EmbeddedDocViewer
                                                        url={previewUrl}
                                                        fileName={currentDoc.file_name}
                                                        title={currentDoc.title}
                                                        fileType={currentDoc.file_type}
                                                        storagePath={currentDoc.storage_path}
                                                        onDownload={handleDownload}
                                                        minHeight="min-h-[460px] sm:min-h-[520px]"
                                                    />
                                                ) : (
                                                    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                                        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#ebf0f7] dark:bg-[#181926] flex items-center justify-center text-slate-400 mb-3 border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)]">
                                                            <FileText className="w-8 h-8 text-pink-500/80" />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">File Preview Not Available</p>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                                                            The physical file attachment was removed or created as a placeholder record.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Quick Summary Sidecards (Neumorphic Raised Cards) */}
                                        <div className="space-y-4 flex flex-col justify-between">
                                            <div className="space-y-4">
                                                {/* Core Properties Card */}
                                                <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] space-y-3">
                                                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                                        <Tag className="w-3.5 h-3.5 text-pink-500" /> Document Specs
                                                    </h4>
                                                    <div className="space-y-2 text-xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">File Size:</span>
                                                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{formatFileSize(currentDoc.file_size)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">MIME Type:</span>
                                                            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={currentDoc.file_type}>
                                                                {currentDoc.file_type || '—'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">Document Type:</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{currentDoc.document_type}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                                            <span className="capitalize text-slate-800 dark:text-slate-200">{currentDoc.category || 'documents'}</span>
                                                        </div>
                                                        {currentDoc.Price && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 dark:text-slate-400">Price / Amount:</span>
                                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{currentDoc.Price}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Supplier & Purchase Order Links Card */}
                                                <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] space-y-3">
                                                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                                        <Building2 className="w-3.5 h-3.5 text-pink-500" /> Supply Chain Context
                                                    </h4>
                                                    <div className="space-y-2 text-xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">Supplier:</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]" title={currentDoc.supplier || '—'}>
                                                                {currentDoc.supplier || '—'}
                                                            </span>
                                                        </div>
                                                        {currentDoc.supplier_id && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 dark:text-slate-400">Supplier ID:</span>
                                                                <span className="font-mono text-slate-800 dark:text-slate-200">{currentDoc.supplier_id}</span>
                                                            </div>
                                                        )}
                                                        {currentDoc.po_number && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 dark:text-slate-400">PO Number:</span>
                                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentDoc.po_number}</span>
                                                            </div>
                                                        )}
                                                        {currentDoc.parcel_batch && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 dark:text-slate-400">Parcel Batch:</span>
                                                                <span className="font-mono text-slate-800 dark:text-slate-200">{currentDoc.parcel_batch}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Notes Card */}
                                                {currentDoc.notes && (
                                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] space-y-1.5">
                                                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                            Notes & Comments
                                                        </h4>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                            {currentDoc.notes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 2: Detailed Metadata & Audit Trail */}
                                {activeTab === 'metadata' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Storage & File Paths Card */}
                                        <div className="p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)] space-y-3.5">
                                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                                <Layers className="w-3.5 h-3.5 text-pink-500" /> Storage & Identification
                                            </h3>
                                            <div className="space-y-2.5 text-xs">
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1 font-medium">Archive ID:</span>
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                                        <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">{currentDoc.id}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(currentDoc.id, 'Archive ID')}
                                                            className="text-slate-400 hover:text-pink-500 ml-2 cursor-pointer"
                                                        >
                                                            {copiedId === 'Archive ID' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1 font-medium">Original Document ID:</span>
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                                        <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">{currentDoc.original_id}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(currentDoc.original_id, 'Original ID')}
                                                            className="text-slate-400 hover:text-pink-500 ml-2 cursor-pointer"
                                                        >
                                                            {copiedId === 'Original ID' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {currentDoc.storage_path && (
                                                    <div>
                                                        <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1 font-medium">Storage Path:</span>
                                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">{currentDoc.storage_path}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(currentDoc.storage_path, 'Storage Path')}
                                                                className="text-slate-400 hover:text-pink-500 ml-2 cursor-pointer"
                                                            >
                                                                {copiedId === 'Storage Path' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {currentDoc.file_url && (
                                                    <div>
                                                        <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1 font-medium">Direct File URL:</span>
                                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">{currentDoc.file_url}</span>
                                                            <a
                                                                href={currentDoc.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-slate-400 hover:text-pink-500 ml-2"
                                                                title="Open in new tab"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Author & System Audit Trail Card */}
                                        <div className="p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)] space-y-3.5">
                                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-white/[0.06]">
                                                <Shield className="w-3.5 h-3.5 text-pink-500" /> Audit Trail & System Tracking
                                            </h3>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Uploaded By:</span>
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">{currentDoc.uploaded_by || 'Unknown'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">Uploader Role:</span>
                                                    <span className="text-slate-800 dark:text-slate-200">{currentDoc.role || '—'}</span>
                                                </div>
                                                {currentDoc.user_id && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">User UUID:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={currentDoc.user_id}>
                                                            {currentDoc.user_id}
                                                        </span>
                                                    </div>
                                                )}
                                                {currentDoc.session_id && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Session ID:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={currentDoc.session_id}>
                                                            {currentDoc.session_id}
                                                        </span>
                                                    </div>
                                                )}
                                                {currentDoc.force_inserted_by && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Force Inserted By:</span>
                                                        <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 truncate max-w-[160px]" title={currentDoc.force_inserted_by}>
                                                            {currentDoc.force_inserted_by}
                                                        </span>
                                                    </div>
                                                )}
                                                {currentDoc.document_verification_id && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Verification ID:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={currentDoc.document_verification_id}>
                                                            {currentDoc.document_verification_id}
                                                        </span>
                                                    </div>
                                                )}
                                                {currentDoc.purchase_id && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Linked Purchase ID:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={currentDoc.purchase_id}>
                                                            {currentDoc.purchase_id}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/[0.06] space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Created:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{formatDate(currentDoc.created_at)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Last Updated:</span>
                                                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{formatDate(currentDoc.updated_at)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400">Archived Date:</span>
                                                        <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formatDate(currentDoc.deleted_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 3: Extracted OCR Data */}
                                {activeTab === 'extracted' && (
                                    <div className="space-y-4">
                                        {currentDoc.extracted_text && (
                                            <div className="p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)] space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                        <FileText className="w-3.5 h-3.5 text-pink-500" /> Extracted Text (OCR)
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(currentDoc.extracted_text || '', 'Extracted Text')}
                                                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-pink-500 flex items-center gap-1 font-semibold cursor-pointer"
                                                    >
                                                        {copiedId === 'Extracted Text' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                        <span>Copy Text</span>
                                                    </button>
                                                </div>
                                                <div className="p-4 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] max-h-72 overflow-y-auto">
                                                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                        {currentDoc.extracted_text}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}

                                        {parsedExtractedData && (
                                            <div className="p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6)] space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                        <Sparkles className="w-3.5 h-3.5 text-pink-500" /> Structured Key-Value Extraction
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(JSON.stringify(parsedExtractedData, null, 2), 'JSON Data')}
                                                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-pink-500 flex items-center gap-1 font-semibold cursor-pointer"
                                                    >
                                                        {copiedId === 'JSON Data' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                        <span>Copy JSON</span>
                                                    </button>
                                                </div>
                                                <div className="p-4 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] max-h-72 overflow-y-auto">
                                                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                        {JSON.stringify(parsedExtractedData, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Neumorphic Footer Actions Bar */}
                    <div className="px-6 py-4 border-t border-slate-200/50 dark:border-white/[0.05] bg-[#ebf0f7]/95 dark:bg-[#14151e]/95 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>Status:</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">Soft-Deleted in Trash</span>
                        </div>

                        <div className="flex items-center gap-3">
                            {onRestore && (
                                <button
                                    type="button"
                                    onClick={handleRestoreClick}
                                    disabled={isRestoring || isDeleting}
                                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-emerald-300/60 dark:border-emerald-700/50 shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-emerald-800 dark:hover:text-emerald-200 active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                                >
                                    {isRestoring ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isRestoring ? 'Restoring...' : 'Restore Document'}</span>
                                </button>
                            )}

                            {onPermanentDelete && (
                                <button
                                    type="button"
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting || isRestoring}
                                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-rose-300/60 dark:border-rose-700/50 shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-rose-800 dark:hover:text-rose-200 active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isRestoring || isDeleting}
                                className="px-4.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:opacity-60"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
