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
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl dark:shadow-black/60"
                    >
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-800/40 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                <LogIn className="text-emerald-600 dark:text-emerald-400" size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Login as {selectedEmployee.display_name}</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                                Enter your password to continue
                            </p>
                        </div>

                        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400">Account</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedEmployee.display_name}</p>
                            <p className="text-sm text-gray-600 dark:text-slate-300">{selectedEmployee.email}</p>
                            {selectedEmployee.employee_id && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">ID: {selectedEmployee.employee_id}</p>
                            )}
                            {selectedEmployee.department && (
                                <p className="text-xs text-gray-400 dark:text-slate-500">{selectedEmployee.department} • {selectedEmployee.position}</p>
                            )}
                            <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployee.role)}`}>
                                {selectedEmployee.role}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                                    className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                    placeholder="Enter your password"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowRememberedPasswordModal(false);
                                    setRememberedPassword('');
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleVerifyRememberedPassword}
                                disabled={isLoggingInWithRemembered || !rememberedPassword.trim()}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

                        <p className="mt-3 text-center text-xs text-gray-400 dark:text-slate-500">
                            This is a remembered session. Your password is required for security.
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
