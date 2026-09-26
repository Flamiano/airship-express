'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip } from 'lucide-react';
import { cn } from '../shared/utils';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
    isStreaming?: boolean;
    placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    value,
    onChange,
    onSubmit,
    disabled,
    isStreaming,
    placeholder = 'Ask Airy anything about payroll…',
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim()) {
                onSubmit();
            }
        }
    };

    return (
        <div className="relative flex items-end gap-2 rounded-2xl border border-line bg-paper px-3 py-2 shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 dark:border-line/30">
            <button
                type="button"
                disabled
                title="Attachments coming soon"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-ink/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Paperclip className="h-4 w-4" />
            </button>

            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={disabled}
                className="flex-1 resize-none bg-transparent px-1 py-2 text-[13.5px] leading-relaxed text-ink placeholder:text-muted outline-none font-rethink disabled:opacity-50 min-h-[36px] max-h-[160px]"
            />

            <button
                type="button"
                onClick={onSubmit}
                disabled={disabled || !value.trim()}
                className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                    value.trim() && !disabled
                        ? 'bg-accent text-paper hover:bg-accent-dark active:scale-95'
                        : 'bg-ink/10 text-muted cursor-not-allowed'
                )}
                aria-label="Send message"
            >
                {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Send className="h-4 w-4" />
                )}
            </button>
        </div>
    );
};