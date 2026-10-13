// list view item component for supplier documents gallery
'use client';

import React, { memo } from 'react';
import { Eye, Download, Edit, Trash2, Calendar, HardDrive, FileText } from 'lucide-react';
import { Document } from '../../types';
import { getCachedPublicUrl } from '../../utils/imageCache';
import { formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { getFileTypeInfo } from '../../../../components/ui/EmbeddedDocViewer';

export interface SupplierDocumentListItemProps {
    doc: Document;
    onPreview: (doc: Document) => void;
    onDownload: (doc: Document, e?: React.MouseEvent) => void;
    onEdit?: (doc: Document) => void;
    onDelete?: (id: string, title: string) => void;
}

export const SupplierDocumentListItem = memo(function SupplierDocumentListItem({
    doc,
    onPreview,
    onDownload,
    onEdit,
    onDelete,
}: SupplierDocumentListItemProps) {
    const publicUrl = getCachedPublicUrl(doc.storage_path, doc.file_url);
    const typeInfo = getFileTypeInfo(doc.file_type, doc.title, doc.storage_path, publicUrl);

    const formattedDate = doc.created_at
        ? new Date(doc.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : 'Unknown Date';

    return (
        <div
            className="group p-3 sm:p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[4px_4px_12px_rgba(166,175,195,0.3),-4px_-4px_12px_rgba(255,255,255,0.9)] dark:shadow-[6px_6px_18px_rgba(0,0,0,0.7)] hover:border-pink-300 dark:hover:border-pink-800 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer"
            onClick={() => onPreview(doc)}
        >
            {/* thumbnail & main info */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* thumbnail / icon */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shrink-0 flex items-center justify-center relative shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                    {typeInfo.isImage && publicUrl ? (
                        <img
                            src={publicUrl}
                            alt={doc.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${typeInfo.colorClasses.bg}`}>
                            <i className={`${typeInfo.icon} text-xl ${typeInfo.colorClasses.text}`} />
                        </div>
                    )}
                </div>

                {/* text details */}
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4
                            className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors truncate max-w-md"
                            title={doc.title}
                        >
                            {doc.title}
                        </h4>
                        <StatusBadge tone={doc.category === 'photos' ? 'purple' : 'pink'} size="xs">
                            {doc.document_type || doc.category}
                        </StatusBadge>
                        {doc.po_number && (
                            <StatusBadge tone="neutral" size="xs">
                                <span className="font-mono">PO: {doc.po_number}</span>
                            </StatusBadge>
                        )}
                        {doc.Price && (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {doc.Price}
                            </span>
                        )}
                        {doc.extracted?.status === 'processing' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                AI OCR in background...
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        {doc.file_name && doc.file_name !== doc.title && (
                            <span className="font-mono text-[11px] truncate max-w-[200px] text-slate-400">
                                {doc.file_name}
                            </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                            <HardDrive className="w-3 h-3 text-slate-400" />
                            {formatFileSize(doc.file_size || 0)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formattedDate}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">
                            By {doc.uploaded_by || 'System'}
                        </span>
                    </div>
                </div>
            </div>

            {/* action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                <AppButton
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => onPreview(doc)}
                    title="Preview Document"
                >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-xs hidden md:inline">Preview</span>
                </AppButton>
                <AppButton
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={(e) => onDownload(doc, e)}
                    title="Download Document"
                >
                    <Download className="w-3.5 h-3.5" />
                </AppButton>
                {onEdit && (
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="sm"
                        onClick={() => onEdit(doc)}
                        title="Edit Document"
                    >
                        <Edit className="w-3.5 h-3.5" />
                    </AppButton>
                )}
                {onDelete && (
                    <AppButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(doc.id, doc.title)}
                        title="Delete Document"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </AppButton>
                )}
            </div>
        </div>
    );
});
