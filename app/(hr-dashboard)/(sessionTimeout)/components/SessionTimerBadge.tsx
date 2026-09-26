'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Timer } from 'lucide-react';

interface SessionTimerBadgeProps {
    inactivityRemaining: number;
    absoluteRemaining: number;
    inactivityLimitSeconds: number;
    warningThresholdSeconds: number;
}

function formatTime(seconds: number): string {
    if (seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SessionTimerBadge({
    inactivityRemaining,
    absoluteRemaining,
    inactivityLimitSeconds,
    warningThresholdSeconds,
}: SessionTimerBadgeProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isWarning = inactivityRemaining <= warningThresholdSeconds;
    const isCritical = inactivityRemaining <= 10;
    const isAbsoluteCritical = absoluteRemaining <= 300;

    const inactivityColor = isCritical
        ? 'text-red-600 dark:text-red-400'
        : isWarning
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400';

    const absoluteColor = isAbsoluteCritical
        ? 'text-red-600 dark:text-red-400'
        : 'text-blue-600 dark:text-blue-400';

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-3 right-3 z-[9998] pointer-events-none"
        >
            <div
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                className="pointer-events-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-full shadow-lg px-3 py-1.5 cursor-pointer select-none"
            >
                <div className="flex items-center gap-3 text-[12px] font-medium">
                    <div className="flex items-center gap-1.5">
                        <Timer
                            size={13}
                            className={isWarning ? 'text-yellow-500' : 'text-gray-400'}
                        />
                        <span className={inactivityColor}>
                            {formatTime(inactivityRemaining)}
                        </span>
                    </div>

                    <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />

                    <div className="flex items-center gap-1.5">
                        <Clock
                            size={13}
                            className={isAbsoluteCritical ? 'text-red-500' : 'text-gray-400'}
                        />
                        <span className={absoluteColor}>
                            {formatTime(absoluteRemaining)}
                        </span>
                    </div>
                </div>

                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700 text-[10.5px] text-gray-500 dark:text-gray-400 whitespace-nowrap"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <span>Inactivity</span>
                            <span className={inactivityColor}>
                                {formatTime(inactivityRemaining)} /{' '}
                                {formatTime(inactivityLimitSeconds)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-0.5">
                            <span>Session max</span>
                            <span className={absoluteColor}>
                                {formatTime(absoluteRemaining)}
                            </span>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}