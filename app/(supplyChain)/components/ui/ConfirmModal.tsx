"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface ConfirmOptions {
    title?: string;
    message?: string | React.ReactElement;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'warning' | 'success' | 'info';
}

interface ConfirmContextType {
    confirm: (options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

// Provider Component
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);
    const [options, setOptions] = useState<ConfirmOptions>({});

    const confirm = (options: ConfirmOptions = {}): Promise<boolean> => {
        return new Promise((res) => {
            setOptions(options);
            setResolve(() => res);
            setIsOpen(true);
        });
    };

    const handleConfirm = () => {
        if (resolve) resolve(true);
        setIsOpen(false);
    };

    const handleCancel = () => {
        if (resolve) resolve(false);
        setIsOpen(false);
    };

    const variantColors = {
        danger: {
            button: "bg-red-500 hover:bg-red-600 focus:ring-red-500/20 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-500/30",
            icon: "text-red-500 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-950/30",
            border: "border-red-200 dark:border-red-800/30",
        },
        warning: {
            button: "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500/20 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:focus:ring-yellow-500/30",
            icon: "text-yellow-500 dark:text-yellow-400",
            bg: "bg-yellow-50 dark:bg-yellow-950/30",
            border: "border-yellow-200 dark:border-yellow-800/30",
        },
        success: {
            button: "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500/20 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500/30",
            icon: "text-emerald-500 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/30",
            border: "border-emerald-200 dark:border-emerald-800/30",
        },
        info: {
            button: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-500/20 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-500/30",
            icon: "text-blue-500 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-950/30",
            border: "border-blue-200 dark:border-blue-800/30",
        },
    };

    const colors = variantColors[options.confirmVariant || 'danger'];
    const iconMap = {
        danger: "fa-exclamation-triangle",
        warning: "fa-exclamation-circle",
        success: "fa-check-circle",
        info: "fa-info-circle",
    };

    const modalTitle = options.title || "Are you sure?";
    const modalMessage = options.message || "This action cannot be undone.";
    const confirmText = options.confirmText || "Confirm";
    const cancelText = options.cancelText || "Cancel";

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                        onClick={handleCancel}
                    />

                    {/* Modal */}
                    <div className="relative bg-white dark:bg-ink rounded-2xl max-w-md w-full p-6 
                                    shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)]
                                    border border-slate-100 dark:border-ink/20 
                                    animate-in fade-in zoom-in duration-200">
                        {/* Icon */}
                        <div
                            className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.border} border-2 
                                    flex items-center justify-center mx-auto mb-4`}
                        >
                            <i className={`fas ${iconMap[options.confirmVariant || 'danger']} text-2xl ${colors.icon}`}></i>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-1.5">
                            {modalTitle}
                        </h3>

                        {/* Message - Changed from <p> to <div> to allow block elements */}
                        <div className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                            {modalMessage}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 px-4 py-2.5 rounded-xl 
                                border border-slate-200 dark:border-ink/30 
                                text-slate-700 dark:text-slate-300 
                                font-semibold text-sm 
                                hover:bg-slate-100 dark:hover:bg-slate-800/50 
                                hover:border-slate-300 dark:hover:border-slate-700/50 
                                transition-all active:scale-[0.98]"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 px-4 py-2.5 rounded-xl 
                                text-white font-semibold text-sm 
                                transition-all shadow-sm active:scale-[0.98] 
                                ${colors.button}`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

// Hook to use confirmation
export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider");
    }
    return context;
}