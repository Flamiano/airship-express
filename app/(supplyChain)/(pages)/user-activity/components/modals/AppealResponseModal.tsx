'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { Appeal } from '../../types';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

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
        <Portal>
            <AnimatePresence>
                <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col w-full max-w-lg max-h-[85vh] bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl shadow-[16px_16px_40px_rgba(0,0,0,0.35)] overflow-hidden border border-white/80 dark:border-[#2c2d3c]"
                >
                    {/* Fixed Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 p-5 bg-slate-50/70 dark:bg-slate-900/40">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] flex items-center justify-center">
                                <Send className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                    {appeal.response_message ? 'View Response' : 'Send Response'}
                                </h3>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
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
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Appeal Message
                            </label>
                            <div className="p-4 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] font-medium">
                                {appeal.appeal_message || 'No appeal message provided.'}
                            </div>
                        </div>

                        {/* Response Textarea / Content */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {appeal.response_message ? 'Recorded Response' : 'Your Response'}
                                </label>
                                {!appeal.response_message && (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                                        {responseMessage.length}/500
                                    </span>
                                )}
                            </div>

                            <textarea
                                value={responseMessage}
                                onChange={(e) => onResponseMessageChange(e.target.value)}
                                placeholder="Type your response to the appeal..."
                                className={`w-full p-4 border rounded-2xl text-xs leading-relaxed transition-all outline-none resize-none h-32 bg-[#ebf0f7] dark:bg-[#14151c] text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-medium`}
                                readOnly={!!appeal.response_message}
                                maxLength={500}
                            />
                        </div>
                    </div>

                    {/* Fixed Footer Actions */}
                    <div className="shrink-0 border-t border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-end gap-3">
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
        </Portal>
    );
};
