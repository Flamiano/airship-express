// header section with title, logged-in user badge, and upload action button
'use client';

import React from 'react';
import { AppButton } from '../../../../components/ui/AppButton';

interface DocumentsHeaderProps {
    userName: string;
    userEmail: string;
    onOpenUpload: () => void;
}

export function DocumentsHeader({
    userName,
    userEmail,
    onOpenUpload,
}: DocumentsHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-ink/20 pb-5">
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5">
                    <i className="fa-solid fa-folder-tree"></i>
                </div>

                <div className="w-full min-w-0">
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                        Document Tracking &amp; Logistics Records
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Centralized evidence repository for daily operations and audit trail.
                    </p>
                </div>
            </div>

            <AppButton
                type="button"
                variant="primary"
                size="md"
                onClick={onOpenUpload}
            >
                <i className="fas fa-cloud-arrow-up text-xs" />
                <span>Upload Files</span>
            </AppButton>
        </div>
    );
}
