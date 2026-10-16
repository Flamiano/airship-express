// supplier cards overview component displaying searchable, interactive supplier cards with document metrics
'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Building2,
    FolderOpen,
    Image as ImageIcon,
    FileText,
    HardDrive,
    User,
    Mail,
    Phone,
    MapPin,
    ArrowRight,
    SlidersHorizontal,
    Sparkles,
    Calendar,
    Layers,
    Camera
} from 'lucide-react';
import { Supplier } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';

export interface SupplierCardsGridProps {
    suppliers: Supplier[];
    loading?: boolean;
    totalFiles: number;
    totalPhotos: number;
    onSelectSupplier: (supplier: Supplier | null) => void;
    onOpenUpload: () => void;
    onOpenPhotoSearch?: () => void;
}

// vibrant palette for supplier avatar badges
const AVATAR_GRADIENTS = [
    'from-pink-500 to-rose-600',
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-fuchsia-600',
    'from-sky-500 to-blue-600',
    'from-rose-500 to-red-600',
];

export function SupplierCardsGrid({
    suppliers,
    loading = false,
    totalFiles,
    totalPhotos,
    onSelectSupplier,
    onOpenUpload,
    onOpenPhotoSearch
}: SupplierCardsGridProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'docs-desc' | 'photos-desc' | 'size-desc' | 'recent'>('name-asc');

    // unique categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        suppliers.forEach(s => {
            if (s.category) set.add(s.category);
        });
        return ['All', ...Array.from(set).sort()];
    }, [suppliers]);

    // filtered and sorted suppliers
    const filteredSuppliers = useMemo(() => {
        let result = suppliers.filter(s => {
            const matchesSearch =
                !searchTerm ||
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.location && s.location.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });

        // sorting
        return result.sort((a, b) => {
            switch (sortBy) {
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'docs-desc':
                    return (b.document_count || 0) - (a.document_count || 0);
                case 'photos-desc':
                    return (b.photo_count || 0) - (a.photo_count || 0);
                case 'size-desc':
                    return (b.total_size || 0) - (a.total_size || 0);
                case 'recent':
                    if (!a.latest_upload && !b.latest_upload) return 0;
                    if (!a.latest_upload) return 1;
                    if (!b.latest_upload) return -1;
                    return new Date(b.latest_upload).getTime() - new Date(a.latest_upload).getTime();
                case 'name-asc':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }, [suppliers, searchTerm, selectedCategory, sortBy]);

    // get gradient by supplier id
    const getGradient = (id: number) => {
        return AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length];
    };

    return (
        <div className="space-y-6">
            {/* search, filter pills, and sort bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_20px_rgba(166,175,195,0.35),-6px_-6px_20px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.7)] space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
                    {/* search input and photo search button */}
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search suppliers by name, category, contact, or location..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-pink-500/30 transition-all shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)]"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {onOpenPhotoSearch && (
                            <button
                                type="button"
                                onClick={onOpenPhotoSearch}
                                title="Search Document with Photo"
                                aria-label="Search Document with Photo"
                                className="px-3 sm:px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] hover:bg-[#e2eaf5] dark:bg-[#1e1f2c] dark:hover:bg-[#27293a] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] active:scale-95 transition-all flex items-center gap-2 text-xs font-bold shrink-0 cursor-pointer"
                            >
                                <Camera className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                                <span className="hidden sm:inline">Photo Search</span>
                            </button>
                        )}
                    </div>

                    {/* sort options */}
                    <div className="flex items-center gap-2 shrink-0">
                        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                        >
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="docs-desc">Most Documents</option>
                            <option value="photos-desc">Most Photos</option>
                            <option value="size-desc">Largest Storage</option>
                            <option value="recent">Recently Uploaded</option>
                        </select>
                    </div>
                </div>

                {/* category pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1">
                        Categories:
                    </span>
                    {categories.map((cat) => {
                        const isActive = selectedCategory === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    isActive
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)]'
                                        : 'bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800/80 shadow-[1px_1px_3px_rgba(166,175,195,0.2)]'
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* active count & helper label */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'Supplier' : 'Suppliers'} Available
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Realtime
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">· Click any card to view documents & gallery</span>
                </div>
                <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">
                    {totalFiles} Total Files across all suppliers
                </span>
            </div>

            {/* grid of suppliers */}
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* special "All Suppliers" card to view entire document library */}
                <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onSelectSupplier({ id: 0, name: 'All Suppliers', category: 'General', contact_person: '', phone: '', email: '', location: '' })}
                    className="group p-5 rounded-3xl bg-linear-to-br from-pink-500/10 via-[#f0f3f8] to-purple-500/10 dark:from-pink-950/20 dark:via-[#191a24] dark:to-purple-950/20 border-2 border-dashed border-pink-400/50 dark:border-pink-500/30 hover:border-pink-500 hover:shadow-[0_12px_30px_rgba(244,63,94,0.25)] transition-all duration-300 flex flex-col justify-between cursor-pointer min-h-[280px]"
                >
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center shadow-md">
                                <Layers className="w-6 h-6" />
                            </div>
                            <StatusBadge tone="pink" size="xs">
                                Global Library
                            </StatusBadge>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                All Suppliers Library
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                Browse all uploaded documents, photos, delivery receipts, and invoices across all active suppliers.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-pink-200/40 dark:border-pink-800/30">
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-black/30 border border-pink-200/50 dark:border-pink-900/40">
                                <span className="block text-xs font-bold text-pink-600 dark:text-pink-400">{totalFiles}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">All Documents</span>
                            </div>
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-black/30 border border-pink-200/50 dark:border-pink-900/40">
                                <span className="block text-xs font-bold text-purple-600 dark:text-purple-400">{totalPhotos}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">All Photos</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-400 group-hover:translate-x-1 transition-transform">
                            <span>Browse Complete Gallery</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </motion.div>

                {/* supplier cards */}
                <AnimatePresence mode="popLayout">
                    {filteredSuppliers.map((supplier, idx) => {
                        const docCount = supplier.document_count || 0;
                        const photoCount = supplier.photo_count || 0;
                        const totalSupplierFiles = supplier.total_files || (docCount + photoCount);
                        const totalSize = supplier.total_size || 0;
                        const gradient = getGradient(supplier.id);
                        const isOfficial = supplier.is_active !== false;

                        return (
                            <motion.div
                                key={supplier.id}
                                layout
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94 }}
                                transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.2) }}
                                onClick={() => onSelectSupplier(supplier)}
                                className="group p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] hover:-translate-y-1.5 hover:shadow-[12px_12px_32px_rgba(166,175,195,0.5),-8px_-8px_24px_rgba(255,255,255,0.95)] transition-all duration-300 flex flex-col justify-between cursor-pointer min-h-[280px]"
                            >
                                {/* card header */}
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 uppercase tracking-tight`}>
                                            {supplier.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {isOfficial ? (
                                                <StatusBadge tone="emerald" size="xs" dot>
                                                    Official Supplier
                                                </StatusBadge>
                                            ) : (
                                                <StatusBadge tone="amber" size="xs" dot dotColor="bg-amber-500">
                                                    Inactive
                                                </StatusBadge>
                                            )}
                                            {supplier.category && (
                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                    {supplier.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3
                                            className="font-bold text-slate-900 dark:text-white text-base group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1"
                                            title={supplier.name}
                                        >
                                            {supplier.name}
                                        </h3>
                                        {supplier.location && (
                                            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                                <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                                <span className="truncate">{supplier.location}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* contact info */}
                                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
                                        {supplier.contact_person && (
                                            <div className="flex items-center gap-1.5 truncate">
                                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="truncate">{supplier.contact_person}</span>
                                            </div>
                                        )}
                                        {supplier.email && (
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="truncate font-mono text-[11px]">{supplier.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* metrics & footer */}
                                <div className="space-y-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                                    {/* metrics badge row */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-center border border-slate-200/60 dark:border-slate-800/60 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                            <div className="flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300">
                                                <FileText className="w-3 h-3 text-pink-500" />
                                                <span className="text-xs font-bold">{docCount}</span>
                                            </div>
                                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Docs</span>
                                        </div>

                                        <div className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-center border border-slate-200/60 dark:border-slate-800/60 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                            <div className="flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300">
                                                <ImageIcon className="w-3 h-3 text-purple-500" />
                                                <span className="text-xs font-bold">{photoCount}</span>
                                            </div>
                                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Photos</span>
                                        </div>

                                        <div className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-center border border-slate-200/60 dark:border-slate-800/60 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                            <div className="flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300">
                                                <HardDrive className="w-3 h-3 text-blue-500" />
                                                <span className="text-[11px] font-bold truncate">{formatFileSize(totalSize)}</span>
                                            </div>
                                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Size</span>
                                        </div>
                                    </div>

                                    {/* action button row */}
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                                {supplier.latest_upload
                                                    ? new Date(supplier.latest_upload).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                    : 'No uploads'}
                                            </span>
                                        </div>
                                        <span className="font-bold text-pink-600 dark:text-pink-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                            Open Gallery <ArrowRight className="w-3.5 h-3.5" />
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>

            {/* empty state */}
            {filteredSuppliers.length === 0 && (
                <div className="p-12 text-center rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-md space-y-3">
                    <Building2 className="w-12 h-12 mx-auto text-slate-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        No Suppliers Found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        No active suppliers match your search criteria "{searchTerm}". Try clearing your filters or search terms.
                    </p>
                    <AppButton
                        type="button"
                        variant="pink"
                        size="sm"
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedCategory('All');
                        }}
                    >
                        Reset Search Filters
                    </AppButton>
                </div>
            )}
        </div>
    );
}
