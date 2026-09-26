// saved/cache gallery card component for grid view
'use client';

import React, { useState, memo } from 'react';
import { Eye, Download, Image as ImageIcon, RefreshCw, Calendar } from 'lucide-react';
import { MediaItem } from '../../types';
import { imageCache } from '../../utils/imageCache';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { getFileTypeInfo } from '../../../../components/ui/EmbeddedDocViewer';

export interface GalleryCardProps {
    item: MediaItem;
    hasError: boolean;
    onPreview: (item: MediaItem) => void;
    onDownload: (item: MediaItem, e: React.MouseEvent) => void;
    onRetry: (id: string, url: string, e: React.MouseEvent) => void;
    onImageError: (id: string) => void;
}

export const GalleryCard = memo(function GalleryCard({
    item,
    hasError,
    onPreview,
    onDownload,
    onRetry,
    onImageError
}: GalleryCardProps) {
    const cached = imageCache.get(item.id);
    const [loaded, setLoaded] = useState<boolean>(cached?.loaded ?? false);
    const typeInfo = getFileTypeInfo(item.file_type, item.title, item.storage_path, item.imageUrl);

    return (
        <div
            className="group p-2 sm:p-2.5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col cursor-pointer"
            onClick={() => onPreview(item)}
        >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)]">
                {typeInfo.isImage ? (
                    <>
                        {!loaded && !hasError && (
                            <div className="absolute inset-0 animate-pulse bg-linear-to-r from-slate-200 dark:from-slate-800 via-slate-100 dark:via-slate-700 to-slate-200 dark:to-slate-800" />
                        )}

                        {!hasError ? (
                            <img
                                src={cached?.url || item.imageUrl}
                                alt={item.title}
                                className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
                                loading="lazy"
                                onLoad={() => {
                                    setLoaded(true);
                                    imageCache.markLoaded(item.id);
                                }}
                                onError={() => onImageError(item.id)}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 p-4 text-center">
                                <ImageIcon className="w-9 h-9 opacity-50 text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-400">Failed to load</span>
                                {imageCache.canRetry(item.id) && (
                                    <AppButton
                                        type="button"
                                        variant="pink"
                                        size="xs"
                                        onClick={(e) => onRetry(item.id, item.imageUrl, e)}
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
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-sm border ${typeInfo.colorClasses.bg} ${typeInfo.colorClasses.border}`}>
                            <i className={`${typeInfo.icon} text-2xl ${typeInfo.colorClasses.text}`} />
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mb-1.5 ${typeInfo.colorClasses.bg} ${typeInfo.colorClasses.text} ${typeInfo.colorClasses.border}`}>
                            {typeInfo.typeName}
                        </span>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-2 max-w-[85%] px-1" title={item.title}>
                            {item.title}
                        </p>
                    </div>
                )}

                <div className="absolute top-2.5 right-2.5">
                    <StatusBadge tone="pink" size="xs">
                        {item.category}
                    </StatusBadge>
                </div>

                {item.supplier && (
                    <div className="absolute bottom-2.5 left-2.5 max-w-[70%]">
                        <StatusBadge tone="neutral" dot size="xs">
                            <span className="truncate">{item.supplier}</span>
                        </StatusBadge>
                    </div>
                )}

                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 rounded-2xl">
                    <AppButton
                        type="button"
                        variant="pink"
                        size="sm"
                        className="group/btn overflow-hidden transition-all duration-300"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(item);
                        }}
                        title="Preview"
                    >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[70px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                            Preview
                        </span>
                    </AppButton>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="sm"
                        className="group/btn overflow-hidden transition-all duration-300"
                        onClick={(e) => onDownload(item, e)}
                        title="Download"
                    >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[80px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                            Download
                        </span>
                    </AppButton>
                </div>
            </div>

            <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1" title={item.title}>
                            {item.title}
                        </h3>
                        {item.po_number && (
                            <StatusBadge tone="pink" size="xs">
                                <span className="font-mono">PO: {item.po_number}</span>
                            </StatusBadge>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <img
                            src={item.uploader.avatar}
                            alt={item.uploader.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200/60 dark:border-slate-700 shrink-0 shadow-2xs"
                        />
                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs truncate leading-none">
                            {item.uploader.name}
                        </p>
                    </div>

                    <div className="flex items-center text-slate-400 dark:text-slate-500 shrink-0 gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.uploadDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
