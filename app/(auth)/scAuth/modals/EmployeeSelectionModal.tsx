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
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl dark:shadow-black/60"
                    >
                        {/* modal header */}
                        <div className="border-b border-slate-100 dark:border-slate-800 p-6 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl transition-colors">
                            <div className="flex items-center gap-3.5">
                                <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100/80 dark:border-pink-900/30 shrink-0">
                                    <Building size={22} className="text-pink-500 dark:text-pink-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                        Select Employee from HR System
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            HR System Data
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all p-2 rounded-xl active:scale-95 cursor-pointer"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* user info bar */}
                        <div className="px-6 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Logged in as:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {loggedInUser?.display_name || loggedInUser?.email}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] tracking-wide border border-transparent ${getRoleColor(loggedInUser?.role)}`}>
                                    {loggedInUser?.role}
                                </span>
                            </div>
                            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline-block font-medium">
                                Select an employee to verify
                            </span>
                        </div>

                        {isDeviceBlocked ? (
                            // device blocked view
                            <div className="p-6 sm:p-8 text-center">
                                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                                    <AlertTriangle className="h-8 w-8 text-rose-500 dark:text-rose-400" />
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Device Blocked</h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
                                    This device has been restricted and blocked by an administrator.
                                </p>

                                {/* admin response section */}
                                {existingAppeal?.response_message && (
                                    <div className="mt-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 text-left shadow-2xs">
                                        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-pink-50 dark:bg-pink-950/50 border border-pink-100 dark:border-pink-900/30 rounded-lg flex items-center justify-center text-xs font-bold text-pink-600 dark:text-pink-400">
                                                    A
                                                </div>
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Admin Response</span>
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

                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {existingAppeal.response_message}
                                        </p>

                                        {existingAppeal.resolved_at && (
                                            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-medium text-slate-400 dark:text-slate-500">
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

                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                                    {existingAppeal ?
                                        (existingAppeal.response_message ? 'An admin has reviewed and replied to your appeal.' :
                                            'Your appeal is currently processing.') :
                                        'If you believe this restriction is a mistake, you can submit an appeal ticket.'}
                                </p>

                                <button
                                    onClick={openAppealModal}
                                    className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shadow-pink-500/20 mx-auto cursor-pointer"
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
                            <>
                                <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 transition-colors">
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 shrink-0 pointer-events-none" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search employee by name, ID, or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-500/30 focus:border-pink-500 dark:focus:border-pink-500/80 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 sm:p-4 max-h-[60vh] sm:max-h-96 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                                    {isLoadingEmployees ? (
                                        <div className="text-center py-10 sm:py-14">
                                            <Loader2 className="animate-spin text-accent mx-auto" size={32} />
                                            <p className="mt-2.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Fetching directory from HR system...</p>
                                        </div>
                                    ) : filteredEmployees.length === 0 ? (
                                        <div className="text-center py-10 sm:py-14 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                                                <User size={24} />
                                            </div>
                                            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">No matching employees found</p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search terms</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {displayedEmployees.map((emp) => {
                                                const isSelected = selectedEmployee?.id === emp.id;
                                                const isDisabled = isSelectionLocked || isCheckingRemembered || isDeviceBlocked;

                                                return (
                                                    <button
                                                        key={emp.id}
                                                        onClick={() => handleEmployeeSelect(emp)}
                                                        disabled={isDisabled}
                                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-all border duration-150 
                                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
                                            ${isSelected
                                                                ? 'border-accent bg-accent/10 dark:bg-accent/15 dark:border-accent/60 shadow-2xs'
                                                                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                                    <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                                                        {emp.display_name}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 shrink-0">
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

                                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{emp.email}</div>

                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 ${getRoleColor(emp.role)}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[120px] sm:max-w-none">
                                                                        {emp.department}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[120px] sm:max-w-none">
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
                                                <div className="text-center py-2.5 text-xs text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-slate-800 mt-3 font-medium">
                                                    + {remainingCount} more {remainingCount === 1 ? 'employee' : 'employees'} available
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-900/80 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                        {selectedEmployee ? (
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                <CheckCircle className="text-emerald-500 dark:text-emerald-400 shrink-0" size={16} />
                                                <span className="font-medium text-slate-600 dark:text-slate-300">Selected:</span>
                                                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[180px]">
                                                    {selectedEmployee.display_name}
                                                </span>

                                                {isCheckingRemembered ? (
                                                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs">
                                                        <Loader2 className="animate-spin text-pink-500" size={13} />
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
                                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full font-medium">
                                                        Not remembered
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Select an employee from the HR list</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                        <button
                                            onClick={handleCloseModal}
                                            className="flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-center cursor-pointer"
                                        >
                                            Cancel
                                        </button>

                                        {selectedEmployee && isCurrentlyActive ? (
                                            <button
                                                disabled
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                                <span>Logged In</span>
                                            </button>
                                        ) : selectedEmployee && isRemembered ? (
                                            <button
                                                onClick={handleLoginWithRemembered}
                                                disabled={isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                            >
                                                <LogIn size={15} />
                                                <span>Login</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={requestOTP}
                                                disabled={!selectedEmployee || isRequestingOTP || isCheckingRemembered || isDeviceBlocked}
                                                className="flex-1 sm:flex-initial px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
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
                            </>
                        ) : (
                            // otp verification view
                            <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-pink-50 dark:bg-pink-950/40 ring-1 ring-pink-500/20 dark:ring-pink-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                                        {isVerifying ? (
                                            <Loader2 className="animate-spin text-pink-500 dark:text-pink-400" size={24} />
                                        ) : (
                                            <Mail className="text-pink-500 dark:text-pink-400" size={24} />
                                        )}
                                    </div>
                                    <h4 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">Verify Security Code</h4>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 px-2 leading-relaxed">
                                        Enter the 6-digit verification code sent to <br />
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">{selectedEmployee?.email}</span>
                                    </p>
                                    <div className="mt-2.5 inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                            HR Employee: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedEmployee?.display_name}</span> ({selectedEmployee?.employee_id})
                                        </p>
                                    </div>
                                </div>

                                {otpSuccess && (
                                    <div className="mb-5 border-l-4 border-emerald-500 text-xs sm:text-[13px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 rounded-r-xl shadow-xs">
                                        <CheckCircle size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        <span>{otpSuccess}</span>
                                    </div>
                                )}

                                {otpError && (
                                    <div className="mb-5 border-l-4 border-rose-500 text-xs sm:text-[13px] text-rose-800 dark:text-rose-300 font-medium flex items-center gap-2.5 bg-rose-50/80 dark:bg-rose-950/40 p-3.5 rounded-r-xl shadow-xs">
                                        <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                                        <span>{otpError}</span>
                                    </div>
                                )}

                                <div className="flex justify-center gap-2 sm:gap-2.5 my-6">
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
                                            className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-slate-50 dark:bg-slate-800/60 border-2 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all duration-200 transform focus:-translate-y-0.5 cursor-pointer 
                                ${isVerifying ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 dark:hover:border-slate-700'}
                                ${otpError
                                                    ? 'border-rose-400 dark:border-rose-500/60 text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                                }`}
                                            disabled={isVerifying}
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center justify-between mb-5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                                    <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all cursor-pointer bg-white dark:bg-slate-800"
                                            disabled={isVerifying}
                                        />
                                        <span>Remember me on this device</span>
                                    </label>
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 shrink-0">
                                        {rememberMe ? '15 days' : '8 hours'}
                                    </span>
                                </div>

                                {countdown > 0 && (
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                                        <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                                        <span>Resend available in <strong className="text-slate-800 dark:text-slate-200 font-bold">{countdown}s</strong></span>
                                    </div>
                                )}

                                <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setOtpSent(false);
                                            setOtpCode(['', '', '', '', '', '']);
                                            setOtpError(null);
                                            setOtpSuccess(null);
                                            setIsRemembered(false);
                                        }}
                                        className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-center py-2 sm:py-0 active:scale-95 cursor-pointer"
                                        disabled={isVerifying}
                                    >
                                        ← Back
                                    </button>

                                    <div className="flex flex-col sm:flex-row gap-2.5">
                                        <button
                                            onClick={resendOTP}
                                            disabled={countdown > 0 || isResending || isVerifying || isDeviceBlocked}
                                            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            {isResending ? (
                                                <>
                                                    <Loader2 className="animate-spin text-slate-500 dark:text-slate-400" size={14} />
                                                    <span>Resending...</span>
                                                </>
                                            ) : (
                                                <span>Resend Code</span>
                                            )}
                                        </button>

                                        <button
                                            onClick={verifyOTP}
                                            disabled={isVerifying || otpCode.join('').length !== 6 || isDeviceBlocked}
                                            className="w-full sm:w-auto px-6 py-2.5 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                        >
                                            {isVerifying ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    <span>Verifying...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={16} />
                                                    <span>Verify Code</span>
                                                </>
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
