'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px] p-3 sm:p-6">
            <div
                ref={modalRef}
                className={cn(
                    'flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-line bg-paper shadow-xl',
                    className
                )}
            >
                <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-4 shrink-0">
                    <h3 className="text-base sm:text-lg font-semibold text-ink pr-2">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink shrink-0"
                    >
                        <X size={20} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="overflow-y-auto px-4 sm:px-5 py-4">{children}</div>
            </div>
        </div>
    );
};