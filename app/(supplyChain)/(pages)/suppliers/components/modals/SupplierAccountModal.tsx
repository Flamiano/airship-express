"use client";

import React, { useState, useEffect } from "react";
import { 
    ShieldCheck, 
    Mail, 
    Send, 
    User, 
    AlertCircle, 
    Loader2, 
    Lock, 
    Unlock
} from "lucide-react";
import { Supplier } from "../../types";
import { supabase } from "../../../../lib/services/client/supabase";
import { user } from "../../../../lib/services/Class/user";
import { toast } from "sonner";
import { useConfirm } from "../../../../components/ui/ConfirmModal";
import Portal from "../../../../components/client/Portal";

interface SupplierAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: Supplier | null;
    onAccountUpdated?: () => void;
}

export function SupplierAccountModal({
    isOpen,
    onClose,
    supplier,
    onAccountUpdated,
}: SupplierAccountModalProps) {
    const { confirm } = useConfirm();
    const currentUserRole = user.getRole();
    const currentUserName = user.getName() || "Administrator";
    const canManageAccounts = ["Admin", "Executive"].includes(currentUserRole);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [existingAccount, setExistingAccount] = useState<any | null>(null);

    // Form state for creating an account
    const [contactName, setContactName] = useState("");
    const [email, setEmail] = useState("");

    // Load existing account
    useEffect(() => {
        if (!isOpen || !supplier) return;

        setContactName(supplier.contact_person || "");
        setEmail(supplier.email || "");

        const fetchAccount = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from("suppliers_account")
                    .select("*")
                    .eq("supplier_id", supplier.id)
                    .maybeSingle();

                if (!error && data) {
                    setExistingAccount(data);
                } else {
                    setExistingAccount(null);
                }
            } catch (err) {
                console.error("Error checking supplier account:", err);
                setExistingAccount(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccount();
    }, [isOpen, supplier]);

    // Create Account Handler
    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplier) return;

        if (!canManageAccounts) {
            toast.error("Permission Denied: Only Admin and Executive can create supplier accounts.");
            return;
        }

        if (!email || !contactName) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/suppliers/create-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    contactName: contactName.trim(),
                    email: email.trim().toLowerCase(),
                    invitedBy: user.getUserId() || null,
                    invitedByName: currentUserName,
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.ok) {
                throw new Error(result.message || "Failed to create supplier account");
            }

            toast.success(`Supplier registered & invitation emailed to ${email}`);
            setExistingAccount(result.data);
            onAccountUpdated?.();
        } catch (err: any) {
            console.error("Error creating supplier account:", err);
            toast.error(err.message || "Failed to create supplier account");
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Account Status (Disable / Enable)
    const handleToggleStatus = async () => {
        if (!existingAccount || !supplier) return;

        if (!canManageAccounts) {
            toast.error("Only Admin and Executive can change account status.");
            return;
        }

        const isCurrentlyActive = existingAccount.status === "Active";
        const newStatus = isCurrentlyActive ? "Disabled" : "Active";

        const agreed = await confirm({
            title: `${isCurrentlyActive ? "Disable" : "Enable"} Supplier Account`,
            message: `Are you sure you want to ${isCurrentlyActive ? "disable" : "enable"} portal access for ${supplier.name}? ${isCurrentlyActive ? "They will no longer be able to log in to the portal." : "They will regain portal access."}`,
            confirmText: isCurrentlyActive ? "Disable Account" : "Enable Account",
            cancelText: "Cancel",
            confirmVariant: isCurrentlyActive ? "danger" : "pink",
        });

        if (!agreed) return;

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from("suppliers_account")
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", existingAccount.id)
                .select()
                .single();

            if (error) throw error;

            setExistingAccount(data);
            toast.success(`Supplier account successfully ${newStatus.toLowerCase()}`);
            onAccountUpdated?.();
        } catch (err: any) {
            console.error("Error updating account status:", err);
            toast.error("Failed to update status: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Resend Email Credentials
    const handleResendCredentials = async () => {
        if (!existingAccount || !supplier) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/suppliers/send-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierName: supplier.name,
                    contactName: existingAccount.contact_name,
                    email: existingAccount.email,
                    password: existingAccount.password_hash || "Contact Procurement to reset",
                    invitedBy: currentUserName,
                }),
            });

            const result = await res.json().catch(() => ({}));

            if (res.ok && result.ok) {
                toast.success(`Credentials successfully resent to ${existingAccount.email}`);
            } else {
                toast.error(result.message || "Failed to send credentials email");
            }
        } catch (err: any) {
            toast.error(err.message || "Error dispatching email request");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !supplier) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={onClose}
                />

                {/* Neumorphic Modal Panel */}
                <div className="relative bg-[#ebf0f7] dark:bg-[#1e2130] rounded-3xl max-w-md w-full
                    border border-white/80 dark:border-white/[0.12]
                    shadow-[14px_14px_32px_#c2cad6,-14px_-14px_32px_#ffffff] dark:shadow-[16px_16px_40px_#0a0c13,-8px_-8px_30px_#2d3249]
                    animate-in fade-in zoom-in-95 duration-200 z-10 overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5
                        border-b border-slate-200/60 dark:border-white/[0.08]
                        bg-[#ebf0f7]/95 dark:bg-[#1e2130]/95">
                        <div className="flex items-center gap-3">
                            {/* Neumorphic icon container */}
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center
                                bg-[#ebf0f7] dark:bg-[#25283b]
                                shadow-[4px_4px_10px_#c2cad6,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#11131c,-3px_-3px_8px_#31354e]
                                text-pink-500 dark:text-pink-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                                    Supplier Portal Account
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                    {supplier.name} · SUP-{String(supplier.id).padStart(3, "0")}
                                </p>
                            </div>
                        </div>

                        {/* Close button — neumorphic */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white
                                bg-[#ebf0f7] dark:bg-[#25283b]
                                shadow-[3px_3px_7px_#c5cfdd,-3px_-3px_7px_#ffffff] dark:shadow-[3px_3px_7px_#11131c,-3px_-3px_7px_#31354e]
                                active:shadow-[inset_2px_2px_5px_#c5cfdd,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_#11131c,inset_-2px_-2px_5px_#31354e]
                                transition-all cursor-pointer text-sm font-bold"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        {isLoading ? (
                            /* Loading state */
                            <div className="py-14 flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center
                                    bg-[#ebf0f7] dark:bg-[#1e2130]
                                    shadow-[inset_3px_3px_7px_#c5cfdd,inset_-3px_-3px_7px_#ffffff] dark:shadow-[inset_3px_3px_7px_#0e0f17,inset_-3px_-3px_7px_#2c3047]">
                                    <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                                </div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                    Checking account status...
                                </p>
                            </div>
                        ) : existingAccount ? (
                            /* ── Existing Account View ── */
                            <div className="space-y-4">

                                {/* Account Info Card — inset neumorphic */}
                                <div className="rounded-2xl p-4 space-y-3
                                    bg-[#e3e9f3] dark:bg-[#151722]
                                    border border-transparent dark:border-white/[0.06]
                                    shadow-[inset_3px_3px_7px_#cbd4e2,inset_-3px_-3px_7px_#ffffff] dark:shadow-[inset_3px_3px_8px_#0b0d13,inset_-3px_-3px_8px_#25293d]">

                                    {/* Status row */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Account Status
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                                            shadow-[2px_2px_5px_rgba(0,0,0,0.08),-1px_-1px_4px_rgba(255,255,255,0.6)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.4)]
                                            ${existingAccount.status === "Active"
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/40"
                                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/40"
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${existingAccount.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                            {existingAccount.status}
                                        </span>
                                    </div>

                                    <div className="h-px bg-slate-200/60 dark:bg-white/[0.08]" />

                                    {/* Portal Email */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Portal Email</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                                            {existingAccount.email}
                                        </span>
                                    </div>

                                    {/* Representative */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Representative</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {existingAccount.contact_name}
                                        </span>
                                    </div>

                                    {/* Login Role */}
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Role</span>
                                        <span className="font-mono font-bold text-pink-600 dark:text-pink-400 text-[11px]
                                            px-2 py-0.5 rounded-lg
                                            bg-[#ebf0f7] dark:bg-[#25283b]
                                            shadow-[2px_2px_4px_#c5cfdd,-1px_-1px_3px_#ffffff] dark:shadow-[2px_2px_4px_#11131c,-1px_-1px_3px_#31354e]">
                                            Supplier
                                        </span>
                                    </div>
                                </div>

                                {/* Permission warning */}
                                {!canManageAccounts && (
                                    <div className="p-3 rounded-2xl flex items-center gap-2.5 text-xs
                                        bg-amber-50/80 dark:bg-amber-950/30
                                        border border-amber-200/80 dark:border-amber-900/40
                                        text-amber-700 dark:text-amber-300
                                        shadow-[inset_2px_2px_5px_rgba(251,191,36,0.15)]">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>Only Admin and Executive can modify account statuses.</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                    {/* Resend Credentials — neumorphic neutral */}
                                    <button
                                        type="button"
                                        onClick={handleResendCredentials}
                                        disabled={isSaving || existingAccount.status !== "Active"}
                                        className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-bold
                                            bg-[#ebf0f7] dark:bg-[#25283b]
                                            text-slate-700 dark:text-slate-200
                                            border border-transparent dark:border-white/[0.08]
                                            shadow-[4px_4px_10px_#c2cad6,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#11131c,-3px_-3px_8px_#31354e]
                                            hover:shadow-[6px_6px_14px_#c2cad6,-6px_-6px_14px_#ffffff] dark:hover:shadow-[6px_6px_14px_#11131c,-4px_-4px_10px_#373b57]
                                            active:shadow-[inset_3px_3px_7px_#c2cad6,inset_-3px_-3px_7px_#ffffff] dark:active:shadow-[inset_3px_3px_7px_#11131c,inset_-3px_-3px_7px_#31354e]
                                            disabled:opacity-40 disabled:cursor-not-allowed
                                            transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Resending...
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="w-3.5 h-3.5" />
                                                Resend Credentials
                                            </>
                                        )}
                                    </button>

                                    {/* Toggle Status — neumorphic colored */}
                                    {canManageAccounts && (
                                        <button
                                            type="button"
                                            onClick={handleToggleStatus}
                                            disabled={isSaving}
                                            className={`flex-1 py-2.5 px-4 rounded-2xl text-xs font-bold
                                                transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40
                                                ${existingAccount.status === "Active"
                                                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-transparent dark:border-rose-900/40 shadow-[4px_4px_10px_rgba(244,63,94,0.18),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(244,63,94,0.12)] hover:shadow-[6px_6px_14px_rgba(244,63,94,0.22)] active:shadow-[inset_3px_3px_7px_rgba(244,63,94,0.15)]"
                                                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-transparent dark:border-emerald-900/40 shadow-[4px_4px_10px_rgba(16,185,129,0.18),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(16,185,129,0.12)] hover:shadow-[6px_6px_14px_rgba(16,185,129,0.22)] active:shadow-[inset_3px_3px_7px_rgba(16,185,129,0.15)]"
                                                }`}
                                        >
                                            {isSaving ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : existingAccount.status === "Active" ? (
                                                <>
                                                    <Lock className="w-3.5 h-3.5" />
                                                    Disable Account
                                                </>
                                            ) : (
                                                <>
                                                    <Unlock className="w-3.5 h-3.5" />
                                                    Enable Account
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* ── Create Account Form ── */
                            <form onSubmit={handleCreateAccount} className="space-y-4">
                                {!canManageAccounts ? (
                                    /* Permission denied */
                                    <div className="p-4 rounded-2xl text-xs space-y-1.5
                                        bg-amber-50/80 dark:bg-amber-950/30
                                        border border-amber-200/80 dark:border-amber-900/40
                                        text-amber-700 dark:text-amber-300
                                        shadow-[inset_2px_2px_5px_rgba(251,191,36,0.12)]">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <AlertCircle className="w-4 h-4" />
                                            Account Creation Restricted
                                        </div>
                                        <p>Only Administrators and Executives are authorized to provision portal credentials for suppliers.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Contact Name Field */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 pl-1">
                                                Contact Representative Name
                                            </label>
                                            <div className="relative">
                                                <User className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    type="text"
                                                    required
                                                    value={contactName}
                                                    onChange={(e) => setContactName(e.target.value)}
                                                    placeholder="e.g. Maria Santos"
                                                    className="w-full py-2.5 pl-10 pr-4 rounded-2xl text-xs font-medium
                                                        bg-[#e3e9f3] dark:bg-[#151722]
                                                        text-slate-800 dark:text-white
                                                        border border-transparent dark:border-white/[0.06]
                                                        shadow-[inset_3px_3px_7px_#cbd4e2,inset_-3px_-3px_7px_#ffffff] dark:shadow-[inset_3px_3px_7px_#0b0d13,inset_-3px_-3px_7px_#25293d]
                                                        outline-none
                                                        placeholder:text-slate-400 dark:placeholder:text-slate-500
                                                        focus:ring-2 focus:ring-pink-400/40 dark:focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Email Field */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 pl-1">
                                                Supplier Email Address
                                            </label>
                                            <div className="relative">
                                                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="supplier@company.com"
                                                    className="w-full py-2.5 pl-10 pr-4 rounded-2xl text-xs font-medium
                                                        bg-[#e3e9f3] dark:bg-[#151722]
                                                        text-slate-800 dark:text-white
                                                        border border-transparent dark:border-white/[0.06]
                                                        shadow-[inset_3px_3px_7px_#cbd4e2,inset_-3px_-3px_7px_#ffffff] dark:shadow-[inset_3px_3px_7px_#0b0d13,inset_-3px_-3px_7px_#25293d]
                                                        outline-none
                                                        placeholder:text-slate-400 dark:placeholder:text-slate-500
                                                        focus:ring-2 focus:ring-pink-400/40 dark:focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Info note — inset card */}
                                        <div className="p-3.5 rounded-2xl text-[11px] leading-relaxed
                                            bg-[#e3e9f3] dark:bg-[#151722]
                                            border border-transparent dark:border-white/[0.06]
                                            shadow-[inset_2px_2px_5px_#cbd4e2,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#0b0d13,inset_-2px_-2px_5px_#25293d]
                                            text-slate-600 dark:text-slate-300">
                                            An account will be registered directly in Authentication and the Users table. An auto-generated secure password will be emailed to{" "}
                                            <strong className="text-pink-600 dark:text-pink-400">{email || "the supplier"}</strong> for direct sign-in.
                                        </div>

                                        {/* Form Actions */}
                                        <div className="flex gap-3 pt-1">
                                            {/* Cancel — neutral neumorphic */}
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-bold
                                                    bg-[#ebf0f7] dark:bg-[#25283b]
                                                    text-slate-600 dark:text-slate-200
                                                    border border-transparent dark:border-white/[0.08]
                                                    shadow-[4px_4px_10px_#c2cad6,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#11131c,-3px_-3px_8px_#31354e]
                                                    hover:shadow-[6px_6px_14px_#c2cad6,-6px_-6px_14px_#ffffff] dark:hover:shadow-[6px_6px_14px_#11131c,-4px_-4px_10px_#373b57]
                                                    active:shadow-[inset_3px_3px_7px_#c2cad6,inset_-3px_-3px_7px_#ffffff] dark:active:shadow-[inset_3px_3px_7px_#11131c,inset_-3px_-3px_7px_#31354e]
                                                    transition-all cursor-pointer"
                                            >
                                                Cancel
                                            </button>

                                            {/* Create & Send — pink accent neumorphic */}
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-bold text-white
                                                    bg-gradient-to-br from-pink-500 to-pink-600
                                                    shadow-[4px_4px_12px_rgba(236,72,153,0.4),-2px_-2px_8px_rgba(255,255,255,0.15)] dark:shadow-[4px_4px_12px_rgba(236,72,153,0.35),-2px_-2px_8px_rgba(255,255,255,0.04)]
                                                    hover:shadow-[6px_6px_16px_rgba(236,72,153,0.5)] hover:from-pink-400 hover:to-pink-500
                                                    active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.2)] active:from-pink-600 active:to-pink-700
                                                    disabled:opacity-50 disabled:cursor-not-allowed
                                                    transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="w-3.5 h-3.5" />
                                                        Create &amp; Send Email
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
