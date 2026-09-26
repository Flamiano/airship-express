'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Send,
    Loader2,
    MessageSquare,
    Pencil,
    Trash2,
    Eye as EyeIcon
} from 'lucide-react';

interface AppealModalProps {
    showAppealModal: boolean;
    existingAppeal: any;
    isEditingAppeal: boolean;
    setIsEditingAppeal: (v: boolean) => void;
    appealMessage: string;
    setAppealMessage: (v: string) => void;
    isSubmittingAppeal: boolean;
    setShowAppealModal: (v: boolean) => void;
    handleSubmitAppeal: () => void;
    handleUpdateAppeal: () => void;
    handleDeleteAppeal: () => void;
}

export default function AppealModal({
    showAppealModal,
    existingAppeal,
    isEditingAppeal,
    setIsEditingAppeal,
    appealMessage,
    setAppealMessage,
    isSubmittingAppeal,
    setShowAppealModal,
    handleSubmitAppeal,
    handleUpdateAppeal,
    handleDeleteAppeal,
}: AppealModalProps) {
    return (
        <AnimatePresence>
            {showAppealModal && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-none my-auto overflow-hidden"
                    >
                        {/* modal header */}
                        <div className="border-b border-white/60 dark:border-white/[0.06] p-4 sm:p-6 flex justify-between items-center bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-blue-500/20 text-blue-500 dark:text-blue-400">
                                    {existingAppeal ? <EyeIcon size={22} /> : <MessageSquare size={22} />}
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-bricolage">
                                        {existingAppeal ? 'Review Appeal' : 'Submit Appeal'}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        {existingAppeal ? 'View and manage your appeal' : 'Request to unblock your device'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAppealModal(false);
                                    setAppealMessage('');
                                    setIsEditingAppeal(false);
                                }}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] transition-all p-2 rounded-xl cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* modal content */}
                        <div className="p-4 sm:p-6 space-y-4 bg-[#EEF2F6] dark:bg-[#161A23] transition-colors flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                            {existingAppeal && !isEditingAppeal ? (
                                // view existing appeal
                                <>
                                    <div className="bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 border border-white/40 dark:border-white/[0.06]">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</span>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-[2px_2px_5px_rgba(0,0,0,0.08)]
                                                ${existingAppeal.status === 'pending'
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/40'
                                                    : existingAppeal.status === 'approved'
                                                        ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                                                        : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800/40'
                                                }`}>
                                                {existingAppeal.status.charAt(0).toUpperCase() + existingAppeal.status.slice(1)}
                                            </span>
                                        </div>

                                        <div className="mt-2">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Your Message:</span>
                                            <p className="text-sm text-slate-900 dark:text-white mt-1 whitespace-pre-wrap">{existingAppeal.appeal_message}</p>
                                        </div>

                                        {existingAppeal.response_message && (
                                            <div className="mt-4 bg-[#E2EAF2] dark:bg-[#181D2A] rounded-xl p-4 shadow-[inset_2px_2px_5px_#c5d3e3,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] border border-blue-500/20 dark:border-blue-800/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">A</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Admin Response</span>
                                                </div>
                                                <p className="text-sm text-slate-900 dark:text-white">{existingAppeal.response_message}</p>
                                            </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                            <span>Submitted: {new Date(existingAppeal.created_at).toLocaleString()}</span>
                                            {existingAppeal.resolved_at && (
                                                <span>• Resolved: {new Date(existingAppeal.resolved_at).toLocaleString()}</span>
                                            )}
                                            {existingAppeal.resolved_by && (
                                                <span>• By: {existingAppeal.resolved_by}</span>
                                            )}
                                        </div>
                                    </div>

                                    {existingAppeal.status === 'pending' && (
                                        <div className="flex flex-wrap gap-2.5 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditingAppeal(true);
                                                    setAppealMessage(existingAppeal.appeal_message);
                                                }}
                                                className="px-4 py-2 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl transition-all flex items-center gap-2 border border-blue-500/20 cursor-pointer"
                                            >
                                                <Pencil size={15} />
                                                Edit Appeal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDeleteAppeal}
                                                className="px-4 py-2 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl transition-all flex items-center gap-2 border border-red-500/20 cursor-pointer"
                                            >
                                                <Trash2 size={15} />
                                                Delete Appeal
                                            </button>
                                        </div>
                                    )}

                                    {existingAppeal.status !== 'pending' && (
                                        <div className="bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 border border-white/40 dark:border-white/[0.06] text-center">
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                {existingAppeal.status === 'approved' ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">Your appeal has been approved!</span>
                                                ) : (
                                                    <span className="text-red-600 dark:text-red-400">Your appeal was rejected.</span>
                                                )}
                                            </p>
                                            {existingAppeal.response_message && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    See the admin response above for more details.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // submit or edit appeal form
                                <>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-slate-900 dark:text-white mb-1.5">
                                            Appeal Message
                                        </label>
                                        <textarea
                                            value={appealMessage}
                                            onChange={(e) => setAppealMessage(e.target.value)}
                                            placeholder="Explain why you believe this device should be unblocked..."
                                            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-accent/40 rounded-xl outline-none transition resize-none h-28 sm:h-32 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                            maxLength={500}
                                        />
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {appealMessage.length}/500 characters
                                        </p>
                                    </div>

                                    <div className="bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-3.5 border border-blue-500/20 dark:border-blue-800/40">
                                        <p className="text-xs text-blue-700 dark:text-blue-400">
                                            <strong>Note:</strong> Your appeal will be reviewed by an administrator. You will be notified once a decision is made.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* modal footer */}
                        <div className="border-t border-white/60 dark:border-white/[0.06] p-4 sm:p-5 flex justify-end gap-3 bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 transition-colors">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAppealModal(false);
                                    setAppealMessage('');
                                    setIsEditingAppeal(false);
                                }}
                                className="px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08]"
                            >
                                {existingAppeal && !isEditingAppeal ? 'Close' : 'Cancel'}
                            </button>
                            {isEditingAppeal || !existingAppeal ? (
                                <button
                                    type="button"
                                    onClick={existingAppeal ? handleUpdateAppeal : handleSubmitAppeal}
                                    disabled={isSubmittingAppeal || !appealMessage.trim()}
                                    className="px-5 sm:px-6 py-2.5 bg-accent text-paper text-xs sm:text-sm font-semibold rounded-xl shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] hover:bg-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer border border-accent/30"
                                >
                                    {isSubmittingAppeal ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            {existingAppeal ? 'Updating...' : 'Submitting...'}
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            {existingAppeal ? 'Update Appeal' : 'Submit Appeal'}
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
