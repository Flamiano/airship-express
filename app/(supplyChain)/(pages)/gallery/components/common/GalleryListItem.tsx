// saved/cache gallery list item component for list view
'use client';

import React, { memo } from 'react';
import { Eye, Download, Image as ImageIcon, Calendar, User, HardDrive } from 'lucide-react';
import { MediaItem } from '../../types';
import { imageCache } from '../../utils/imageCache';
import { AppButton } from '../../../../components/ui/AppButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { getFileTypeInfo } from '../../../../components/ui/EmbeddedDocViewer';

export interface GalleryListItemProps {
    item: MediaItem;
    hasError: boolean;
    onPreview: (item: MediaItem) => void;
    onDownload: (item: MediaItem, e: React.MouseEvent) => void;
    onImageError: (id: string) => void;
}

export const GalleryListItem = memo(function GalleryListItem({
    item,
    hasError,
    onPreview,
    onDownload,
    onImageError
}: GalleryListItemProps) {
    const cached = imageCache.get(item.id);
    const typeInfo = getFileTypeInfo(item.file_type, item.title, item.storage_path, item.imageUrl);

    return (
        <div
            className="p-3.5 sm:p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[4px_4px_12px_rgba(166,175,195,0.3),-4px_-4px_12px_rgba(255,255,255,0.9)] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.6)] hover:scale-[1.005] transition-all flex items-center justify-between gap-4 cursor-pointer group"
            onClick={() => onPreview(item)}
        >
            <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shrink-0 overflow-hidden shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)] group-hover:border-pink-500/60 transition-colors">
                    {typeInfo.isImage ? (
                        !hasError ? (
                            <img
                                src={cached?.url || item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                onError={() => onImageError(item.id)}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon className="w-5 h-5 text-slate-400" />
                            </div>
                        )
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${typeInfo.colorClasses.bg}`}>
                            <i className={`${typeInfo.icon} text-lg sm:text-xl ${typeInfo.colorClasses.text}`} />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                            {item.title}
                        </h3>
                        {item.po_number && (
                            <StatusBadge tone="pink" size="xs">
                                <span className="font-mono">PO: {item.po_number}</span>
                            </StatusBadge>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        <StatusBadge tone="pink" icon="fas fa-tag" size="xs">
                            {item.category}
                        </StatusBadge>

                        {item.supplier && (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                <User className="w-3 h-3 text-slate-400" />
                                {item.supplier}
                            </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                            <HardDrive className="w-3 h-3 text-slate-400" />
                            {item.fileSize}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                    <img
                        src={item.uploader.avatar}
                        alt={item.uploader.name}
                        className="w-7 h-7 rounded-full border border-slate-200/60 dark:border-slate-700 object-cover shrink-0 shadow-2xs"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 hidden lg:inline">
                        {item.uploader.name}
                    </span>
                </div>

                <div className="hidden md:flex items-center text-slate-400 dark:text-slate-500 font-medium text-[11px]">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span>{item.uploadDate}</span>
                </div>

                <AppButton
                    type="button"
                    variant="pink"
                    size="xs"
                    className="group/btn overflow-hidden transition-all duration-300"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview(item);
                    }}
                    title="Preview image"
                >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[70px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                        Preview
                    </span>
                </AppButton>

                <AppButton
                    type="button"
                    variant="neutral"
                    size="xs"
                    className="group/btn overflow-hidden transition-all duration-300"
                    onClick={(e) => onDownload(item, e)}
                    title="Download file"
                >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-0 opacity-0 overflow-hidden group-hover/btn:max-w-[80px] group-hover/btn:opacity-100 transition-all duration-300 ease-out whitespace-nowrap">
                        Download
                    </span>
                </AppButton>
            </div>
        </div>
    );
});
