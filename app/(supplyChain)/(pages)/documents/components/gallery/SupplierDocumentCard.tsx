// gallery card component for supplier documents and media with image preview, badges, and action buttons
'use client';

import React, { useState, memo } from 'react';
import { Eye, Download, Image as ImageIcon, RefreshCw, Calendar, Edit, Trash2, Tag, DollarSign } from 'lucide-react';
import { Document } from '../../types';
import { imageCache, getCachedPublicUrl } from '../../utils/imageCache';
import { formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { getFileTypeInfo } from '../../../../components/ui/EmbeddedDocViewer';

export interface SupplierDocumentCardProps {
    doc: Document;
    onPreview: (doc: Document) => void;
    onDownload: (doc: Document, e?: React.MouseEvent) => void;
    onEdit?: (doc: Document) => void;
    onDelete?: (id: string, title: string) => void;
}

export const SupplierDocumentCard = memo(function SupplierDocumentCard({
    doc,
    onPreview,
    onDownload,
    onEdit,
    onDelete,
}: SupplierDocumentCardProps) {
    const publicUrl = getCachedPublicUrl(doc.storage_path, doc.file_url);
    const cached = imageCache.get(doc.id);
    const [loaded, setLoaded] = useState<boolean>(cached?.loaded ?? false);
    const [hasError, setHasError] = useState<boolean>(false);

    const typeInfo = getFileTypeInfo(doc.file_type, doc.title, doc.storage_path, publicUrl);

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHasError(false);
        setLoaded(false);
        imageCache.set(doc.id, publicUrl);
    };

    const formattedDate = doc.created_at
        ? new Date(doc.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : 'Unknown Date';

    return (
        <div
            className="group p-2 sm:p-2.5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col cursor-pointer"
            onClick={() => onPreview(doc)}
        >
            {/* thumbnail container */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                {typeInfo.isImage ? (
                    <>
                        {!loaded && !hasError && (
                            <div className="absolute inset-0 animate-pulse bg-linear-to-r from-slate-200 dark:from-slate-800 via-slate-100 dark:via-slate-700 to-slate-200 dark:to-slate-800" />
                        )}

                        {!hasError ? (
                            <img
                                src={publicUrl}
                                alt={doc.title}
                                className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ease-out ${
                                    loaded ? 'opacity-100' : 'opacity-0'
                                }`}
                                loading="lazy"
                                onLoad={() => {
                                    setLoaded(true);
                                    imageCache.markLoaded(doc.id);
                                }}
                                onError={() => {
                                    setHasError(true);
                                    imageCache.markError(doc.id);
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 p-4 text-center">
                                <ImageIcon className="w-9 h-9 opacity-50 text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-400">Failed to load</span>
                                {imageCache.canRetry(doc.id) && (
                                    <AppButton
                                        type="button"
                                        variant="pink"
                                        size="xs"
                                        onClick={handleRetry}
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Retry</span>
                                    </AppButton>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center select-none relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                        <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-sm border ${typeInfo.colorClasses.bg} ${typeInfo.colorClasses.border}`}
                        >
                            <i className={`${typeInfo.icon} text-2xl ${typeInfo.colorClasses.text}`} />
                        </div>
                        <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mb-1.5 ${typeInfo.colorClasses.bg} ${typeInfo.colorClasses.text} ${typeInfo.colorClasses.border}`}
                        >
                            {typeInfo.typeName}
                        </span>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-2 max-w-[85%] px-1" title={doc.title}>
                            {doc.title}
                        </p>
                    </div>
                )}

                {/* category badge top right */}
                <div className="absolute top-2.5 right-2.5">
                    <StatusBadge tone={doc.category === 'photos' ? 'purple' : 'pink'} size="xs">
                        {doc.document_type || doc.category}
                    </StatusBadge>
                </div>

                {/* file size badge top left */}
                <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-xs">
                        {formatFileSize(doc.file_size || 0)}
                    </span>
                </div>

                {/* PO badge bottom left */}
                {doc.po_number && (
                    <div className="absolute bottom-2.5 left-2.5 max-w-[70%]">
                        <StatusBadge tone="neutral" dot size="xs">
                            <span className="truncate font-mono">PO: {doc.po_number}</span>
                        </StatusBadge>
                    </div>
                )}

                {/* background OCR indicator */}
                {doc.extracted?.status === 'processing' && (
                    <div className="absolute bottom-2.5 right-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-md shadow-xs animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            AI OCR...
                        </span>
                    </div>
                )}

                {/* hover action buttons overlay */}
                <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 rounded-2xl">
                    <AppButton
                        type="button"
                        variant="pink"
                        size="sm"
                        className="group/btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(doc);
                        }}
                        title="Preview Document"
                    >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs">Preview</span>
                    </AppButton>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(doc, e);
                        }}
                        title="Download Document"
                    >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                    </AppButton>
                    {onEdit && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(doc);
                            }}
                            title="Edit Document"
                        >
                            <Edit className="w-3.5 h-3.5 shrink-0" />
                        </AppButton>
                    )}
                    {onDelete && (
                        <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(doc.id, doc.title);
                            }}
                            title="Delete Document"
                        >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </AppButton>
                    )}
                </div>
            </div>

            {/* card description & metadata */}
            <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                <div>
                    <h3
                        className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1"
                        title={doc.title}
                    >
                        {doc.title}
                    </h3>
                    {doc.file_name && doc.file_name !== doc.title && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                            {doc.file_name}
                        </p>
                    )}
                    {doc.Price && (
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-1">
                            <span>Amount:</span>
                            <span>{doc.Price}</span>
                        </p>
                    )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                doc.uploaded_by || 'User'
                            )}&background=random&size=48`}
                            alt={doc.uploaded_by || 'User'}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200/60 dark:border-slate-700 shrink-0"
                        />
                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs truncate leading-none">
                            {doc.uploaded_by || 'System'}
                        </p>
                    </div>

                    <div className="flex items-center text-slate-400 dark:text-slate-500 shrink-0 gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formattedDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
