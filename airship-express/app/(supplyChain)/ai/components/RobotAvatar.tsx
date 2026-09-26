// app/components/ai/components/RobotAvatar.tsx

'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface RobotAvatarProps {
    size?: number;
    isThinking?: boolean;
    isResponding?: boolean;
    className?: string;
}

export function RobotAvatar({
    size = 32,
    isThinking = false,
    isResponding = false,
    className = ''
}: RobotAvatarProps) {
    const [isBlinking, setIsBlinking] = useState(false);

    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 150);
        }, 3000 + Math.random() * 2000);

        return () => clearInterval(blinkInterval);
    }, []);

    const getEyeColor = () => {
        if (isThinking) return '#f59e0b';
        if (isResponding) return '#34d399';
        return '#ec4899';
    };

    return (
        <motion.div
            className={`relative flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
        >
            <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
            >
                {/* Head */}
                <rect
                    x="15"
                    y="15"
                    width="70"
                    height="65"
                    rx="20"
                    fill="white"
                    stroke="#ec4899"
                    strokeWidth="2"
                />

                {/* Eyes */}
                <motion.g
                    animate={{
                        scaleY: isBlinking ? 0.1 : 1,
                    }}
                    transition={{ duration: 0.1 }}
                    style={{ transformOrigin: '50px 38px' }}
                >
                    <ellipse
                        cx="35"
                        cy="38"
                        rx="10"
                        ry="12"
                        fill={getEyeColor()}
                    />
                    <ellipse
                        cx="65"
                        cy="38"
                        rx="10"
                        ry="12"
                        fill={getEyeColor()}
                    />
                </motion.g>

                {/* Eye highlights */}
                <circle cx="32" cy="35" r="3" fill="white" opacity="0.7" />
                <circle cx="62" cy="35" r="3" fill="white" opacity="0.7" />

                {/* Mouth */}
                {isThinking ? (
                    <motion.circle
                        cx="50"
                        cy="58"
                        r="6"
                        fill="#f59e0b"
                        animate={{ scale: [1, 0.8, 1] }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            ease: "easeInOut" as const,
                            repeatType: "loop" as const,
                        }}
                    />
                ) : isResponding ? (
                    <motion.path
                        d="M 35 58 Q 50 68 65 58"
                        stroke="#34d399"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        animate={{
                            d: ['M 35 58 Q 50 68 65 58', 'M 35 60 Q 50 70 65 60']
                        }}
                        transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            ease: "easeInOut" as const,
                            repeatType: "loop" as const,
                        }}
                    />
                ) : (
                    <path
                        d="M 38 55 Q 50 48 62 55"
                        stroke="#ec4899"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                    />
                )}

                {/* Antenna */}
                <line x1="50" y1="10" x2="50" y2="15" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />

                {/* Antenna light */}
                <motion.circle
                    cx="50"
                    cy="8"
                    r="4"
                    fill={isThinking ? '#f59e0b' : '#ec4899'}
                    animate={{
                        scale: isThinking ? [1, 1.3, 1] : 1,
                    }}
                    transition={{
                        duration: 1,
                        repeat: isThinking ? Infinity : 0,
                        ease: "easeInOut" as const,
                        repeatType: isThinking ? "loop" as const : undefined,
                    }}
                />

                {/* Blush */}
                <circle cx="18" cy="50" r="5" fill="#fb7185" opacity="0.15" />
                <circle cx="82" cy="50" r="5" fill="#fb7185" opacity="0.15" />
            </svg>
        </motion.div>
    );
}