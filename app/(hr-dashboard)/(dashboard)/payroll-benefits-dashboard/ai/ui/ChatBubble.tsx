'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Copy, Check, Download } from 'lucide-react';
import { cn } from '../shared/utils';
import type { ChatMessage } from '../shared/types';
import { AiryAvatar } from './Avatar';
import { TypingIndicator } from './TypingIndicator';

interface ChatBubbleProps {
    message: ChatMessage;
    isStreaming?: boolean;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function slugifyFilename(label: string | undefined) {
    const base = label && label.length > 0 ? label : 'payslip';
    const cleaned = base.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${cleaned}.svg`;
}

function renderInline(text: string, key: number) {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|₱[\d,]+\.?\d*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith('**')) {
            parts.push(
                <strong key={`${key}-${match.index}`} className="font-semibold text-ink">
                    {token.slice(2, -2)}
                </strong>
            );
        } else if (token.startsWith('`')) {
            parts.push(
                <code
                    key={`${key}-${match.index}`}
                    className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-ink dark:bg-ink/20"
                >
                    {token.slice(1, -1)}
                </code>
            );
        } else if (token.startsWith('₱')) {
            parts.push(
                <span key={`${key}-${match.index}`} className="font-mono font-semibold text-accent">
                    {token}
                </span>
            );
        }
        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

function renderContent(content: string) {
    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = (key: string) => {
        if (listBuffer.length === 0) return;
        blocks.push(
            <ul key={key} className="my-1.5 space-y-1 pl-4">
                {listBuffer.map((item, i) => (
                    <li
                        key={i}
                        className="relative text-[13.5px] leading-relaxed text-ink/90 before:absolute before:left-[-12px] before:top-[8px] before:h-1 before:w-1 before:rounded-full before:bg-accent/70"
                    >
                        {renderInline(item, i)}
                    </li>
                ))}
            </ul>
        );
        listBuffer = [];
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        if (/^[-•*]\s+/.test(trimmed)) {
            listBuffer.push(trimmed.replace(/^[-•*]\s+/, ''));
            return;
        }

        flushList(`list-${idx}`);

        if (trimmed === '') {
            blocks.push(<div key={`space-${idx}`} className="h-2" />);
            return;
        }

        blocks.push(
            <p key={`p-${idx}`} className="text-[13.5px] leading-relaxed text-ink/90">
                {renderInline(line, idx)}
            </p>
        );
    });

    flushList('list-final');
    return blocks;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isStreaming }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { }
    };

    if (message.role === 'system') return null;

    const isEmptyStreaming = isStreaming && isAssistant && !message.content;
    const isActivelyTyping = isStreaming && isAssistant && !!message.content;
    const hasAttachments = isAssistant && message.attachments && message.attachments.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex gap-2.5 w-full', isUser && 'flex-row-reverse')}
        >
            {isAssistant ? (
                <AiryAvatar
                    size="sm"
                    showRing
                    video={isActivelyTyping}
                    status={isActivelyTyping ? 'speaking' : 'idle'}
                />
            ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper text-[10.5px] font-semibold font-bricolage">
                    You
                </div>
            )}

            <div className={cn('flex flex-col gap-1 max-w-[85%]', isUser && 'items-end')}>
                {isEmptyStreaming ? (
                    <div className="rounded-2xl rounded-tl-sm border border-line bg-gradient-to-br from-paper to-accent/[0.04] px-4 py-3 dark:border-line/30">
                        <TypingIndicator />
                    </div>
                ) : (
                    <div
                        className={cn(
                            'rounded-2xl px-4 py-2.5 border transition-colors',
                            isUser
                                ? 'bg-accent text-paper border-accent rounded-tr-sm'
                                : message.error
                                    ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40 rounded-tl-sm'
                                    : 'bg-paper border-line dark:border-line/30 rounded-tl-sm'
                        )}
                    >
                        {isUser ? (
                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
                                {message.content}
                            </p>
                        ) : (
                            <div className="space-y-0.5">{renderContent(message.content)}</div>
                        )}
                    </div>
                )}

                {hasAttachments && (
                    <div className="flex w-full flex-col gap-2 sm:w-80">
                        {message.attachments!.map((att, i) => {
                            const filename = slugifyFilename(att.label);
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm dark:border-line/30"
                                >
                                    <img
                                        src={att.url}
                                        alt={att.label || 'Generated image'}
                                        className="block w-full bg-white"
                                    />
                                    <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 dark:border-line/30">
                                        <span className="min-w-0 truncate text-[11px] font-medium text-ink font-rethink">
                                            {att.label || 'Image'}
                                        </span>

                                        <a href={att.url}
                                            download={filename}
                                            className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-medium text-paper transition-colors hover:bg-accent-dark"
                                        >
                                            <Download className="h-3 w-3" />
                                            Download
                                        </a>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {!isEmptyStreaming && (
                    <div className={cn('flex items-center gap-1.5 ml-1 mr-1', isUser && 'flex-row-reverse')}>
                        <span className="text-[10px] text-muted/70 font-rethink">
                            {formatTime(message.createdAt)}
                        </span>

                        {isAssistant && message.content && !isStreaming && (
                            <>
                                <span className="text-muted/30">·</span>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="flex items-center gap-1 text-[10px] text-muted hover:text-ink transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {message.error && isAssistant && (
                    <div className="flex items-center gap-1 ml-1 text-[10px] text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        Something went wrong
                    </div>
                )}
            </div>
        </motion.div >
    );
};