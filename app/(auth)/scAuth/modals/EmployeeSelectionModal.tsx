'use client';

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
    Eye as EyeIcon
} from 'lucide-react';

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
    const filteredEmployees = employees.filter(emp =>
        (emp.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayedEmployees = filteredEmployees.length > 5
        ? filteredEmployees.slice(0, 5)
        : filteredEmployees;
    const remainingCount = filteredEmployees.length - 5;

    return (
        <AnimatePresence>
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-2.5 sm:p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-[#1c1d25] border border-line dark:border-[#353746] rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/60 my-auto overflow-hidden"
                    >
                        {/* modal header */}
                        <div className="border-b border-line dark:border-[#353746] p-4 sm:p-6 flex justify-between items-center bg-white dark:bg-[#1c1d25] rounded-t-2xl shrink-0 transition-colors">
                            <div className="flex items-center gap-3 sm:gap-3.5">
                                <div className="p-2 sm:p-2.5 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent border border-accent/20 shrink-0">
                                    <Building size={20} className="text-accent sm:w-[22px] sm:h-[22px]" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-ink dark:text-white font-bricolage tracking-tight">
                                        Select Employee from HR System
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[11px] sm:text-xs font-medium text-muted dark:text-slate-400">
                                            HR System Data
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-muted dark:text-slate-400 hover:text-ink dark:hover:text-white hover:bg-paper dark:hover:bg-[#2a2a2e] transition-all p-2 rounded-xl active:scale-95 cursor-pointer"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* user info bar */}
                        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-paper dark:bg-[#23242e] border-b border-line dark:border-[#353746] flex items-center justify-between text-xs shrink-0">
                            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                                <span className="text-muted dark:text-slate-400 font-medium">Logged in as:</span>
                                <span className="font-semibold text-ink dark:text-white truncate max-w-[140px] sm:max-w-none">
                                    {loggedInUser?.display_name || loggedInUser?.email}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] sm:text-[11px] tracking-wide border border-transparent ${getRoleColor(loggedInUser?.role)}`}>
                                    {loggedInUser?.role}
                                </span>
                            </div>
                            <span className="text-muted dark:text-slate-400 hidden sm:inline-block font-medium">
                                Select an employee to verify
                            </span>
                        </div>

                        {isDeviceBlocked ? (
                            // device blocked view
                            <div className="p-4 sm:p-8 text-center flex-1 overflow-y-auto custom-scrollbar">
                                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                                    <AlertTriangle className="h-8 w-8 text-rose-500 dark:text-rose-400" />
                                </div>

                                <h3 className="text-lg font-bold text-ink dark:text-white font-bricolage">Device Blocked</h3>
                                <p className="text-xs sm:text-sm text-muted dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
                                    This device has been restricted and blocked by an administrator.
                                </p>

                                {/* admin response section */}
                                {existingAppeal?.response_message && (
                                    <div className="mt-5 bg-paper dark:bg-[#23242e] rounded-2xl p-4 border border-line dark:border-[#353746] text-left shadow-2xs">
                                        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-accent/10 dark:bg-accent/20 border border-accent/20 rounded-lg flex items-center justify-center text-xs font-bold text-accent">
                                                    A
                                                </div>
                                                <span className="text-xs font-semibold text-ink dark:text-white">Admin Response</span>
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

                                        <p className="text-xs sm:text-sm text-muted dark:text-slate-300 leading-relaxed">
                                            {existingAppeal.response_message}
                                        </p>

                                        {existingAppeal.resolved_at && (
                                            <div className="mt-3 pt-2.5 border-t border-line dark:border-[#353746] text-[10px] font-medium text-muted dark:text-slate-400">
                                                Resolved: {new Date(existingAppeal.resolved_at).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* pending or submitted status section */}
                                {existingAppeal && !existingAppeal.response_message && (
                                    <div className="mt-5 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/40 text-left">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-xs font-bold text-amber-800 dark:text-amber-400">
                                                Status: {existingAppeal.status === 'pending' ? 'Under Admin Review' : existingAppeal.status === 'approved' ? 'Approved' : 'Rejected'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                                            {existingAppeal.status === 'pending' ? 'Your appeal has been logged and is waiting for review.' :
                                                existingAppeal.status === 'approved' ? 'Appeal approved! Device access will be granted shortly.' :
                                                    'Appeal rejected. Please reach out to support for further assistance.'}
                                        </p>
                                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/30 text-[10px] font-medium text-amber-600/80 dark:text-amber-400/70">
                                            Submitted: {new Date(existingAppeal.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-muted dark:text-slate-400 mt-4">
                                    {existingAppeal ?
                                        (existingAppeal.response_message ? 'An admin has reviewed and replied to your appeal.' :
                                            'Your appeal is currently processing.') :
                                        'If you believe this restriction is a mistake, you can submit an appeal ticket.'}
                                </p>

                                <button
                                    onClick={openAppealModal}
                                    className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dark text-paper rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
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
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="p-3 sm:p-4 border-b border-line dark:border-[#353746] bg-white dark:bg-[#1c1d25] backdrop-blur-md shrink-0 transition-colors">
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-slate-400 shrink-0 pointer-events-none" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search employee by name, ID, or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-paper dark:bg-[#2a2a2e] border border-line dark:border-[#353746] rounded-xl text-ink dark:text-white focus:bg-white dark:focus:bg-[#2a2a2e] focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-muted/60 dark:placeholder:text-slate-400 shadow-2xs"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 sm:p-4 flex-1 min-h-0 overflow-y-auto space-y-2 custom-scrollbar bg-white dark:bg-[#1c1b1f]">
                                    {isLoadingEmployees ? (
                                        <div className="text-center py-10 sm:py-14">
                                            <Loader2 className="animate-spin text-accent mx-auto" size={32} />
                                            <p className="mt-2.5 text-muted dark:text-slate-300 text-xs sm:text-sm font-medium">Fetching directory from HR system...</p>
                                        </div>
                                    ) : filteredEmployees.length === 0 ? (
                                        <div className="text-center py-10 sm:py-14 bg-paper dark:bg-[#23242e] rounded-2xl border border-dashed border-line dark:border-[#353746]">
                                            <div className="w-12 h-12 bg-white dark:bg-[#2a2a2e] rounded-full flex items-center justify-center mx-auto mb-3 text-muted dark:text-slate-400">
                                                <User size={24} />
                                            </div>
                                            <p className="text-xs sm:text-sm font-medium text-ink dark:text-white">No matching employees found</p>
                                            <p className="text-[11px] text-muted dark:text-slate-400 mt-1">Try adjusting your search terms</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {displayedEmployees.map((emp) => {
                                                const isSelected = selectedEmployee?.id === emp.id;
                                                const isDisabled = isSelectionLocked || isCheckingRemembered || isDeviceBlocked;

                                                return (
                                                    <button
                                                        key={emp.id}
                                                        type="button"
                                                        onClick={() => handleEmployeeSelect(emp)}
                                                        disabled={isDisabled}
                                                        className={`w-full text-left px-3.5 py-2.5 sm:py-3 rounded-xl transition-all border duration-150 
                                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
                                            ${isSelected
                                                                ? 'border-accent bg-accent/10 dark:bg-accent/20 dark:border-accent/60 shadow-2xs'
                                                                : 'border-line dark:border-[#353746] bg-white dark:bg-[#23242e] hover:bg-paper dark:hover:bg-[#2a2a2e] hover:border-accent/40'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                                    <span className="font-semibold text-xs sm:text-sm text-ink dark:text-white truncate">
                                                                        {emp.display_name}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono text-muted dark:text-slate-300 bg-paper dark:bg-[#1c1d25] px-1.5 py-0.5 rounded-md border border-line dark:border-[#353746] shrink-0">
                                                                        {emp.employee_id}
                                                                    </span>

                                                                    {emp.is_active && (
                                                                        <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                                            Active
                                                                        </span>
                                                                    )}
                                                                    {!emp.is_active && emp.remembered && (
                                                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                            Remembered
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="text-xs text-muted dark:text-slate-400 truncate mt-1">{emp.email}</div>

                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 ${getRoleColor(emp.role)}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted dark:text-slate-300 bg-paper dark:bg-[#1c1d25] px-2 py-0.5 rounded-md truncate max-w-[120px] sm:max-w-none">
                                                                        {emp.department}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted/40 dark:text-slate-500">•</span>
                                                                    <span className="text-[10px] text-muted dark:text-slate-400 truncate max-w-[120px] sm:max-w-none">
                                                                        {emp.position}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {isSelected && (
                                                                <div className="mt-0.5 shrink-0 bg-accent/15 dark:bg-accent/20 p-1 rounded-full text-accent">
                                                                    <CheckCircle size={18} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}

                                            {remainingCount > 0 && (
                                                <div className="text-center py-2.5 text-xs text-muted dark:text-slate-400 border-t border-dashed border-line dark:border-[#353746] mt-3 font-medium">
                                                    + {remainingCount} more {remainingCount === 1 ? 'employee' : 'employees'} available
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-line dark:border-[#353746] p-3 sm:p-4 bg-paper dark:bg-[#1c1d25] shrink-0 sticky bottom-0 z-20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
                                    <div className="text-xs text-muted dark:text-slate-300 min-w-0">
                                        {selectedEmployee ? (
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                <CheckCircle className="text-emerald-500 dark:text-emerald-400 shrink-0" size={16} />
                                                <span className="font-medium text-muted dark:text-slate-400 text-xs">Selected:</span>
                                                <span className="font-bold text-ink dark:text-white truncate max-w-[120px] sm:max-w-[180px] text-xs">
                                                    {selectedEmployee.display_name}
                                                </span>

                                                {isCheckingRemembered ? (
                                                    <div className="flex items-center gap-1 text-muted dark:text-slate-400 text-xs">
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
                                                    <span className="text-[10px] bg-paper dark:bg-[#23242e] text-muted dark:text-slate-300 border border-line dark:border-[#353746] px-2 py-0.5 rounded-full font-medium">
                                                        Not remembered
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted dark:text-slate-400 font-medium">Select an employee from the HR list</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold text-muted dark:text-slate-300 hover:text-ink dark:hover:text-white transition-colors border border-line dark:border-[#353746] rounded-xl bg-white dark:bg-[#2a2a2e] hover:bg-paper dark:hover:bg-[#353746] text-center cursor-pointer"
                                        >
                                            Cancel
                                        </button>

                                        {selectedEmployee && isCurrentlyActive ? (
                                            <button
                                                type="button"
                                                disabled
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-slate-200 dark:bg-paper/10 text-muted dark:text-paper/50 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                                <span>Logged In</span>
                                            </button>
                                        ) : selectedEmployee && isRemembered ? (
                                            <button
                                                type="button"
                                                onClick={handleLoginWithRemembered}
                                                disabled={isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                            >
                                                <LogIn size={15} />
                                                <span>Login</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={requestOTP}
                                                disabled={!selectedEmployee || isRequestingOTP || isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-accent hover:bg-accent-dark text-paper text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
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
                            <div className="p-5 sm:p-8 bg-white dark:bg-[#1c1d25] text-ink dark:text-white transition-colors flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                                <div>
                                    <div className="text-center mb-6">
                                        <div className="w-13 h-13 sm:w-15 sm:h-15 bg-accent/10 dark:bg-accent/20 ring-1 ring-accent/20 dark:ring-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                                            {isVerifying ? (
                                                <Loader2 className="animate-spin text-accent" size={26} />
                                            ) : (
                                                <Mail className="text-accent" size={26} />
                                            )}
                                        </div>
                                        <h4 className="text-lg sm:text-xl font-bold text-ink dark:text-white font-bricolage tracking-tight">
                                            Verify Security Code
                                        </h4>
                                        <p className="text-xs text-muted dark:text-slate-400 mt-1 leading-relaxed">
                                            Enter the 6-digit verification code sent to
                                        </p>
                                        <p className="text-xs font-semibold text-accent mt-0.5 tracking-tight break-all">
                                            {selectedEmployee?.email}
                                        </p>
                                        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs text-muted dark:text-slate-400">
                                            <span>HR Employee:</span>
                                            <span className="font-semibold text-ink dark:text-white">{selectedEmployee?.display_name}</span>
                                            {selectedEmployee?.employee_id && (
                                                <span className="font-mono text-muted dark:text-slate-400">({selectedEmployee.employee_id})</span>
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
                                        <div className="mb-3 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center justify-center gap-1.5 text-center">
                                            <AlertCircle size={14} className="shrink-0" />
                                            <span>{otpError}</span>
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
                                                className={`w-10 h-12 sm:w-13 sm:h-14 text-center text-lg sm:text-2xl font-bold rounded-xl transition-all duration-150 outline-none
                                                    ${otpError
                                                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-2 border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-400'
                                                        : digit
                                                            ? 'bg-white dark:bg-[#2a2a2e] border-2 border-accent text-ink dark:text-white shadow-xs'
                                                            : 'bg-paper dark:bg-[#2a2a2e] border border-line dark:border-[#353746] text-ink dark:text-white hover:border-accent/40'
                                                    }
                                                    focus:bg-white dark:focus:bg-[#2a2a2e] focus:border-accent focus:ring-4 focus:ring-accent/15
                                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                                                disabled={isVerifying}
                                                autoFocus={index === 0}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between mb-4 bg-paper dark:bg-[#23242e] p-3 rounded-xl border border-line dark:border-[#353746] shadow-xs">
                                        <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-ink dark:text-white cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-line dark:border-[#353746] text-accent focus:ring-accent cursor-pointer bg-white dark:bg-[#2a2a2e]"
                                                disabled={isVerifying}
                                            />
                                            <span>Remember me on this device</span>
                                        </label>
                                        <span className="text-[10px] sm:text-xs font-bold text-muted dark:text-slate-300 bg-white dark:bg-[#1c1d25] px-2.5 py-0.5 rounded-md border border-line dark:border-[#353746] shrink-0">
                                            {rememberMe ? '15 days' : '8 hours'}
                                        </span>
                                    </div>

                                    {countdown > 0 && (
                                        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted dark:text-slate-400 mb-3">
                                            <Clock size={14} className="text-muted dark:text-slate-400" />
                                            <span>Resend available in <strong className="text-ink dark:text-white font-bold">{countdown}s</strong></span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-3.5 border-t border-line dark:border-[#353746] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpSent(false);
                                            setOtpCode(['', '', '', '', '', '']);
                                            setOtpError(null);
                                            setOtpSuccess(null);
                                            setIsRemembered(false);
                                        }}
                                        className="text-xs sm:text-sm font-semibold text-muted dark:text-slate-300 hover:text-ink dark:hover:text-white transition-colors text-center py-2 sm:py-0 active:scale-95 cursor-pointer"
                                        disabled={isVerifying}
                                    >
                                        ← Back
                                    </button>

                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
                                        <button
                                            type="button"
                                            onClick={resendOTP}
                                            disabled={countdown > 0 || isResending || isVerifying || isDeviceBlocked}
                                            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-muted dark:text-slate-300 bg-white dark:bg-[#2a2a2e] border border-line dark:border-[#353746] rounded-xl hover:bg-paper dark:hover:bg-[#353746] transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            {isResending ? (
                                                <>
                                                    <Loader2 className="animate-spin text-muted dark:text-slate-400" size={14} />
                                                    <span>Resending...</span>
                                                </>
                                            ) : (
                                                <span>Resend Code</span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={verifyOTP}
                                            disabled={isVerifying || otpCode.some(d => !d) || isDeviceBlocked}
                                            className="w-full sm:w-auto px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold bg-accent hover:bg-accent-dark text-paper rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            {isVerifying ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={14} />
                                                    <span>Verifying...</span>
                                                </>
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
