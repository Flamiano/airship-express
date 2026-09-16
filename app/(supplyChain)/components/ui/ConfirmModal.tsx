"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
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

    // Keyboard shortcuts: Enter to confirm, Escape to cancel
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleConfirm();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, resolve]);

    const variantColors = {
        pink: {
            button: "bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            icon: "text-pink-600 dark:text-pink-400",
            bg: "bg-pink-50/50 dark:bg-pink-950/30",
            border: "border-pink-200/80 dark:border-pink-800/40",
            glow: "ring-2 ring-pink-500/20",
        },
        danger: {
            button: "bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white border-rose-400/80 shadow-[0_3px_10px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            icon: "text-rose-500 dark:text-rose-400",
            bg: "bg-rose-50/50 dark:bg-rose-950/30",
            border: "border-rose-200/80 dark:border-rose-800/40",
            glow: "ring-2 ring-rose-500/20",
        },
        warning: {
            button: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white border-amber-400/80 shadow-[0_3px_10px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            icon: "text-amber-500 dark:text-amber-400",
            bg: "bg-amber-50/50 dark:bg-amber-950/30",
            border: "border-amber-200/80 dark:border-amber-800/40",
            glow: "ring-2 ring-amber-500/20",
        },
        success: {
            button: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white border-emerald-400/80 shadow-[0_3px_10px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            icon: "text-emerald-500 dark:text-emerald-400",
            bg: "bg-emerald-50/50 dark:bg-emerald-950/30",
            border: "border-emerald-200/80 dark:border-emerald-800/40",
            glow: "ring-2 ring-emerald-500/20",
        },
        info: {
            button: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white border-blue-400/80 shadow-[0_3px_10px_rgba(59,130,246,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            icon: "text-blue-500 dark:text-blue-400",
            bg: "bg-blue-50/50 dark:bg-blue-950/30",
            border: "border-blue-200/80 dark:border-blue-800/40",
            glow: "ring-2 ring-blue-500/20",
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
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                            onClick={handleCancel}
                        />

                        {/* Neumorphic Modal Card */}
                        <div className="relative bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl max-w-md w-full p-6 sm:p-8 
                                        border border-white/80 dark:border-[#2c2d3c] 
                                        shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] 
                                        dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)]
                                        animate-in fade-in zoom-in-95 duration-200 z-10">
                            
                            {/* Debossed Inset Icon Well */}
                            <div
                                className={`w-16 h-16 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] ${colors.border} ${colors.glow} border 
                                        shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] 
                                        dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]
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
                                    className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer border active:scale-95 ${colors.button}`}
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