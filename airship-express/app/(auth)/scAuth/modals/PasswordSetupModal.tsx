'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Loader2, Check, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { maskEmail } from '../services/scAuthService';

const isUUID = (str?: string | null): boolean => {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

const formatId = (id?: string | null): string => {
    if (!id) return '';
    const trimmed = id.trim();
    if (isUUID(trimmed)) {
        return trimmed.slice(0, 8) + '...';
    }
    return trimmed;
};

interface PasswordSetupModalProps {
    showPasswordModal: boolean;
    selectedEmployeeForPassword: any;
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
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password criteria rules
    const rules = useMemo(() => [
        {
            id: 'length',
            label: 'At least 8 characters',
            isValid: newPassword.length >= 8,
        },
        {
            id: 'uppercase',
            label: 'At least 1 uppercase letter (A-Z)',
            isValid: /[A-Z]/.test(newPassword),
        },
        {
            id: 'lowercase',
            label: 'At least 1 lowercase letter (a-z)',
            isValid: /[a-z]/.test(newPassword),
        },
        {
            id: 'number',
            label: 'At least 1 number (0-9)',
            isValid: /[0-9]/.test(newPassword),
        },
        {
            id: 'special',
            label: 'At least 1 special character (!@#$%...)',
            isValid: /[^A-Za-z0-9]/.test(newPassword),
        },
    ], [newPassword]);

    const passedCount = rules.filter((r) => r.isValid).length;

    // Strength indicator
    const strength = useMemo(() => {
        if (newPassword.length === 0) {
            return { label: 'Not Set', score: 0, color: 'text-muted/60 dark:text-paper/40', barColor: 'bg-slate-300 dark:bg-slate-700' };
        }
        if (passedCount <= 2) {
            return { label: 'Weak', score: 1, color: 'text-rose-500', barColor: 'bg-rose-500' };
        }
        if (passedCount <= 4) {
            return { label: 'Medium', score: 2, color: 'text-amber-500', barColor: 'bg-amber-500' };
        }
        return { label: 'Strong', score: 3, color: 'text-emerald-500', barColor: 'bg-emerald-500' };
    }, [newPassword, passedCount]);

    return (
        <AnimatePresence>
            {showPasswordModal && selectedEmployeeForPassword && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-none my-auto overflow-hidden"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="text-center mb-5 sm:mb-6">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <User className="text-accent" size={26} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage">Set Up Your Account</h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Create your account to access the supply chain system
                                </p>
                            </div>

                            {/* Recessed Neumorphic Employee Info Card */}
                            <div className="mb-4 p-3.5 sm:p-4 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl border border-white/40 dark:border-white/[0.06]">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Employee</p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base mt-0.5">{selectedEmployeeForPassword.display_name}</p>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-all">{maskEmail(selectedEmployeeForPassword.email)}</p>
                                {(selectedEmployeeForPassword.employee_id || selectedEmployeeForPassword.id) && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">ID: {formatId(selectedEmployeeForPassword.employee_id || selectedEmployeeForPassword.id)}</p>
                                )}
                                {(() => {
                                    const hasDept = selectedEmployeeForPassword.department && selectedEmployeeForPassword.department.toLowerCase().trim() !== selectedEmployeeForPassword.role?.toLowerCase().trim();
                                    const hasPos = selectedEmployeeForPassword.position && selectedEmployeeForPassword.position.toLowerCase().trim() !== selectedEmployeeForPassword.role?.toLowerCase().trim() && selectedEmployeeForPassword.position.toLowerCase().trim() !== selectedEmployeeForPassword.department?.toLowerCase().trim();

                                    if (!hasDept && !hasPos) return null;
                                    return (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {hasDept && selectedEmployeeForPassword.department}
                                            {hasDept && hasPos && ' • '}
                                            {hasPos && selectedEmployeeForPassword.position}
                                        </p>
                                    );
                                })()}
                                <span className={`inline-block mt-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg shadow-[2px_2px_5px_rgba(0,0,0,0.08)] ${getRoleColor(selectedEmployeeForPassword.role)}`}>
                                    {selectedEmployeeForPassword.role}
                                </span>
                            </div>

                            <div className="space-y-3.5">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-accent/40 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                            placeholder="Enter password (min 8 characters)"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Password Strength Meter & Live Validation Checklist */}
                                <div className="p-3 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] rounded-2xl border border-white/40 dark:border-white/[0.06] space-y-2">
                                    {/* Strength Bar */}
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                            <ShieldCheck size={13} className={strength.color} />
                                            Password Strength
                                        </span>
                                        <span className={`font-bold uppercase tracking-wider text-[10px] ${strength.color}`}>
                                            {strength.label}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 1 ? strength.barColor : 'bg-transparent'}`} />
                                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 2 ? strength.barColor : 'bg-transparent'}`} />
                                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 3 ? strength.barColor : 'bg-transparent'}`} />
                                    </div>

                                    {/* Requirements Checklist */}
                                    <div className="pt-1 grid grid-cols-1 gap-1.5 text-[11px]">
                                        {rules.map((rule) => (
                                            <div
                                                key={rule.id}
                                                className={`flex items-center gap-2 transition-colors ${
                                                    rule.isValid
                                                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                <div
                                                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                                        rule.isValid
                                                            ? 'bg-emerald-500 text-white shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                                            : 'bg-slate-300 dark:bg-slate-700 text-transparent'
                                                    }`}
                                                >
                                                    <Check size={9} strokeWidth={3.5} />
                                                </div>
                                                <span>{rule.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-accent/40 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition"
                                            placeholder="Confirm your password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {confirmPassword.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-[11px] pt-1.5">
                                            {newPassword === confirmPassword ? (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                    <Check size={12} strokeWidth={3} /> Passwords match
                                                </span>
                                            ) : (
                                                <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                                                    <X size={12} strokeWidth={3} /> Passwords do not match
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Neumorphic Modal Footer */}
                        <div className="shrink-0 border-t border-white/60 dark:border-white/[0.08] p-4 sm:p-5 bg-[#EEF2F6] dark:bg-[#161A23] flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setOtpSent(true);
                                    setShowEmployeeModal(true);
                                }}
                                className="flex-1 px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08]"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateAccount}
                                disabled={isCreatingUser}
                                className="flex-1 px-4 py-2.5 bg-accent text-paper rounded-xl text-xs sm:text-sm font-medium shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] hover:bg-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-accent/30"
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
