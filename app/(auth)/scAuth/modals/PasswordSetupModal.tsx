'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { User, Loader2 } from 'lucide-react';

interface PasswordSetupModalProps {
    showPasswordModal: boolean;
    selectedEmployeeForPassword: any;
    hrHasPassword: boolean;
    useHrPassword: boolean;
    setUseHrPassword: (v: boolean) => void;
    newPassword: string;
    setNewPassword: (v: string) => void;
    confirmPassword: string;
    setConfirmPassword: (v: string) => void;
    isCreatingUser: boolean;
    getRoleColor: (role: string) => string;
    handleCreateAccount: () => void;
    setShowPasswordModal: (v: boolean) => void;
    setOtpSent: (v: boolean) => void;
    setShowEmployeeModal: (v: boolean) => void;
}

export default function PasswordSetupModal({
    showPasswordModal,
    selectedEmployeeForPassword,
    hrHasPassword,
    useHrPassword,
    setUseHrPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isCreatingUser,
    getRoleColor,
    handleCreateAccount,
    setShowPasswordModal,
    setOtpSent,
    setShowEmployeeModal,
}: PasswordSetupModalProps) {
    return (
        <AnimatePresence>
            {showPasswordModal && selectedEmployeeForPassword && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl dark:shadow-black/60"
                    >
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-accent/10 dark:bg-accent/20 ring-1 ring-accent/20 dark:ring-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                <User className="text-accent dark:text-accent" size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Set Up Your Account</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                                Create your account to access the supply chain system
                            </p>
                        </div>

                        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400">Employee</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedEmployeeForPassword.display_name}</p>
                            <p className="text-sm text-gray-600 dark:text-slate-300">{selectedEmployeeForPassword.email}</p>
                            {selectedEmployeeForPassword.employee_id && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">ID: {selectedEmployeeForPassword.employee_id}</p>
                            )}
                            {selectedEmployeeForPassword.department && (
                                <p className="text-xs text-gray-400 dark:text-slate-500">{selectedEmployeeForPassword.department} • {selectedEmployeeForPassword.position}</p>
                            )}
                            <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployeeForPassword.role)}`}>
                                {selectedEmployeeForPassword.role}
                            </span>
                        </div>

                        {hrHasPassword && (
                            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/40">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useHrPassword}
                                        onChange={(e) => setUseHrPassword(e.target.checked)}
                                        className="mt-1 w-4 h-4 text-accent rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-accent dark:focus:ring-accent/50"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                                            Use HR system password
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">
                                            Your password will be synced from the HR system
                                        </p>
                                    </div>
                                </label>
                            </div>
                        )}

                        {!useHrPassword && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                        placeholder="Enter password (min 6 characters)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-accent dark:focus:ring-accent/50 focus:border-transparent outline-none transition"
                                        placeholder="Confirm your password"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setOtpSent(true);
                                    setShowEmployeeModal(true);
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCreateAccount}
                                disabled={isCreatingUser}
                                className="flex-1 px-4 py-2.5 bg-accent dark:bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-dark dark:hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isCreatingUser ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
