// header section with title, live metrics, filter toggle, and view mode switcher
'use client';

import React from 'react';
import { Filter, Grid, List } from 'lucide-react';
import { AppButton } from '../../../../components/ui/AppButton';
import { formatFileSize } from '../../utils/formatters';

interface GalleryHeaderProps {
    totalCount: number;
    totalSize: number;
    categoriesCount: number;
    showFilters: boolean;
    onToggleFilters: () => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function GalleryHeader({
    totalCount,
    totalSize,
    categoriesCount,
    showFilters,
    onToggleFilters,
    viewMode,
    onViewModeChange
}: GalleryHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0">
                    <i className="fa-solid fa-photo-film"></i>
                </div>
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Media Gallery
                        </h1>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] font-semibold text-pink-600 dark:text-pink-400 text-[11px]">
                            <span className="font-bold">{totalCount}</span> images
                        </div>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] font-medium text-slate-600 dark:text-slate-400 text-[11px]">
                            <span>{formatFileSize(totalSize)}</span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] font-medium text-slate-600 dark:text-slate-400 text-[11px]">
                            <span>{Math.max(0, categoriesCount - 1)} categories</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <AppButton
                    type="button"
                    variant={showFilters ? 'pink' : 'neutral'}
                    size="sm"
                    onClick={onToggleFilters}
                >
                    <Filter className="w-4 h-4 text-pink-500" />
                    <span>Filters</span>
                    {showFilters && (
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    )}
                </AppButton>

                <div className="bg-[#ebf0f7] dark:bg-[#14151c] p-1 rounded-full border border-slate-200/60 dark:border-slate-800 flex items-center gap-1 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                    <button
                        type="button"
                        onClick={() => onViewModeChange('grid')}
                        title="Grid View"
                        className={`p-1.5 rounded-full transition-all cursor-pointer ${
                            viewMode === 'grid'
                                ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-[0_2px_6px_rgba(236,72,153,0.35)] font-semibold'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('list')}
                        title="List View"
                        className={`p-1.5 rounded-full transition-all cursor-pointer ${
                            viewMode === 'list'
                                ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white shadow-[0_2px_6px_rgba(236,72,153,0.35)] font-semibold'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
