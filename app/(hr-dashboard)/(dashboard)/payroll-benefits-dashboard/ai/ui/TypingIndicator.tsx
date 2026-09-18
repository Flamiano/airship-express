'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const THINKING_STEPS = [
    'Reading your question…',
    'Checking payroll records…',
    'Cross-referencing SSS, PhilHealth, Pag-IBIG…',
    'Putting the numbers together…',
];

export const TypingIndicator: React.FC = () => {
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % THINKING_STEPS.length);
        }, 1700);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-3 px-1 py-1">
            <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                <span className="absolute inset-0 rounded-full bg-accent/10 animate-ping" />
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-accent/30 bg-paper ring-1 ring-accent/15">
                    <motion.img
                        src="/images/airy-ai/run.png"
                        alt="Airy thinking"
                        animate={{
                            y: [0, -3, 0, 1, 0],
                            rotate: [-4, 4, -4],
                        }}
                        transition={{
                            duration: 0.7,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        className="h-[70%] w-[70%] object-contain"
                    />
                </div>
                <motion.span
                    animate={{ opacity: [0.5, 0.15, 0.5] }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute right-full top-1/2 mr-1 h-0.5 w-3 -translate-y-1/2 rounded-full bg-accent/40"
                />
                <motion.span
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                    className="absolute right-full top-[60%] mr-1.5 h-0.5 w-2 -translate-y-1/2 rounded-full bg-accent/30"
                />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
                <div className="relative h-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={stepIndex}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute left-0 top-0 whitespace-nowrap text-[11.5px] font-medium text-muted font-rethink sm:text-[12px]"
                        >
                            {THINKING_STEPS[stepIndex]}
                        </motion.span>
                    </AnimatePresence>
                </div>
                <div className="h-1 w-36 overflow-hidden rounded-full bg-ink/[0.06] dark:bg-ink/20 sm:w-44">
                    <motion.div
                        className="h-full w-1/3 rounded-full bg-gradient-to-r from-accent/40 via-accent to-accent/40"
                        animate={{ x: ['-100%', '220%'] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
            </div>
        </div>
    );
};