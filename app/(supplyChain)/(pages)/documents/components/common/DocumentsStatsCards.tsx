// metric overview cards for total files, photos, documents, and archived items
'use client';

import React from 'react';
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { CardsSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";

interface DocumentsStatsCardsProps {
    loading: boolean;
    totalFiles: number;
    totalPhotos: number;
    archiveCount: number;
}

export function DocumentsStatsCards({
    loading,
    totalFiles,
    totalPhotos,
    archiveCount
}: DocumentsStatsCardsProps) {
    if (loading) {
        return (
            <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5" />
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            <Cards
                frontIcon="fas fa-files"
                header="Total Files"
                data={totalFiles.toString()}
                arrow="fas fa-arrow-up"
                description="All uploaded files"
                backBg="bg-ink dark:bg-ink/90"
                backHeader="Total Files Overview"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`Total number of files in the system: ${totalFiles}\n\nIncludes all document types\nUpdated in real-time`}
                tooltip="View all files"
                tooltipLink="/gallery"
                badge={`${totalFiles} files`}
            />

            <Cards
                frontIcon="fas fa-image"
                header="Photos"
                data={totalPhotos.toString()}
                arrow="fas fa-arrow-up"
                description="Image files"
                backBg="bg-ink dark:bg-ink/90"
                backHeader="Photo Files"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`Total photo files stored: ${totalPhotos}\n\n Includes JPG, PNG, HEIC formats\nImage evidence for operations`}
                tooltip="View all photos"
                tooltipLink="#"
                badge={`${totalPhotos} photos`}
            />

            <Cards
                frontIcon="fas fa-file-alt"
                header="Documents"
                data={(totalFiles - totalPhotos).toString()}
                arrow="fas fa-arrow-up"
                description="Document files"
                backBg="bg-ink dark:bg-ink/90"
                backHeader="Document Files"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`Total document files stored: ${totalFiles - totalPhotos}\n\n Includes PDF, DOC, XLS formats\nOfficial records and receipts`}
                tooltip="View all documents"
                tooltipLink="#"
                badge={`${totalFiles - totalPhotos} docs`}
            />

            <Cards
                frontIcon="fas fa-archive"
                header="Archived"
                data={archiveCount.toString()}
                arrow="fas fa-arrow-down"
                description="Deleted documents"
                backBg="bg-ink dark:bg-ink/90"
                backHeader="Archived Documents"
                headerTextColor="text-muted dark:text-white/80"
                backDescription={`Total archived documents: ${archiveCount}\n\n📦 Deleted files stored in archive\nHistorical record of deletions`}
                tooltip="View archive"
                tooltipLink="/archive?tab=documents"
                badge={`${archiveCount} archived`}
                frontTextColor="text-amber-600 dark:text-amber-400"
                descriptionTextColor="text-slate-500 dark:text-slate-400"
            />
        </div>
    );
}
