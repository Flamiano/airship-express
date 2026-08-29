"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import Portal from "@/app/(supplyChain)/components/client/Portal";

interface ConfirmOptions {
    title?: string;
    message?: string | React.ReactElement;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'pink' | 'danger' | 'warning' | 'success' | 'info';
}

interface ConfirmContextType {
    confirm: (options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

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
        pink: {
            button: "bg-pink-600 hover:bg-pink-700 text-white shadow-xs focus:ring-pink-500/30",
            icon: "text-pink-600 dark:text-pink-400",
            bg: "bg-pink-50 dark:bg-pink-950/40",
            border: "border-pink-200 dark:border-pink-800/40",
            glow: "ring-4 ring-pink-500/10 dark:ring-pink-500/20",
        },
        danger: {
            button: "bg-red-600 hover:bg-red-700 text-white shadow-xs focus:ring-red-500/30",
            icon: "text-red-500 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-950/40",
            border: "border-red-200 dark:border-red-800/40",
            glow: "ring-4 ring-red-500/10 dark:ring-red-500/20",
        },
        warning: {
            button: "bg-amber-600 hover:bg-amber-700 text-white shadow-xs focus:ring-amber-500/30",
            icon: "text-amber-500 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950/40",
            border: "border-amber-200 dark:border-amber-800/40",
            glow: "ring-4 ring-amber-500/10 dark:ring-amber-500/20",
        },
        success: {
            button: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500/30",
            icon: "text-emerald-500 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/40",
            border: "border-emerald-200 dark:border-emerald-800/40",
            glow: "ring-4 ring-emerald-500/10 dark:ring-emerald-500/20",
        },
        info: {
            button: "bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus:ring-blue-500/30",
            icon: "text-blue-500 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-950/40",
            border: "border-blue-200 dark:border-blue-800/40",
            glow: "ring-4 ring-blue-500/10 dark:ring-blue-500/20",
        },
    };

    const variantKey = options.confirmVariant || 'pink';
    const colors = variantColors[variantKey] || variantColors.pink;
    const iconMap = {
        pink: "fa-check-circle",
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
                <Portal>
                    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                            onClick={handleCancel}
                        />

                        {/* Raindrop Container Card */}
                        <div className="relative bg-white/95 dark:bg-[#202128]/95 backdrop-blur-xl rounded-[28px] max-w-md w-full p-6 sm:p-7 
                                        shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),inset_0_1px_0_#ffffff] 
                                        dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]
                                        border border-slate-200/80 dark:border-[#353746] 
                                        animate-in fade-in zoom-in-95 duration-200 z-10">
                            
                            {/* Raindrop Icon Pill */}
                            <div
                                className={`w-16 h-16 rounded-[22px] ${colors.bg} ${colors.border} ${colors.glow} border 
                                        flex items-center justify-center mx-auto mb-4.5 transition-transform`}
                            >
                                <i className={`fas ${iconMap[variantKey]} text-2xl ${colors.icon}`}></i>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-1.5">
                                {modalTitle}
                            </h3>

                            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center mb-6 leading-relaxed">
                                {modalMessage}
                            </div>

                            <div className="flex gap-3">
                                <AppButton
                                    variant="neutral"
                                    size="md"
                                    pill
                                    className="flex-1 text-xs sm:text-sm font-semibold"
                                    onClick={handleCancel}
                                >
                                    {cancelText}
                                </AppButton>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${colors.button}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </ConfirmContext.Provider>
    );
}

// use confirm dialog context
export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider");
    }
    return context;
}