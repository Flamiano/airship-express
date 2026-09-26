// gallery content wrapper component orchestrating layout, search, filters, cards, and modal
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { GallerySkeleton } from '../../components/ui/SkeletonLoader';
import { AppButton } from '../../components/ui/AppButton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useGallery } from './hooks/useGallery';
import { GalleryHeader } from './components/common/GalleryHeader';
import { GalleryFilterBar } from './components/common/GalleryFilterBar';
import { GalleryCard } from './components/common/GalleryCard';
import { GalleryListItem } from './components/common/GalleryListItem';
import { GalleryPreviewModal } from './components/modals/GalleryPreviewModal';

export default function GalleryContentWrapper() {
    const {
        mediaItems,
        loading,
        loadingMore,
        viewMode,
        setViewMode,
        selectedItem,
        selectedItemIndex,
        isPreviewOpen,
        hasMore,
        totalCount,
        totalSize,
        categories,
        suppliers,
        imageErrors,
        showFilters,
        setShowFilters,
        filterState,
        searchInputRef,
        handleLoadMore,
        handleFilterChange,
        handleSearchChange,
        handleImageClick,
        closePreview,
        handleNextImage,
        handlePrevImage,
        handleImageError,
        handleRetry,
        downloadImage,
        clearFilters,
    } = useGallery();

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300 bgCard">
            <div className="space-y-4">
                <GalleryHeader
                    totalCount={totalCount}
                    totalSize={totalSize}
                    categoriesCount={categories.length}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />

                <GalleryFilterBar
                    filterState={filterState}
                    categories={categories}
                    suppliers={suppliers}
                    showFilters={showFilters}
                    searchInputRef={searchInputRef}
                    onSearchChange={handleSearchChange}
                    onFilterChange={handleFilterChange}
                    onClearFilters={clearFilters}
                />
            </div>

            {loading && mediaItems.length === 0 ? (
                <GallerySkeleton count={8} />
            ) : viewMode === 'grid' ? (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                        {mediaItems.map((item, index) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                                transition={{
                                    duration: 0.25,
                                    ease: [0.25, 1, 0.5, 1],
                                    delay: Math.min(index * 0.03, 0.3),
                                }}
                            >
                                <GalleryCard
                                    item={item}
                                    hasError={imageErrors.has(item.id)}
                                    onPreview={handleImageClick}
                                    onDownload={downloadImage}
                                    onRetry={handleRetry}
                                    onImageError={handleImageError}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            ) : (
                <motion.div layout className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {mediaItems.map((item, index) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{
                                    duration: 0.2,
                                    delay: Math.min(index * 0.02, 0.2),
                                }}
                            >
                                <GalleryListItem
                                    item={item}
                                    hasError={imageErrors.has(item.id)}
                                    onPreview={handleImageClick}
                                    onDownload={downloadImage}
                                    onImageError={handleImageError}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {!loading && mediaItems.length > 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    {hasMore ? (
                        <AppButton
                            type="button"
                            variant="pink"
                            size="lg"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span className="tracking-wide">Loading more...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 opacity-80" />
                                    <span>
                                        Load More <span className="opacity-80 font-mono text-xs">({mediaItems.length} / {totalCount})</span>
                                    </span>
                                </>
                            )}
                        </AppButton>
                    ) : (
                        <StatusBadge tone="emerald" size="md">
                            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mr-1" />
                            <span>All {totalCount} items loaded</span>
                        </StatusBadge>
                    )}

                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                        Showing <span className="font-mono text-slate-700 dark:text-slate-300">{mediaItems.length}</span> of <span className="font-mono text-slate-700 dark:text-slate-300">{totalCount}</span> items
                    </div>
                </div>
            )}

            {!loading && mediaItems.length === 0 && (
                <div className="text-center py-16 px-4 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] animate-in fade-in duration-200">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        No media items found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed font-medium">
                        We couldn't find anything matching your search or filters.
                    </p>
                    <button
                        onClick={clearFilters}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Clear all filters</span>
                    </button>
                </div>
            )}

            <GalleryPreviewModal
                isOpen={isPreviewOpen}
                selectedItem={selectedItem}
                selectedItemIndex={selectedItemIndex}
                totalItems={mediaItems.length}
                onClose={closePreview}
                onNext={handleNextImage}
                onPrev={handlePrevImage}
                onDownload={downloadImage}
                onImageError={handleImageError}
                hasError={selectedItem ? imageErrors.has(selectedItem.id) : false}
            />
        </div>
    );
}
