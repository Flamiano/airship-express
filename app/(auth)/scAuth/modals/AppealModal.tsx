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
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl dark:shadow-black/60"
                    >
                        {/* modal header */}
                        <div className="border-b border-gray-200 dark:border-slate-800 p-6 flex justify-between items-center bg-white dark:bg-slate-900 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 ring-1 ring-blue-500/10 dark:ring-blue-500/20">
                                    {existingAppeal ? <EyeIcon size={22} /> : <MessageSquare size={22} />}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        {existingAppeal ? 'Review Appeal' : 'Submit Appeal'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                        {existingAppeal ? 'View and manage your appeal' : 'Request to unblock your device'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAppealModal(false);
                                    setAppealMessage('');
                                    setIsEditingAppeal(false);
                                }}
                                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* modal content */}
                        <div className="p-6 space-y-4 bg-white dark:bg-slate-900 transition-colors">
                            {existingAppeal && !isEditingAppeal ? (
                                // view existing appeal
                                <>
                                    <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</span>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full 
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
                                            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Your Message:</span>
                                            <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{existingAppeal.appeal_message}</p>
                                        </div>

                                        {existingAppeal.response_message && (
                                            <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">A</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Admin Response</span>
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-slate-300">{existingAppeal.response_message}</p>
                                            </div>
                                        )}

                                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400 dark:text-slate-500">
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
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => {
                                                    setIsEditingAppeal(true);
                                                    setAppealMessage(existingAppeal.appeal_message);
                                                }}
                                                className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all flex items-center gap-2 border border-blue-200/60 dark:border-blue-800/40 cursor-pointer"
                                            >
                                                <Pencil size={15} />
                                                Edit Appeal
                                            </button>
                                            <button
                                                onClick={handleDeleteAppeal}
                                                className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-all flex items-center gap-2 border border-red-200/60 dark:border-red-800/40 cursor-pointer"
                                            >
                                                <Trash2 size={15} />
                                                Delete Appeal
                                            </button>
                                        </div>
                                    )}

                                    {existingAppeal.status !== 'pending' && (
                                        <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 border border-gray-200 dark:border-slate-700 text-center">
                                            <p className="text-sm text-gray-600 dark:text-slate-300">
                                                {existingAppeal.status === 'approved' ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">Your appeal has been approved!</span>
                                                ) : (
                                                    <span className="text-red-600 dark:text-red-400">Your appeal was rejected.</span>
                                                )}
                                            </p>
                                            {existingAppeal.response_message && (
                                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                            Appeal Message
                                        </label>
                                        <textarea
                                            value={appealMessage}
                                            onChange={(e) => setAppealMessage(e.target.value)}
                                            placeholder="Explain why you believe this device should be unblocked..."
                                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition resize-none h-32 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                            maxLength={500}
                                        />
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                            {appealMessage.length}/500 characters
                                        </p>
                                    </div>

                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-800/40">
                                        <p className="text-xs text-blue-700 dark:text-blue-400">
                                            <strong>Note:</strong> Your appeal will be reviewed by an administrator. You will be notified once a decision is made.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* modal footer */}
                        <div className="border-t border-gray-200 dark:border-slate-800 p-4 flex justify-end gap-3 bg-white dark:bg-slate-900 transition-colors">
                            <button
                                onClick={() => {
                                    setShowAppealModal(false);
                                    setAppealMessage('');
                                    setIsEditingAppeal(false);
                                }}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                                {existingAppeal && !isEditingAppeal ? 'Close' : 'Cancel'}
                            </button>
                            {isEditingAppeal || !existingAppeal ? (
                                <button
                                    onClick={existingAppeal ? handleUpdateAppeal : handleSubmitAppeal}
                                    disabled={isSubmittingAppeal || !appealMessage.trim()}
                                    className="px-6 py-2 bg-accent dark:bg-accent text-white rounded-lg hover:bg-accent-dark dark:hover:bg-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
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
