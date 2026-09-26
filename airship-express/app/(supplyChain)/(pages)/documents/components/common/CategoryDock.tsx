// quick-filter dock for all files, photos, documents, and document types
'use client';

import React from 'react';
import { Document } from '../../types';

interface CategoryDockProps {
    categoryFilter: string;
    typeFilter: string;
    totalFiles: number;
    totalPhotos: number;
    documents: Document[];
    onSelectCategory: (category: string) => void;
    onSelectType: (type: string) => void;
}

const DOCUMENT_TYPES = [
    "Official Receipt",
    "Invoice",
    "Delivery Receipt",
    "Parcel Condition",
    "Courier Handover",
    "Vehicle Maintenance",
];

export function CategoryDock({
    categoryFilter,
    typeFilter,
    totalFiles,
    totalPhotos,
    documents,
    onSelectCategory,
    onSelectType
}: CategoryDockProps) {
    return (
        <div className="mt-4 p-3 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] transition-all">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
                {/* category filter group */}
                <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200/60 dark:border-slate-800 shrink-0">
                    <button
                        onClick={() => onSelectCategory("")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 ${!categoryFilter && !typeFilter
                            ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                            : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]"
                            }`}
                    >
                        <i className="fas fa-folder-open text-xs" />
                        <span>All Files</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${!categoryFilter && !typeFilter
                                ? "bg-white/25 text-white"
                                : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                        >
                            {totalFiles}
                        </span>
                    </button>

                    <button
                        onClick={() => onSelectCategory("photos")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 ${categoryFilter === "photos"
                            ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                            : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]"
                            }`}
                    >
                        <i className="fas fa-image text-xs" />
                        <span>Photos</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${categoryFilter === "photos"
                                ? "bg-white/25 text-white"
                                : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                        >
                            {totalPhotos}
                        </span>
                    </button>

                    <button
                        onClick={() => onSelectCategory("documents")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 ${categoryFilter === "documents"
                            ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                            : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]"
                            }`}
                    >
                        <i className="fas fa-file-alt text-xs" />
                        <span>Documents</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${categoryFilter === "documents"
                                ? "bg-white/25 text-white"
                                : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                        >
                            {totalFiles - totalPhotos}
                        </span>
                    </button>
                </div>

                {/* specific document type badges */}
                <div className="flex items-center gap-1.5 pl-1 shrink-0">
                    {DOCUMENT_TYPES.map((type) => {
                        const count = documents.filter((d) => d.document_type === type).length;
                        const isActive = typeFilter === type;

                        return (
                            <button
                                key={type}
                                onClick={() => onSelectType(type)}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 ${isActive
                                    ? "bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                    : "bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]"
                                    }`}
                            >
                                <i
                                    className={`fas fa-tag text-[10px] ${isActive ? "text-white" : "text-slate-400 dark:text-slate-400"
                                        }`}
                                />
                                <span>{type}</span>
                                <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive
                                        ? "bg-white/25 text-white"
                                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                        }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
