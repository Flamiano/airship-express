"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function AiryButton({
    onClick,
    thinking,
}: {
    onClick: () => void;
    thinking?: boolean;
}) {
    const [hovering, setHovering] = useState(false);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        setTilt({ x: dx * 18, y: dy * -18 });
    };

    const handleLeave = () => {
        setHovering(false);
        setTilt({ x: 0, y: 0 });
    };

    const showVideo = hovering || thinking;

    return (
        <motion.div
            initial={mounted ? { opacity: 0, scale: 0.5, y: 60 } : false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40"
            style={{ perspective: 600 }}
        >
            <motion.div
                animate={{ rotateX: tilt.y, rotateY: tilt.x }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                style={{ transformStyle: "preserve-3d" }}
            >
                <motion.button
                    ref={btnRef}
                    onClick={onClick}
                    onMouseEnter={() => setHovering(true)}
                    onMouseMove={handleMove}
                    onMouseLeave={handleLeave}
                    title="Ask Airy — your payroll co-pilot"
                    aria-label="Open Airy"
                    whileTap={{ scale: 0.9 }}
                    animate={{
                        boxShadow: thinking
                            ? [
                                "0 8px 30px rgba(229,22,126,0.35)",
                                "0 12px 40px rgba(229,22,126,0.55)",
                                "0 8px 30px rgba(229,22,126,0.35)",
                            ]
                            : "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                    transition={{
                        boxShadow: {
                            duration: 1.8,
                            repeat: thinking ? Infinity : 0,
                            ease: "easeInOut",
                        },
                    }}
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-paper border border-line"
                >
                    <AnimatePresence mode="wait">
                        {showVideo ? (
                            <motion.video
                                key="video"
                                src="/images/airy-ai/run.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                                className="h-10 w-10 object-contain rounded-full"
                            />
                        ) : (
                            <motion.img
                                key="image"
                                src="/images/airy-ai/hi.png"
                                alt="Airy"
                                initial={{ opacity: 0, scale: 0.6, rotate: 30 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.6, rotate: -30 }}
                                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                                className="h-10 w-10 object-contain"
                            />
                        )}
                    </AnimatePresence>

                    {thinking && (
                        <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-paper"
                        />
                    )}
                </motion.button>

                <motion.span
                    animate={{
                        scale: [1, 1.35, 1],
                        opacity: [0.4, 0, 0.4],
                    }}
                    transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="absolute inset-0 rounded-full bg-accent/40 pointer-events-none"
                    style={{ transform: "translateZ(-10px)" }}
                />

                <motion.span
                    animate={{
                        scale: [1, 1.6, 1],
                        opacity: [0.25, 0, 0.25],
                    }}
                    transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5,
                    }}
                    className="absolute inset-0 rounded-full bg-accent/30 pointer-events-none"
                    style={{ transform: "translateZ(-20px)" }}
                />
            </motion.div>
        </motion.div>
    );
}