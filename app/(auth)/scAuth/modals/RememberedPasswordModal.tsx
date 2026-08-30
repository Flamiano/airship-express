'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Loader2 } from 'lucide-react';

interface RememberedPasswordModalProps {
    showRememberedPasswordModal: boolean;
    selectedEmployee: any;
    rememberedPassword: string;
    setRememberedPassword: (v: string) => void;
    isLoggingInWithRemembered: boolean;
    getRoleColor: (role: string) => string;
    handleVerifyRememberedPassword: () => void;
    setShowRememberedPasswordModal: (v: boolean) => void;
}

export default function RememberedPasswordModal({
    showRememberedPasswordModal,
    selectedEmployee,
    rememberedPassword,
    setRememberedPassword,
    isLoggingInWithRemembered,
    getRoleColor,
    handleVerifyRememberedPassword,
    setShowRememberedPasswordModal,
}: RememberedPasswordModalProps) {
    return (
        <AnimatePresence>
            {showRememberedPasswordModal && selectedEmployee && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-ink border border-line dark:border-paper/10 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/60 my-auto overflow-hidden"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="text-center mb-5 sm:mb-6">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-800/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <LogIn className="text-emerald-600 dark:text-emerald-400" size={26} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-ink dark:text-paper font-bricolage">Login as {selectedEmployee.display_name}</h3>
                                <p className="text-xs sm:text-sm text-muted dark:text-paper/70 mt-1">
                                    Enter your password to continue
                                </p>
                            </div>

                            <div className="mb-4 p-3.5 sm:p-4 bg-paper dark:bg-paper/5 rounded-xl border border-line dark:border-paper/10">
                                <p className="text-xs text-muted dark:text-paper/70">Account</p>
                                <p className="font-medium text-ink dark:text-paper text-sm sm:text-base">{selectedEmployee.display_name}</p>
                                <p className="text-xs sm:text-sm text-muted dark:text-paper/70 break-all">{selectedEmployee.email}</p>
                                {selectedEmployee.employee_id && (
                                    <p className="text-xs text-muted dark:text-paper/50 mt-1">ID: {selectedEmployee.employee_id}</p>
                                )}
                                {selectedEmployee.department && (
                                    <p className="text-xs text-muted dark:text-paper/50">{selectedEmployee.department} • {selectedEmployee.position}</p>
                                )}
                                <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployee.role)}`}>
                                    {selectedEmployee.role}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-ink dark:text-paper mb-1">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={rememberedPassword}
                                        onChange={(e) => setRememberedPassword(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleVerifyRememberedPassword();
                                            }
                                        }}
                                        className="w-full border border-line dark:border-paper/20 bg-transparent dark:bg-paper/5 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 focus:ring-2 focus:ring-accent outline-none transition"
                                        placeholder="Enter your password"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <p className="mt-3 text-center text-[11px] sm:text-xs text-muted dark:text-paper/50">
                                This is a remembered session. Your password is required for security.
                            </p>
                        </div>

                        <div className="shrink-0 border-t border-line dark:border-paper/10 p-4 sm:p-5 bg-paper dark:bg-paper/5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRememberedPasswordModal(false);
                                    setRememberedPassword('');
                                }}
                                className="flex-1 px-4 py-2.5 border border-line dark:border-paper/20 rounded-xl text-xs sm:text-sm font-medium text-muted dark:text-paper/70 hover:bg-white dark:hover:bg-paper/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyRememberedPassword}
                                disabled={isLoggingInWithRemembered || !rememberedPassword.trim()}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isLoggingInWithRemembered ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={16} />
                                        Login
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
