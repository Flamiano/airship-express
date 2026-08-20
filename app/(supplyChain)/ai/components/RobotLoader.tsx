// app/components/ai/components/RobotLoader.tsx

'use client';

import { motion } from 'framer-motion';

interface RobotLoaderProps {
    size?: number;
}

export function RobotLoader({ size = 80 }: RobotLoaderProps) {
    return (
        <div
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {/* Outer glow ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-2 border-pink-400/20"
                animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            {/* Spinning ring */}
            <motion.div
                className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-transparent border-b-transparent border-l-pink-300/30"
                animate={{
                    rotate: 360,
                }}
                transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* Second spinning ring (opposite direction) */}
            <motion.div
                className="absolute inset-2 rounded-full border-2 border-r-pink-400/30 border-l-transparent border-t-transparent border-b-pink-400/30"
                animate={{
                    rotate: -360,
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* Robot face placeholder */}
            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 shadow-inner">
                <span className="text-2xl animate-pulse">🤖</span>
            </div>
        </div>
    );
}