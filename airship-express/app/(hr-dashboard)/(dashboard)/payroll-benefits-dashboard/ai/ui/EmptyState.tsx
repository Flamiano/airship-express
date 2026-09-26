'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    Calculator, Building2, HeartPulse, TrendingUp, Receipt, Users,
} from 'lucide-react';
import { AiryAvatar } from './Avatar';
import { cn } from '../shared/utils';

interface EmptyStateProps {
    onPromptSelect: (prompt: string) => void;
}

const STARTER_PROMPTS = [
    { icon: Calculator, label: 'Explain a payslip', prompt: 'Can you explain how net pay is computed for a ₱25,000 monthly salary?', tint: 'accent' },
    { icon: Building2, label: 'SSS contribution', prompt: 'What is the SSS employee share for a ₱30,000 monthly salary?', tint: 'sss' },
    { icon: HeartPulse, label: 'PhilHealth rates', prompt: 'How is PhilHealth premium computed for a ₱40,000 monthly salary?', tint: 'philhealth' },
    { icon: TrendingUp, label: 'Pag-IBIG rules', prompt: 'What is the maximum Pag-IBIG contribution per month?', tint: 'pagibig' },
    { icon: Receipt, label: 'Claims workflow', prompt: 'Walk me through how to approve a claim and mark it reimbursed.', tint: 'purple' },
    { icon: Users, label: 'System overview', prompt: 'How many active employees do we have right now?', tint: 'blue' },
];

const TINT_MAP: Record<string, string> = {
    accent: 'bg-accent/10 text-accent border-accent/20',
    sss: 'bg-[#eef3fe] text-[#2455c7] border-[#2455c7]/20 dark:bg-[#182241]/50 dark:text-[#6f97ff]',
    philhealth: 'bg-[#e9f8f2] text-[#0b8f6b] border-[#0b8f6b]/20 dark:bg-[#0e2b23]/50 dark:text-[#2fd6a4]',
    pagibig: 'bg-[#fbf1de] text-[#b8720e] border-[#b8720e]/20 dark:bg-[#35260f]/50 dark:text-[#f0a53d]',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400',
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
};

const STICKERS = [
    { src: '/images/airy-ai/ok.png', className: 'left-[-8px] top-0 h-8 w-8 rotate-[-8deg]', delay: 0 },
    { src: '/images/airy-ai/run.png', className: 'right-[-10px] top-5 h-9 w-9 rotate-[10deg]', delay: 0.6 },
    { src: '/images/airy-ai/location.png', className: 'left-2 bottom-[-8px] h-8 w-8 rotate-[6deg]', delay: 1.1 },
    { src: '/images/airy-ai/unbox.png', className: 'right-1 bottom-[-12px] h-8 w-8 rotate-[-6deg]', delay: 0.3 },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onPromptSelect }) => {
    return (
        <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-3 sm:py-4">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />

            <div className="relative w-full max-w-xl">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center gap-2.5 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left"
                >
                    <div className="relative shrink-0">
                        <AiryAvatar size="hero" video status="greeting" shape="rounded" showRing />
                        {STICKERS.map((sticker) => (
                            <motion.img
                                key={sticker.src}
                                src={sticker.src}
                                alt=""
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: [0, -5, 0] }}
                                transition={{
                                    opacity: { duration: 0.3, delay: sticker.delay },
                                    y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: sticker.delay },
                                }}
                                className={cn(
                                    'absolute hidden rounded-lg border border-line bg-paper object-cover p-0.5 shadow-md sm:block dark:border-line/30',
                                    sticker.className
                                )}
                            />
                        ))}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h1 className="font-bricolage text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                            Airy
                        </h1>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted font-rethink sm:text-[13.5px]">
                            Your payroll assistant. I know your SSS brackets, PhilHealth rates, Pag-IBIG tiers, and everything else in your system.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 dark:border-line/30">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-medium text-muted font-rethink">
                                    Online · Reads live data
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="mt-3 sm:mt-5"
                >
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted font-rethink">
                        Try asking
                    </p>

                    <div
                        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {STARTER_PROMPTS.map((p, i) => {
                            const Icon = p.icon;
                            return (
                                <motion.button
                                    key={p.label}
                                    initial={{ opacity: 0, x: 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + i * 0.03, duration: 0.2 }}
                                    onClick={() => onPromptSelect(p.prompt)}
                                    className="flex shrink-0 snap-start items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-left transition-all hover:border-accent/40 hover:bg-accent/[0.03] active:scale-[0.97] dark:border-line/30"
                                >
                                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', TINT_MAP[p.tint])}>
                                        <Icon className="h-2.5 w-2.5" />
                                    </span>
                                    <span className="whitespace-nowrap text-[11.5px] font-medium text-ink font-rethink">
                                        {p.label}
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};