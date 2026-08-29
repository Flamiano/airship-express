"use client";

import { useState, useMemo } from "react";
import {
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    X,
    Loader2,
    LogOut,
    ShieldCheck,
    KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Portal from "@/app/(supplyChain)/components/client/Portal";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    userName?: string;
    userRole?: string;
}

export function ChangePasswordModal({
    isOpen,
    onClose,
    userEmail,
    userName,
    userRole,
}: ChangePasswordModalProps) {
    const router = useRouter();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMode, setSubmitMode] = useState<"save" | "save_logout" | null>(null);
    const [isSuccessState, setIsSuccessState] = useState(false);

    // Password criteria check
    const criteria = useMemo(() => {
        return {
            length: newPassword.length >= 8,
            uppercase: /[A-Z]/.test(newPassword),
            lowercase: /[a-z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            match: newPassword.length > 0 && newPassword === confirmPassword,
            different: currentPassword.length > 0 && newPassword.length > 0 && currentPassword !== newPassword,
        };
    }, [newPassword, confirmPassword, currentPassword]);

    const isAllCriteriaMet = useMemo(() => {
        return (
            criteria.length &&
            criteria.uppercase &&
            criteria.lowercase &&
            criteria.number &&
            criteria.match &&
            currentPassword.trim().length > 0
        );
    }, [criteria, currentPassword]);

    // Format name into initials
    const getInitials = (name?: string): string => {
        if (!name || !name.trim()) return "U";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const resetForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setIsSubmitting(false);
        setSubmitMode(null);
        setIsSuccessState(false);
    };

    const handleClose = () => {
        if (isSubmitting) return;
        resetForm();
        onClose();
    };

    const performClientLogout = async () => {
        const sessionToken = typeof window !== "undefined" ? localStorage.getItem("session_token") : null;
        if (sessionToken) {
            try {
                await fetch("/api/supplyChain/logout", {
                    method: "POST",
                    headers: { "x-session-token": sessionToken },
                });
            } catch (e) {
                // non-critical
            }
        }

        if (typeof window !== "undefined") {
            localStorage.removeItem("session_token");
            localStorage.removeItem("user_role");
            localStorage.removeItem("session_expires");
            localStorage.removeItem("user_name");
            localStorage.removeItem("user_email");
            localStorage.removeItem("logged_in_email");
            localStorage.removeItem("user_agent");
            localStorage.removeItem("user_ip");
            localStorage.removeItem("user_id");
            localStorage.removeItem("session_backup");
            localStorage.removeItem("session_backup_2");
            localStorage.removeItem("session_backup_3");

            try {
                sessionStorage.removeItem("session_backup");
            } catch (e) {}

            document.cookie = "session_token=; path=/; max-age=0";
            document.cookie = "session_backup=; path=/; max-age=0";
            document.cookie = "session_backup_2=; path=/; max-age=0";
            document.cookie = "session_backup_3=; path=/; max-age=0";
        }

        router.push("/scAuth");
        router.refresh();
    };

    const handleSubmit = async (logoutAfter: boolean) => {
        if (!currentPassword.trim()) {
            toast.error("Please enter your current password.");
            return;
        }

        if (!criteria.length) {
            toast.error("Password must be at least 8 characters long.");
            return;
        }
        if (!criteria.uppercase) {
            toast.error("Password must contain at least 1 uppercase letter.");
            return;
        }
        if (!criteria.lowercase) {
            toast.error("Password must contain at least 1 lowercase letter.");
            return;
        }
        if (!criteria.number) {
            toast.error("Password must contain at least 1 number.");
            return;
        }
        if (!criteria.match) {
            toast.error("New password and confirm password do not match.");
            return;
        }
        if (currentPassword === newPassword) {
            toast.error("New password must be different from your current password.");
            return;
        }

        setIsSubmitting(true);
        setSubmitMode(logoutAfter ? "save_logout" : "save");

        try {
            const sessionToken = typeof window !== "undefined" ? localStorage.getItem("session_token") : null;
            const email = userEmail || (typeof window !== "undefined" ? localStorage.getItem("user_email") || localStorage.getItem("logged_in_email") : "");
            const name = userName || (typeof window !== "undefined" ? localStorage.getItem("user_name") : "");
            const role = userRole || (typeof window !== "undefined" ? localStorage.getItem("user_role") : "");

            const response = await fetch("/api/supplyChain/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(sessionToken ? { "x-session-token": sessionToken } : {}),
                },
                body: JSON.stringify({
                    email,
                    userName: name,
                    role,
                    currentPassword,
                    newPassword,
                    confirmPassword,
                    logoutAfterSave: logoutAfter,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                toast.error(result.message || "Failed to update password.");
                setIsSubmitting(false);
                setSubmitMode(null);
                return;
            }

            toast.success(result.message || "Password updated successfully!");

            if (logoutAfter) {
                await performClientLogout();
            } else {
                setIsSuccessState(true);
                setIsSubmitting(false);
                setSubmitMode(null);
            }
        } catch (error: any) {
            console.error("Change password error:", error);
            toast.error("An unexpected error occurred. Please try again.");
            setIsSubmitting(false);
            setSubmitMode(null);
        }
    };

    const effectiveEmail = userEmail || (typeof window !== "undefined" ? localStorage.getItem("user_email") || localStorage.getItem("logged_in_email") || "" : "");
    const effectiveName = userName || (typeof window !== "undefined" ? localStorage.getItem("user_name") || "User" : "User");
    const effectiveRole = userRole || (typeof window !== "undefined" ? localStorage.getItem("user_role") || "Employee" : "Employee");

    if (!isOpen) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 
                          bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm 
                          overflow-hidden animate-in fade-in duration-200"
                onClick={handleClose}
            >
                {/* Modal Container */}
                <div
                    className="flex flex-col w-full max-w-lg max-h-[88vh] 
                            bg-white dark:bg-[#2a2a2e] 
                            rounded-2xl shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] 
                            overflow-hidden border border-gray-100 dark:border-slate-700/60 
                            transform transition-all animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Fixed Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-gray-100 dark:border-slate-700/60 px-6 py-5 bg-white dark:bg-[#2a2a2e]">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-800/30">
                                <KeyRound className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                                    Change Password
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                    Update your credentials to secure your account
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 p-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5 dark:bg-[#1c1b1f]">
                        {isSuccessState ? (
                            /* Success Confirmation Screen */
                            <div className="text-center py-4 space-y-4">
                                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/40 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                                    <ShieldCheck className="h-8 w-8" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Password Updated Successfully!
                                    </h4>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                        Your new password is now active. You can continue working or log out to sign in again.
                                    </p>
                                </div>

                                <div className="p-3.5 bg-gray-50/80 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-700/60 rounded-xl text-left text-xs space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-slate-400">Account:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{effectiveEmail}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-slate-400">Status:</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Secured & Updated</span>
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                                    <button
                                        type="button"
                                        onClick={performClientLogout}
                                        className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs sm:text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>Save & Logout</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Done</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Change Password Form */
                            <>
                                {/* User summary pill */}
                                <div className="flex items-center gap-3.5 p-3.5 bg-gray-50/80 dark:bg-slate-800/30 rounded-xl border border-gray-100 dark:border-slate-700/60">
                                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-pink-600 dark:bg-pink-500 text-white text-sm font-bold shrink-0 select-none">
                                        {getInitials(effectiveName)}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {effectiveName}
                                            </span>
                                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200/60 dark:border-pink-800/40 shrink-0">
                                                {effectiveRole}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                                            {effectiveEmail}
                                        </span>
                                    </div>
                                </div>

                                {/* Current Password Field */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                                        Current Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter your current password"
                                            disabled={isSubmitting}
                                            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#2a2a2e] border border-gray-200/90 dark:border-slate-700/60 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-pink-500 outline-none transition"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword((prev) => !prev)}
                                            tabIndex={-1}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition cursor-pointer"
                                        >
                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password Field */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                                        New Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new strong password"
                                            disabled={isSubmitting}
                                            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#2a2a2e] border border-gray-200/90 dark:border-slate-700/60 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-pink-500 outline-none transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword((prev) => !prev)}
                                            tabIndex={-1}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition cursor-pointer"
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>

                                    {/* Inline Requirements - Only shown when typing */}
                                    {newPassword.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1 animate-in fade-in duration-150">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                                                criteria.length
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40'
                                            }`}>
                                                {criteria.length ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                                                8+ chars
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                                                criteria.uppercase
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40'
                                            }`}>
                                                {criteria.uppercase ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                                                1 uppercase
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                                                criteria.lowercase
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40'
                                            }`}>
                                                {criteria.lowercase ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                                                1 lowercase
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                                                criteria.number
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40'
                                            }`}>
                                                {criteria.number ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                                                1 number
                                            </span>
                                        </div>
                                    )}
                                </div>

                                    {/* Confirm New Password Field */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                                                Confirm New Password <span className="text-rose-500">*</span>
                                            </label>
                                        {confirmPassword.length > 0 && (
                                            <span className={`text-[10px] font-semibold flex items-center gap-1 ${criteria.match ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                {criteria.match ? (
                                                    <>
                                                        <CheckCircle2 className="h-3 w-3" /> Passwords match
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="h-3 w-3" /> Passwords do not match
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your new password"
                                            disabled={isSubmitting}
                                            className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#2a2a2e] border rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-pink-500 outline-none transition ${
                                                confirmPassword.length > 0 && !criteria.match
                                                    ? 'border-rose-400 dark:border-rose-500/80 focus:ring-rose-400'
                                                    : 'border-gray-200/90 dark:border-slate-700/60'
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                                            tabIndex={-1}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition cursor-pointer"
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons - Inline */}
                                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        disabled={isSubmitting}
                                        className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-[#1c1d25] hover:bg-gray-50 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                                    >
                                        Cancel
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSubmit(false)}
                                            disabled={isSubmitting || !isAllCriteriaMet}
                                            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/50 border border-gray-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-[#1c1d25] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                                            title="Save password and keep current session"
                                        >
                                            {isSubmitting && submitMode === "save" ? (
                                                <>
                                                    <Loader2 className="animate-spin h-3.5 w-3.5 text-pink-500" />
                                                    <span>Saving...</span>
                                                </>
                                            ) : (
                                                <span>Save Changes</span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSubmit(true)}
                                            disabled={isSubmitting || !isAllCriteriaMet}
                                            className="px-4.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                                            title="Save password and log out to sign in again"
                                        >
                                            {isSubmitting && submitMode === "save_logout" ? (
                                                <>
                                                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                                                    <span>Logging out...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LogOut className="h-3.5 w-3.5" />
                                                    <span>Save & Logout</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}

export default ChangePasswordModal;
