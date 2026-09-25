'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Search,
    Send,
    CheckCircle,
    AlertCircle,
    User,
    Building,
    Loader2,
    Clock,
    Mail,
    LogIn,
    AlertTriangle,
    MessageSquare,
    Eye as EyeIcon,
    Lock
} from 'lucide-react';
import { maskEmail } from '../services/scAuthService';

const isUUID = (str?: string | null): boolean => {
    if (!str) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
};

export const isDropOffPickupRider = (emp: any): boolean => {
    if (!emp) return false;
    const pos = (emp.position || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const role = (emp.role || '').toLowerCase();
    const title = (emp.job_title || emp.title || '').toLowerCase();
    return (
        pos.includes('rider') ||
        pos.includes('driver') ||
        pos.includes('drop-off') ||
        pos.includes('drop off') ||
        pos.includes('pick-up') ||
        pos.includes('pick up') ||
        title.includes('rider') ||
        title.includes('driver') ||
        dept.includes('rider') ||
        dept.includes('driver') ||
        role.includes('rider') ||
        role.includes('driver')
    );
};

const formatId = (id?: string | null): string => {
    if (!id) return '';
    const trimmed = id.trim();
    if (isUUID(trimmed)) {
        return trimmed.slice(0, 8) + '...';
    }
    return trimmed;
};

interface EmployeeSelectionModalProps {
    showEmployeeModal: boolean;
    loggedInUser: any;
    employees: any[];
    selectedEmployee: any;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    isLoadingEmployees: boolean;
    isSelectionLocked: boolean;
    isCheckingRemembered: boolean;
    isDeviceBlocked: boolean;
    isCurrentlyActive: boolean;
    isRemembered: boolean;
    isRequestingOTP: boolean;
    isResending: boolean;
    isVerifying: boolean;
    otpSent: boolean;
    otpCode: string[];
    otpError: string | null;
    otpSuccess: string | null;
    rememberMe: boolean;
    setRememberMe: (v: boolean) => void;
    countdown: number;
    otpExpiresIn?: number;
    existingAppeal: any;
    blockedDeviceId: string | null;
    getRoleColor: (role: string) => string;
    handleEmployeeSelect: (emp: any) => void;
    handleCloseModal: () => void;
    handleLoginWithRemembered: () => void;
    requestOTP: () => void;
    resendOTP: () => void;
    verifyOTP: () => void;
    handleOtpChange: (index: number, value: string) => void;
    handleOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
    handleOtpPaste: (e: React.ClipboardEvent) => void;
    openAppealModal: () => void;
    setOtpSent: (v: boolean) => void;
    setOtpCode: (v: string[]) => void;
    setOtpError: (v: string | null) => void;
    setOtpSuccess: (v: string | null) => void;
    setIsRemembered: (v: boolean) => void;
}

export default function EmployeeSelectionModal({
    showEmployeeModal,
    loggedInUser,
    employees,
    selectedEmployee,
    searchTerm,
    setSearchTerm,
    isLoadingEmployees,
    isSelectionLocked,
    isCheckingRemembered,
    isDeviceBlocked,
    isCurrentlyActive,
    isRemembered,
    isRequestingOTP,
    isResending,
    isVerifying,
    otpSent,
    otpCode,
    otpError,
    otpSuccess,
    rememberMe,
    setRememberMe,
    countdown,
    otpExpiresIn = 300,
    existingAppeal,
    getRoleColor,
    handleEmployeeSelect,
    handleCloseModal,
    handleLoginWithRemembered,
    requestOTP,
    resendOTP,
    verifyOTP,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    openAppealModal,
    setOtpSent,
    setOtpCode,
    setOtpError,
    setOtpSuccess,
    setIsRemembered,
}: EmployeeSelectionModalProps) {
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
    const [isDebouncing, setIsDebouncing] = useState(false);

    useEffect(() => {
        if (!searchTerm) {
            setDebouncedSearchTerm('');
            setIsDebouncing(false);
            return;
        }
        setIsDebouncing(true);
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setIsDebouncing(false);
        }, 250);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const isAdminOrExec = loggedInUser?.role === 'Admin' || loggedInUser?.role === 'Executive';

    const filteredEmployees = useMemo(() => {
        // Exclude Drop-Off Pick-Up Riders / Drivers from the selection modal
        const eligibleEmployees = (employees || []).filter(emp => !isDropOffPickupRider(emp));

        const query = debouncedSearchTerm.toLowerCase().trim();
        if (!query) return eligibleEmployees;
        return eligibleEmployees.filter(emp =>
            (emp.display_name || '').toLowerCase().includes(query) ||
            (emp.employee_id || '').toLowerCase().includes(query) ||
            (emp.id || '').toLowerCase().includes(query) ||
            (emp.email || '').toLowerCase().includes(query) ||
            (emp.position || '').toLowerCase().includes(query) ||
            (emp.department || '').toLowerCase().includes(query)
        );
    }, [employees, debouncedSearchTerm]);

    const displayedEmployees = filteredEmployees;

    return (
        <AnimatePresence>
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-none my-auto overflow-hidden"
                    >
                        {/* modal header */}
                        <div className="border-b border-white/60 dark:border-white/[0.06] p-4 sm:p-6 flex justify-between items-center bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 transition-colors">
                            <div className="flex items-center gap-3 sm:gap-3.5">
                                <div className="p-2 sm:p-2.5 rounded-2xl bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-accent/20 text-accent shrink-0">
                                    {isAdminOrExec ? (
                                        <Lock size={20} className="text-accent sm:w-[22px] sm:h-[22px]" />
                                    ) : (
                                        <Building size={20} className="text-accent sm:w-[22px] sm:h-[22px]" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-bricolage tracking-tight">
                                        {loggedInUser?.role === 'Admin'
                                            ? 'Select Admin Account'
                                            : loggedInUser?.role === 'Executive'
                                                ? 'Select Executive Account'
                                                : 'Select Employee from HR System'}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {loggedInUser?.role === 'Admin'
                                                ? 'Admin Directory'
                                                : loggedInUser?.role === 'Executive'
                                                    ? 'Executive Directory'
                                                    : 'HR System Directory'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_#c4d0df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] transition-all p-2 rounded-xl cursor-pointer"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* user info bar */}
                        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[#EAF0F6] dark:bg-[#13161F] border-b border-white/60 dark:border-white/[0.06] flex items-center justify-between text-xs shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Logged in as:</span>
                                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-none">
                                    {loggedInUser?.display_name || maskEmail(loggedInUser?.email)}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-lg font-semibold text-[10px] sm:text-[11px] tracking-wide shadow-[1px_1px_3px_rgba(0,0,0,0.05)] ${getRoleColor(loggedInUser?.role)}`}>
                                    {loggedInUser?.role}
                                </span>
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline-block font-medium">
                                {isAdminOrExec ? 'Select an account to verify' : 'Select an employee to verify'}
                            </span>
                        </div>

                        {isDeviceBlocked ? (
                            // device blocked view
                            <div className="p-4 sm:p-8 text-center flex-1 overflow-y-auto custom-scrollbar bg-[#EEF2F6] dark:bg-[#161A23]">
                                <div className="w-16 h-16 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-8 w-8 text-rose-500 dark:text-rose-400" />
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-bricolage">Device Blocked</h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
                                    This device has been restricted and blocked by an administrator.
                                </p>

                                {/* admin response section */}
                                {existingAppeal?.response_message && (
                                    <div className="mt-5 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 border border-white/40 dark:border-white/[0.06] text-left">
                                        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-accent/10 dark:bg-accent/20 border border-accent/20 rounded-lg flex items-center justify-center text-xs font-bold text-accent">
                                                    A
                                                </div>
                                                <span className="text-xs font-semibold text-slate-900 dark:text-white">Admin Response</span>
                                            </div>

                                            {existingAppeal.status === 'approved' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                                                    <CheckCircle size={12} />
                                                    Approved
                                                </span>
                                            )}
                                            {existingAppeal.status === 'rejected' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-800/40">
                                                    <AlertCircle size={12} />
                                                    Rejected
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                            {existingAppeal.response_message}
                                        </p>

                                        {existingAppeal.resolved_at && (
                                            <div className="mt-3 pt-2.5 border-t border-white/60 dark:border-white/[0.06] text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                Resolved: {new Date(existingAppeal.resolved_at).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* pending or submitted status section */}
                                {existingAppeal && !existingAppeal.response_message && (
                                    <div className="mt-5 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 border border-amber-500/20 text-left">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-xs font-bold text-amber-800 dark:text-amber-400">
                                                Status: {existingAppeal.status === 'pending' ? 'Under Admin Review' : existingAppeal.status === 'approved' ? 'Approved' : 'Rejected'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                                            {existingAppeal.status === 'pending' ? 'Your appeal has been logged and is waiting for review.' :
                                                existingAppeal.status === 'approved' ? 'Appeal approved! Device access will be granted shortly.' :
                                                    'Appeal rejected. Please reach out to support for further assistance.'}
                                        </p>
                                        <div className="mt-2.5 pt-2 border-t border-white/60 dark:border-white/[0.06] text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                            Submitted: {new Date(existingAppeal.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                                    {existingAppeal ?
                                        (existingAppeal.response_message ? 'An admin has reviewed and replied to your appeal.' :
                                            'Your appeal is currently processing.') :
                                        'If you believe this restriction is a mistake, you can submit an appeal ticket.'}
                                </p>

                                <button
                                    onClick={openAppealModal}
                                    className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dark text-paper rounded-xl text-xs font-semibold shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all cursor-pointer border border-accent/30"
                                >
                                    {existingAppeal ? (
                                        <>
                                            <EyeIcon size={15} />
                                            <span>{existingAppeal.response_message ? 'View Response' : 'Review Appeal'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare size={15} />
                                            <span>Submit Appeal</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : !otpSent ? (
                            // employee selection view
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#EEF2F6] dark:bg-[#161A23]">
                                <div className="p-3.5 sm:p-4 border-b border-white/60 dark:border-white/[0.06] bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 transition-colors">
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 shrink-0 pointer-events-none" size={18} />
                                        <input
                                            type="text"
                                            placeholder={isAdminOrExec ? "Search account by name, ID, or email..." : "Search employee by name, ID, or email..."}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-accent/40 rounded-xl text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {isDebouncing && (
                                                <Loader2 className="animate-spin text-accent shrink-0" size={15} />
                                            )}
                                            {searchTerm && !isDebouncing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchTerm('')}
                                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                                                    aria-label="Clear search"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3.5 sm:p-4 flex-1 min-h-0 overflow-y-auto space-y-3 custom-scrollbar bg-[#EEF2F6] dark:bg-[#161A23]">
                                    {isLoadingEmployees ? (
                                        <div className="text-center py-10 sm:py-14">
                                            <Loader2 className="animate-spin text-accent mx-auto" size={32} />
                                            <p className="mt-2.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                                                {isAdminOrExec ? 'Fetching accounts...' : 'Fetching directory from HR system...'}
                                            </p>
                                        </div>
                                    ) : filteredEmployees.length === 0 ? (
                                        <div className="text-center py-10 sm:py-14 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl border border-white/40 dark:border-white/[0.06]">
                                            <div className="w-12 h-12 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                                                <User size={24} />
                                            </div>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                                                {isAdminOrExec ? 'No matching accounts found' : 'No matching employees found'}
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search terms</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {displayedEmployees.map((emp) => {
                                                const isRider = isDropOffPickupRider(emp);
                                                const isSelected = selectedEmployee?.id === emp.id;
                                                const isDisabled = isSelectionLocked || isCheckingRemembered || isDeviceBlocked || isRider;

                                                return (
                                                    <button
                                                        key={emp.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isRider) return;
                                                            handleEmployeeSelect(emp);
                                                        }}
                                                        disabled={isDisabled}
                                                        title={isRider ? "Drop-Off Pick-Up Drivers are field personnel and cannot access the web portal." : undefined}
                                                        className={`w-full text-left px-4 py-3 rounded-2xl transition-all duration-150 border
                                                            ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
                                                            ${isSelected
                                                                ? 'bg-[#E2ECF6] dark:bg-[#192233] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border-accent/60'
                                                                : isRider
                                                                    ? 'bg-[#E5EBF2]/60 dark:bg-[#151821]/60 shadow-none border-dashed border-slate-300 dark:border-slate-800'
                                                                    : 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] border-white/70 dark:border-white/[0.06] hover:border-accent/30'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                {/* Row 1: Name + Short ID + Status */}
                                                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                                    <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-[240px]">
                                                                        {emp.display_name}
                                                                    </span>
                                                                    {(emp.employee_id || emp.id) && (
                                                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-[#EAF0F6] dark:bg-[#13161F] px-1.5 py-0.5 rounded-md border border-white/40 dark:border-white/[0.06] shrink-0">
                                                                            {formatId(emp.employee_id || emp.id)}
                                                                        </span>
                                                                    )}

                                                                    {isRider && (
                                                                        <span className="text-[10px] bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/30 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                            Field Staff (Driver)
                                                                        </span>
                                                                    )}

                                                                    {!isRider && emp.is_active && (
                                                                        <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                                            Active
                                                                        </span>
                                                                    )}
                                                                    {!isRider && !emp.is_active && emp.remembered && (
                                                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                            Remembered
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Row 2: Email (+ Department/Position) on left, Role badge on right */}
                                                                <div className="flex items-center justify-between gap-2 mt-1.5">
                                                                    <div className="flex items-center gap-1.5 min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                                                                        <span className="truncate">{maskEmail(emp.email)}</span>
                                                                        {emp.department && emp.department.toLowerCase().trim() !== emp.role?.toLowerCase().trim() && (
                                                                            <>
                                                                                <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                                                                                <span className="truncate">{emp.department}</span>
                                                                            </>
                                                                        )}
                                                                        {emp.position && emp.position.toLowerCase().trim() !== emp.role?.toLowerCase().trim() && emp.position.toLowerCase().trim() !== emp.department?.toLowerCase().trim() && (
                                                                            <>
                                                                                <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                                                                                <span className="truncate">{emp.position}</span>
                                                                            </>
                                                                        )}
                                                                    </div>

                                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-[1px_1px_3px_rgba(0,0,0,0.05)] shrink-0 ml-auto ${getRoleColor(emp.role)}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {isSelected && (
                                                                <div className="shrink-0 bg-accent/15 dark:bg-accent/20 p-1 rounded-full text-accent ml-1">
                                                                    <CheckCircle size={18} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Selection Bar */}
                                <div className="border-t border-white/60 dark:border-white/[0.06] p-4 sm:p-5 bg-[#EEF2F6] dark:bg-[#161A23] shrink-0 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                        {selectedEmployee ? (
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                <CheckCircle className="text-emerald-500 dark:text-emerald-400 shrink-0" size={16} />
                                                <span className="font-medium text-slate-500 dark:text-slate-400 text-xs">Selected:</span>
                                                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[180px] text-xs">
                                                    {selectedEmployee.display_name}
                                                </span>

                                                {isCheckingRemembered ? (
                                                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs">
                                                        <Loader2 className="animate-spin text-accent" size={13} />
                                                        <span>Checking...</span>
                                                    </div>
                                                ) : isCurrentlyActive ? (
                                                    <span className="text-[10px] bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 px-2 py-0.5 rounded-full font-bold">
                                                        Logged In
                                                    </span>
                                                ) : isRemembered ? (
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 px-2 py-0.5 rounded-full font-bold">
                                                        Remembered
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] bg-[#EAF0F6] dark:bg-[#13161F] text-slate-500 dark:text-slate-400 border border-white/40 dark:border-white/[0.06] px-2 py-0.5 rounded-full font-medium">
                                                        Not remembered
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                {isAdminOrExec ? 'Select an account from the list' : 'Select an employee from the HR list'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer border border-white/60 dark:border-white/[0.08]"
                                        >
                                            Cancel
                                        </button>

                                        {selectedEmployee && isCurrentlyActive ? (
                                            <button
                                                type="button"
                                                disabled
                                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                                <span>Logged In</span>
                                            </button>
                                        ) : selectedEmployee && isRemembered ? (
                                            <button
                                                type="button"
                                                onClick={handleLoginWithRemembered}
                                                disabled={isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-[4px_4px_10px_rgba(16,185,129,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                                            >
                                                <LogIn size={15} />
                                                <span>Login</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => requestOTP()}
                                                disabled={!selectedEmployee || isRequestingOTP || isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-accent hover:bg-accent-dark text-paper text-xs sm:text-sm font-semibold rounded-xl shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-accent/30"
                                            >
                                                {isRequestingOTP || isCheckingRemembered ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={15} />
                                                        <span>{isRequestingOTP ? 'Sending...' : 'Checking...'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={15} />
                                                        <span>Send OTP</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // otp verification view
                            <div className="p-5 sm:p-8 bg-[#EEF2F6] dark:bg-[#161A23] text-slate-900 dark:text-white transition-colors flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                                <div>
                                    <div className="text-center mb-6">
                                        <div className="w-13 h-13 sm:w-15 sm:h-15 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[5px_5px_10px_#d1dbe7,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_12px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                                            {isVerifying ? (
                                                <Loader2 className="animate-spin text-accent" size={26} />
                                            ) : (
                                                <Mail className="text-accent" size={26} />
                                            )}
                                        </div>
                                        <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-bricolage tracking-tight">
                                            Verify Security Code
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                            Enter the 6-digit verification code sent to
                                        </p>
                                        <p className="text-xs font-bold text-accent mt-0.5 tracking-tight break-all">
                                            {maskEmail(selectedEmployee?.email)}
                                        </p>
                                        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <span>{isAdminOrExec ? 'Account:' : 'HR Employee:'}</span>
                                            <span className="font-semibold text-slate-900 dark:text-white">{selectedEmployee?.display_name || loggedInUser?.display_name}</span>
                                            {(selectedEmployee?.employee_id || selectedEmployee?.id) && (
                                                <span className="font-mono text-slate-400 dark:text-slate-500">({formatId(selectedEmployee.employee_id || selectedEmployee.id)})</span>
                                            )}
                                        </div>
                                    </div>

                                    {otpSuccess && (
                                        <div className="mb-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5 text-center">
                                            <CheckCircle size={14} className="shrink-0" />
                                            <span>{otpSuccess}</span>
                                        </div>
                                    )}

                                    {otpError && (
                                        <div className="mb-3 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center justify-center gap-1.5 text-center bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                                            <AlertCircle size={14} className="shrink-0" />
                                            <span>{otpError}</span>
                                        </div>
                                    )}

                                    {otpExpiresIn === 0 && otpCode.some(d => d) && !otpError && (
                                        <div className="mb-3 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-center gap-1.5 text-center bg-rose-50/70 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200/80 dark:border-rose-900/40 animate-pulse">
                                            <AlertCircle size={14} className="shrink-0" />
                                            <span>Inputted OTP is already expired. Please click Resend Code.</span>
                                        </div>
                                    )}

                                    <div className="flex justify-center gap-2 sm:gap-3 my-5 sm:my-7">
                                        {otpCode.map((digit, index) => (
                                            <input
                                                key={index}
                                                id={`otp-${index}`}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                onPaste={index === 0 ? handleOtpPaste : undefined}
                                                className={`w-10 h-12 sm:w-13 sm:h-14 text-center text-lg sm:text-2xl font-bold rounded-2xl transition-all duration-150 outline-none
                                                    ${otpError || (otpExpiresIn === 0 && digit)
                                                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-2 border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-400'
                                                        : digit
                                                            ? 'bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[3px_3px_6px_#d1dbe7,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] border-2 border-accent text-slate-900 dark:text-white'
                                                            : 'bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.7),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] border border-white/40 dark:border-white/[0.06] text-slate-900 dark:text-white hover:border-accent/40'
                                                    }
                                                    focus:border-accent focus:ring-2 focus:ring-accent/30
                                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                                                disabled={isVerifying}
                                                autoFocus={index === 0}
                                            />
                                        ))}
                                    </div>

                                    {/* Remember Me Card */}
                                    <div className="flex items-center justify-between mb-4 bg-[#EAF0F6] dark:bg-[#13161F] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] p-3.5 rounded-2xl border border-white/40 dark:border-white/[0.06]">
                                        <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent cursor-pointer"
                                                disabled={isVerifying}
                                            />
                                            <span>Remember me on this device</span>
                                        </label>
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 bg-[#EEF2F6] dark:bg-[#1A1F2B] px-2.5 py-0.5 rounded-lg border border-white/60 dark:border-white/[0.08] shadow-[2px_2px_4px_rgba(0,0,0,0.05)] shrink-0">
                                            {rememberMe ? '15 days' : '8 hours'}
                                        </span>
                                    </div>

                                    {otpExpiresIn > 0 ? (
                                        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                                            <Clock size={14} className="text-amber-500 dark:text-amber-400 animate-pulse" />
                                            <span>
                                                Code expires in{' '}
                                                <strong className="text-amber-600 dark:text-amber-400 font-bold">
                                                    {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, '0')}
                                                </strong>
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-3">
                                            <Clock size={14} />
                                            <span>OTP has expired. Please click <strong>Resend Code</strong>.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/60 dark:border-white/[0.06] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpSent(false);
                                            setOtpCode(['', '', '', '', '', '']);
                                            setOtpError(null);
                                            setOtpSuccess(null);
                                            setIsRemembered(false);
                                        }}
                                        className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-center py-2 sm:py-0 cursor-pointer"
                                        disabled={isVerifying}
                                    >
                                        ← Back
                                    </button>

                                    <div className="flex flex-col sm:flex-row gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => resendOTP()}
                                            disabled={countdown > 0 || isResending || isVerifying || isDeviceBlocked}
                                            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 bg-[#EEF2F6] dark:bg-[#1A1F2B] shadow-[4px_4px_8px_#d1dbe7,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/[0.08] rounded-xl hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isResending ? (
                                                <>
                                                    <Loader2 className="animate-spin text-muted dark:text-paper/60" size={14} />
                                                    <span>Resending...</span>
                                                </>
                                            ) : countdown > 0 ? (
                                                <span>Resend in {countdown}s</span>
                                            ) : (
                                                <span>Resend Code</span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={verifyOTP}
                                            disabled={isVerifying || otpCode.some(d => !d) || isDeviceBlocked}
                                            className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-semibold bg-accent hover:bg-accent-dark text-paper rounded-xl shadow-[4px_4px_10px_rgba(234,88,12,0.35),-2px_-2px_6px_rgba(255,255,255,0.3)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-accent/30"
                                        >
                                            {isVerifying ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={14} />
                                                    <span>Verifying...</span>
                                                </>
                                            ) : otpExpiresIn === 0 ? (
                                                <span>Code Expired</span>
                                            ) : (
                                                <span>Verify OTP</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
