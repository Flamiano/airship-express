// app/(supplyChain)/ai/components/RobotHeader.tsx

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface RobotHeaderProps {
    size?: number;
    isThinking?: boolean;
    isResponding?: boolean;
}

export function RobotHeader({ size = 36, isThinking = false, isResponding = false }: RobotHeaderProps) {
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
        if (isResponding) return '#10b981';
        return '#ec4899';
    };

    // FIX: Define mouth paths with proper string values
    const mouthSmile = "M 43 55 Q 50 58 57 55";
    const mouthTalking1 = "M 43 55 Q 50 61 57 55";
    const mouthTalking2 = "M 43 56 Q 50 63 57 56";

    return (
        <motion.div
            className="relative flex items-center justify-center filter drop-shadow-md"
            style={{ width: size, height: size }}
            animate={{
                y: isThinking ? [0, -3, 0] : 0,
            }}
            transition={{
                duration: 1.5,
                repeat: isThinking ? Infinity : 0,
                ease: "easeInOut" as const,
            }}
        >
            <svg
                viewBox="0 0 100 100"
                className="w-full h-full overflow-visible"
            >
                <defs>
                    <linearGradient id="headGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                        <stop offset="70%" stopColor="#f1f5f9" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.98" />
                    </linearGradient>
                    <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="50%" stopColor="#f8fafc" />
                        <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Ears */}
                <rect x="7" y="38" width="10" height="20" rx="3" fill="url(#metalGradient)" stroke="#475569" strokeWidth="1" />
                <rect x="83" y="38" width="10" height="20" rx="3" fill="url(#metalGradient)" stroke="#475569" strokeWidth="1" />

                {/* Antenna */}
                <line x1="50" y1="9" x2="50" y2="20" stroke="url(#metalGradient)" strokeWidth="4" strokeLinecap="round" />

                {/* Antenna Light */}
                <motion.circle
                    cx="50"
                    cy="8"
                    r="6"
                    fill={isThinking ? '#f59e0b' : isResponding ? '#10b981' : '#ec4899'}
                    filter="url(#glow)"
                    animate={{
                        scale: isThinking ? [1, 1.25, 1] : 1,
                        opacity: isThinking ? [0.7, 1, 0.7] : 1,
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: isThinking ? Infinity : 0,
                        ease: "easeInOut" as const,
                    }}
                />
                <circle cx="48" cy="6" r="2" fill="white" opacity="0.9" />

                {/* Head Shadow */}
                <rect x="15" y="24" width="70" height="63" rx="20" fill="#94a3b8" />

                {/* Main Head */}
                <rect
                    x="15"
                    y="20"
                    width="70"
                    height="63"
                    rx="20"
                    fill="url(#headGradient)"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                />

                {/* Highlight */}
                <path
                    d="M 22 23 Q 50 21 78 23"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.9"
                />

                {/* Visor */}
                <rect
                    x="23"
                    y="27"
                    width="54"
                    height="49"
                    rx="12"
                    fill="#ffffff"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                />

                {/* Airship Logo */}
                <g transform="translate(32, 29) scale(0.18)">
                    <path
                        d="M 28 0 L 0 52 L 20 52 L 28 36 L 42 36 L 28 12 Z M 65 0 L 45 52 L 62 52 L 78 22 L 60 52 L 78 52 Z"
                        fill="#18181b"
                    />
                    <path d="M 85 0 L 105 26 L 85 52 L 102 52 L 122 26 L 102 0 Z" fill="#ec4899" />
                    <path d="M 112 0 L 132 26 L 112 52 L 129 52 L 149 26 L 129 0 Z" fill="#ec4899" />
                    <path d="M 139 0 L 159 26 L 139 52 L 156 52 L 176 26 L 156 0 Z" fill="#ec4899" />
                </g>

                {/* Eyes */}
                <motion.g
                    animate={{
                        scaleY: isBlinking ? 0.1 : 1,
                    }}
                    transition={{ duration: 0.1 }}
                    style={{ transformOrigin: '50px 45px' }}
                >
                    <ellipse
                        cx="36"
                        cy="45"
                        rx="6"
                        ry="7"
                        fill={getEyeColor()}
                        filter="url(#glow)"
                    />
                    <ellipse
                        cx="64"
                        cy="45"
                        rx="6"
                        ry="7"
                        fill={getEyeColor()}
                        filter="url(#glow)"
                    />
                    <circle cx="34" cy="43" r="1.8" fill="white" opacity="0.9" />
                    <circle cx="62" cy="43" r="1.8" fill="white" opacity="0.9" />
                </motion.g>

                {/* FIX: Mouth with proper path handling */}
                {isThinking ? (
                    <motion.circle
                        cx="50"
                        cy="56"
                        r="3.5"
                        fill="#f59e0b"
                        filter="url(#glow)"
                        animate={{ scale: [1, 0.75, 1] }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            ease: "easeInOut" as const,
                        }}
                    />
                ) : isResponding ? (
                    <motion.path
                        d={mouthTalking1}
                        stroke="#10b981"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        filter="url(#glow)"
                        animate={{
                            d: [mouthTalking1, mouthTalking2, mouthTalking1],
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            ease: "easeInOut" as const,
                        }}
                    />
                ) : (
                    <path
                        d={mouthSmile}
                        stroke="#ec4899"
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                    />
                )}

                {/* Branding */}
                <text
                    x="50"
                    y="66"
                    textAnchor="middle"
                    fill="#18181b"
                    fontSize="4"
                    fontWeight="900"
                    letterSpacing="0.8"
                    className="font-sans select-none"
                >
                    AIRSHIP
                </text>
                <text
                    x="50"
                    y="70"
                    textAnchor="middle"
                    fill="#ec4899"
                    fontSize="3"
                    fontWeight="800"
                    letterSpacing="1.2"
                    className="font-sans select-none"
                >
                    EXPRESS
                </text>

                {/* Thinking Ring */}
                {isThinking && (
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="46"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="12 10"
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "linear" as const,
                        }}
                        style={{ transformOrigin: '50px 50px' }}
                        opacity="0.8"
                    />
                )}
            </svg>
        </motion.div>
    );
}

export default RobotHeader;