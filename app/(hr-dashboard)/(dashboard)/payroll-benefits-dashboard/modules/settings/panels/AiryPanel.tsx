'use client';

import { useState } from 'react';
import {
    Bot,
    Sparkles,
    ScanLine,
    Zap,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';

export default function AiryPanel() {
    const [open, setOpen] = useState<string | null>('scanner');

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Airy Assistant
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Configure how Airy helps with payroll, claims, and receipts.
                </p>
            </header>

            <div className="rounded-xl border border-line bg-paper dark:border-line/40">
                <Panel
                    id="scanner"
                    icon={ScanLine}
                    title="Receipt scanning"
                    description="Airy verifies claims receipts using Gemini Vision with a Groq fallback."
                    isOpen={open === 'scanner'}
                    onToggle={() => setOpen(open === 'scanner' ? null : 'scanner')}
                >
                    <div className="space-y-3">
                        <Bullet
                            tone="success"
                            title="Verdict thresholds"
                            body="Approve under 1% amount difference, review between 1% and 5%, reject over 5%. Tamper signals always reject."
                        />
                        <Bullet
                            tone="accent"
                            title="Blur warning"
                            body="Photos flagged as blurry are warned before scanning so admins can retake."
                        />
                        <Bullet
                            tone="warning"
                            title="Override"
                            body="Admins can override a rejected verdict but the override is logged on the claim."
                        />
                    </div>
                </Panel>

                <Panel
                    id="providers"
                    icon={Zap}
                    title="AI providers"
                    description="Primary and fallback models used for text and vision."
                    isOpen={open === 'providers'}
                    onToggle={() => setOpen(open === 'providers' ? null : 'providers')}
                >
                    <ul className="space-y-2">
                        <ProviderRow
                            name="Gemini"
                            model="gemini-2.5-flash"
                            role="Vision primary"
                        />
                        <ProviderRow
                            name="Groq"
                            model="qwen/qwen3.8-27b"
                            role="Vision fallback"
                        />
                        <ProviderRow
                            name="Groq"
                            model="llama-3.3-70b-versatile"
                            role="Text chat"
                        />
                        <ProviderRow
                            name="DeepSeek"
                            model="deepseek-chat"
                            role="Analysis fallback"
                        />
                    </ul>
                </Panel>

                <Panel
                    id="chatbot"
                    icon={Bot}
                    title="Chatbot"
                    description="Where Airy appears in the dashboard and how replies are styled."
                    isOpen={open === 'chatbot'}
                    onToggle={() => setOpen(open === 'chatbot' ? null : 'chatbot')}
                >
                    <ul className="space-y-2 text-[12px] text-muted font-rethink">
                        <li className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-accent" />
                            Airy replies are plain sentences, no markdown.
                        </li>
                        <li className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-accent" />
                            Payroll figures are never echoed in chat.
                        </li>
                        <li className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-accent" />
                            Bulk exports require a written data privacy approval.
                        </li>
                    </ul>
                </Panel>
            </div>
        </div>
    );
}

function Panel({
    icon: Icon,
    title,
    description,
    isOpen,
    onToggle,
    children,
}: {
    id: string;
    icon: React.ElementType;
    title: string;
    description: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border-b border-line last:border-b-0 dark:border-line/40">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-start gap-3 px-4 py-4 text-left"
            >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink font-rethink">
                        {title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted font-rethink">
                        {description}
                    </p>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                )}
            </button>

            {isOpen && (
                <div className="border-t border-line px-4 py-4 dark:border-line/40">
                    {children}
                </div>
            )}
        </div>
    );
}

function Bullet({
    tone,
    title,
    body,
}: {
    tone: 'success' | 'warning' | 'accent';
    title: string;
    body: string;
}) {
    const dot = {
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        accent: 'bg-accent',
    }[tone];

    return (
        <div className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink font-rethink">
                    {title}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted font-rethink">
                    {body}
                </p>
            </div>
        </div>
    );
}

function ProviderRow({
    name,
    model,
    role,
}: {
    name: string;
    model: string;
    role: string;
}) {
    return (
        <li className="flex items-center justify-between gap-3 rounded-lg border border-line/60 px-3 py-2 dark:border-line/30">
            <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink font-rethink">
                    {name}
                </p>
                <p className="text-[10.5px] text-muted font-mono truncate">
                    {model}
                </p>
            </div>
            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent font-rethink">
                {role}
            </span>
        </li>
    );
}