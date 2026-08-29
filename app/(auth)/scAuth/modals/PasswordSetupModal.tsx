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
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-ink border border-line dark:border-paper/10 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/60 my-auto overflow-hidden"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="text-center mb-5 sm:mb-6">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-accent/10 dark:bg-accent/20 ring-1 ring-accent/20 dark:ring-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <User className="text-accent dark:text-accent" size={26} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-ink dark:text-paper font-bricolage">Set Up Your Account</h3>
                                <p className="text-xs sm:text-sm text-muted dark:text-paper/70 mt-1">
                                    Create your account to access the supply chain system
                                </p>
                            </div>

                            <div className="mb-4 p-3.5 sm:p-4 bg-paper dark:bg-paper/5 rounded-xl border border-line dark:border-paper/10">
                                <p className="text-xs text-muted dark:text-paper/70">Employee</p>
                                <p className="font-medium text-ink dark:text-paper text-sm sm:text-base">{selectedEmployeeForPassword.display_name}</p>
                                <p className="text-xs sm:text-sm text-muted dark:text-paper/70 break-all">{selectedEmployeeForPassword.email}</p>
                                {selectedEmployeeForPassword.employee_id && (
                                    <p className="text-xs text-muted dark:text-paper/50 mt-1">ID: {selectedEmployeeForPassword.employee_id}</p>
                                )}
                                {selectedEmployeeForPassword.department && (
                                    <p className="text-xs text-muted dark:text-paper/50">{selectedEmployeeForPassword.department} • {selectedEmployeeForPassword.position}</p>
                                )}
                                <span className={`inline-block mt-2 text-[10px] font-medium px-2.5 py-0.5 rounded-md ${getRoleColor(selectedEmployeeForPassword.role)}`}>
                                    {selectedEmployeeForPassword.role}
                                </span>
                            </div>

                            {hrHasPassword && (
                                <div className="mb-4 p-3.5 sm:p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/40">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useHrPassword}
                                            onChange={(e) => setUseHrPassword(e.target.checked)}
                                            className="mt-1 w-4 h-4 text-accent rounded border-line dark:border-paper/20 dark:bg-paper/5 focus:ring-accent"
                                        />
                                        <div>
                                            <p className="text-xs sm:text-sm font-medium text-ink dark:text-paper">
                                                Use HR system password
                                            </p>
                                            <p className="text-xs text-muted dark:text-paper/70">
                                                Your password will be synced from the HR system
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            )}

                            {!useHrPassword && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-ink dark:text-paper mb-1">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full border border-line dark:border-paper/20 bg-transparent dark:bg-paper/5 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 focus:ring-2 focus:ring-accent outline-none transition"
                                            placeholder="Enter password (min 6 characters)"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-ink dark:text-paper mb-1">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full border border-line dark:border-paper/20 bg-transparent dark:bg-paper/5 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-ink dark:text-paper placeholder:text-muted/40 dark:placeholder:text-paper/40 focus:ring-2 focus:ring-accent outline-none transition"
                                            placeholder="Confirm your password"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-line dark:border-paper/10 p-4 sm:p-5 bg-paper dark:bg-paper/5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setOtpSent(true);
                                    setShowEmployeeModal(true);
                                }}
                                className="flex-1 px-4 py-2.5 border border-line dark:border-paper/20 rounded-xl text-xs sm:text-sm font-medium text-muted dark:text-paper/70 hover:bg-white dark:hover:bg-paper/10 transition-colors cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateAccount}
                                disabled={isCreatingUser}
                                className="flex-1 px-4 py-2.5 bg-accent text-paper rounded-xl text-xs sm:text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
