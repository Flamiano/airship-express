'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, LucideIcon } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

type Accent = 'blue' | 'purple' | 'pink' | 'green' | 'orange' | 'red' | 'amber';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    className?: string;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    accent?: Accent;
    icon?: LucideIcon;
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

const accentStyles: Record<
    Accent,
    { border: string; badge: string; glow: string; ring: string }
> = {
    blue: {
        border: 'border-t-blue-500',
        badge: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)]',
        ring: 'ring-blue-500/20',
    },
    purple: {
        border: 'border-t-violet-500',
        badge: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(139,92,246,0.25)]',
        ring: 'ring-violet-500/20',
    },
    pink: {
        border: 'border-t-pink-500',
        badge: 'bg-pink-100 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(236,72,153,0.25)]',
        ring: 'ring-pink-500/20',
    },
    green: {
        border: 'border-t-emerald-500',
        badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)]',
        ring: 'ring-emerald-500/20',
    },
    orange: {
        border: 'border-t-orange-500',
        badge: 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(249,115,22,0.25)]',
        ring: 'ring-orange-500/20',
    },
    red: {
        border: 'border-t-red-500',
        badge: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(239,68,68,0.25)]',
        ring: 'ring-red-500/20',
    },
    amber: {
        border: 'border-t-amber-500',
        badge: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        glow: 'shadow-[0_20px_60px_-15px_rgba(245,158,11,0.25)]',
        ring: 'ring-amber-500/20',
    },
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className,
    footer,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    accent = 'blue',
    icon: Icon,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const styles = accentStyles[accent];

    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const [isEntering, setIsEntering] = useState(true);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        window.setTimeout(() => {
            setIsClosing(false);
            setShouldRender(false);
            onClose();
        }, 180);
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsEntering(true);
            const raf = requestAnimationFrame(() => setIsEntering(false));
            return () => cancelAnimationFrame(raf);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!shouldRender) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = original;
        };
    }, [shouldRender]);

    useEffect(() => {
        if (shouldRender) {
            previouslyFocused.current = document.activeElement as HTMLElement;
            const t = window.setTimeout(() => modalRef.current?.focus(), 0);
            return () => window.clearTimeout(t);
        } else {
            previouslyFocused.current?.focus?.();
        }
    }, [shouldRender]);

    useEffect(() => {
        if (!shouldRender) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (closeOnEscape && event.key === 'Escape') {
                handleClose();
                return;
            }
            if (event.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shouldRender, closeOnEscape, handleClose]);

    const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
            handleClose();
        }
    };

    if (!shouldRender) return null;

    return (
        <div
            className={cn(
                'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-6',
                'transition-opacity duration-200 ease-out',
                isClosing ? 'opacity-0' : 'opacity-100'
            )}
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                tabIndex={-1}
                className={cn(
                    'flex w-full flex-col overflow-hidden bg-paper outline-none ring-1 border-t-4',
                    'max-h-[92vh] sm:max-h-[90vh]',
                    'rounded-t-2xl rounded-b-none sm:rounded-2xl',
                    styles.border,
                    styles.glow,
                    styles.ring,
                    'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    isClosing || isEntering
                        ? 'opacity-0 translate-y-4 sm:scale-90 sm:translate-y-2'
                        : 'opacity-100 translate-y-0 sm:scale-100',
                    sizeClasses[size],
                    className
                )}
            >
                <div className="relative flex flex-row items-center justify-between gap-3 border-b border-line/60 bg-paper px-4 sm:px-5 py-3.5 sm:py-4 shrink-0 dark:border-line/30">
                    <div className="flex flex-row items-center gap-3 min-w-0 flex-1">
                        {Icon && (
                            <span
                                className={cn(
                                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                    styles.badge
                                )}
                            >
                                <Icon size={18} strokeWidth={2} />
                            </span>
                        )}
                        <h3
                            id="modal-title"
                            className="text-base sm:text-lg font-semibold text-ink truncate"
                        >
                            {title}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close dialog"
                        className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-ink/5 hover:text-ink active:scale-90 dark:hover:bg-ink/10"
                    >
                        <X size={18} strokeWidth={2} />
                    </button>
                </div>

                <div className="overflow-y-auto px-4 sm:px-5 py-4">{children}</div>

                {footer && (
                    <div className="shrink-0 border-t border-line bg-ink/[0.02] px-4 sm:px-5 py-3 dark:border-line/30 dark:bg-ink/[0.05]">
                        <div className="flex w-full flex-row items-center justify-end gap-2 sm:gap-2.5">
                            {footer}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};