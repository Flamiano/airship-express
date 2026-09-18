'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RotateCcw, Loader2, ArrowDown, Sparkles } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sendChatMessage, createMessage } from '../assistants/PayslipAssistant';
import { AiryAvatar } from './Avatar';
import { ChatBubble } from './ChatBubble';
import { DateDivider, isSameDay } from './DateDivider';
import { EmptyState } from './EmptyState';
import type { ChatMessage, PayrollContext } from '../shared/types';
import { cn } from '../shared/utils';

interface ChatDrawerProps {
    context?: PayrollContext;
    employeeId?: string;
    title?: string;
    subtitle?: string;
    className?: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
    context,
    employeeId,
    title = 'Airy',
    subtitle = 'Payroll AI Assistant',
    className,
}) => {
    const toast = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingId, setStreamingId] = useState<string | null>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [booting, setBooting] = useState(true);
    const [inputFocused, setInputFocused] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const autoScrollRef = useRef(true);

    useEffect(() => {
        const timer = setTimeout(() => setBooting(false), 1900);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            autoScrollRef.current = nearBottom;
            setShowScrollBtn(!nearBottom && messages.length > 0);
        };

        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [messages.length]);

    useEffect(() => {
        if (autoScrollRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, isStreaming]);

    const scrollToBottom = () => {
        autoScrollRef.current = true;
        setShowScrollBtn(false);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    const submitMessage = useCallback(
        async (text?: string) => {
            const content = (text ?? input).trim();
            if (!content || isStreaming) return;

            const userMsg = createMessage('user', content);
            setMessages((prev) => [...prev, userMsg]);
            setInput('');
            setIsStreaming(true);
            autoScrollRef.current = true;

            const assistantId = `assistant-${Date.now()}`;
            setStreamingId(assistantId);

            setMessages((prev) => [
                ...prev,
                {
                    id: assistantId,
                    role: 'assistant',
                    content: '',
                    createdAt: new Date().toISOString(),
                },
            ]);

            let fullText = '';

            try {
                await sendChatMessage({
                    history: messages,
                    userMessage: content,
                    context,
                    employeeId,
                    onAttachment: (attachment) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? { ...m, attachments: [...(m.attachments ?? []), attachment] }
                                    : m
                            )
                        );
                    },
                    onChunk: (delta) => {
                        fullText += delta;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId ? { ...m, content: fullText } : m
                            )
                        );
                    },
                    onDone: () => {
                        setIsStreaming(false);
                        setStreamingId(null);
                    },
                    onError: (err) => {
                        toast.showError(err.message || 'AI failed to respond');
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        content: 'Sorry, something went wrong. Please try again.',
                                        error: true,
                                    }
                                    : m
                            )
                        );
                    },
                });
            } catch {
                setIsStreaming(false);
                setStreamingId(null);
            }
        },
        [input, isStreaming, messages, context, employeeId, toast]
    );

    const handleClear = () => {
        setMessages([]);
        setInput('');
        setStreamingId(null);
        setIsStreaming(false);
        autoScrollRef.current = true;
    };

    const showEmpty = messages.length === 0;

    return (
        <div
            className={cn(
                'relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-line bg-paper',
                'dark:border-line/30',
                className
            )}
        >
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 rounded-[26px] transition-opacity duration-700',
                    isStreaming ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                    background:
                        'radial-gradient(120% 60% at 0% 0%, rgba(var(--accent-rgb, 236,0,140),0.12), transparent 60%)',
                }}
            />

            <AnimatePresence>
                {booting && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-paper"
                    >
                        <video
                            src="/images/airy-ai/hi-run.mp4"
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="h-20 w-20 rounded-full object-cover ring-2 ring-accent/30 ring-offset-2 ring-offset-paper sm:h-24 sm:w-24"
                        />
                        <div className="flex flex-col items-center gap-1.5">
                            <p className="text-[12px] font-medium text-ink font-rethink sm:text-[13px]">
                                Waking up Airy
                            </p>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-line bg-gradient-to-r from-accent/[0.06] via-transparent to-transparent px-3 dark:border-line/30 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className="relative shrink-0">
                        <AiryAvatar
                            size="sm"
                            showRing
                            video={isStreaming}
                            status={isStreaming ? 'thinking' : 'idle'}
                            className="sm:h-10 sm:w-10"
                        />
                        {!isStreaming && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center">
                                <span className="absolute h-3 w-3 animate-ping rounded-full bg-accent/40" />
                                <Sparkles className="relative h-2.5 w-2.5 text-accent" />
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold font-bricolage leading-none text-ink sm:text-[14px]">
                            {title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                                className={cn(
                                    'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                                    isStreaming ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                                )}
                            />
                            <p className="truncate text-[10.5px] text-muted font-rethink sm:text-[11px]">
                                {isStreaming ? 'Thinking…' : subtitle}
                            </p>
                        </div>
                    </div>
                </div>

                {messages.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="group flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 text-[11px] font-medium text-muted transition-colors hover:border-accent/40 hover:bg-accent/[0.06] hover:text-ink dark:border-line/30 sm:px-3 sm:text-[11.5px]"
                        title="Start new conversation"
                    >
                        <RotateCcw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-180" />
                        <span className="hidden sm:inline">New</span>
                    </button>
                )}
            </header>

            <div className="relative min-h-0 flex-1">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto overscroll-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {showEmpty ? (
                        <EmptyState onPromptSelect={submitMessage} />
                    ) : (
                        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-3 py-5 sm:px-6 sm:py-7">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, idx) => {
                                    const prev = messages[idx - 1];
                                    const showDivider = !prev || !isSameDay(prev.createdAt, msg.createdAt);
                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDivider && <DateDivider dateStr={msg.createdAt} />}
                                            <div className="py-1.5">
                                                <ChatBubble
                                                    message={msg}
                                                    isStreaming={isStreaming && streamingId === msg.id}
                                                />
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </AnimatePresence>
                            <div ref={bottomRef} className="h-1" />
                        </div>
                    )}
                </div>

                <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-paper to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-paper to-transparent" />
            </div>

            <AnimatePresence>
                {showScrollBtn && (
                    <motion.button
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        onClick={scrollToBottom}
                        className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 flex h-8 items-center gap-1.5 rounded-full border border-accent/20 bg-paper/90 px-3 text-[11px] font-medium text-ink shadow-lg shadow-accent/10 backdrop-blur transition-colors hover:bg-ink/[0.04] dark:border-line/30 sm:bottom-28"
                    >
                        <ArrowDown className="h-3.5 w-3.5" />
                        Latest
                    </motion.button>
                )}
            </AnimatePresence>

            <footer className="relative z-10 shrink-0 border-t border-line bg-paper px-2.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3 sm:pb-3">
                <div className="mx-auto w-full max-w-3xl">
                    <div
                        className={cn(
                            'relative rounded-[20px] p-[1.5px] transition-all duration-300',
                            inputFocused
                                ? 'bg-gradient-to-r from-accent via-accent/60 to-accent shadow-md shadow-accent/15'
                                : 'bg-line dark:bg-line/30'
                        )}
                    >
                        <div className="flex items-end gap-2 rounded-[18.5px] bg-paper px-2.5 py-1.5 sm:px-3 sm:py-2">
                            <textarea
                                value={input}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    const el = e.target as HTMLTextAreaElement;
                                    el.style.height = 'auto';
                                    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        submitMessage();
                                    }
                                }}
                                placeholder="Ask about SSS, PhilHealth, Pag-IBIG…"
                                rows={1}
                                disabled={isStreaming}
                                className="block w-full min-h-[36px] max-h-[160px] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[13.5px] leading-relaxed text-ink placeholder:text-muted outline-none font-rethink disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => submitMessage()}
                                disabled={isStreaming || !input.trim()}
                                className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all',
                                    input.trim() && !isStreaming
                                        ? 'bg-accent text-paper hover:bg-accent-dark active:scale-90'
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
                    </div>

                    <div className="mt-2 hidden items-center justify-between gap-3 text-[10.5px] text-muted font-rethink sm:flex">
                        <span className="truncate">
                            Airy reads live data from your payroll database.
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                            <kbd className="rounded border border-line bg-ink/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] dark:border-line/30">
                                Enter
                            </kbd>
                            <span>send</span>
                            <span className="text-muted/50">·</span>
                            <kbd className="rounded border border-line bg-ink/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] dark:border-line/30">
                                Shift + Enter
                            </kbd>
                            <span>newline</span>
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
};