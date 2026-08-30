'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { Appeal } from '../../types';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';

interface AppealResponseModalProps {
    isOpen: boolean;
    appeal: Appeal | null;
    responseMessage: string;
    onResponseMessageChange: (message: string) => void;
    onClose: () => void;
    onSendResponse: () => void;
}

export const AppealResponseModal: React.FC<AppealResponseModalProps> = ({
    isOpen,
    appeal,
    responseMessage,
    onResponseMessageChange,
    onClose,
    onSendResponse,
}) => {
    if (!isOpen || !appeal) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl dark:shadow-black/80 overflow-hidden border border-slate-200/80 dark:border-slate-800"
                >
                    {/* Fixed Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 p-6 bg-slate-50/80 dark:bg-slate-900/80">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/40 shadow-2xs">
                                <Send className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    {appeal.response_message ? 'View Response' : 'Send Response'}
                                </h3>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    {appeal.user_name} <span className="text-slate-400 dark:text-slate-500">({appeal.user_email})</span>
                                </p>
                            </div>
                        </div>

                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </AppButton>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {/* Original Appeal Message */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Appeal Message
                            </label>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                {appeal.appeal_message || 'No appeal message provided.'}
                            </div>
                        </div>

                        {/* Response Textarea / Content */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {appeal.response_message ? 'Recorded Response' : 'Your Response'}
                                </label>
                                {!appeal.response_message && (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                        {responseMessage.length}/500
                                    </span>
                                )}
                            </div>

                            <textarea
                                value={responseMessage}
                                onChange={(e) => onResponseMessageChange(e.target.value)}
                                placeholder="Type your response to the appeal..."
                                className={`w-full p-3.5 border rounded-xl text-sm leading-relaxed transition-all outline-none resize-none h-32 ${appeal.response_message
                                    ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-800'
                                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20'
                                    }`}
                                readOnly={!!appeal.response_message}
                                maxLength={500}
                            />
                        </div>
                    </div>

                    {/* Fixed Footer Actions */}
                    <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end gap-3">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                        >
                            Close
                        </AppButton>

                        {!appeal.response_message && (
                            <AppButton
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={onSendResponse}
                                disabled={!responseMessage.trim()}
                            >
                                <Send className="w-4 h-4" />
                                <span>Send Response</span>
                            </AppButton>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
