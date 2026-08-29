'use client';

import React, { useState, useEffect } from 'react';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';

export interface FileTypeInfo {
    isPdf: boolean;
    isDoc: boolean;
    isWord: boolean;
    isExcel: boolean;
    isPowerPoint: boolean;
    isText: boolean;
    isImage: boolean;
    category: 'pdf' | 'doc' | 'image' | 'text' | 'other';
    typeName: string;
    icon: string;
    colorClasses: {
        bg: string;
        text: string;
        border: string;
    };
}

export function getFileTypeInfo(
    fileType?: string,
    fileName?: string,
    storagePath?: string,
    url?: string
): FileTypeInfo {
    const type = (fileType || '').toLowerCase();
    const name = (fileName || '').toLowerCase();
    const path = (storagePath || '').toLowerCase();
    const cleanUrl = (url || '').split('?')[0].toLowerCase();

    const isPdf =
        type.includes('pdf') ||
        name.endsWith('.pdf') ||
        path.endsWith('.pdf') ||
        cleanUrl.endsWith('.pdf');

    const isWord =
        type.includes('word') ||
        type.includes('officedocument.wordprocessingml') ||
        type.includes('msword') ||
        name.endsWith('.doc') ||
        name.endsWith('.docx') ||
        name.endsWith('.rtf') ||
        name.endsWith('.odt') ||
        path.endsWith('.doc') ||
        path.endsWith('.docx') ||
        path.endsWith('.rtf') ||
        path.endsWith('.odt') ||
        cleanUrl.endsWith('.doc') ||
        cleanUrl.endsWith('.docx');

    const isExcel =
        type.includes('excel') ||
        type.includes('officedocument.spreadsheetml') ||
        type.includes('spreadsheet') ||
        type.includes('csv') ||
        name.endsWith('.xls') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.csv') ||
        name.endsWith('.ods') ||
        path.endsWith('.xls') ||
        path.endsWith('.xlsx') ||
        path.endsWith('.csv') ||
        cleanUrl.endsWith('.xls') ||
        cleanUrl.endsWith('.xlsx') ||
        cleanUrl.endsWith('.csv');

    const isPowerPoint =
        type.includes('presentation') ||
        type.includes('powerpoint') ||
        name.endsWith('.ppt') ||
        name.endsWith('.pptx') ||
        name.endsWith('.odp') ||
        path.endsWith('.ppt') ||
        path.endsWith('.pptx') ||
        cleanUrl.endsWith('.ppt') ||
        cleanUrl.endsWith('.pptx');

    const isText =
        type.includes('text/plain') ||
        name.endsWith('.txt') ||
        path.endsWith('.txt') ||
        cleanUrl.endsWith('.txt');

    const isDoc = isWord || isExcel || isPowerPoint || isText;

    const isImage =
        !isPdf &&
        !isDoc &&
        (type.includes('image') ||
            type.includes('jpg') ||
            type.includes('jpeg') ||
            type.includes('png') ||
            type.includes('gif') ||
            type.includes('webp') ||
            type.includes('svg') ||
            type.includes('heic') ||
            name.endsWith('.jpg') ||
            name.endsWith('.jpeg') ||
            name.endsWith('.png') ||
            name.endsWith('.gif') ||
            name.endsWith('.webp') ||
            name.endsWith('.svg') ||
            name.endsWith('.heic') ||
            path.endsWith('.jpg') ||
            path.endsWith('.jpeg') ||
            path.endsWith('.png') ||
            path.endsWith('.gif') ||
            path.endsWith('.webp') ||
            path.endsWith('.svg') ||
            path.endsWith('.heic') ||
            cleanUrl.endsWith('.jpg') ||
            cleanUrl.endsWith('.jpeg') ||
            cleanUrl.endsWith('.png') ||
            cleanUrl.endsWith('.gif') ||
            cleanUrl.endsWith('.webp') ||
            cleanUrl.endsWith('.svg') ||
            cleanUrl.endsWith('.heic'));

    let typeName = 'File';
    let icon = 'fas fa-file';
    let colorClasses = {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700'
    };

    if (isPdf) {
        typeName = 'PDF Document';
        icon = 'fas fa-file-pdf';
        colorClasses = {
            bg: 'bg-rose-50 dark:bg-rose-950/40',
            text: 'text-rose-600 dark:text-rose-400',
            border: 'border-rose-200 dark:border-rose-800/50'
        };
    } else if (isWord) {
        typeName = 'Word Document';
        icon = 'fas fa-file-word';
        colorClasses = {
            bg: 'bg-blue-50 dark:bg-blue-950/40',
            text: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800/50'
        };
    } else if (isExcel) {
        typeName = 'Spreadsheet';
        icon = 'fas fa-file-excel';
        colorClasses = {
            bg: 'bg-emerald-50 dark:bg-emerald-950/40',
            text: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-800/50'
        };
    } else if (isPowerPoint) {
        typeName = 'Presentation';
        icon = 'fas fa-file-powerpoint';
        colorClasses = {
            bg: 'bg-amber-50 dark:bg-amber-950/40',
            text: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-200 dark:border-amber-800/50'
        };
    } else if (isText) {
        typeName = 'Text Document';
        icon = 'fas fa-file-lines';
        colorClasses = {
            bg: 'bg-slate-50 dark:bg-slate-800/50',
            text: 'text-slate-600 dark:text-slate-300',
            border: 'border-slate-200 dark:border-slate-700'
        };
    } else if (isImage) {
        typeName = 'Image';
        icon = 'fas fa-file-image';
        colorClasses = {
            bg: 'bg-purple-50 dark:bg-purple-950/40',
            text: 'text-purple-600 dark:text-purple-400',
            border: 'border-purple-200 dark:border-purple-800/50'
        };
    }

    return {
        isPdf,
        isDoc,
        isWord,
        isExcel,
        isPowerPoint,
        isText,
        isImage,
        category: isPdf ? 'pdf' : isDoc ? 'doc' : isImage ? 'image' : isText ? 'text' : 'other',
        typeName,
        icon,
        colorClasses
    };
}

export interface EmbeddedDocViewerProps {
    url: string | null;
    fileName?: string;
    title?: string;
    fileType?: string;
    storagePath?: string;
    className?: string;
    minHeight?: string;
    onDownload?: () => void;
    // Optional image zoom/pan controls support when rendering images
    zoom?: number;
    rotation?: number;
    pan?: { x: number; y: number };
    onImageError?: () => void;
    showViewerSwitch?: boolean;
}

export default function EmbeddedDocViewer({
    url,
    fileName,
    title,
    fileType,
    storagePath,
    className = '',
    minHeight = 'min-h-[480px]',
    onDownload,
    zoom = 1,
    rotation = 0,
    pan = { x: 0, y: 0 },
    onImageError,
    showViewerSwitch = true,
}: EmbeddedDocViewerProps) {
    const [viewerEngine, setViewerEngine] = useState<'google' | 'direct' | 'office'>('direct');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);

    const typeInfo = getFileTypeInfo(fileType, fileName, storagePath, url || undefined);

    // Default engine: Google docs viewer for docx/xlsx/pptx/rtf/odt, direct for pdf/images
    useEffect(() => {
        if (typeInfo.isDoc) {
            setViewerEngine('google');
        } else {
            setViewerEngine('direct');
        }
        setIsLoading(true);
        setHasError(false);
    }, [url, fileType, fileName, storagePath]);

    if (!url) {
        return (
            <div className={`w-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 ${minHeight} ${className}`}>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-inner">
                    <i className="fas fa-file-circle-xmark text-3xl" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No document URL available</p>
                <p className="text-xs text-slate-400 mt-1">Unable to locate file source for preview</p>
            </div>
        );
    }

    const encodedUrl = encodeURIComponent(url);

    let embedSrc = url;
    if (typeInfo.isPdf) {
        if (viewerEngine === 'google') {
            embedSrc = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        } else if (viewerEngine === 'office') {
            embedSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
        } else {
            embedSrc = `${url}#toolbar=1&navpanes=0`;
        }
    } else if (typeInfo.isDoc) {
        if (viewerEngine === 'office') {
            embedSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
        } else if (viewerEngine === 'direct') {
            embedSrc = url;
        } else {
            embedSrc = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        }
    }

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    return (
        <div className={`w-full h-full flex flex-col relative overflow-hidden select-none ${className}`}>
            {/* Top Toolbar for Embedded Documents & PDFs */}
            {(typeInfo.isPdf || typeInfo.isDoc) && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 text-xs shrink-0 rounded-t-xl">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-semibold text-[11px] border ${typeInfo.colorClasses.bg} ${typeInfo.colorClasses.text} ${typeInfo.colorClasses.border}`}>
                            <i className={typeInfo.icon} />
                            <span>{typeInfo.typeName}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px] sm:max-w-xs hidden sm:inline" title={fileName || title}>
                            {fileName || title || 'Document Preview'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {showViewerSwitch && (typeInfo.isPdf || typeInfo.isDoc) && (
                            <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                                {typeInfo.isPdf && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewerEngine('direct');
                                            setIsLoading(true);
                                        }}
                                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${viewerEngine === 'direct'
                                                ? 'bg-pink-500 text-white shadow-2xs font-semibold'
                                                : 'text-slate-600 dark:text-slate-300 hover:text-pink-600'
                                            }`}
                                    >
                                        Native
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewerEngine('google');
                                        setIsLoading(true);
                                    }}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${viewerEngine === 'google'
                                            ? 'bg-pink-500 text-white shadow-2xs font-semibold'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-pink-600'
                                        }`}
                                >
                                    Google Docs
                                </button>
                                {typeInfo.isDoc && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewerEngine('office');
                                            setIsLoading(true);
                                        }}
                                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${viewerEngine === 'office'
                                                ? 'bg-pink-500 text-white shadow-2xs font-semibold'
                                                : 'text-slate-600 dark:text-slate-300 hover:text-pink-600'
                                            }`}
                                    >
                                        Office Live
                                    </button>
                                )}
                            </div>
                        )}

                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                            title="Open in new window"
                        >
                            <i className="fas fa-external-link-alt text-[10px]" />
                            <span className="hidden sm:inline">Open Tab</span>
                        </a>

                        {onDownload && (
                            <button
                                type="button"
                                onClick={onDownload}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/50 border border-pink-200 dark:border-pink-800/50 transition-colors cursor-pointer shadow-2xs"
                                title="Download File"
                            >
                                <i className="fas fa-download text-[10px]" />
                                <span className="hidden sm:inline">Download</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Viewer Content Frame */}
            <div className={`relative flex-1 w-full h-full flex items-center justify-center bg-slate-950/90 dark:bg-slate-950 overflow-hidden ${minHeight}`}>
                {isLoading && (typeInfo.isPdf || typeInfo.isDoc) && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-xs text-slate-300 gap-3">
                        <div className="w-9 h-9 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                        <div className="text-center">
                            <p className="text-xs font-semibold text-white">Loading Embedded {typeInfo.typeName}...</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Rendering document preview</p>
                        </div>
                    </div>
                )}

                {hasError ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-center p-6 max-w-md">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                            <i className="fas fa-triangle-exclamation text-2xl" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white">Could not embed document</h4>
                            <p className="text-xs text-slate-400 mt-1">
                                The file format may require direct download or browser viewing.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
                            >
                                Open File Directly
                            </a>
                            {onDownload && (
                                <AppButton type="button" variant="neutral" size="sm" onClick={onDownload}>
                                    Download
                                </AppButton>
                            )}
                        </div>
                    </div>
                ) : typeInfo.isPdf || typeInfo.isDoc ? (
                    <iframe
                        key={`${viewerEngine}-${embedSrc}`}
                        src={embedSrc}
                        title={title || fileName || 'Document Viewer'}
                        className="w-full h-full min-h-[460px] sm:min-h-[540px] border-0 bg-white dark:bg-slate-900 rounded-b-xl"
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                    />
                ) : typeInfo.isImage ? (
                    <div
                        className="transition-transform duration-100 ease-out will-change-transform max-w-full max-h-full flex items-center justify-center select-none"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`
                        }}
                    >
                        <img
                            src={url}
                            alt={title || fileName || 'Image Preview'}
                            className="max-w-[85vw] sm:max-w-[75vw] max-h-[65vh] object-contain rounded-xl shadow-2xl border border-white/10 select-none pointer-events-none"
                            draggable={false}
                            onLoad={() => setIsLoading(false)}
                            onError={() => {
                                setIsLoading(false);
                                setHasError(true);
                                onImageError?.();
                            }}
                        />
                    </div>
                ) : (
                    /* Other file types fallback */
                    <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                            <i className={`${typeInfo.icon} text-3xl`} />
                        </div>
                        <p className="text-sm font-semibold text-white truncate max-w-xs">{fileName || title || 'Attachment'}</p>
                        <p className="text-xs text-slate-400 mt-1">{typeInfo.typeName}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 shadow-xs inline-flex items-center gap-1.5"
                            >
                                <i className="fas fa-external-link-alt text-[11px]" />
                                <span>Open File</span>
                            </a>
                            {onDownload && (
                                <AppButton type="button" variant="primary" size="sm" onClick={onDownload}>
                                    <i className="fas fa-download text-xs" />
                                    <span>Download</span>
                                </AppButton>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
