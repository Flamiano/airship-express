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

                    <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2.5 px-3.5 py-1.5 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-full transition-all">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <i className="fa-solid fa-user text-[10px] sm:text-[11px] text-pink-500 dark:text-pink-400"></i>
                        <span>Logged in as:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none">
                            {userName}
                        </span>
                        {userEmail && (
                            <span className="text-slate-400 dark:text-slate-500 font-medium sm:border-l sm:border-slate-300/60 dark:sm:border-slate-700 sm:pl-2 sm:ml-0.5 truncate max-w-[180px] sm:max-w-none">
                                {userEmail}
                            </span>
                        )}
                    </div>
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
