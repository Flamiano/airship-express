// modal for viewing and managing selected files in a responsive visual grid with cached live previews and lazy rendering
'use client';

import React, { useState } from 'react';
import { formatFileSize, getFileColor, getFileIcon } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

// Global cache for File object URLs to prevent re-creation, flickering, and redundant memory consumption
const previewUrlCache = new Map<string, string>();

/**
 * Returns a cached Object URL for a File. If not cached yet, creates and caches it.
 */
export function getCachedFilePreviewUrl(file: File): string {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    let cachedUrl = previewUrlCache.get(cacheKey);
    if (!cachedUrl) {
        cachedUrl = URL.createObjectURL(file);
        previewUrlCache.set(cacheKey, cachedUrl);
    }
    return cachedUrl;
}

/**
 * Revokes and deletes a specific File from the preview cache
 */
export function revokeCachedFilePreviewUrl(file: File): void {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    const url = previewUrlCache.get(cacheKey);
    if (url) {
        URL.revokeObjectURL(url);
        previewUrlCache.delete(cacheKey);
    }
}

/**
 * Revokes all cached Object URLs and clears the cache
 */
export function clearAllCachedFilePreviewUrls(): void {
    previewUrlCache.forEach((url) => {
        try {
            URL.revokeObjectURL(url);
        } catch {
            // ignore cleanup errors
        }
    });
    previewUrlCache.clear();
}

interface SelectedFilesGridModalProps {
    isOpen: boolean;
    files: File[];
    maxFiles?: number;
    onClose: () => void;
    onRemoveFile: (index: number) => void;
    onClearAll?: () => void;
}

export function SelectedFilesGridModal({
    isOpen,
    files,
    maxFiles = 10,
    onClose,
    onRemoveFile,
    onClearAll,
}: SelectedFilesGridModalProps) {
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    // Only render when open
    if (!isOpen) return null;

    const handleRemove = (index: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const fileToRemove = files[index];
        if (fileToRemove) {
            revokeCachedFilePreviewUrl(fileToRemove);
        }
        if (previewFile && fileToRemove === previewFile) {
            setPreviewFile(null);
        }
        onRemoveFile(index);
    };

    const handleClearAll = () => {
        files.forEach((f) => revokeCachedFilePreviewUrl(f));
        setPreviewFile(null);
        if (onClearAll) {
            onClearAll();
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[100000] bg-slate-950/65 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-grid-2 text-sm"></i>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                        Selected Files Review
                                    </h3>
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                        {files.length} / {maxFiles} Max
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Review, preview, or remove files before uploading
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {onClearAll && files.length > 0 && (
                                <AppButton
                                    type="button"
                                    variant="danger"
                                    size="xs"
                                    onClick={onClearAll}
                                    title="Remove all selected files"
                                >
                                    <i className="fas fa-trash-can text-xs"></i>
                                    <span>Clear All</span>
                                </AppButton>
                            )}
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
                    </div>

                    {/* Content Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {files.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] flex items-center justify-center text-2xl mb-3 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                                    <i className="fas fa-folder-open text-pink-500"></i>
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No files selected</p>
                                <p className="text-xs mt-1">Select or drop up to {maxFiles} files in the upload window</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                                {files.map((file, index) => {
                                    const isImage = file.type.startsWith('image/');
                                    const fileExt = file.name.split('.').pop() || '';
                                    const previewUrl = isImage ? getCachedFilePreviewUrl(file) : null;

                                    return (
                                        <div
                                            key={`${file.name}-${file.size}-${index}`}
                                            className="group relative flex flex-col bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl p-3 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.4)] hover:border-pink-500/50 transition-all"
                                        >
                                            {/* Top Preview/Icon Area */}
                                            <div
                                                onClick={() => setPreviewFile(file)}
                                                className="w-full h-28 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden cursor-pointer relative"
                                            >
                                                {isImage && previewUrl ? (
                                                    <img
                                                        src={previewUrl}
                                                        alt={file.name}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1.5 p-2 text-center">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border ${getFileColor(file.type || fileExt)}`}>
                                                            <i className={`fas ${getFileIcon(file.type || fileExt)}`}></i>
                                                        </div>
                                                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                                                            .{fileExt}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-[11px] font-bold text-white flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm">
                                                        <i className="fas fa-eye text-xs"></i> View
                                                    </span>
                                                </div>

                                                {/* Index badge */}
                                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono font-bold">
                                                    #{index + 1}
                                                </div>
                                            </div>

                                            {/* File Info */}
                                            <div className="mt-2.5 min-w-0">
                                                <div
                                                    className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate"
                                                    title={file.name}
                                                >
                                                    {file.name}
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                                    <span>{formatFileSize(file.size)}</span>
                                                    <span className="font-mono text-[10px] uppercase text-pink-600 dark:text-pink-400 font-bold">
                                                        {fileExt}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Remove Button */}
                                            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex justify-end">
                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="xs"
                                                    className="w-full text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
                                                    onClick={(e) => handleRemove(index, e)}
                                                >
                                                    <i className="fas fa-trash-alt text-[10px]"></i>
                                                    <span>Remove</span>
                                                </AppButton>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/40 dark:bg-[#14151e]/40">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <strong className="text-slate-800 dark:text-slate-200">{files.length}</strong> of max <strong className="text-slate-800 dark:text-slate-200">{maxFiles}</strong> allowed files
                        </div>
                        <AppButton
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={onClose}
                        >
                            <span>Done Reviewing</span>
                        </AppButton>
                    </div>

                    {/* Lightbox - only mounted and rendered when actively viewing a file */}
                    {previewFile && (
                        <div 
                            className="fixed inset-0 z-[100010] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
                            onClick={() => setPreviewFile(null)}
                        >
                            <div 
                                className="bg-[#161722] rounded-3xl max-w-3xl w-full max-h-[85vh] p-4 flex flex-col border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-white">
                                    <div className="min-w-0 pr-4">
                                        <div className="font-bold text-sm truncate">{previewFile.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{formatFileSize(previewFile.size)}</div>
                                    </div>
                                    <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setPreviewFile(null)}>
                                        <i className="fas fa-times text-xs"></i>
                                    </AppButton>
                                </div>
                                <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] max-h-[60vh] bg-black/40 rounded-2xl p-2">
                                    {previewFile.type.startsWith('image/') ? (
                                        <img
                                            src={getCachedFilePreviewUrl(previewFile)}
                                            alt={previewFile.name}
                                            className="max-w-full max-h-[58vh] object-contain rounded-lg shadow-lg"
                                        />
                                    ) : previewFile.type === 'application/pdf' ? (
                                        <iframe
                                            src={getCachedFilePreviewUrl(previewFile)}
                                            title={previewFile.name}
                                            className="w-full h-[58vh] rounded-lg border-0"
                                        />
                                    ) : (
                                        <div className="text-center p-8 text-slate-300">
                                            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-3xl mb-3">
                                                <i className={`fas ${getFileIcon(previewFile.type)}`}></i>
                                            </div>
                                            <p className="font-bold text-sm">{previewFile.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">Direct preview for this file type will be available once uploaded.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </Portal>
    );
}
